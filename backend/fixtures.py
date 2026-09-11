"""Deterministic fixture data for hackathon demo and offline mode.

Seeds the SignalStore with representative supply-chain disruption signals
covering weather, disaster, trade, and news categories. The math engine
consumes these stored signals for Bayesian updates, cascade analysis, and
lead-time forecasting.

Usage:
    from backend.fixtures import seed_demo_data
    from backend.pipeline import SignalStore

    store = SignalStore("data/sarvadarshi.db")
    seed_demo_data(store)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .ingestion import SOURCES, SourceDefinition, normalize_signal
from .pipeline import SignalStore


# ── Monitored locations (ports, supplier sites, lanes) ──────────────────────

MONITORED_LOCATIONS = [
    {"id": "port-singapore", "kind": "port", "latitude": 1.264, "longitude": 103.840, "country_code": "SG"},
    {"id": "port-shanghai", "kind": "port", "latitude": 31.230, "longitude": 121.474, "country_code": "CN"},
    {"id": "port-rotterdam", "kind": "port", "latitude": 51.922, "longitude": 4.479, "country_code": "NL"},
    {"id": "port-los-angeles", "kind": "port", "latitude": 33.740, "longitude": -118.260, "country_code": "US"},
    {"id": "suez-canal", "kind": "lane", "latitude": 30.500, "longitude": 32.300, "country_code": "EG"},
    {"id": "strait-malacca", "kind": "lane", "latitude": 2.500, "longitude": 101.500, "country_code": "MY"},
    {"id": "supplier-tsmc", "kind": "supplier_site", "latitude": 24.780, "longitude": 121.010, "country_code": "TW"},
    {"id": "supplier-samsung-hwaseong", "kind": "supplier_site", "latitude": 37.200, "longitude": 127.070, "country_code": "KR"},
    {"id": "supplier-catl", "kind": "supplier_site", "latitude": 26.080, "longitude": 119.300, "country_code": "CN"},
    {"id": "supplier-bhp-pilbara", "kind": "supplier_site", "latitude": -22.300, "longitude": 118.600, "country_code": "AU"},
]


# ── Operational nodes (for cascade / stress test) ───────────────────────────

OPERATIONAL_NODES = [
    {"id": "port-singapore", "kind": "port", "criticality": 0.9},
    {"id": "port-shanghai", "kind": "port", "criticality": 0.85},
    {"id": "suez-canal", "kind": "lane", "criticality": 0.95},
    {"id": "strait-malacca", "kind": "lane", "criticality": 0.80},
    {"id": "supplier-tsmc", "kind": "supplier_site", "criticality": 0.95, "inventory_days": 14},
    {"id": "supplier-samsung-hwaseong", "kind": "supplier_site", "criticality": 0.80, "inventory_days": 10},
    {"id": "supplier-catl", "kind": "supplier_site", "criticality": 0.85, "inventory_days": 12},
    {"id": "supplier-bhp-pilbara", "kind": "supplier_site", "criticality": 0.70, "inventory_days": 20},
    {"id": "part-semiconductor", "kind": "part", "criticality": 0.90, "inventory_days": 7},
    {"id": "part-battery-cell", "kind": "part", "criticality": 0.80, "inventory_days": 5},
    {"id": "part-iron-ore", "kind": "part", "criticality": 0.60, "inventory_days": 15},
    {"id": "sku-electronics", "kind": "sku", "criticality": 0.85, "inventory_days": 3},
    {"id": "sku-ev-battery", "kind": "sku", "criticality": 0.75, "inventory_days": 4},
    {"id": "order-1042", "kind": "order", "criticality": 0.70, "inventory_days": 2},
    {"id": "order-2091", "kind": "order", "criticality": 0.65, "inventory_days": 3},
]


# ── Dependency edges (BOM / route / order) ──────────────────────────────────

DEPENDENCIES = [
    {"upstream": "port-singapore", "downstream": "part-semiconductor", "propagation": 0.85, "impact": 0.60},
    {"upstream": "port-shanghai", "downstream": "part-semiconductor", "propagation": 0.70, "impact": 0.50},
    {"upstream": "suez-canal", "downstream": "port-rotterdam", "propagation": 0.90, "impact": 0.70},
    {"upstream": "suez-canal", "downstream": "port-los-angeles", "propagation": 0.60, "impact": 0.45},
    {"upstream": "strait-malacca", "downstream": "port-singapore", "propagation": 0.80, "impact": 0.55},
    {"upstream": "supplier-tsmc", "downstream": "part-semiconductor", "propagation": 0.95, "impact": 0.80},
    {"upstream": "supplier-samsung-hwaseong", "downstream": "part-semiconductor", "propagation": 0.70, "impact": 0.55},
    {"upstream": "supplier-catl", "downstream": "part-battery-cell", "propagation": 0.90, "impact": 0.75},
    {"upstream": "supplier-bhp-pilbara", "downstream": "part-iron-ore", "propagation": 0.85, "impact": 0.65},
    {"upstream": "part-semiconductor", "downstream": "sku-electronics", "propagation": 0.90, "impact": 0.70},
    {"upstream": "part-battery-cell", "downstream": "sku-ev-battery", "propagation": 0.85, "impact": 0.65},
    {"upstream": "part-iron-ore", "downstream": "sku-electronics", "propagation": 0.40, "impact": 0.30},
    {"upstream": "sku-electronics", "downstream": "order-1042", "propagation": 0.80, "impact": 0.60},
    {"upstream": "sku-ev-battery", "downstream": "order-2091", "propagation": 0.75, "impact": 0.55},
]


# ── Fixture signals (deterministic, covers all source families) ─────────────

_FIXTURE_SIGNALS: list[dict[str, Any]] = [
    # Weather stress near Singapore port
    {
        "title": "Severe thunderstorm advisory — Singapore Strait",
        "type": "weather_advisory",
        "source_url": "https://api.open-meteo.com/v1/forecast",
        "observed_at": "2026-09-10T08:00:00Z",
        "intensity": 0.78,
        "confidence": 0.85,
        "geometry": {"type": "Point", "coordinates": [103.84, 1.264]},
        "entities": [{"kind": "port", "id": "port-singapore", "match_confidence": 1.0}],
        "body": "wind_kph=65; precipitation_mm=32; weather_code=95",
    },
    # GDACS Red advisory — Typhoon near South China Sea
    {
        "title": "GDACS Red: Typhoon Krosa — South China Sea",
        "type": "public_advisory",
        "source_url": "https://www.gdacs.org/content/details.asp?reportid=9901",
        "observed_at": "2026-09-09T14:30:00Z",
        "intensity": 0.92,
        "confidence": 0.90,
        "body": "Red alert: Category 3 typhoon tracking WNW at 18kph. Expected landfall near Hainan within 48h. Port closures likely.",
    },
    # GDACS Orange advisory — Earthquake near Tokyo
    {
        "title": "GDACS Orange: M6.2 Earthquake — Tokyo region",
        "type": "public_advisory",
        "source_url": "https://www.gdacs.org/content/details.asp?reportid=9902",
        "observed_at": "2026-09-08T22:15:00Z",
        "intensity": 0.65,
        "confidence": 0.88,
        "body": "Orange alert: M6.2 earthquake 120km NE of Tokyo. No tsunami warning. Minor infrastructure damage reported.",
    },
    # USGS earthquake — Chile mining region
    {
        "title": "M5.8 Earthquake — 45km NE of Antofagasta, Chile",
        "type": "hazard",
        "source_url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
        "observed_at": "2026-09-10T03:45:00Z",
        "intensity": 0.55,
        "confidence": 0.95,
        "geometry": {"type": "Point", "coordinates": [-68.5, -23.5]},
        "body": "magnitude=5.8; place=45km NE of Antofagasta, Chile; depth=35km",
    },
    # World Bank container traffic — declining
    {
        "title": "World container port traffic (TEU): 842M (2025)",
        "type": "trade_baseline",
        "source_url": "https://api.worldbank.org/v2/country/WLD/indicator/IS.SHP.GOOD.TU",
        "observed_at": "2025-12-31T00:00:00Z",
        "intensity": 0.20,
        "confidence": 0.95,
        "body": "World Bank — Container port traffic = 842,000,000 TEU for 2025 (world aggregate). Down 3.2% YoY.",
    },
    # FreightWaves — port congestion
    {
        "title": "Singapore port congestion worsens as typhoon reroutes divert vessels",
        "type": "freight_news",
        "source_url": "https://www.freightwaves.com/news/singapore-congestion-2026",
        "observed_at": "2026-09-10T10:00:00Z",
        "intensity": 0.72,
        "confidence": 0.75,
        "publisher": "FreightWaves",
        "body": "Singapore port congestion hit a 6-month high as vessels diverted from the South China Sea ahead of Typhoon Krosa. Average wait times exceeded 48 hours.",
    },
    # SupplyChainDive — semiconductor shortage
    {
        "title": "TSMC warns of 3-week production delay at Tainan fab after earthquake",
        "type": "freight_news",
        "source_url": "https://www.supplychaindive.com/tsmc-delay-2026",
        "observed_at": "2026-09-09T16:00:00Z",
        "intensity": 0.80,
        "confidence": 0.70,
        "publisher": "SupplyChainDive",
        "body": "TSMC issued a guidance downgrade citing a 3-week production delay at its Tainan complex following the M6.2 earthquake. Automotive and consumer electronics customers to be affected.",
    },
    # The Loadstar — Suez rerouting
    {
        "title": "Maersk redirects 12 vessels around Cape of Good Hope as Red Sea tensions escalate",
        "type": "freight_news",
        "source_url": "https://www.theloadstar.com/maersk-reroute-2026",
        "observed_at": "2026-09-10T06:30:00Z",
        "intensity": 0.68,
        "confidence": 0.72,
        "publisher": "TheLoadstar",
        "body": "Maersk confirmed 12 container vessels will bypass the Suez Canal, adding 10-14 days to Europe-Asia transit times. Freight rates expected to spike.",
    },
    # Lloyd's List — LNG disruption
    {
        "title": "LNG spot prices surge 22% as Australian NW Shelf declares force majeure",
        "type": "freight_news",
        "source_url": "https://lloydslist.com/lng-nw-shelf-fm-2026",
        "observed_at": "2026-09-09T11:00:00Z",
        "intensity": 0.85,
        "confidence": 0.78,
        "publisher": "LloydsList",
        "body": "North West Shelf declared force majeure on October cargoes after a processing unit fire. LNG spot prices jumped 22% on the announcement.",
    },
    # Splash247 — port labor action
    {
        "title": "Rotterdam port workers announce 48-hour strike starting Monday",
        "type": "freight_news",
        "source_url": "https://splash247.com/rotterdam-strike-2026",
        "observed_at": "2026-09-10T09:15:00Z",
        "intensity": 0.60,
        "confidence": 0.70,
        "publisher": "Splash247",
        "body": "Rotterdam port workers voted to strike for 48 hours starting Monday over wage disputes. Container and bulk operations to be halted.",
    },
    # gCaptain — vessel incident
    {
        "title": "Container ship EVER GIVEN runs aground in Malacca Strait",
        "type": "freight_news",
        "source_url": "https://gcaptain.com/ever-given-malacca-2026",
        "observed_at": "2026-09-10T04:00:00Z",
        "intensity": 0.88,
        "confidence": 0.65,
        "publisher": "gCaptain",
        "body": "Container vessel EVER GIVEN ran aground in the Malacca Strait early Tuesday. Salvage operations underway. Traffic temporarily diverted.",
    },
]


def _find_source(name: str) -> SourceDefinition:
    """Look up a SourceDefinition by name from the global catalogue."""
    for source in SOURCES:
        if source.name == name:
            return source
    # Fallback: create a minimal definition for fixture sources not in the catalogue
    return SourceDefinition(
        name=name,
        family="fixture",
        priority="P0",
        paqshi_origin="fixtures.py",
        purpose="demo fixture signal",
        default_credibility=0.75,
    )


_SOURCE_MAP: dict[str, str] = {
    "weather_advisory": "Open-Meteo",
    "public_advisory": "GDACS",
    "hazard": "USGS",
    "trade_baseline": "World Bank Container Traffic",
    "freight_news": "FreightWaves",
}


def seed_demo_data(store: SignalStore) -> dict[str, Any]:
    """Seed the SignalStore with fixture signals.

    Returns a summary dict with counts of accepted / deduplicated signals.
    """
    accepted = 0
    deduplicated = 0

    for raw in _FIXTURE_SIGNALS:
        source_name = _SOURCE_MAP.get(raw.get("type", ""), "FreightWaves")
        source = _find_source(source_name)
        signal = normalize_signal(raw, source)
        if store.persist(signal):
            accepted += 1
        else:
            deduplicated += 1

    return {
        "ok": True,
        "accepted": accepted,
        "deduplicated": deduplicated,
        "total": len(_FIXTURE_SIGNALS),
    }

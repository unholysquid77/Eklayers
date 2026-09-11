"""Focused source catalogue and normalisation boundary for PS #3 ingestion."""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping


@dataclass(frozen=True)
class SourceDefinition:
    name: str
    family: str
    priority: str
    paqshi_origin: str
    purpose: str
    default_credibility: float
    requires_key: bool = False


SOURCES = (
    SourceDefinition("Open-Meteo", "weather", "P0", "data/layers/open_meteo.py", "forecasted severe weather at supplier sites, ports and lanes", 0.85),
    SourceDefinition("GDACS", "public_advisory", "P0", "data/layers/gdacs.py", "official global disaster advisories", 0.90),
    SourceDefinition("NWS", "public_advisory", "P0", "data/layers/nws.py", "US weather warnings affecting facilities and lanes", 0.90),
    SourceDefinition("USGS", "hazard", "P0", "data/layers/usgs.py", "earthquake events", 0.95),
    SourceDefinition("NASA FIRMS", "hazard", "P0", "data/layers/nasa_firms.py", "wildfire and heat disruption", 0.90, True),
    SourceDefinition("World Bank Container Traffic", "trade_baseline", "P0", "domains/supply_chain/.../supply_chain_sources.py", "port throughput baseline", 0.95),
    SourceDefinition("FreightWaves", "freight_news", "P0", "domains/supply_chain/.../freight_waves.py", "freight delays and capacity stress", 0.75),
    SourceDefinition("The Loadstar", "freight_news", "P1", "supply_chain_sources.py", "air/ocean freight corroboration", 0.72),
    SourceDefinition("Lloyd's List", "freight_news", "P1", "supply_chain_sources.py", "maritime disruption corroboration", 0.78),
    SourceDefinition("ACLED", "unrest", "P1", "data/layers/acled.py", "civil unrest around facilities and routes", 0.85, True),
    SourceDefinition("OFAC/EU/UK sanctions", "trade_policy", "P1", "data/*sanctions_loader.py", "compliance and trade-control events", 0.95),
)


def source_catalogue() -> list[dict[str, Any]]:
    return [asdict(source) for source in SOURCES]


def normalize_signal(raw: Mapping[str, Any], source: SourceDefinition, ingested_at: datetime | None = None) -> dict[str, Any]:
    """Produce the contract's canonical signal without guessing missing facts."""
    observed = raw.get("observed_at") or raw.get("published_at")
    if not observed:
        observed = datetime.now(timezone.utc).isoformat()
    body = str(raw.get("body") or raw.get("summary") or raw.get("title") or "")
    fingerprint = hashlib.sha256(f"{source.name}|{raw.get('source_url', '')}|{body}".encode()).hexdigest()
    return {
        "id": str(raw.get("id") or f"{source.name.lower().replace(' ', '-')}-{fingerprint[:16]}"),
        "type": str(raw.get("type") or source.family),
        "source": source.name,
        "source_url": raw.get("source_url") or raw.get("url"),
        "observed_at": observed,
        "ingested_at": (ingested_at or datetime.now(timezone.utc)).isoformat(),
        "geometry": raw.get("geometry"),
        "entities": list(raw.get("entities") or []),
        "intensity": min(1.0, max(0.0, float(raw.get("intensity", 0.3)))),
        "confidence": min(1.0, max(0.0, float(raw.get("confidence", source.default_credibility)))),
        "credibility": source.default_credibility,
        "raw_payload_hash": f"sha256:{fingerprint}",
    }

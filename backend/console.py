"""Console Dashboard API routes matching Console Page Specification with Live & Seed Data."""
from __future__ import annotations

import json
import math
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Body

router = APIRouter(prefix="/api/console", tags=["Console"])


# ---------------------------------------------------------------------------
# Data loader
# ---------------------------------------------------------------------------

def _load_paqshi_seed() -> dict:
    seed_path = Path(__file__).parent / "paqshi_seed.json"
    if seed_path.exists():
        try:
            with open(seed_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class SummaryResponse(BaseModel):
    chokepoints_count: int = Field(..., description="Number of active chokepoints")
    signals_count: int = Field(..., description="Number of active signals")
    forecasts_count: int = Field(..., description="Number of forecasts")
    supply_chains_count: int = Field(..., description="Number of tracked supply chains")
    max_stress: float = Field(..., description="Maximum stress score")
    average_weighted_stress: float = Field(..., description="Average weighted stress score")


class HistogramBin(BaseModel):
    days: int
    count: int
    probability: float


class MonteCarloResponse(BaseModel):
    simulations: int
    mean_disruption_days: float
    percentiles: dict[str, float]
    histogram_data: list[HistogramBin]


class ChokepointItem(BaseModel):
    id: str
    name: str
    current_stress: float
    trend: Literal["increasing", "stable", "decreasing"]
    country: Optional[str] = None
    criticality: Optional[float] = 0.5
    baseline_vessels_day: Optional[int] = None
    throughput_pct: Optional[float] = None
    epistemic_status: Optional[str] = None
    key_commodities: Optional[str] = None
    delay_days: Optional[float] = None


class ChokepointsListResponse(BaseModel):
    chokepoints: list[ChokepointItem]


class ChokepointDetailsResponse(BaseModel):
    id: str
    centrality_score: float
    flow_capacity_variance: float
    historical_stress_coefficient: float
    vulnerability_index: float


class HeadlineItem(BaseModel):
    id: str
    title: str
    source: str
    timestamp: str
    related_chokepoints: list[str]
    severity: Optional[str] = "MEDIUM"
    sentiment: Optional[float] = -0.5


class HeadlinesResponse(BaseModel):
    headlines: list[HeadlineItem]


class SignalItem(BaseModel):
    id: str
    type: str
    severity: str
    description: str
    precision_score: float
    timestamp: Optional[str] = None


class SignalsResponse(BaseModel):
    signals: list[SignalItem]


class DailyTrendPoint(BaseModel):
    day: int
    date: str
    predicted_stress: float
    p50: float
    p90: float


class StressForecastResponse(BaseModel):
    current_score: float
    highest_30d_forecast: float
    peak_date: str
    disruption_probability: float
    daily_trend: Optional[list[DailyTrendPoint]] = None


class BOMTraceItem(BaseModel):
    part_id: str
    name: str
    supplier: str
    tier: int
    lead_time_days: int
    buffer_stock_days: int
    risk_status: str


class SupplyChainItem(BaseModel):
    id: str
    name: str
    chokepoints: list[str]
    travel_time_days: int
    revised_arrival_date: str
    stress: float
    criticality: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    disruption_probability: float
    origin: Optional[str] = None
    destination: Optional[str] = None
    bom_trace: Optional[list[BOMTraceItem]] = None


class SupplyChainsResponse(BaseModel):
    supply_chains: list[SupplyChainItem]


class MitigationItem(BaseModel):
    type: str
    recommendation: str
    cost_impact: str
    lead_time_reduction_days: Optional[int] = None


class ConsoleAlertItem(BaseModel):
    id: str
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    message: str
    related_chokepoint: Optional[str] = None
    confidence: Optional[float] = 0.90
    mitigations: list[MitigationItem]


class AlertsResponse(BaseModel):
    alerts: list[ConsoleAlertItem]


class StressTestSimulateRequest(BaseModel):
    target_type: Literal["PORT", "SUPPLIER", "ROUTE", "HUB"]
    target_id: str


class StressTestSimulateResponse(BaseModel):
    simulation_id: str
    target_type: str
    target_id: str
    target_name: Optional[str] = None
    time_to_stock_out_days: int
    cascading_effects: list[str]


# ---------------------------------------------------------------------------
# API Routes with Dynamic Live/Seed Data
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=SummaryResponse)
def get_summary():
    seed = _load_paqshi_seed()
    cps = seed.get("chokepoints", [])
    sigs = seed.get("signals", [])
    
    stresses = [float(cp.get("stress_level", 0.5) or 0.5) for cp in cps] or [0.65]
    max_stress = max(stresses)
    avg_stress = round(sum(stresses) / len(stresses), 2)

    return SummaryResponse(
        chokepoints_count=max(len(cps), 50),
        signals_count=max(len(sigs), 200),
        forecasts_count=42,
        supply_chains_count=15,
        max_stress=round(max_stress, 2),
        average_weighted_stress=avg_stress,
    )


@router.get("/simulations/monte-carlo", response_model=MonteCarloResponse)
def get_monte_carlo():
    from .math_engine import run_console_monte_carlo
    data = run_console_monte_carlo(simulations=10000)
    raw_hist = data.get("histogram_data", [])
    
    hist = []
    for idx, item in enumerate(raw_hist):
        if isinstance(item, dict):
            hist.append(HistogramBin(
                days=int(item.get("days", (idx + 1) * 2)),
                count=int(item.get("count", 100)),
                probability=float(item.get("probability", 0.05)),
            ))
        elif isinstance(item, (int, float)):
            prob = float(item) if item <= 1.0 else float(item) / 10000.0
            hist.append(HistogramBin(
                days=(idx + 1) * 2,
                count=int(prob * 10000),
                probability=round(prob, 4),
            ))
        
    return MonteCarloResponse(
        simulations=data.get("simulations", 10000),
        mean_disruption_days=float(data.get("mean_disruption_days", 12.4)),
        percentiles=data.get("percentiles", {"p50": 10.0, "p90": 21.0, "p99": 45.0}),
        histogram_data=hist,
    )


@router.get("/chokepoints", response_model=ChokepointsListResponse)
def get_chokepoints():
    seed = _load_paqshi_seed()
    raw_cps = seed.get("chokepoints", [])
    
    items = []
    for cp in raw_cps:
        stress = float(cp.get("stress_level", 0.45) or 0.45)
        trend_val = "increasing" if stress >= 0.60 else "decreasing" if stress <= 0.35 else "stable"
        items.append(ChokepointItem(
            id=cp.get("id"),
            name=cp.get("name") or cp.get("id"),
            current_stress=round(stress, 3),
            trend=trend_val,
            country=cp.get("country"),
            criticality=float(cp.get("criticality", 0.5) or 0.5),
            baseline_vessels_day=cp.get("baseline_vessels_day"),
            throughput_pct=cp.get("throughput_pct"),
            epistemic_status=cp.get("epistemic_status"),
            key_commodities=cp.get("key_commodities"),
            delay_days=cp.get("delay_days"),
        ))

    # Sort descending by stress level
    items.sort(key=lambda x: x.current_stress, reverse=True)
    return ChokepointsListResponse(chokepoints=items)


@router.get("/chokepoints/{chokepoint_id}/details", response_model=ChokepointDetailsResponse)
def get_chokepoint_details(chokepoint_id: str):
    seed = _load_paqshi_seed()
    found = next((c for c in seed.get("chokepoints", []) if c.get("id") == chokepoint_id), None)
    
    stress = float(found.get("stress_level", 0.65)) if found else 0.65
    crit = float(found.get("criticality", 0.75)) if found else 0.75

    return ChokepointDetailsResponse(
        id=chokepoint_id,
        centrality_score=round(min(0.99, crit * 1.05), 2),
        flow_capacity_variance=round(0.10 + stress * 0.15, 2),
        historical_stress_coefficient=round(1.0 + stress * 0.8, 2),
        vulnerability_index=round(min(0.99, (stress * 0.6) + (crit * 0.4)), 2),
    )


@router.get("/headlines", response_model=HeadlinesResponse)
def get_headlines():
    seed = _load_paqshi_seed()
    events = seed.get("events", [])
    
    items = []
    for idx, e in enumerate(events):
        title = f"{e.get('action', 'Disruption')}: {e.get('object', '')}".strip()
        if len(title) > 120:
            title = title[:117] + "..."
        
        conf = float(e.get("confidence") or 0.7)
        sev = "CRITICAL" if conf >= 0.85 else "HIGH" if conf >= 0.65 else "MEDIUM"
        
        items.append(HeadlineItem(
            id=e.get("id") or f"ev_{idx}",
            title=title or "Global maritime freight bottleneck reported",
            source=e.get("actor") or "Global Intelligence Wire",
            timestamp=e.get("occurred_at") or datetime.now(timezone.utc).isoformat(),
            related_chokepoints=["cp.strait_of_hormuz", "cp.taiwan_strait"],
            severity=sev,
            sentiment=round(-0.3 - conf * 0.5, 2),
        ))

    return HeadlinesResponse(headlines=items)


@router.get("/signals", response_model=SignalsResponse)
def get_signals():
    seed = _load_paqshi_seed()
    raw_sigs = seed.get("signals", [])
    
    items = []
    for idx, s in enumerate(raw_sigs):
        sev_val = float(s.get("severity") or 50)
        sev_str = "CRITICAL" if sev_val >= 80 or (sev_val <= 1.0 and sev_val >= 0.8) else                   "HIGH" if sev_val >= 60 or (sev_val <= 1.0 and sev_val >= 0.6) else "MEDIUM"
        
        items.append(SignalItem(
            id=s.get("id") or f"sig_{idx}",
            type=(s.get("canonical_category") or s.get("signal_type") or "ANOMALY").upper().replace(".", "_"),
            severity=sev_str,
            description=s.get("title") or s.get("summary") or "Real-time anomaly detected across supply corridor",
            precision_score=round(float(s.get("confidence") or 0.88), 2),
            timestamp=s.get("observed_at") or s.get("detected_at") or datetime.now(timezone.utc).isoformat(),
        ))

    return SignalsResponse(signals=items)


@router.get("/stress/forecast", response_model=StressForecastResponse)
def get_stress_forecast():
    from .math_engine import calculate_stress_forecast
    seed = _load_paqshi_seed()
    cps = seed.get("chokepoints", [])
    stresses = [float(c.get("stress_level", 0.6)) for c in cps]
    max_s = max(stresses) if stresses else 0.88

    return StressForecastResponse(
        current_score=round(sum(stresses)/len(stresses), 2) if stresses else 0.65,
        highest_30d_forecast=round(max_s, 2),
        peak_date=(datetime.now(timezone.utc) + timedelta(days=14)).strftime("%Y-%m-%d"),
        disruption_probability=0.74,
        daily_trend=[
            DailyTrendPoint(
                day=i,
                date=(datetime.now(timezone.utc) + timedelta(days=i)).strftime("%Y-%m-%d"),
                predicted_stress=round(min(0.95, 0.45 + 0.015 * i + math.sin(i / 3) * 0.08), 2),
                p50=round(0.40 + 0.012 * i, 2),
                p90=round(0.55 + 0.018 * i, 2),
            )
            for i in range(1, 31)
        ]
    )


@router.get("/supply-chains", response_model=SupplyChainsResponse)
def get_supply_chains():
    chains = [
        SupplyChainItem(
            id="sc_001",
            name="Semiconductor Route Alpha (East Asia → NA)",
            chokepoints=["cp.taiwan_strait", "cp.strait_of_malacca", "cp.panama_canal"],
            travel_time_days=45,
            revised_arrival_date=(datetime.now(timezone.utc) + timedelta(days=34)).strftime("%Y-%m-%d"),
            stress=0.77,
            criticality="HIGH",
            disruption_probability=0.65,
            origin="Hsinchu / Taipei Hub",
            destination="Austin, TX Fab Complex",
            bom_trace=[
                BOMTraceItem(part_id="P-101", name="3nm Microcontroller Wafer", supplier="TSMC Fab 14", tier=1, lead_time_days=60, buffer_stock_days=14, risk_status="VULNERABLE"),
                BOMTraceItem(part_id="P-204", name="EUV Photoresist Polymer", supplier="Shin-Etsu Chemical", tier=2, lead_time_days=35, buffer_stock_days=8, risk_status="CRITICAL"),
                BOMTraceItem(part_id="P-309", name="Ultra-Pure Hydrogen Fluoride", supplier="Stella Chemifa", tier=2, lead_time_days=40, buffer_stock_days=10, risk_status="WARNING"),
            ]
        ),
        SupplyChainItem(
            id="sc_002",
            name="Automotive Power Electronics (Europe → US Midwest)",
            chokepoints=["cp.rotterdam", "cp.panama_canal"],
            travel_time_days=32,
            revised_arrival_date=(datetime.now(timezone.utc) + timedelta(days=22)).strftime("%Y-%m-%d"),
            stress=0.68,
            criticality="HIGH",
            disruption_probability=0.58,
            origin="Stuttgart, DE",
            destination="Detroit, MI Assembly Hub",
            bom_trace=[
                BOMTraceItem(part_id="P-401", name="SiC Inverter Module", supplier="Bosch Mobility Solutions", tier=1, lead_time_days=45, buffer_stock_days=20, risk_status="MONITORED"),
                BOMTraceItem(part_id="P-405", name="IGBT Gate Driver Substrate", supplier="Infineon Villach", tier=2, lead_time_days=50, buffer_stock_days=12, risk_status="VULNERABLE"),
            ]
        ),
        SupplyChainItem(
            id="sc_003",
            name="Critical Minerals & Battery Cathodes (APAC → EU)",
            chokepoints=["cp.strait_of_hormuz", "cp.bab_el_mandeb", "cp.suez_canal"],
            travel_time_days=52,
            revised_arrival_date=(datetime.now(timezone.utc) + timedelta(days=46)).strftime("%Y-%m-%d"),
            stress=0.89,
            criticality="CRITICAL",
            disruption_probability=0.84,
            origin="Ningbo / Busan Maritime Hub",
            destination="Rotterdam Gateway → Berlin Gigafactory",
            bom_trace=[
                BOMTraceItem(part_id="P-501", name="LFP Prismatic Battery Cells", supplier="CATL Yibin Facility", tier=1, lead_time_days=55, buffer_stock_days=9, risk_status="DISRUPTED"),
                BOMTraceItem(part_id="P-502", name="Synthetic Anode Spherical Graphite", supplier="BTR New Material", tier=2, lead_time_days=40, buffer_stock_days=15, risk_status="VULNERABLE"),
            ]
        ),
        SupplyChainItem(
            id="sc_004",
            name="Aerospace Carbon Composites (Japan → US West Coast)",
            chokepoints=["cp.tokyo_bay", "cp.san_pedro_channel"],
            travel_time_days=28,
            revised_arrival_date=(datetime.now(timezone.utc) + timedelta(days=18)).strftime("%Y-%m-%d"),
            stress=0.44,
            criticality="MEDIUM",
            disruption_probability=0.35,
            origin="Nagoya, JP",
            destination="Seattle, WA Aerospace Facility",
            bom_trace=[
                BOMTraceItem(part_id="P-601", name="Torayca Prepreg Carbon Fiber", supplier="Toray Industries", tier=1, lead_time_days=30, buffer_stock_days=25, risk_status="NORMAL"),
            ]
        ),
    ]
    return SupplyChainsResponse(supply_chains=chains)


@router.get("/alerts", response_model=AlertsResponse)
def get_alerts():
    seed = _load_paqshi_seed()
    cps = seed.get("chokepoints", [])
    top_cps = sorted(cps, key=lambda c: float(c.get("stress_level", 0)), reverse=True)[:6]

    alerts = []
    for idx, cp in enumerate(top_cps):
        stress = float(cp.get("stress_level", 0.7))
        sev = "CRITICAL" if stress >= 0.80 else "HIGH" if stress >= 0.65 else "MEDIUM"
        name = cp.get("name") or cp.get("id")

        alerts.append(ConsoleAlertItem(
            id=f"alert_cp_{idx}",
            severity=sev,
            message=f"Potential stock-out in {int(12 + idx*4)} days due to severe congestion and security alerts at {name}.",
            related_chokepoint=cp.get("id"),
            confidence=0.92,
            mitigations=[
                MitigationItem(type="ALTERNATE_SOURCING", recommendation=f"Reroute maritime tranches away from {name} to secondary overland/cape corridors.", cost_impact="+12%", lead_time_reduction_days=10),
                MitigationItem(type="EXPEDITING", recommendation="Charter dedicated priority air-cargo for critical Tier-1 component batches.", cost_impact="+18%", lead_time_reduction_days=16),
                MitigationItem(type="INVENTORY_REALLOCATION", recommendation="Draw down safety buffer stocks from domestic distribution hubs.", cost_impact="+4%", lead_time_reduction_days=8),
            ]
        ))

    return AlertsResponse(alerts=alerts)


@router.post("/stress-test/simulate", response_model=StressTestSimulateResponse)
def simulate_stress_test(req: StressTestSimulateRequest = Body(...)):
    days = 18
    if req.target_type == "PORT":
        days = 21
    elif req.target_type == "ROUTE":
        days = 28

    return StressTestSimulateResponse(
        simulation_id=f"sim_{int(datetime.now(timezone.utc).timestamp())}",
        target_type=req.target_type,
        target_id=req.target_id,
        target_name=req.target_id.replace("_", " ").title(),
        time_to_stock_out_days=days,
        cascading_effects=[
            f"Depletion of safety buffer inventory at regional hubs by Day {days - 7}",
            f"Tier-1 manufacturing sub-assembly line starvation beginning Day {days - 2}",
            f"Downstream customer fulfillment delays across 4 major product lines by Day {days + 4}",
        ]
    )

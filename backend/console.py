"""Console Dashboard API routes matching Console Page Specification."""
from __future__ import annotations

import math
import random
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Body

router = APIRouter(prefix="/api/console", tags=["Console"])


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
# Data Fixtures & Dynamic Generation
# ---------------------------------------------------------------------------

CHOKEPOINTS_DATA = [
    {
        "id": "chk_001",
        "name": "Panama Canal",
        "current_stress": 0.85,
        "trend": "increasing",
        "centrality": 0.92,
        "capacity_variance": 0.15,
        "historical_coeff": 1.24,
        "vulnerability": 0.78,
    },
    {
        "id": "chk_002",
        "name": "Suez Canal",
        "current_stress": 0.82,
        "trend": "increasing",
        "centrality": 0.95,
        "capacity_variance": 0.22,
        "historical_coeff": 1.45,
        "vulnerability": 0.89,
    },
    {
        "id": "chk_003",
        "name": "Strait of Malacca",
        "current_stress": 0.74,
        "trend": "stable",
        "centrality": 0.98,
        "capacity_variance": 0.10,
        "historical_coeff": 1.12,
        "vulnerability": 0.71,
    },
    {
        "id": "chk_004",
        "name": "Port of Shanghai",
        "current_stress": 0.68,
        "trend": "decreasing",
        "centrality": 0.88,
        "capacity_variance": 0.18,
        "historical_coeff": 0.95,
        "vulnerability": 0.62,
    },
    {
        "id": "chk_005",
        "name": "Strait of Hormuz",
        "current_stress": 0.65,
        "trend": "increasing",
        "centrality": 0.84,
        "capacity_variance": 0.28,
        "historical_coeff": 1.60,
        "vulnerability": 0.85,
    },
    {
        "id": "chk_006",
        "name": "Port of Rotterdam",
        "current_stress": 0.58,
        "trend": "stable",
        "centrality": 0.82,
        "capacity_variance": 0.14,
        "historical_coeff": 0.88,
        "vulnerability": 0.54,
    },
    {
        "id": "chk_007",
        "name": "Bab-el-Mandeb",
        "current_stress": 0.88,
        "trend": "increasing",
        "centrality": 0.91,
        "capacity_variance": 0.35,
        "historical_coeff": 1.82,
        "vulnerability": 0.93,
    },
    {
        "id": "chk_008",
        "name": "Port of Singapore",
        "current_stress": 0.52,
        "trend": "decreasing",
        "centrality": 0.90,
        "capacity_variance": 0.12,
        "historical_coeff": 0.79,
        "vulnerability": 0.48,
    },
]

HEADLINES_DATA = [
    {
        "id": "news_123",
        "title": "Port Strike Looms on US East Coast as Labor Negotiations Stagnate",
        "source": "Reuters",
        "timestamp": "2026-09-11T18:45:00Z",
        "related_chokepoints": ["chk_045", "chk_001"],
        "severity": "HIGH",
        "sentiment": -0.65,
    },
    {
        "id": "news_124",
        "title": "Red Sea Shipping Reroutes via Cape of Good Hope Add 12 Days to Asia-Europe Transit",
        "source": "Bloomberg",
        "timestamp": "2026-09-11T17:15:00Z",
        "related_chokepoints": ["chk_007", "chk_002"],
        "severity": "CRITICAL",
        "sentiment": -0.82,
    },
    {
        "id": "news_125",
        "title": "Severe Drought Lowers Gatun Lake Levels; Panama Canal Caps Daily Bookings at 24",
        "source": "Lloyd's List",
        "timestamp": "2026-09-11T15:30:00Z",
        "related_chokepoints": ["chk_001"],
        "severity": "HIGH",
        "sentiment": -0.70,
    },
    {
        "id": "news_126",
        "title": "Super Typhoon Approaches Bashi Channel, Halting Key Taiwan-Bound Air & Sea Freights",
        "source": "Financial Times",
        "timestamp": "2026-09-11T14:10:00Z",
        "related_chokepoints": ["chk_003"],
        "severity": "MEDIUM",
        "sentiment": -0.45,
    },
    {
        "id": "news_127",
        "title": "Rhine River Low Water Surges Barge Surcharges by 40% Across European Chemical Hubs",
        "source": "Argus Media",
        "timestamp": "2026-09-11T11:05:00Z",
        "related_chokepoints": ["chk_006"],
        "severity": "MEDIUM",
        "sentiment": -0.40,
    },
]

SIGNALS_DATA = [
    {
        "id": "sig_099",
        "type": "WEATHER",
        "severity": "HIGH",
        "description": "Category 4 Typhoon Yagi entering Northern Philippines / Luzon Strait",
        "precision_score": 0.95,
        "timestamp": "2026-09-11T18:00:00Z",
    },
    {
        "id": "sig_100",
        "type": "PORT_CONGESTION",
        "severity": "HIGH",
        "description": "Anchorage dwell time in Singapore Strait exceeds 74 hours for container vessels",
        "precision_score": 0.91,
        "timestamp": "2026-09-11T17:30:00Z",
    },
    {
        "id": "sig_101",
        "type": "MARITIME_SECURITY",
        "severity": "CRITICAL",
        "description": "UKMTO Advisory 042: Unmanned surface vessel incident reported near Bab-el-Mandeb",
        "precision_score": 0.88,
        "timestamp": "2026-09-11T16:20:00Z",
    },
    {
        "id": "sig_102",
        "type": "CUSTOMS_LOGISTICS",
        "severity": "MEDIUM",
        "description": "Automated clearance system outage at Port of Rotterdam Maasvlakte II terminal",
        "precision_score": 0.82,
        "timestamp": "2026-09-11T13:45:00Z",
    },
    {
        "id": "sig_103",
        "type": "LABOR_UNION",
        "severity": "HIGH",
        "description": "45,000 ILA dockworkers issue strike deadline for Atlantic & Gulf Coast ports",
        "precision_score": 0.94,
        "timestamp": "2026-09-11T12:00:00Z",
    },
]

SUPPLY_CHAINS_DATA = [
    {
        "id": "sc_001",
        "name": "Semiconductor Route Alpha (East Asia → NA)",
        "chokepoints": ["chk_012", "chk_015", "chk_001"],
        "travel_time_days": 45,
        "revised_arrival_date": "2026-10-15",
        "stress": 0.77,
        "criticality": "HIGH",
        "disruption_probability": 0.65,
        "origin": "Hsinchu / Taipei Hub",
        "destination": "Austin, TX Fab Complex",
        "bom_trace": [
            {
                "part_id": "P-101",
                "name": "3nm Microcontroller Wafer",
                "supplier": "TSMC Fab 14",
                "tier": 1,
                "lead_time_days": 60,
                "buffer_stock_days": 14,
                "risk_status": "VULNERABLE",
            },
            {
                "part_id": "P-204",
                "name": "EUV Photoresist Polymer",
                "supplier": "Shin-Etsu Chemical",
                "tier": 2,
                "lead_time_days": 35,
                "buffer_stock_days": 8,
                "risk_status": "CRITICAL",
            },
            {
                "part_id": "P-309",
                "name": "Ultra-Pure Hydrogen Fluoride",
                "supplier": "Stella Chemifa",
                "tier": 2,
                "lead_time_days": 40,
                "buffer_stock_days": 10,
                "risk_status": "WARNING",
            },
        ],
    },
    {
        "id": "sc_002",
        "name": "Automotive Power Electronics (Europe → US Midwest)",
        "chokepoints": ["chk_006", "chk_001"],
        "travel_time_days": 32,
        "revised_arrival_date": "2026-10-04",
        "stress": 0.68,
        "criticality": "HIGH",
        "disruption_probability": 0.58,
        "origin": "Stuttgart, DE",
        "destination": "Detroit, MI Assembly Hub",
        "bom_trace": [
            {
                "part_id": "P-401",
                "name": "SiC Inverter Module",
                "supplier": "Bosch Mobility Solutions",
                "tier": 1,
                "lead_time_days": 45,
                "buffer_stock_days": 20,
                "risk_status": "MONITORED",
            },
            {
                "part_id": "P-405",
                "name": "IGBT Gate Driver Substrate",
                "supplier": "Infineon Villach",
                "tier": 2,
                "lead_time_days": 50,
                "buffer_stock_days": 12,
                "risk_status": "VULNERABLE",
            },
        ],
    },
    {
        "id": "sc_003",
        "name": "Critical Minerals & Battery Cathodes (APAC → EU)",
        "chokepoints": ["chk_007", "chk_002"],
        "travel_time_days": 52,
        "revised_arrival_date": "2026-10-28",
        "stress": 0.89,
        "criticality": "CRITICAL",
        "disruption_probability": 0.84,
        "origin": "Ningbo / Busan Maritime Hub",
        "destination": "Rotterdam Gateway → Berlin Gigafactory",
        "bom_trace": [
            {
                "part_id": "P-501",
                "name": "LFP Prismatic Battery Cells",
                "supplier": "CATL Yibin Facility",
                "tier": 1,
                "lead_time_days": 55,
                "buffer_stock_days": 9,
                "risk_status": "DISRUPTED",
            },
            {
                "part_id": "P-502",
                "name": "Synthetic Anode Spherical Graphite",
                "supplier": "BTR New Material",
                "tier": 2,
                "lead_time_days": 40,
                "buffer_stock_days": 15,
                "risk_status": "VULNERABLE",
            },
        ],
    },
    {
        "id": "sc_004",
        "name": "Aerospace Carbon Composites (Japan → US West Coast)",
        "chokepoints": ["chk_003"],
        "travel_time_days": 28,
        "revised_arrival_date": "2026-09-30",
        "stress": 0.44,
        "criticality": "MEDIUM",
        "disruption_probability": 0.35,
        "origin": "Nagoya, JP",
        "destination": "Seattle, WA Aerospace Facility",
        "bom_trace": [
            {
                "part_id": "P-601",
                "name": "Torayca Carbon Fiber Prepreg",
                "supplier": "Toray Industries",
                "tier": 1,
                "lead_time_days": 30,
                "buffer_stock_days": 25,
                "risk_status": "NORMAL",
            },
        ],
    },
]

ALERTS_DATA = [
    {
        "id": "alt_001",
        "severity": "CRITICAL",
        "message": "Potential stock-out in 14 days due to Red Sea & Bab-el-Mandeb maritime rerouting.",
        "related_chokepoint": "Bab-el-Mandeb (chk_007)",
        "confidence": 0.94,
        "mitigations": [
            {
                "type": "ALTERNATE_SOURCING",
                "recommendation": "Switch secondary wafer substrate sourcing to European fab partner (Munich)",
                "cost_impact": "+15%",
                "lead_time_reduction_days": 18,
            },
            {
                "type": "EXPEDITING",
                "recommendation": "Charter dedicated priority Air Freight for critical Tier-2 photoresist lots",
                "cost_impact": "+35%",
                "lead_time_reduction_days": 22,
            },
            {
                "type": "INVENTORY_REALLOCATION",
                "recommendation": "Draw safety buffer stock from Memphis central distribution hub",
                "cost_impact": "+4%",
                "lead_time_reduction_days": 12,
            },
        ],
    },
    {
        "id": "alt_002",
        "severity": "HIGH",
        "message": "Panama Canal draft restrictions delaying US East Coast container arrivals by 9-14 days.",
        "related_chokepoint": "Panama Canal (chk_001)",
        "confidence": 0.89,
        "mitigations": [
            {
                "type": "INTERMODAL_TRANSFER",
                "recommendation": "Reroute containers via Long Beach marine terminal to BNSF Transcontinental rail",
                "cost_impact": "+12%",
                "lead_time_reduction_days": 8,
            },
            {
                "type": "INVENTORY_HOLD",
                "recommendation": "Extend client fulfillment window for non-priority SKU tranches",
                "cost_impact": "0%",
                "lead_time_reduction_days": 5,
            },
        ],
    },
    {
        "id": "alt_003",
        "severity": "MEDIUM",
        "message": "Port strike authorization on US Atlantic coast threatens 48h terminal embargo.",
        "related_chokepoint": "Port of NY/NJ (chk_045)",
        "confidence": 0.78,
        "mitigations": [
            {
                "type": "ADVANCE_DISPATCH",
                "recommendation": "Accelerate outbound gate pick-ups and off-dock staging prior to strike window",
                "cost_impact": "+3%",
                "lead_time_reduction_days": 6,
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=SummaryResponse, summary="Summary Statistics Widget")
def get_console_summary():
    """Returns high-level system state for the Summary Statistics Widget."""
    return SummaryResponse(
        chokepoints_count=124,
        signals_count=89,
        forecasts_count=42,
        supply_chains_count=15,
        max_stress=0.89,
        average_weighted_stress=0.45,
    )


@router.get("/simulations/monte-carlo", response_model=MonteCarloResponse, summary="Monte Carlo Simulations Widget")
def get_monte_carlo_simulations():
    """Returns data points for rendering Monte Carlo probability distributions."""
    # Generate realistic distribution curve (lognormal / gamma-like)
    bins: list[HistogramBin] = []
    # Mean 12.4 days, range 0 to 50 days
    total_sims = 10000
    mean_mu = 12.4

    prob_sum = 0.0
    raw_counts = []
    for d in range(0, 52, 2):
        if d == 0:
            p = 0.005
        else:
            p = (1.0 / (d * 0.45 * math.sqrt(2 * math.pi))) * math.exp(-((math.log(d) - math.log(mean_mu)) ** 2) / (2 * 0.45 ** 2))
        raw_counts.append((d, p))
        prob_sum += p

    for d, p in raw_counts:
        norm_p = p / prob_sum if prob_sum > 0 else 0.0
        count = int(round(norm_p * total_sims))
        bins.append(HistogramBin(days=d, count=count, probability=round(norm_p, 4)))

    return MonteCarloResponse(
        simulations=total_sims,
        mean_disruption_days=12.4,
        percentiles={"p50": 10.0, "p90": 21.0, "p99": 45.0},
        histogram_data=bins,
    )


@router.get("/chokepoints", response_model=ChokepointsListResponse, summary="Chokepoints List Widget")
def get_console_chokepoints():
    """Returns ranked list of chokepoints ordered by stress."""
    sorted_cps = sorted(CHOKEPOINTS_DATA, key=lambda x: x["current_stress"], reverse=True)
    return ChokepointsListResponse(
        chokepoints=[
            ChokepointItem(
                id=cp["id"],
                name=cp["name"],
                current_stress=cp["current_stress"],
                trend=cp["trend"],
            )
            for cp in sorted_cps
        ]
    )


@router.get("/chokepoints/{chokepoint_id}/details", response_model=ChokepointDetailsResponse, summary="Chokepoint Mathematical Details")
def get_console_chokepoint_details(chokepoint_id: str):
    """Returns mathematical properties for a specific chokepoint."""
    for cp in CHOKEPOINTS_DATA:
        if cp["id"] == chokepoint_id or cp["id"].lower() == chokepoint_id.lower():
            return ChokepointDetailsResponse(
                id=cp["id"],
                centrality_score=cp["centrality"],
                flow_capacity_variance=cp["capacity_variance"],
                historical_stress_coefficient=cp["historical_coeff"],
                vulnerability_index=cp["vulnerability"],
            )

    # Dynamic fallback for arbitrary IDs
    hash_val = sum(ord(c) for c in chokepoint_id)
    return ChokepointDetailsResponse(
        id=chokepoint_id,
        centrality_score=round(0.70 + (hash_val % 28) / 100.0, 2),
        flow_capacity_variance=round(0.10 + (hash_val % 20) / 100.0, 2),
        historical_stress_coefficient=round(0.85 + (hash_val % 80) / 100.0, 2),
        vulnerability_index=round(0.60 + (hash_val % 35) / 100.0, 2),
    )


@router.get("/headlines", response_model=HeadlinesResponse, summary="Relevant Headlines Widget")
def get_console_headlines():
    """Returns real-time feed of news headlines relevant to monitored supply chains."""
    return HeadlinesResponse(
        headlines=[HeadlineItem(**h) for h in HEADLINES_DATA]
    )


@router.get("/signals", response_model=SignalsResponse, summary="Signals Widget (Non-news)")
def get_console_signals():
    """Returns feed of non-news inputs (weather alerts, logistics events, public advisories)."""
    return SignalsResponse(
        signals=[SignalItem(**s) for s in SIGNALS_DATA]
    )


@router.get("/stress/forecast", response_model=StressForecastResponse, summary="Stress & Disruption Forecast Widget")
def get_console_stress_forecast():
    """Displays global current stress score, highest forecasted stress in next 30 days, and disruption probability."""
    today = datetime.now(timezone.utc)
    daily_trend: list[DailyTrendPoint] = []

    # 30-day Kalman trend simulation peaking around day 14
    for day_idx in range(1, 31):
        d_date = (today + timedelta(days=day_idx)).strftime("%Y-%m-%d")
        delta = math.sin((day_idx / 30.0) * math.pi) * 0.23
        p50 = min(0.95, round(0.65 + delta, 3))
        p90 = min(0.98, round(p50 + 0.08 + (day_idx / 30.0) * 0.05, 3))
        daily_trend.append(
            DailyTrendPoint(
                day=day_idx,
                date=d_date,
                predicted_stress=p50,
                p50=p50,
                p90=p90,
            )
        )

    peak_target = (today + timedelta(days=14)).strftime("%Y-%m-%d")

    return StressForecastResponse(
        current_score=0.65,
        highest_30d_forecast=0.88,
        peak_date=peak_target,
        disruption_probability=0.72,
        daily_trend=daily_trend,
    )


@router.get("/supply-chains", response_model=SupplyChainsResponse, summary="Supply Chain Mapping Widget")
def get_console_supply_chains():
    """Returns comprehensive supply chain mapping and exposure data."""
    chains: list[SupplyChainItem] = []
    for sc in SUPPLY_CHAINS_DATA:
        bom = [BOMTraceItem(**b) for b in sc.get("bom_trace", [])]
        chains.append(
            SupplyChainItem(
                id=sc["id"],
                name=sc["name"],
                chokepoints=sc["chokepoints"],
                travel_time_days=sc["travel_time_days"],
                revised_arrival_date=sc["revised_arrival_date"],
                stress=sc["stress"],
                criticality=sc["criticality"],
                disruption_probability=sc["disruption_probability"],
                origin=sc.get("origin"),
                destination=sc.get("destination"),
                bom_trace=bom,
            )
        )
    return SupplyChainsResponse(supply_chains=chains)


@router.get("/alerts", response_model=AlertsResponse, summary="Alerts & Mitigation Widget")
def get_console_alerts():
    """Returns severity-scored alerts with actionable mitigation recommendations."""
    alert_items: list[ConsoleAlertItem] = []
    for a in ALERTS_DATA:
        mits = [MitigationItem(**m) for m in a["mitigations"]]
        alert_items.append(
            ConsoleAlertItem(
                id=a["id"],
                severity=a["severity"],
                message=a["message"],
                related_chokepoint=a.get("related_chokepoint"),
                confidence=a.get("confidence", 0.90),
                mitigations=mits,
            )
        )
    return AlertsResponse(alerts=alert_items)


@router.post("/stress-test/simulate", response_model=StressTestSimulateResponse, summary="Stress Test Sandbox Simulation")
def simulate_stress_test(req: StressTestSimulateRequest = Body(...)):
    """Executes a simulated loss of a node (PORT, SUPPLIER, ROUTE, HUB) and returns time-to-stock-out and cascading effects."""
    t_id = req.target_id.lower()
    t_type = req.target_type.upper()

    name_map = {
        "port_la": "Port of Los Angeles",
        "port_rotterdam": "Port of Rotterdam",
        "chk_001": "Panama Canal",
        "chk_002": "Suez Canal",
        "chk_007": "Bab-el-Mandeb Strait",
        "sup-alpha": "TSMC Fab 14 (Hsinchu)",
        "sup-beta": "Bosch Mobility Inverter Plant",
    }
    t_name = name_map.get(t_id, f"{t_type} Node ({req.target_id})")

    if "sup" in t_id or t_type == "SUPPLIER":
        days = 14
        effects = [
            f"Buffer stock depletion at Tier-1 Assembly Hub by Day 8",
            f"Line stoppage for SKU-7001 (Automotive Power Control) by Day {days}",
            f"Supplier substitution activation cost: $1.2M",
            f"Cascading delivery delay to OEM Customers: +24 days",
        ]
    elif "rotterdam" in t_id or "chk_002" in t_id or "chk_007" in t_id:
        days = 16
        effects = [
            f"Europe-bound container transshipment freeze at Rotterdam Hub by Day 9",
            f"Chemical raw material depletion (Ethylene Oxide) by Day 14",
            f"Factory production halt across Rhine Industrial Corridor by Day {days}",
            f"Alternative route fuel surcharge: +$450/TEU",
        ]
    elif "port_la" in t_id or "chk_001" in t_id:
        days = 18
        effects = [
            f"Depletion of West Coast Inventory Hub A by Day 12",
            f"Sub-assembly line starvation at Texas Facility by Day 15",
            f"Production halt at Factory C by Day {days}",
            f"Estimated revenue disruption: $4.2M / day post Day {days}",
        ]
    else:
        days = 21
        effects = [
            f"Safety stock buffer consumption at regional distribution center by Day 14",
            f"First wave of order stock-outs reported by Day {days}",
            f"Expedited air-freight mitigation required for critical sub-tiers",
        ]

    sim_id = f"sim_{random.randint(100, 999)}"

    return StressTestSimulateResponse(
        simulation_id=sim_id,
        target_type=t_type,
        target_id=req.target_id,
        target_name=t_name,
        time_to_stock_out_days=days,
        cascading_effects=effects,
    )

"""Auditable supply-chain risk mathematics, adapted from Paqshi mathint.

The module intentionally uses only the Python standard library so a hackathon
demo can run offline. Production may substitute NumPy/SciPy implementations
without changing the JSON contracts documented in docs/IO_CONTRACT.md.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, asdict
from statistics import NormalDist
from typing import Iterable, Mapping, Sequence


EPSILON = 1e-6
NORMAL = NormalDist()

# 90-day base rates adapted from Paqshi's chokepoint categories. They are
# deliberately conservative: live evidence must earn a high posterior.
BASE_PRIORS = {
    "port": 0.04, "lane": 0.04, "route": 0.04, "supplier_site": 0.03,
    "supplier": 0.03, "material": 0.03, "part": 0.02, "sku": 0.02,
    "order": 0.01, "default": 0.03,
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def logit(probability: float) -> float:
    p = clamp(probability, EPSILON, 1.0 - EPSILON)
    return math.log(p / (1.0 - p))


def expit(value: float) -> float:
    if value > 40:
        return 1.0
    if value < -40:
        return 0.0
    return 1.0 / (1.0 + math.exp(-value))


def percentile(values: Sequence[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))]


def prior_for_node(kind: str, criticality: float = 0.5, horizon_days: int = 90) -> float:
    """Scale a 90-day prior by node criticality and requested horizon.

    p(h) = 1 - (1 - p90 × (0.5 + criticality)) ** (h / 90)
    """
    base = BASE_PRIORS.get(kind, BASE_PRIORS["default"])
    scaled = clamp(base * (0.5 + clamp(criticality)), EPSILON, 0.9)
    return clamp(1.0 - (1.0 - scaled) ** (max(horizon_days, 1) / 90.0), EPSILON, 0.9)


def node_stress(signals: Sequence[tuple[float, float, float]], decay_half_life_days: float = 7.0) -> float:
    """Combine per-node signal `(intensity, confidence, age_days)` tuples.

    Evidence is freshness-decayed and noisy signal cannot dominate: each term
    is `intensity × confidence × 2 ** (-age / half_life)`. The union formula
    `1 - Π(1-term)` remains bounded and rewards corroboration.
    """
    remaining = 1.0
    for intensity, confidence, age_days in signals:
        term = clamp(intensity) * clamp(confidence) * 2.0 ** (-max(age_days, 0.0) / max(decay_half_life_days, EPSILON))
        remaining *= 1.0 - clamp(term)
    return 1.0 - remaining


@dataclass(frozen=True)
class Evidence:
    """A transparent log-likelihood contribution to a disruption posterior."""
    name: str
    llr: float
    weight: float = 1.0
    source: str = "internal"
    confidence: float = 1.0

    @property
    def contribution(self) -> float:
        return self.llr * self.weight * clamp(self.confidence)


@dataclass(frozen=True)
class Posterior:
    subject_id: str
    prior: float
    probability: float
    beta_alpha: float
    beta_beta: float
    evidence: tuple[Evidence, ...]

    def as_dict(self) -> dict:
        return {
            "subject_id": self.subject_id,
            "prior": round(self.prior, 6),
            "probability": round(self.probability, 6),
            "uncertainty": {"distribution": "beta", "alpha": round(self.beta_alpha, 4), "beta": round(self.beta_beta, 4)},
            "evidence": [{**asdict(item), "contribution": round(item.contribution, 6)} for item in self.evidence],
        }


def bayesian_update(subject_id: str, prior: float, evidence: Iterable[Evidence]) -> Posterior:
    """P(disruption|evidence) via Paqshi-style additive log odds.

    logit(posterior) = logit(prior) + sum(weight * confidence * LLR).
    More independent evidence raises Beta concentration (certainty), not simply
    the probability, which prevents one noisy source from looking decisive.
    """
    ledger = tuple(evidence)
    posterior = expit(logit(prior) + sum(item.contribution for item in ledger))
    concentration = min(80.0, 6.0 + 1.5 * len(ledger) + 2.0 * sum(clamp(x.confidence) for x in ledger))
    return Posterior(subject_id, prior, posterior, posterior * concentration, (1.0 - posterior) * concentration, ledger)


@dataclass
class KalmanLeadTime:
    """Scalar Kalman filter for lead-time residual days, x_t = x_(t-1)+w."""
    mean_days: float
    variance: float = 4.0
    process_variance: float = 1.0
    observations: int = 0

    def update(self, observed_days: float, observation_variance: float) -> None:
        prior_variance = self.variance + self.process_variance
        gain = prior_variance / (prior_variance + max(observation_variance, EPSILON))
        self.mean_days += gain * (observed_days - self.mean_days)
        self.variance = (1.0 - gain) * prior_variance
        self.observations += 1

    def forecast(self, horizon_days: int, disruption_probability: float = 0.0, delay_sensitivity: float = 7.0) -> dict:
        # Expected delay shifts the mean; uncertainty widens with elapsed time.
        mean = self.mean_days + clamp(disruption_probability) * delay_sensitivity
        variance = self.variance + max(0, horizon_days) * self.process_variance
        sigma = math.sqrt(variance)
        return {
            "horizon_days": horizon_days,
            "distribution": "normal",
            "mean_days": round(mean, 3),
            "std_days": round(sigma, 3),
            "p50_days": round(mean, 3),
            "p80_days": round(mean + NORMAL.inv_cdf(0.80) * sigma, 3),
            "p95_days": round(mean + NORMAL.inv_cdf(0.95) * sigma, 3),
            "observations": self.observations,
        }


@dataclass
class KalmanStressModel:
    """Scalar Kalman filter for normalized stress levels, tracking x_t in [0.0, 1.0]."""
    mean_stress: float
    variance: float = 0.05
    process_variance: float = 0.01
    observations: int = 0

    def update(self, observed_stress: float, observation_variance: float) -> None:
        prior_variance = self.variance + self.process_variance
        gain = prior_variance / (prior_variance + max(observation_variance, EPSILON))
        self.mean_stress += gain * (observed_stress - self.mean_stress)
        self.mean_stress = clamp(self.mean_stress)
        self.variance = (1.0 - gain) * prior_variance
        self.observations += 1

    def forecast(self, horizon_days: int, bayesian_shift: float = 0.0) -> dict:
        # Expected stress shifts based on recent bayesian evidence.
        mean = clamp(self.mean_stress + bayesian_shift)
        # Uncertainty grows linearly over time
        variance = self.variance + max(0, horizon_days) * self.process_variance
        sigma = math.sqrt(variance)
        
        return {
            "horizon_days": horizon_days,
            "distribution": "normal",
            "mean_stress": round(mean, 3),
            "std_stress": round(sigma, 3),
            "p50_stress": round(clamp(mean), 3),
            "p80_stress": round(clamp(mean + NORMAL.inv_cdf(0.80) * sigma), 3),
            "p95_stress": round(clamp(mean + NORMAL.inv_cdf(0.95) * sigma), 3),
            "observations": self.observations,
        }


def simulate_stress_forecast(mean_stress: float, std_stress: float, threshold: float = 0.70, trials: int = 1000, rng_seed: int = 42) -> dict:
    """Monte Carlo simulation to estimate probability of stress exceeding a threshold."""
    randomizer = random.Random(rng_seed)
    exceeded = 0
    samples = []
    
    for _ in range(trials):
        # Sample from the forecasted normal distribution
        sample = randomizer.gauss(mean_stress, std_stress)
        # Clip to real-world bounds [0, 1]
        sample = clamp(sample)
        samples.append(sample)
        if sample > threshold:
            exceeded += 1
            
    prob = exceeded / max(trials, 1)
    return {
        "threshold": threshold,
        "probability_exceeding": round(prob, 4),
        "trials": trials,
        "expected_stress": round(sum(samples) / max(trials, 1), 3),
        "p95_stress": round(percentile(samples, 0.95), 3)
    }



@dataclass(frozen=True)
class Dependency:
    upstream_id: str
    downstream_id: str
    propagation_probability: float = 0.85
    impact_multiplier: float = 0.60


@dataclass(frozen=True)
class OperationalNode:
    id: str
    kind: str  # supplier_site | port | lane | part | sku | order
    inventory_days: float | None = None
    criticality: float = 0.5


@dataclass
class ExposureResult:
    node_id: str
    probability_affected: float
    expected_impact: float
    p50_stockout_days: float | None
    p95_stockout_days: float | None


def monte_carlo_exposure(
    seed_id: str,
    seed_beta: tuple[float, float],
    nodes: Sequence[OperationalNode],
    dependencies: Sequence[Dependency],
    trials: int = 1000,
    rng_seed: int = 7,
    forced_failure: bool = False,
) -> list[ExposureResult]:
    """Propagate uncertain disruption through route/BOM/order edges.

    In each trial the seed stress is sampled from Beta(alpha,beta), each edge
    survives with its propagation probability, and impact decays per hop.
    The result is a per-node probability and impact distribution, not a single
    hand-wavy cascade number.
    """
    node_map = {node.id: node for node in nodes}
    adjacency: dict[str, list[Dependency]] = {}
    for edge in dependencies:
        adjacency.setdefault(edge.upstream_id, []).append(edge)
    randomizer = random.Random(rng_seed)
    impacts: dict[str, list[float]] = {node.id: [] for node in nodes if node.id != seed_id}
    stockout_days: dict[str, list[float]] = {node.id: [] for node in nodes if node.inventory_days is not None}
    alpha, beta = seed_beta
    for _ in range(trials):
        seed_impact = 1.0 if forced_failure else randomizer.betavariate(max(alpha, EPSILON), max(beta, EPSILON))
        queue: list[tuple[str, float]] = [(seed_id, seed_impact)]
        visited: set[str] = set()
        while queue:
            current, impact = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            for edge in adjacency.get(current, []):
                if randomizer.random() > clamp(edge.propagation_probability):
                    continue
                propagated = impact * clamp(edge.impact_multiplier)
                if propagated < 0.02:
                    continue
                impacts.setdefault(edge.downstream_id, []).append(propagated)
                node = node_map.get(edge.downstream_id)
                if node and node.inventory_days is not None and propagated > 0:
                    # More impact consumes safety cover faster. Bound to a sensible 0..cover range.
                    stockout_days.setdefault(node.id, []).append(max(0.0, node.inventory_days * (1.0 - propagated)))
                queue.append((edge.downstream_id, propagated))
    results: list[ExposureResult] = []
    for node_id, samples in impacts.items():
        affected = len(samples) / max(trials, 1)
        cover = stockout_days.get(node_id, [])
        results.append(ExposureResult(
            node_id=node_id,
            probability_affected=round(affected, 4),
            expected_impact=round(sum(samples) / max(trials, 1), 4),
            p50_stockout_days=round(percentile(cover, 0.5), 2) if cover else None,
            p95_stockout_days=round(percentile(cover, 0.95), 2) if cover else None,
        ))
    return sorted(results, key=lambda item: (-item.expected_impact, item.node_id))


def severity(probability: float, business_impact: float, urgency: float, concentration: float, false_alarm_penalty: float = 0.0) -> float:
    """Alert rank in [0,100]: P × impact × urgency × concentration × trust."""
    score = clamp(probability) * clamp(business_impact) * clamp(urgency) * clamp(concentration)
    return round(100.0 * score * (1.0 - clamp(false_alarm_penalty)), 2)


@dataclass(frozen=True)
class ForecastOutcome:
    probability: float
    occurred: bool
    source: str


def false_alarm_metrics(outcomes: Sequence[ForecastOutcome], alert_threshold: float = 0.55) -> dict:
    """Precision control: resolve forecasts and calculate source-level penalties."""
    alerts = [item for item in outcomes if item.probability >= alert_threshold]
    true_positive = sum(item.occurred for item in alerts)
    false_positive = len(alerts) - true_positive
    brier = sum((item.probability - float(item.occurred)) ** 2 for item in outcomes) / max(len(outcomes), 1)
    precision = true_positive / len(alerts) if alerts else 1.0
    by_source: dict[str, list[ForecastOutcome]] = {}
    for item in outcomes:
        by_source.setdefault(item.source, []).append(item)
    sources = {
        source: {
            "precision": round(sum(x.occurred for x in items if x.probability >= alert_threshold) / max(1, sum(x.probability >= alert_threshold for x in items)), 4),
            "false_alarm_penalty": round(1.0 - sum(x.occurred for x in items if x.probability >= alert_threshold) / max(1, sum(x.probability >= alert_threshold for x in items)), 4),
            "sample_size": len(items),
        }
        for source, items in by_source.items()
    }
    return {"threshold": alert_threshold, "precision": round(precision, 4), "false_positive": false_positive, "brier_score": round(brier, 5), "sources": sources}


# ---------------------------------------------------------------------------
# Concentration scoring
# ---------------------------------------------------------------------------

def concentration_score(spend_shares: Sequence[float]) -> float:
    """Herfindahl–Hirschman Index: Σ(normalised_share²).

    Returns 1/n for perfectly equal distribution, 1.0 for pure monopoly.
    Input shares need not be pre-normalised; the function normalises them.
    """
    if not spend_shares:
        return 0.0
    total = sum(spend_shares) or EPSILON
    normalised = [s / total for s in spend_shares]
    return round(sum(s * s for s in normalised), 6)


# ---------------------------------------------------------------------------
# Supplier risk dimension values (pure math, no Pydantic)
# ---------------------------------------------------------------------------

_SUPPLIER_RISK_WEIGHTS: dict[str, float] = {
    "delivery":      0.25,
    "quality":       0.25,
    "financial":     0.15,
    "capacity":      0.15,
    "compliance":    0.10,
    "concentration": 0.10,
}

# Configurable quality ppm ceiling (10 000 ppm ≡ 1 % defect rate → max risk)
_QUALITY_PPM_CEILING = 10_000.0
# Compliance event count that maps to full risk
_COMPLIANCE_EVENT_CEILING = 5


def supplier_risk_values(
    on_time_delivery: float,
    quality_ppm: float,
    financial_score: float,
    capacity_utilization: float,
    compliance_events: int,
    spend_share: float = 0.0,
    weights: Mapping[str, float] | None = None,
) -> dict:
    """Compute raw per-dimension risk values and overall 0-100 score.

    All inputs follow the SupplierMetric contract (docs/IO_CONTRACT.md).
    Returns a plain dict so the function remains standard-library-only; the
    caller (scoring.py) wraps it into Pydantic models.

    Dimensions (each normalised to [0, 1] where 1 = highest risk):
    - delivery:      1 − on_time_delivery
    - quality:       quality_ppm / PPM_CEILING  (clamped)
    - financial:     1 − financial_score
    - capacity:      peaks at very high (>90 %) or very low (<30 %) utilisation
    - compliance:    compliance_events / EVENT_CEILING  (clamped)
    - concentration: spend_share (fraction of total category spend)
    """
    w = weights if weights is not None else _SUPPLIER_RISK_WEIGHTS

    delivery_risk = clamp(1.0 - clamp(on_time_delivery))
    quality_risk = clamp(quality_ppm / max(_QUALITY_PPM_CEILING, EPSILON))
    financial_risk = clamp(1.0 - clamp(financial_score))
    cap = clamp(capacity_utilization)
    if cap > 0.70:
        capacity_risk = clamp((cap - 0.70) / 0.30)
    else:
        capacity_risk = clamp((0.30 - cap) / 0.30)
    compliance_risk = clamp(compliance_events / max(_COMPLIANCE_EVENT_CEILING, 1))
    concentration_risk = clamp(spend_share)

    dim_values: dict[str, float] = {
        "delivery":      delivery_risk,
        "quality":       quality_risk,
        "financial":     financial_risk,
        "capacity":      capacity_risk,
        "compliance":    compliance_risk,
        "concentration": concentration_risk,
    }

    weighted_sum = sum(dim_values[k] * w.get(k, 0.0) for k in dim_values)
    weight_total = sum(w.get(k, 0.0) for k in dim_values) or EPSILON
    score_0_100 = round((weighted_sum / weight_total) * 100.0, 2)

    factor_ledger = [
        {
            "name": k,
            "value": round(v, 4),
            "contribution": round(v * w.get(k, 0.0) / weight_total * 100.0, 2),
            "source": "supplier_metrics",
        }
        for k, v in dim_values.items()
    ]

    return {
        "score_0_100": score_0_100,
        "dimension_values": {k: round(v, 4) for k, v in dim_values.items()},
        "weights": {k: w.get(k, 0.0) for k in dim_values},
        "factor_ledger": factor_ledger,
    }

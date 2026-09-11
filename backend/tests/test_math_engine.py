from backend.math_engine import (
    Evidence, OperationalNode, Dependency,
    bayesian_update, KalmanLeadTime, monte_carlo_exposure,
    false_alarm_metrics, ForecastOutcome, prior_for_node, node_stress,
    concentration_score, supplier_risk_values,
)
from backend.ingestion import SOURCES, normalize_signal


def test_positive_evidence_increases_posterior():
    result = bayesian_update("port", 0.05, [Evidence("advisory", 1.0)])
    assert result.probability > result.prior
    assert result.beta_alpha > 0 and result.beta_beta > 0


def test_priors_and_stress_are_bounded_and_criticality_matters():
    assert prior_for_node("port", 1.0) > prior_for_node("port", 0.0)
    assert 0 < node_stress([(0.8, 0.9, 0)]) < 1


def test_forecast_widens_with_horizon():
    state = KalmanLeadTime(10, variance=4, process_variance=2)
    assert state.forecast(30)["std_days"] > state.forecast(1)["std_days"]


def test_forced_stress_test_reaches_downstream_node():
    nodes = [OperationalNode("supplier", "supplier_site"), OperationalNode("sku", "sku", inventory_days=8)]
    result = monte_carlo_exposure("supplier", (2, 8), nodes, [Dependency("supplier", "sku", 1.0, 1.0)], trials=50, forced_failure=True)
    assert result[0].node_id == "sku"
    assert result[0].probability_affected == 1.0


def test_false_alarm_control_reports_penalty():
    metrics = false_alarm_metrics([ForecastOutcome(0.9, False, "noisy"), ForecastOutcome(0.9, True, "trusted")])
    assert metrics["sources"]["noisy"]["false_alarm_penalty"] == 1.0


def test_weather_signal_normalizes_with_provenance():
    signal = normalize_signal({"title": "Typhoon advisory", "intensity": 0.8}, SOURCES[0])
    assert signal["source"] == "Open-Meteo"
    assert signal["raw_payload_hash"].startswith("sha256:")


# ---------------------------------------------------------------------------
# Concentration (HHI)
# ---------------------------------------------------------------------------

def test_concentration_monopoly_equals_one():
    assert concentration_score([1.0]) == 1.0


def test_concentration_equal_distribution():
    # n equal suppliers -> HHI = 1/n
    n = 4
    result = concentration_score([1.0] * n)
    assert abs(result - 1.0 / n) < 1e-5


def test_concentration_empty_returns_zero():
    assert concentration_score([]) == 0.0


def test_concentration_unnormalised_shares():
    # Should normalise before squaring
    result = concentration_score([50, 50])
    assert abs(result - 0.5) < 1e-5


# ---------------------------------------------------------------------------
# Supplier risk values
# ---------------------------------------------------------------------------

def test_supplier_risk_perfect_supplier_scores_near_zero():
    rv = supplier_risk_values(
        on_time_delivery=1.0, quality_ppm=0, financial_score=1.0,
        capacity_utilization=0.60, compliance_events=0, spend_share=0.0,
    )
    assert rv["score_0_100"] < 10.0


def test_supplier_risk_terrible_supplier_scores_near_100():
    rv = supplier_risk_values(
        on_time_delivery=0.0, quality_ppm=10_000, financial_score=0.0,
        capacity_utilization=1.0, compliance_events=5, spend_share=1.0,
    )
    assert rv["score_0_100"] > 80.0


def test_supplier_risk_factor_ledger_contributions_sum_to_score():
    rv = supplier_risk_values(
        on_time_delivery=0.85, quality_ppm=500, financial_score=0.75,
        capacity_utilization=0.70, compliance_events=1, spend_share=0.2,
    )
    ledger_total = sum(e["contribution"] for e in rv["factor_ledger"])
    # Contributions sum to score (within floating-point tolerance)
    assert abs(ledger_total - rv["score_0_100"]) < 0.5


def test_supplier_risk_custom_weights_respected():
    # If delivery weight is 1.0 and all others 0, score should equal delivery dimension
    weights = {"delivery": 1.0, "quality": 0.0, "financial": 0.0, "capacity": 0.0, "compliance": 0.0, "concentration": 0.0}
    rv = supplier_risk_values(
        on_time_delivery=0.80, quality_ppm=9000, financial_score=0.1,
        capacity_utilization=0.95, compliance_events=5, spend_share=1.0,
        weights=weights,
    )
    expected = round((1.0 - 0.80) * 100.0, 2)
    assert abs(rv["score_0_100"] - expected) < 0.5


from backend.math_engine import Evidence, OperationalNode, Dependency, bayesian_update, KalmanLeadTime, monte_carlo_exposure, false_alarm_metrics, ForecastOutcome, prior_for_node, node_stress
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

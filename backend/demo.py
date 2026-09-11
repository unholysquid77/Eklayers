"""Offline, deterministic example covering posterior → forecast → stress test."""
from .math_engine import Evidence, OperationalNode, Dependency, bayesian_update, KalmanLeadTime, monte_carlo_exposure


def run_demo() -> dict:
    posterior = bayesian_update("port-singapore", 0.04, [
        Evidence("weather_advisory", 0.9, source="GDACS", confidence=0.85),
        Evidence("port_congestion", 0.7, source="container_traffic", confidence=0.90),
        Evidence("freight_news_corroboration", 0.35, source="FreightWaves", confidence=0.70),
    ])
    filter_ = KalmanLeadTime(mean_days=18, variance=9, process_variance=1.5)
    filter_.update(observed_days=23, observation_variance=4)
    nodes = [OperationalNode("port-singapore", "port"), OperationalNode("part-controller", "part", 10), OperationalNode("sku-gateway", "sku", 7), OperationalNode("order-1042", "order", 3)]
    edges = [Dependency("port-singapore", "part-controller"), Dependency("part-controller", "sku-gateway"), Dependency("sku-gateway", "order-1042")]
    return {"posterior": posterior.as_dict(), "lead_time": filter_.forecast(14, posterior.probability), "stress_test": [item.__dict__ for item in monte_carlo_exposure("port-singapore", (posterior.beta_alpha, posterior.beta_beta), nodes, edges, trials=500)]}

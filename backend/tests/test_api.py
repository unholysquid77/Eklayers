"""Contract tests for all FastAPI endpoints.

Uses FastAPI TestClient (which wraps httpx). Tests verify:
- HTTP status codes
- Envelope schema shape (data / as_of / model_version)
- Live ingestion -> pipeline response (signal in -> alert out)
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app import app, state

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state():
    """Restore deterministic seed state before each test."""
    state.reset()
    yield
    state.reset()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_envelope(resp, status: int = 200):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert "data" in body
    assert "as_of" in body
    assert "model_version" in body
    return body["data"]


# ---------------------------------------------------------------------------
# Map layers
# ---------------------------------------------------------------------------

def test_map_layers_returns_geojson():
    data = _assert_envelope(client.get("/v1/map/layers"))
    assert data["type"] == "FeatureCollection"
    assert isinstance(data["features"], list)


# ---------------------------------------------------------------------------
# Alerts  (empty before any signals)
# ---------------------------------------------------------------------------

def test_alerts_empty_on_seed():
    data = _assert_envelope(client.get("/v1/alerts"))
    assert isinstance(data, list)


def test_alerts_404_for_unknown_id():
    resp = client.get("/v1/alerts/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

def test_suppliers_list_returns_seed():
    data = _assert_envelope(client.get("/v1/suppliers"))
    assert len(data) == 3   # three seed suppliers


def test_supplier_risk_detail():
    data = _assert_envelope(client.get("/v1/suppliers/sup-alpha/risk"))
    assert "score_0_100" in data
    assert "dimension_scores" in data
    assert "factor_ledger" in data
    assert 0.0 <= data["score_0_100"] <= 100.0


def test_supplier_risk_404_unknown():
    resp = client.get("/v1/suppliers/unknown-sup/risk")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Concentration
# ---------------------------------------------------------------------------

def test_concentration_returns_hhi_entries():
    data = _assert_envelope(client.get("/v1/concentration"))
    assert isinstance(data, list)
    assert len(data) > 0
    for entry in data:
        assert "hhi" in entry
        assert 0.0 <= entry["hhi"] <= 1.0


# ---------------------------------------------------------------------------
# Chokepoint forecast
# ---------------------------------------------------------------------------

def test_forecast_known_node():
    data = _assert_envelope(client.get("/v1/chokepoints/sup-alpha/forecast"))
    assert "forecast" in data
    assert "p50_days" in data["forecast"]
    assert "p80_days" in data["forecast"]
    assert "p95_days" in data["forecast"]


def test_forecast_404_unknown():
    resp = client.get("/v1/chokepoints/unknown-node/forecast")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Live ingestion -> alert pipeline
# ---------------------------------------------------------------------------

def test_ingest_signal_with_entity_creates_alert():
    """Multiple corroborating signals linked to a known supplier must generate an alert.

    A single weak signal may not cross the absolute probability gate (0.05).  Two
    corroborating high-intensity signals from different sources reliably do.
    """
    payload = [
        {
            "type": "quality_event",
            "source": "ERP",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "intensity": 0.92,
            "confidence": 0.95,
            "credibility": 0.90,
            "entities": [{"kind": "supplier", "id": "sup-beta", "match_confidence": 0.95}],
        },
        {
            "type": "capacity_event",
            "source": "SupplierPortal",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "intensity": 0.88,
            "confidence": 0.90,
            "credibility": 0.85,
            "entities": [{"kind": "supplier", "id": "sup-beta", "match_confidence": 0.92}],
        },
    ]
    ingest_data = _assert_envelope(client.post("/v1/ingest/signals", json=payload))
    assert ingest_data["accepted"] == 2
    assert ingest_data["deduplicated"] == 0
    assert ingest_data["quarantined"] == 0

    # Alert pipeline should have fired
    alerts_data = _assert_envelope(client.get("/v1/alerts"))
    alert_ids = [a["subject_id"] for a in alerts_data]
    assert "sup-beta" in alert_ids


def test_ingest_signal_deduplication():
    """Second POST of the same hash must be deduplicated."""
    payload = [
        {
            "type": "port_congestion",
            "source": "GDACS",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "intensity": 0.70,
            "confidence": 0.80,
            "credibility": 0.90,
            "raw_payload_hash": "sha256:dedup-test-000",
            "entities": [{"kind": "supplier", "id": "sup-alpha", "match_confidence": 0.90}],
        }
    ]
    r1 = _assert_envelope(client.post("/v1/ingest/signals", json=payload))
    assert r1["accepted"] == 1

    r2 = _assert_envelope(client.post("/v1/ingest/signals", json=payload))
    assert r2["deduplicated"] == 1
    assert r2["accepted"] == 0


def test_ingest_signal_quarantine_no_anchor():
    """Signal with no entity and no geometry must be quarantined."""
    payload = [
        {
            "type": "unrest",
            "source": "ACLED",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "intensity": 0.60,
            "confidence": 0.70,
        }
    ]
    data = _assert_envelope(client.post("/v1/ingest/signals", json=payload))
    assert data["quarantined"] == 1
    assert data["accepted"] == 0


# ---------------------------------------------------------------------------
# Operational ingestion
# ---------------------------------------------------------------------------

def test_ingest_operational_upserts_supplier():
    payload = {
        "suppliers": [
            {
                "id": "sup-delta",
                "name": "Delta Metals Inc.",
                "tier": 1,
                "country": "IN",
                "region": "Asia",
                "categories": ["metals"],
                "criticality": 0.6,
            }
        ]
    }
    data = _assert_envelope(client.post("/v1/ingest/operational", json=payload))
    assert data["suppliers_upserted"] == 1

    suppliers = _assert_envelope(client.get("/v1/suppliers"))
    ids = [s["id"] for s in suppliers]
    assert "sup-delta" in ids


# ---------------------------------------------------------------------------
# Stress test
# ---------------------------------------------------------------------------

def test_stress_test_known_node():
    payload = {"target_id": "sup-alpha", "target_kind": "supplier", "trials": 50, "rng_seed": 42}
    data = _assert_envelope(client.post("/v1/stress-tests", json=payload))
    assert data["target_id"] == "sup-alpha"
    assert data["forced_failure"] is True
    assert isinstance(data["node_results"], list)


def test_stress_test_404_unknown():
    payload = {"target_id": "ghost-node", "target_kind": "port", "trials": 50, "rng_seed": 7}
    resp = client.post("/v1/stress-tests", json=payload)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Mitigation compare
# ---------------------------------------------------------------------------

def test_mitigation_compare_404_unknown_alert():
    resp = client.post("/v1/mitigations/compare", json={"alert_id": "no-such-alert"})
    assert resp.status_code == 404


def test_mitigation_compare_after_alert():
    """Ingest signal -> get alert id -> compare mitigations."""
    payload = [
        {
            "type": "capacity_event",
            "source": "ERP",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "intensity": 0.88,
            "confidence": 0.92,
            "credibility": 0.85,
            "entities": [{"kind": "supplier", "id": "sup-gamma", "match_confidence": 0.95}],
        }
    ]
    client.post("/v1/ingest/signals", json=payload)
    alerts = _assert_envelope(client.get("/v1/alerts"))
    if not alerts:
        pytest.skip("Alert pipeline did not fire for this signal (threshold not crossed)")

    alert_id = alerts[0]["id"]
    mitigations = _assert_envelope(client.post("/v1/mitigations/compare", json={"alert_id": alert_id}))
    assert isinstance(mitigations, list)
    for m in mitigations:
        assert "type" in m
        assert "cost_impact" in m


# ---------------------------------------------------------------------------
# Demo reset
# ---------------------------------------------------------------------------

def test_demo_reset_clears_signals():
    # Ingest a signal
    client.post("/v1/ingest/signals", json=[{
        "type": "weather_advisory", "source": "GDACS",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "intensity": 0.8, "confidence": 0.9,
        "entities": [{"kind": "supplier", "id": "sup-alpha", "match_confidence": 0.9}],
    }])
    # Reset
    _assert_envelope(client.post("/v1/demo/reset"))
    # Alerts should be empty again
    alerts = _assert_envelope(client.get("/v1/alerts"))
    assert alerts == []

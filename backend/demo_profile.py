"""3PL Contractor Demo Profile and clean state manager."""
from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

MOCK_DB_PATH = "data/mock_data.db"

CLEAN_STATE: dict[str, Any] = {
    "org_profile": {
        "company_name": "",
        "primary_plant": "",
        "primary_port": "",
        "currency": "INR (₹)",
        "annual_volume_units": 0,
        "critical_order_threshold_inr": 1000000,
    },
    "plants": [],
    "custom_suppliers": [],
    "custom_skus": [],
    "customer_orders": [],
    "routes": [],
    "api_credentials": {
        "openrouter_api_key": "",
        "gemini_api_key": "",
        "opensky_configured": True,
        "ais_maritime_configured": True,
        "gnews_configured": True,
        "weather_configured": True,
    }
}

def get_3pl_contractor_profile() -> dict[str, Any]:
    """Retrieves 3PL contractor demo profile from data/mock_data.db or fallback."""
    if os.path.exists(MOCK_DB_PATH):
        try:
            conn = sqlite3.connect(MOCK_DB_PATH)
            cur = conn.cursor()
            row = cur.execute("SELECT payload_json FROM demo_scenarios WHERE id = '3pl_contractor'").fetchone()
            conn.close()
            if row and row[0]:
                return json.loads(row[0])
        except Exception:
            pass
    return CLEAN_STATE

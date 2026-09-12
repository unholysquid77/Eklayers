"""3PL Contractor Demo Profile and clean state manager."""
from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MOCK_DB_PATH = BASE_DIR / "data" / "mock_data.db"

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

CANONICAL_3PL_PROFILE: dict[str, Any] = {
    "org_profile": {
        "company_name": "Nexis Global 3PL & Semiconductor Logistics",
        "primary_plant": "Pune Gigafactory (Chakan Industrial Zone)",
        "primary_port": "JNPT Nhava Sheva, Mumbai",
        "currency": "INR (₹)",
        "annual_volume_units": 540000,
        "critical_order_threshold_inr": 1000000,
    },
    "plants": [
        {
            "id": "PLANT-01",
            "name": "Pune Gigafactory (Chakan Industrial Zone)",
            "location": "Pune, Maharashtra, India",
            "capacity_units_day": 1500,
            "critical_lines": "Line A (Motor Controllers), Line B (Inverters)",
            "status": "OPERATIONAL"
        },
        {
            "id": "PLANT-02",
            "name": "Bengaluru Advanced R&D & Pilot Assembly",
            "location": "Electronic City, Bengaluru, India",
            "capacity_units_day": 300,
            "critical_lines": "Pilot Line (Sensors & Gateways)",
            "status": "OPERATIONAL"
        },
        {
            "id": "PLANT-03",
            "name": "Chennai Port Automotive Assembly",
            "location": "Sriperumbudur, Tamil Nadu, India",
            "capacity_units_day": 800,
            "critical_lines": "EV Powertrain Line C",
            "status": "OPERATIONAL"
        },
        {
            "id": "PLANT-04",
            "name": "Hyderabad Defense & Aerospace Logistics Hub",
            "location": "Adibatla, Hyderabad, India",
            "capacity_units_day": 400,
            "critical_lines": "Secure Telematics & Avionics",
            "status": "OPERATIONAL"
        }
    ],
    "custom_suppliers": [
        {
            "id": "SUP-001",
            "name": "TSMC Sub-Fab 14",
            "country": "Taiwan",
            "lead_time_days": 42,
            "single_source": True,
            "critical_part": "MCU-441 Automotive Microcontroller IC",
            "contact_email": "dispatch@tsmc-fab14.tw",
            "risk_level": "CRITICAL"
        },
        {
            "id": "SUP-002",
            "name": "Infineon Technologies AG",
            "country": "Germany",
            "lead_time_days": 28,
            "single_source": False,
            "critical_part": "IGBT-312 Gate Driver Modules",
            "contact_email": "orders@infineon-munich.de",
            "risk_level": "MEDIUM"
        },
        {
            "id": "SUP-003",
            "name": "STMicroelectronics Pte Ltd",
            "country": "Singapore",
            "lead_time_days": 35,
            "single_source": True,
            "critical_part": "SiC Power MOSFET Die",
            "contact_email": "apac-logistics@stmicro.sg",
            "risk_level": "CRITICAL"
        },
        {
            "id": "SUP-004",
            "name": "NXP Semiconductors NV",
            "country": "USA",
            "lead_time_days": 21,
            "single_source": False,
            "critical_part": "RF-808 Telematics Baseband",
            "contact_email": "support@nxp-austin.com",
            "risk_level": "LOW"
        },
        {
            "id": "SUP-005",
            "name": "Murata Manufacturing Co.",
            "country": "Japan",
            "lead_time_days": 18,
            "single_source": False,
            "critical_part": "SEN-105 MEMS Diagnostic Sensors",
            "contact_email": "global-sales@murata.jp",
            "risk_level": "LOW"
        },
        {
            "id": "SUP-006",
            "name": "Samsung Semiconductor",
            "country": "South Korea",
            "lead_time_days": 30,
            "single_source": True,
            "critical_part": "BMS ASIC Power Manager",
            "contact_email": "dispatch@samsung-giheung.kr",
            "risk_level": "HIGH"
        }
    ],
    "custom_skus": [
        {"sku_id": "SKU-441", "name": "Industrial Motor Controller v4", "current_stock_units": 1420, "daily_burn_units": 125, "runway_days": 11.0, "safety_buffer_days": 21, "critical_part": "MCU-441"},
        {"sku_id": "SKU-108", "name": "SiC Power MOSFET Module", "current_stock_units": 640, "daily_burn_units": 55, "runway_days": 11.0, "safety_buffer_days": 20, "critical_part": "SiC Substrate & Die"},
        {"sku_id": "SKU-205", "name": "High-Voltage Power Inverter", "current_stock_units": 860, "daily_burn_units": 45, "runway_days": 19.0, "safety_buffer_days": 15, "critical_part": "IGBT-312"},
        {"sku_id": "SKU-808", "name": "Automotive Telematics Gateway", "current_stock_units": 2400, "daily_burn_units": 160, "runway_days": 15.0, "safety_buffer_days": 20, "critical_part": "RF-808"},
        {"sku_id": "SKU-105", "name": "Smart Grid Diagnostic Sensor", "current_stock_units": 3100, "daily_burn_units": 110, "runway_days": 28.0, "safety_buffer_days": 14, "critical_part": "SEN-105"},
        {"sku_id": "SKU-502", "name": "Battery Management System BMS-2", "current_stock_units": 920, "daily_burn_units": 70, "runway_days": 13.0, "safety_buffer_days": 18, "critical_part": "BMS ASIC"}
    ],
    "customer_orders": [
        {"order_id": "ORD-18421", "customer_name": "Acme Automotive Global", "sku_id": "SKU-441", "units": 450, "order_value_inr": 1420000, "promised_delivery_date": "2026-09-24", "late_penalty_daily_inr": 25000, "priority": "CRITICAL"},
        {"order_id": "ORD-18425", "customer_name": "Siemens Mobility India", "sku_id": "SKU-441", "units": 300, "order_value_inr": 950000, "promised_delivery_date": "2026-09-25", "late_penalty_daily_inr": 18000, "priority": "HIGH"},
        {"order_id": "ORD-18432", "customer_name": "Schneider Electric Solutions", "sku_id": "SKU-441", "units": 200, "order_value_inr": 630000, "promised_delivery_date": "2026-09-27", "late_penalty_daily_inr": 12000, "priority": "MEDIUM"},
        {"order_id": "ORD-18440", "customer_name": "ABB Industrial Systems", "sku_id": "SKU-205", "units": 180, "order_value_inr": 1800000, "promised_delivery_date": "2026-10-02", "late_penalty_daily_inr": 30000, "priority": "HIGH"},
        {"order_id": "ORD-18451", "customer_name": "Tata Motors EV Division", "sku_id": "SKU-108", "units": 350, "order_value_inr": 2100000, "promised_delivery_date": "2026-09-22", "late_penalty_daily_inr": 45000, "priority": "CRITICAL"},
        {"order_id": "ORD-18458", "customer_name": "Mahindra Electric Mobility", "sku_id": "SKU-108", "units": 220, "order_value_inr": 1320000, "promised_delivery_date": "2026-09-26", "late_penalty_daily_inr": 28000, "priority": "HIGH"},
        {"order_id": "ORD-18464", "customer_name": "Bosch Mobility Systems", "sku_id": "SKU-808", "units": 600, "order_value_inr": 1200000, "promised_delivery_date": "2026-09-29", "late_penalty_daily_inr": 15000, "priority": "MEDIUM"},
        {"order_id": "ORD-18470", "customer_name": "L&T Transportation Infra", "sku_id": "SKU-502", "units": 140, "order_value_inr": 980000, "promised_delivery_date": "2026-10-05", "late_penalty_daily_inr": 20000, "priority": "MEDIUM"}
    ],
    "routes": [
        {
            "id": "RTE-001",
            "name": "Taiwan Semi Fab -> JNPT Nhava Sheva -> Pune Plant",
            "transport_mode": "MARITIME_FEEDER",
            "carrier": "Evergreen Marine / Maersk",
            "origin": "Kaohsiung / Hsinchu, Taiwan",
            "destination": "JNPT Nhava Sheva -> Pune Plant",
            "transit_days": 18,
            "critical_sku": "SKU-441 (Power Controller)",
            "chokepoints_traversed": ["Taiwan Strait", "Strait of Malacca", "Arabian Sea Corridor"],
            "risk_level": "CRITICAL"
        },
        {
            "id": "RTE-002",
            "name": "Singapore Substrate Hub -> JNPT -> Pune Gigafactory",
            "transport_mode": "MULTIMODAL_AIR_SEA",
            "carrier": "DHL Global Forwarding",
            "origin": "Port of Singapore",
            "destination": "Pune Gigafactory, India",
            "transit_days": 11,
            "critical_sku": "SKU-108 (SiC MOSFET)",
            "chokepoints_traversed": ["Strait of Malacca"],
            "risk_level": "HIGH"
        },
        {
            "id": "RTE-003",
            "name": "Munich Semiconductor Fab -> Mumbai BOM Air Freight -> Pune",
            "transport_mode": "AIR_CARGO",
            "carrier": "Lufthansa Cargo / Air India",
            "origin": "Munich MUC, Germany",
            "destination": "Mumbai BOM Air Freight -> Pune",
            "transit_days": 4,
            "critical_sku": "SKU-205 (High-Voltage Inverter)",
            "chokepoints_traversed": ["Middle East Air Corridor"],
            "risk_level": "MEDIUM"
        },
        {
            "id": "RTE-004",
            "name": "Austin Semiconductor Fab -> Chennai Air Cargo Hub -> Electronic City",
            "transport_mode": "AIR_CARGO",
            "carrier": "FedEx Express Cargo",
            "origin": "Austin Bergstrom AUS, USA",
            "destination": "Chennai MAA Hub -> Bengaluru Electronic City",
            "transit_days": 6,
            "critical_sku": "SKU-808 (Telematics Gateway)",
            "chokepoints_traversed": ["Atlantic Trans-Ocean Corridor"],
            "risk_level": "LOW"
        },
        {
            "id": "RTE-005",
            "name": "Kyoto Component Hub -> Singapore Gateway -> JNPT Nhava Sheva",
            "transport_mode": "OCEAN_CONTAINER",
            "carrier": "Ocean Network Express (ONE)",
            "origin": "Port of Kobe / Kyoto, Japan",
            "destination": "JNPT Nhava Sheva, Mumbai",
            "transit_days": 21,
            "critical_sku": "SKU-105 (Diagnostic Sensor)",
            "chokepoints_traversed": ["South China Sea", "Strait of Malacca"],
            "risk_level": "LOW"
        }
    ],
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
    """Retrieves 3PL contractor demo profile from data/mock_data.db or canonical in-memory fallback."""
    import copy
    if os.path.exists(MOCK_DB_PATH):
        try:
            conn = sqlite3.connect(str(MOCK_DB_PATH))
            cur = conn.cursor()
            row = cur.execute("SELECT payload_json FROM demo_scenarios WHERE id = '3pl_contractor'").fetchone()
            conn.close()
            if row and row[0]:
                return json.loads(row[0])
        except Exception:
            pass
    return copy.deepcopy(CANONICAL_3PL_PROFILE)

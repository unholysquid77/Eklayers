import re
with open("backend/app.py", "r") as f:
    content = f.read()

ingest_live = """
@app.post("/v1/ingest/live", summary="Trigger automated live ingestion pipeline")
def trigger_live_ingestion():
    import random
    from datetime import datetime, timezone
    locations = [
        ("Singapore Port", 1.264, 103.840, "port-singapore"),
        ("Taiwan Strait", 24.3, 119.5, "port-kaohsiung"),
        ("Red Sea", 16.0, 41.0, "port-said"),
        ("Beta KK (Tokyo)", 35.6895, 139.6917, "sup-beta"),
    ]
    loc = random.choice(locations)
    signal = RiskSignal(
        id=f"sig-{random.randint(1000, 9999)}",
        type="geopolitical",
        source="cron-ingestor",
        subject=loc[3],
        body=f"Automated ingestion pipeline detected anomaly near {loc[0]}",
        severity=random.uniform(0.5, 0.9),
        lat=loc[1],
        lon=loc[2],
        geography=loc[0],
        entities=[loc[3]],
        observed_at=datetime.now(timezone.utc).isoformat()
    )
    state.signals.append(signal)
    state._refresh_derived()
    return _envelope({"status": "ok", "ingested": 1, "signal_id": signal.id})
"""

content = content.replace("@app.post(\"/v1/demo/reset\",", ingest_live + "\n\n@app.post(\"/v1/demo/reset\",")

with open("backend/app.py", "w") as f:
    f.write(content)

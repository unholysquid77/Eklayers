from backend.pipeline import IngestionPipeline, SignalStore
from backend.sources import MonitoredLocation


class FixtureAdapter:
    source_name = "Open-Meteo"
    def fetch(self, _locations):
        yield {"id": "weather-1", "type": "weather_advisory", "title": "High wind", "body": "wind", "observed_at": "2026-09-11T00:00:00Z", "intensity": 0.8, "entities": [{"id": "port-a"}]}


def test_pipeline_persists_and_deduplicates(tmp_path):
    pipeline = IngestionPipeline(SignalStore(tmp_path / "signals.db"))
    location = MonitoredLocation("port-a", "port", 1.0, 2.0)
    first = pipeline.run(FixtureAdapter(), [location])
    second = pipeline.run(FixtureAdapter(), [location])
    assert (first.accepted, first.deduplicated) == (1, 0)
    assert (second.accepted, second.deduplicated) == (0, 1)

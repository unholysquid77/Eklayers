"""CLI for the first live ingestion slice.

Example:
  python -m backend.run_ingestion --db data/sarvadarshi.db --port port-singapore 1.264 103.840 SG
"""
from __future__ import annotations

import argparse

from .pipeline import IngestionPipeline, SignalStore
from .sources import (GDACSAdapter, GoogleNewsAdapter, MonitoredLocation,
                      NWSAlertsAdapter, OpenMeteoAdapter, USGSEarthquakeAdapter,
                      WorldBankContainerTrafficAdapter)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Sarvadarshi P0 ingestors")
    parser.add_argument("--db", default="data/sarvadarshi.db")
    parser.add_argument("--port", nargs=4, metavar=("ID", "LAT", "LON", "COUNTRY"), action="append", default=[])
    parser.add_argument("--no-news", action="store_true", help="skip publisher RSS queries")
    args = parser.parse_args()
    locations = [MonitoredLocation(id=item[0], kind="port", latitude=float(item[1]), longitude=float(item[2]), country_code=item[3]) for item in args.port]
    pipeline = IngestionPipeline(SignalStore(args.db))
    adapters = [OpenMeteoAdapter(), GDACSAdapter(), NWSAlertsAdapter(), USGSEarthquakeAdapter(), WorldBankContainerTrafficAdapter()]
    if not args.no_news:
        adapters.append(GoogleNewsAdapter())
    for adapter in adapters:
        print(pipeline.run(adapter, locations))


if __name__ == "__main__":
    main()

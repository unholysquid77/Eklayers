"""Concrete live adapters for the selected Paqshi P0/P1 sources.

Each adapter yields raw dictionaries; normalisation, deduplication and durable
storage stay in `backend.pipeline`. This makes sources independently testable
and lets fixture mode exercise the entire pipeline without network access.
"""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen


USER_AGENT = "Sarvadarshi/0.1 (hackathon demo; contact: ops@example.invalid)"


def get_json(url: str, params: dict[str, Any] | None = None, timeout: int = 6) -> Any:
    target = f"{url}?{urlencode(params, doseq=True)}" if params else url
    request = Request(target, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get_text(url: str, timeout: int = 6) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml,text/html"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")



@dataclass(frozen=True)
class MonitoredLocation:
    id: str
    kind: str  # supplier_site | port | lane
    latitude: float
    longitude: float
    country_code: str | None = None

    def entity(self) -> dict[str, Any]:
        return {"kind": self.kind, "id": self.id, "match_confidence": 1.0}


class OpenMeteoAdapter:
    source_name = "Open-Meteo"
    endpoint = "https://api.open-meteo.com/v1/forecast"

    def fetch(self, locations: Iterable[MonitoredLocation]) -> Iterable[dict[str, Any]]:
        for location in locations:
            data = get_json(self.endpoint, {
                "latitude": location.latitude, "longitude": location.longitude,
                "current": "temperature_2m,precipitation,wind_speed_10m,weather_code",
                "forecast_days": 1,
            })
            current = data.get("current", {})
            wind = float(current.get("wind_speed_10m") or 0)
            precipitation = float(current.get("precipitation") or 0)
            code = int(current.get("weather_code") or 0)
            # Severe WMO weather codes, extreme wind, or active heavy rain.
            intensity = max(min(wind / 100.0, 1.0), min(precipitation / 20.0, 1.0), 0.75 if code >= 95 else 0.0)
            if intensity < 0.30:
                continue
            yield {
                "id": f"open-meteo:{location.id}:{current.get('time')}", "type": "weather_advisory",
                "title": f"Weather stress near {location.id}", "observed_at": current.get("time"),
                "source_url": self.endpoint, "intensity": intensity,
                "confidence": 0.85, "entities": [location.entity()],
                "geometry": {"type": "Point", "coordinates": [location.longitude, location.latitude]},
                "body": f"wind_kph={wind}; precipitation_mm={precipitation}; weather_code={code}",
            }


class GDACSAdapter:
    source_name = "GDACS"
    endpoint = "https://www.gdacs.org/xml/rss.xml"

    def fetch(self, _locations: Iterable[MonitoredLocation] = ()) -> Iterable[dict[str, Any]]:
        root = ET.fromstring(get_text(self.endpoint))
        for item in root.findall(".//item"):
            title = item.findtext("title", default="")
            link = item.findtext("link", default="")
            published = item.findtext("pubDate") or datetime.now(timezone.utc).isoformat()
            description = item.findtext("description", default="")
            # GDACS exposes severity in title/description; retain it as evidence,
            # while safe default intensity prevents optimistic parsing from risk.
            lowered = f"{title} {description}".lower()
            intensity = 0.85 if "red" in lowered else 0.60 if "orange" in lowered else 0.40
            yield {"id": f"gdacs:{link or title}", "type": "public_advisory", "title": title,
                   "body": description, "source_url": link or self.endpoint,
                   "observed_at": published, "intensity": intensity, "confidence": 0.90}


class NWSAlertsAdapter:
    source_name = "NWS"
    endpoint = "https://api.weather.gov/alerts/active"

    def fetch(self, locations: Iterable[MonitoredLocation]) -> Iterable[dict[str, Any]]:
        us_locations = [x for x in locations if x.country_code == "US"]
        if not us_locations:
            return
        data = get_json(self.endpoint, {"status": "actual", "limit": 25})

        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            severity = {"Extreme": 1.0, "Severe": 0.8, "Moderate": 0.55, "Minor": 0.35}.get(props.get("severity"), 0.30)
            yield {"id": props.get("id"), "type": "public_advisory", "title": props.get("event", "NWS alert"),
                   "body": props.get("description", ""), "source_url": props.get("@id") or self.endpoint,
                   "observed_at": props.get("sent"), "intensity": severity, "confidence": 0.90,
                   "geometry": feature.get("geometry")}


class USGSEarthquakeAdapter:
    source_name = "USGS"
    endpoint = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"

    def fetch(self, _locations: Iterable[MonitoredLocation] = ()) -> Iterable[dict[str, Any]]:
        data = get_json(self.endpoint)
        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            magnitude = float(props.get("mag") or 0.0)
            if magnitude < 4.0:
                continue
            yield {"id": feature.get("id"), "type": "hazard", "title": props.get("title", "Earthquake"),
                   "body": f"magnitude={magnitude}; place={props.get('place', '')}", "source_url": props.get("url"),
                   "observed_at": datetime.fromtimestamp((props.get("time") or 0) / 1000, tz=timezone.utc).isoformat(),
                   "intensity": min(1.0, magnitude / 8.0), "confidence": 0.95, "geometry": feature.get("geometry")}


class WorldBankContainerTrafficAdapter:
    source_name = "World Bank Container Traffic"
    endpoint = "https://api.worldbank.org/v2/country/WLD/indicator/IS.SHP.GOOD.TU"

    def fetch(self, _locations: Iterable[MonitoredLocation] = ()) -> Iterable[dict[str, Any]]:
        data = get_json(self.endpoint, {"format": "json", "per_page": 10})
        rows = data[1] if isinstance(data, list) and len(data) > 1 else []
        for row in rows:
            if row.get("value") is None:
                continue
            yield {"id": f"world-bank-container:{row.get('date')}", "type": "trade_baseline",
                   "title": "World container port traffic", "body": str(row.get("value")),
                   "source_url": self.endpoint, "observed_at": f"{row.get('date')}-12-31",
                   "intensity": 0.20, "confidence": 0.95}


class GoogleNewsAdapter:
    """Paqshi's curated maritime/freight publisher queries through Google RSS."""
    source_name = "Google News"
    publishers = {
        "FreightWaves": "site:freightwaves.com supply chain OR freight delay",
        "The Loadstar": "site:theloadstar.com shipping OR freight",
        "Splash247": "site:splash247.com shipping disruption",
        "gCaptain": "site:gcaptain.com shipping OR port",
        "JOC": "site:joc.com container freight OR port congestion",
        "SupplyChainDive": "site:supplychaindive.com supply chain disruption",
        "LloydsList": "site:lloydslist.com shipping disruption",
        "ContainerNews": "site:container-news.com shipping",
        "MaritimeExecutive": "site:maritime-executive.com shipping",
        "HellenicShipping": "site:hellenicshippingnews.com shipping",
        "Drewry": "Drewry World Container Index freight rates",
        "SupplyChainBrain": "site:supplychainbrain.com disruption",
        "SingaporePort": "Port of Singapore congestion container delay",
        "MalaccaStrait": "Strait of Malacca tanker maritime delay",
        "SuezRedSea": "Suez Canal container queue Red Sea reroute",
        "HormuzStrait": "Strait of Hormuz tanker transit security",
        "TaiwanMaritime": "Taiwan Strait shipping lane transit disruption",
        "PanamaCanal": "Panama Canal vessel draft transit restriction",
        "SemiconductorLogistics": "semiconductor automotive chip supply delay shipping",
    }

    def fetch(self, _locations: Iterable[MonitoredLocation] = ()) -> Iterable[dict[str, Any]]:
        for publisher, query in self.publishers.items():
            try:
                url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
                text_content = get_text(url)
                if not text_content:
                    continue
                root = ET.fromstring(text_content)
                for item in root.findall(".//item")[:15]:
                    title = item.findtext("title", default="").strip()
                    link = item.findtext("link", default="").strip()
                    body = item.findtext("description", default="").strip()
                    # Clean html tags from body if any
                    import re
                    clean_body = re.sub(r'<[^>]+>', ' ', body).strip()
                    pub_date = item.findtext("pubDate")
                    
                    # Estimate severity from title/body keywords
                    text_lower = f"{title} {clean_body}".lower()
                    sev = 0.35
                    if any(k in text_lower for k in ["critical", "halt", "blocked", "strike", "attack", "closed"]):
                        sev = 0.85
                    elif any(k in text_lower for k in ["delay", "congestion", "reroute", "severe", "queue", "disrupt"]):
                        sev = 0.65
                    elif any(k in text_lower for k in ["warning", "storm", "divert", "surge"]):
                        sev = 0.50

                    yield {
                        "id": f"{publisher}:{link or title}",
                        "type": "freight_news",
                        "title": title,
                        "body": clean_body,
                        "source_url": link,
                        "observed_at": pub_date or datetime.now(timezone.utc).isoformat(),
                        "intensity": sev,
                        "confidence": 0.80,
                        "publisher": publisher,
                        "domain": "maritime_freight"
                    }
            except Exception:
                continue


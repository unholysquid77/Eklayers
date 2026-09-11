"""Supply-chain news ingestors: RSS-first with Google News fallback.

Adapted from Paqshi's SupplyChainNewsIngestor and FreightWavesIngestor
patterns. Each publisher tries its own RSS feed first; on failure it
falls back to a Google News RSS query for the same domain.

The adapters yield raw dicts that flow through the existing
IngestionPipeline → normalize_signal → SQLite path.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from .sources import USER_AGENT


# ── RSS feed registry ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PublisherFeed:
    name: str
    domain: str
    rss_url: str | None  # direct RSS; None = Google News only
    google_query: str    # fallback Google News query
    credibility: float = 0.72


PUBLISHER_FEEDS: tuple[PublisherFeed, ...] = (
    PublisherFeed("FreightWaves", "freightwaves.com",
                  "https://www.freightwaves.com/feed",
                  "site:freightwaves.com supply chain OR freight delay"),
    PublisherFeed("TheLoadstar", "theloadstar.com",
                  "https://www.theloadstar.com/feed/",
                  "site:theloadstar.com shipping OR freight"),
    PublisherFeed("Splash247", "splash247.com",
                  "https://splash247.com/feed/",
                  "site:splash247.com shipping disruption"),
    PublisherFeed("gCaptain", "gcaptain.com",
                  "https://gcaptain.com/feed/",
                  "site:gcaptain.com shipping OR port"),
    PublisherFeed("JOC", "joc.com",
                  None,
                  "Journal of Commerce container freight OR site:joc.com"),
    PublisherFeed("SupplyChainDive", "supplychaindive.com",
                  "https://www.supplychaindive.com/feeds/news/",
                  "site:supplychaindive.com supply chain disruption"),
    PublisherFeed("LloydsList", "lloydslist.com",
                  None,
                  "Lloyd's List shipping disruption OR site:lloydslist.com"),
    PublisherFeed("ContainerNews", "container-news.com",
                  None,
                  "site:container-news.com shipping"),
    PublisherFeed("MaritimeExecutive", "maritime-executive.com",
                  "https://www.maritime-executive.com/feed",
                  "site:maritime-executive.com shipping"),
    PublisherFeed("HellenicShipping", "hellenicshippingnews.com",
                  "https://www.hellenicshippingnews.com/feed/",
                  "site:hellenicshippingnews.com shipping"),
    PublisherFeed("Drewry", "drewry.co.uk",
                  None,
                  "Drewry World Container Index freight rates"),
    PublisherFeed("SupplyChainBrain", "supplychainbrain.com",
                  "https://www.supplychainbrain.com/rss",
                  "site:supplychainbrain.com disruption"),
)


# ── Fetching helpers ─────────────────────────────────────────────────────────

def _fetch_url(url: str, timeout: int = 15) -> str | None:
    """Fetch a URL and return its text content, or None on failure."""
    try:
        request = Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        })
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def _google_news_rss(query: str) -> str:
    """Build a Google News RSS URL for the given query."""
    return (
        "https://news.google.com/rss/search?"
        f"q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    )


def _parse_rss_items(xml_text: str) -> list[dict[str, Any]]:
    """Parse RSS/Atom XML into a list of item dicts."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    items: list[dict[str, Any]] = []
    # RSS 2.0: //item, Atom: //entry
    for item_el in root.findall(".//item"):
        title = (item_el.findtext("title") or "").strip()
        link = (item_el.findtext("link") or "").strip()
        pub_date = (item_el.findtext("pubDate") or "").strip()
        description = (item_el.findtext("description") or "").strip()
        if not title:
            continue
        items.append({
            "title": title,
            "link": link or None,
            "pub_date": pub_date,
            "description": description,
        })
    return items


def _parse_pub_date(date_str: str) -> datetime | None:
    """Best-effort parse of RSS pubDate or ISO datetime strings."""
    if not date_str:
        return None
    # RFC 2822: "Mon, 10 Sep 2026 08:00:00 GMT"
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            continue
    return None


# ── Public API ───────────────────────────────────────────────────────────────

def fetch_publisher_news(publisher: PublisherFeed) -> list[dict[str, Any]]:
    """Fetch news items for a single publisher.

    Tries the direct RSS feed first. On failure, falls back to Google News.
    Returns a list of raw signal dicts ready for normalize_signal().
    """
    items: list[dict[str, Any]] = []

    # 1. Try direct RSS
    if publisher.rss_url:
        xml_text = _fetch_url(publisher.rss_url)
        if xml_text:
            parsed = _parse_rss_items(xml_text)
            for entry in parsed[:15]:
                items.append({
                    "title": entry["title"],
                    "type": "freight_news",
                    "source_url": entry["link"] or publisher.rss_url,
                    "observed_at": _parse_pub_date(entry["pub_date"]),
                    "intensity": 0.35,
                    "confidence": publisher.credibility,
                    "publisher": publisher.name,
                    "body": entry.get("description", "")[:500],
                })

    # 2. Fallback to Google News RSS
    if not items:
        gn_url = _google_news_rss(publisher.google_query)
        xml_text = _fetch_url(gn_url)
        if xml_text:
            parsed = _parse_rss_items(xml_text)
            for entry in parsed[:15]:
                items.append({
                    "title": entry["title"],
                    "type": "freight_news",
                    "source_url": entry["link"],
                    "observed_at": _parse_pub_date(entry["pub_date"]),
                    "intensity": 0.35,
                    "confidence": publisher.credibility * 0.9,  # slight penalty for Google News bridge
                    "publisher": publisher.name,
                    "body": entry.get("description", "")[:500],
                })

    return items


def fetch_all_publisher_news(
    publishers: tuple[PublisherFeed, ...] = PUBLISHER_FEEDS,
) -> list[dict[str, Any]]:
    """Fetch news from all configured publishers.

    Returns a flat list of raw signal dicts, deduplicated by title hash.
    """
    import hashlib

    seen_hashes: set[str] = set()
    all_items: list[dict[str, Any]] = []

    for publisher in publishers:
        try:
            items = fetch_publisher_news(publisher)
        except Exception:
            items = []

        for item in items:
            # Deduplicate by normalized title hash
            norm = hashlib.md5(item["title"].lower().encode()).hexdigest()[:12]
            if norm in seen_hashes:
                continue
            seen_hashes.add(norm)
            all_items.append(item)

    return all_items

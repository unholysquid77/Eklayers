"""Durable ingestion orchestration: fetch → normalize → dedupe → persist."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Protocol

from .ingestion import SOURCES, SourceDefinition, normalize_signal
from .sources import MonitoredLocation


class Adapter(Protocol):
    source_name: str
    def fetch(self, locations: Iterable[MonitoredLocation]) -> Iterable[dict[str, Any]]: ...


@dataclass(frozen=True)
class RunSummary:
    source: str
    fetched: int
    accepted: int
    deduplicated: int
    quarantined: int
    error: str | None = None


class SignalStore:
    def __init__(self, database_path: str | Path = "data/sarvadarshi.db") -> None:
        self.path = Path(database_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS signals (
                    id TEXT PRIMARY KEY, source TEXT NOT NULL, signal_type TEXT NOT NULL,
                    observed_at TEXT NOT NULL, ingested_at TEXT NOT NULL, payload_hash TEXT NOT NULL UNIQUE,
                    intensity REAL NOT NULL, confidence REAL NOT NULL, payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_signals_source_time ON signals(source, observed_at DESC);
                
                CREATE TABLE IF NOT EXISTS ingestion_runs (
                    id INTEGER PRIMARY KEY, source TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT NOT NULL,
                    fetched INTEGER NOT NULL, accepted INTEGER NOT NULL, deduplicated INTEGER NOT NULL,
                    quarantined INTEGER NOT NULL, error TEXT
                );

                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY, actor TEXT, action TEXT, object TEXT, location TEXT,
                    latitude REAL, longitude REAL, occurred_at TEXT, confidence REAL, severity REAL,
                    domain TEXT, event_category TEXT, raw_text TEXT, payload_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_events_time ON events(occurred_at DESC);

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, source_name TEXT, source_url TEXT, title TEXT, body TEXT,
                    published_at TEXT, domain TEXT, payload_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_docs_pub ON documents(published_at DESC);

                CREATE TABLE IF NOT EXISTS trajectories (
                    id TEXT PRIMARY KEY, subject_kind TEXT, subject_id TEXT, subject_label TEXT,
                    t0 TEXT, horizon_days INTEGER, last_value REAL, baseline REAL,
                    points_json TEXT, notes_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_traj_subj ON trajectories(subject_id);

                CREATE TABLE IF NOT EXISTS enterprise_config (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)

    def _connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def persist(self, signal: dict[str, Any]) -> bool:
        try:
            with self._connection() as conn:
                conn.execute("""INSERT INTO signals(id, source, signal_type, observed_at, ingested_at, payload_hash, intensity, confidence, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (signal["id"], signal["source"], signal["type"], signal["observed_at"], signal["ingested_at"], signal["raw_payload_hash"], signal["intensity"], signal["confidence"], json.dumps(signal, sort_keys=True)))
            return True
        except sqlite3.IntegrityError:
            return False

    def load_all_signals(self, limit: int = 2000) -> list[dict[str, Any]]:
        """Loads persisted signals from SQLite."""
        try:
            with self._connection() as conn:
                rows = conn.execute("SELECT payload_json FROM signals ORDER BY observed_at DESC LIMIT ?", (limit,)).fetchall()
                signals = []
                for (payload_str,) in rows:
                    try:
                        signals.append(json.loads(payload_str))
                    except Exception:
                        pass
                return signals
        except Exception:
            return []

    def record_run(self, summary: RunSummary, started_at: str) -> None:
        with self._connection() as conn:
            conn.execute("INSERT INTO ingestion_runs(source, started_at, finished_at, fetched, accepted, deduplicated, quarantined, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (summary.source, started_at, datetime.now(timezone.utc).isoformat(), summary.fetched, summary.accepted, summary.deduplicated, summary.quarantined, summary.error))

    def save_enterprise_config(self, cfg: dict[str, Any], key: str = "active_config") -> None:
        """Persists enterprise configuration dictionary to SQLite."""
        try:
            with self._connection() as conn:
                now_str = datetime.now(timezone.utc).isoformat()
                conn.execute("""
                    INSERT INTO enterprise_config (key, value_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at
                """, (key, json.dumps(cfg), now_str))
        except Exception as exc:
            pass

    def load_enterprise_config(self, key: str = "active_config") -> dict[str, Any] | None:
        """Loads persisted enterprise configuration dictionary from SQLite."""
        try:
            with self._connection() as conn:
                row = conn.execute("SELECT value_json FROM enterprise_config WHERE key = ?", (key,)).fetchone()
                if row and row[0]:
                    return json.loads(row[0])
        except Exception:
            pass
        return None

    def load_trajectories(self) -> dict[str, Any]:
        """Loads latest probabilistic forecast trajectories keyed by subject_id."""
        traj_map = {}
        try:
            with self._connection() as conn:
                rows = conn.execute("SELECT subject_id, subject_label, horizon_days, last_value, baseline, points_json FROM trajectories").fetchall()
                for r in rows:
                    sub_id, label, h_days, last_val, base, points_str = r
                    try:
                        pts = json.loads(points_str) if points_str else []
                    except Exception:
                        pts = []
                    traj_map[sub_id] = {
                        "subject_id": sub_id,
                        "label": label,
                        "horizon_days": h_days,
                        "last_value": last_val,
                        "baseline": base,
                        "points": pts,
                    }
        except Exception:
            pass
        return traj_map


class IngestionPipeline:
    def __init__(self, store: SignalStore, sources: Iterable[SourceDefinition] = SOURCES) -> None:
        self.store = store
        self.sources = {source.name: source for source in sources}

    def run(self, adapter: Adapter, locations: Iterable[MonitoredLocation] = ()) -> RunSummary:
        started = datetime.now(timezone.utc).isoformat()
        source = self.sources[adapter.source_name]
        fetched = accepted = deduplicated = quarantined = 0
        accepted_signals = []
        error: str | None = None
        try:
            for raw in adapter.fetch(locations):
                fetched += 1
                try:
                    signal = normalize_signal(raw, source)
                    if self.store.persist(signal):
                        accepted += 1
                        accepted_signals.append(signal)
                    else:
                        deduplicated += 1
                except (TypeError, ValueError, KeyError) as exc:
                    quarantined += 1
                    error = str(exc)
        except Exception as exc:  # record source health, do not crash all feeds
            error = f"{type(exc).__name__}: {exc}"
        
        # Forward accepted signals to live in-memory FastAPI backend
        if accepted_signals:
            try:
                import urllib.request, urllib.error
                req = urllib.request.Request(
                    "http://localhost:8000/v1/ingest/signals",
                    data=json.dumps(accepted_signals).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                urllib.request.urlopen(req, timeout=2)
            except Exception:
                pass

        summary = RunSummary(adapter.source_name, fetched, accepted, deduplicated, quarantined, error)
        self.store.record_run(summary, started)
        return summary


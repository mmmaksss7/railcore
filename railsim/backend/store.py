"""SQLite short-term history (24–72h)."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

DB = Path(__file__).resolve().parent / "data" / "railsim.db"


class Store:
    def __init__(self, path: Path = DB) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._lock = threading.Lock()
        self._init()

    def _conn(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        return con

    def _init(self) -> None:
        with self._lock, self._conn() as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                  id TEXT PRIMARY KEY,
                  ts INTEGER NOT NULL,
                  level TEXT,
                  text TEXT,
                  detail TEXT,
                  train_id TEXT,
                  station_id TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
                CREATE TABLE IF NOT EXISTS snapshots (
                  ts INTEGER PRIMARY KEY,
                  trains INTEGER,
                  delays INTEGER,
                  load_avg INTEGER,
                  wagons INTEGER,
                  payload TEXT
                );
                CREATE TABLE IF NOT EXISTS train_samples (
                  ts INTEGER NOT NULL,
                  train_id TEXT NOT NULL,
                  speed INTEGER,
                  status TEXT,
                  delay INTEGER,
                  t REAL,
                  edge INTEGER
                );
                CREATE INDEX IF NOT EXISTS idx_samples_ts ON train_samples(ts);
                """
            )

    def add_event(self, ev: dict) -> None:
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT OR REPLACE INTO events(id,ts,level,text,detail,train_id,station_id) VALUES(?,?,?,?,?,?,?)",
                (
                    ev.get("id"),
                    int(ev.get("ts") or 0),
                    ev.get("level"),
                    ev.get("text"),
                    ev.get("detail"),
                    ev.get("trainId") or ev.get("train_id"),
                    ev.get("stationId") or ev.get("station_id"),
                ),
            )

    def add_snapshot(self, ts: int, kpi: dict) -> None:
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT OR REPLACE INTO snapshots(ts,trains,delays,load_avg,wagons,payload) VALUES(?,?,?,?,?,?)",
                (
                    int(ts),
                    int(kpi.get("trains") or 0),
                    int(kpi.get("delays") or 0),
                    int(kpi.get("avg") or 0),
                    int(kpi.get("wagons") or 0),
                    json.dumps(kpi, ensure_ascii=False),
                ),
            )

    def add_samples(self, ts: int, trains: list[dict]) -> None:
        rows = [
            (int(ts), t["id"], int(t.get("speed") or 0), t.get("status"), int(t.get("delayMin") or 0), float(t.get("t") or 0), int(t.get("edge") or 0))
            for t in trains
        ]
        with self._lock, self._conn() as con:
            con.executemany(
                "INSERT INTO train_samples(ts,train_id,speed,status,delay,t,edge) VALUES(?,?,?,?,?,?,?)",
                rows,
            )

    def events(self, since_ms: int | None = None, limit: int = 200) -> list[dict]:
        q = "SELECT id,ts,level,text,detail,train_id,station_id FROM events"
        args: list[Any] = []
        if since_ms:
            q += " WHERE ts >= ?"
            args.append(int(since_ms))
        q += " ORDER BY ts DESC LIMIT ?"
        args.append(int(limit))
        with self._lock, self._conn() as con:
            rows = con.execute(q, args).fetchall()
        return [
            {
                "id": r["id"],
                "ts": r["ts"],
                "level": r["level"],
                "text": r["text"],
                "detail": r["detail"],
                "trainId": r["train_id"],
                "stationId": r["station_id"],
            }
            for r in rows
        ]

    def snapshots(self, since_ms: int | None = None, limit: int = 400) -> list[dict]:
        q = "SELECT ts,trains,delays,load_avg,wagons,payload FROM snapshots"
        args: list[Any] = []
        if since_ms:
            q += " WHERE ts >= ?"
            args.append(int(since_ms))
        q += " ORDER BY ts ASC LIMIT ?"
        args.append(int(limit))
        with self._lock, self._conn() as con:
            rows = con.execute(q, args).fetchall()
        out = []
        for r in rows:
            item = {
                "ts": r["ts"],
                "trains": r["trains"],
                "delays": r["delays"],
                "load_avg": r["load_avg"],
                "wagons": r["wagons"],
            }
            try:
                extra = json.loads(r["payload"] or "{}")
                item.update(extra)
            except json.JSONDecodeError:
                pass
            out.append(item)
        return out

    def train_history(self, train_id: str, since_ms: int | None = None, limit: int = 300) -> list[dict]:
        q = "SELECT ts,speed,status,delay,t,edge FROM train_samples WHERE train_id=?"
        args: list[Any] = [train_id]
        if since_ms:
            q += " AND ts >= ?"
            args.append(int(since_ms))
        q += " ORDER BY ts ASC LIMIT ?"
        args.append(int(limit))
        with self._lock, self._conn() as con:
            rows = con.execute(q, args).fetchall()
        return [dict(r) for r in rows]

    def purge(self, hours: int) -> dict[str, int]:
        cutoff = int(time.time() * 1000) - hours * 3600 * 1000
        with self._lock, self._conn() as con:
            e = con.execute("DELETE FROM events WHERE ts < ?", (cutoff,)).rowcount
            s = con.execute("DELETE FROM snapshots WHERE ts < ?", (cutoff,)).rowcount
            t = con.execute("DELETE FROM train_samples WHERE ts < ?", (cutoff,)).rowcount
        return {"events": e, "snapshots": s, "samples": t}

    def stats(self) -> dict[str, int]:
        with self._lock, self._conn() as con:
            ev = con.execute("SELECT COUNT(*) c FROM events").fetchone()["c"]
            sn = con.execute("SELECT COUNT(*) c FROM snapshots").fetchone()["c"]
            sm = con.execute("SELECT COUNT(*) c FROM train_samples").fetchone()["c"]
        return {"events": ev, "snapshots": sn, "samples": sm}

    def ping(self) -> bool:
        try:
            with self._lock, self._conn() as con:
                con.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:
            return False


store = Store()

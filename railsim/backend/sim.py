"""Railway simulation loop. Config-driven thresholds, no recompile needed."""
from __future__ import annotations

import copy
import json
import logging
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from bus import bus
from store import store

log = logging.getLogger("railsim.sim")
ROOT = Path(__file__).resolve().parent
CFG_PATH = ROOT / "data" / "config.yaml"
WORLD_PATH = ROOT / "data" / "world.json"
START_MS = int(datetime(2026, 10, 14, 14, 32, 10, tzinfo=timezone.utc).timestamp() * 1000)

DEFAULT_CFG = {
    "history_hours": 72,
    "snapshot_interval_sec": 15,
    "sample_interval_sec": 8,
    "thresholds": {
        "axlebox_c": 80,
        "axlebox_alarm_c": 87,
        "delay_warn_min": 5,
        "delay_alarm_min": 15,
        "load_warn_pct": 70,
        "load_alarm_pct": 90,
        "loco_health_min": 60,
        "wagon_health_min": 70,
    },
    "constraints": {
        "max_speed_freight": 80,
        "max_speed_passenger": 120,
        "max_speed_intl": 90,
        "dwell_min_sec": 18,
        "dwell_max_sec": 55,
    },
    "optimization": {
        "reroute_load_threshold": 85,
        "ktsm_stop_station": "ast",
        "reroute_train_id": "t5503",
        "alt_via_station": "bxh",
    },
    "index": {"snapshot_retention_hours": 72, "event_retention_hours": 72},
}


def load_config() -> dict:
    if CFG_PATH.exists():
        with CFG_PATH.open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        cfg = copy.deepcopy(DEFAULT_CFG)
        for k, v in data.items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
        return cfg
    return copy.deepcopy(DEFAULT_CFG)


def save_config(cfg: dict) -> dict:
    CFG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CFG_PATH.open("w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, allow_unicode=True, sort_keys=False)
    return cfg


def _wagon_type(cargo: str) -> str:
    c = cargo.lower()
    if "пассаж" in c:
        return "Пассажирский"
    if "нефть" in c or "мазут" in c:
        return "Цистерна"
    if "контейнер" in c:
        return "Контейнер"
    if "авто" in c:
        return "Автовоз"
    if "зерно" in c:
        return "Зерновоз"
    if "щеб" in c or "сер" in c or "соль" in c:
        return "Хоппер"
    if "служеб" in c:
        return "Платформа"
    return "Полувагон"


def _wagons(frm: str, to: str, cargo: str, n: int, start: int = 61847290) -> list[dict]:
    kind = _wagon_type(cargo)
    return [
        {
            "id": f"w{start + i}",
            "number": str(start + i),
            "type": kind,
            "cargo": cargo,
            "from": frm,
            "to": to,
            "health": 88 + ((i * 7) % 12),
        }
        for i in range(n)
    ]


def seed_trains() -> list[dict]:
    w4827 = _wagons("Экибастуз", "ТЭЦ Караганда", "Уголь", 12)
    w4827[2] = {**w4827[2], "number": "61877302", "id": "w61877302", "health": 71}
    hero = [
        {"id": "t4827", "number": "4827", "kind": "грузовой", "route": ["ekb", "ast", "kgf"], "edge": 0, "t": 0.42, "heading": 1, "speed": 64, "delayMin": 12, "status": "в пути", "dwell": 0, "loco": {"model": "2ТЭ-25КМ", "number": "0047", "health": 82}, "crew": {"id": "182", "driver": "Иванов А.С.", "helper": "Петров Д.В."}, "wagons": w4827, "lengthM": 720, "massT": 5840},
        {"id": "t712", "number": "712", "kind": "пассажирский", "route": ["alm", "ast", "ppk"], "edge": 0, "t": 0.35, "heading": 1, "speed": 88, "delayMin": 0, "status": "в пути", "dwell": 0, "loco": {"model": "KZ4", "number": "0012", "health": 94}, "crew": {"id": "091", "driver": "Садыков М.К.", "helper": "Омаров Е.Т."}, "wagons": _wagons("Алматы", "Петропавл", "пассажиры", 8, 70011000), "lengthM": 210, "massT": 640},
        {"id": "t5503", "number": "5503", "kind": "грузовой", "route": ["dzn", "kgf", "ast"], "edge": 0, "t": 0.2, "heading": 1, "speed": 48, "delayMin": 0, "status": "в пути", "dwell": 0, "loco": {"model": "ТЭ33А", "number": "0034", "health": 79}, "crew": {"id": "204", "driver": "Ким В.П.", "helper": "Нурланов А."}, "wagons": _wagons("Жезказган", "Астана", "Металл", 16, 53001000), "lengthM": 890, "massT": 4120},
        {"id": "t101", "number": "101", "kind": "международный", "route": ["akx", "ast", "alm", "dos"], "edge": 2, "t": 0.3, "heading": 1, "speed": 72, "delayMin": 0, "status": "в пути", "dwell": 0, "loco": {"model": "KZ8", "number": "0008", "health": 91}, "crew": {"id": "017", "driver": "Ли В.", "helper": "Чжан Х."}, "wagons": _wagons("Актобе", "Достык (КНР)", "Контейнеры", 10, 88001000), "lengthM": 540, "massT": 1980},
        {"id": "t001", "number": "001", "kind": "пассажирский", "route": ["alm", "ast"], "edge": 0, "t": 0.55, "heading": 1, "speed": 96, "delayMin": 8, "status": "в пути", "dwell": 0, "loco": {"model": "2ЭС7", "number": "0003", "health": 97}, "crew": {"id": "044", "driver": "Белов И.Н.", "helper": "Серов П.А."}, "wagons": _wagons("Алматы", "Астана", "пассажиры", 9, 10001000), "lengthM": 248, "massT": 710},
        {"id": "t3301", "number": "3301", "kind": "грузовой", "route": ["sco", "guw", "akx"], "edge": 0, "t": 0.7, "heading": 1, "speed": 41, "delayMin": 4, "status": "в пути", "dwell": 0, "loco": {"model": "ТЭ33А", "number": "0047", "health": 68}, "crew": {"id": "311", "driver": "Жумабаев С.", "helper": "Ибраев Т."}, "wagons": _wagons("Актау", "Актобе", "Нефть", 14, 44001000), "lengthM": 610, "massT": 3210},
        {"id": "t900", "number": "900", "kind": "служебный", "route": ["ast", "kgf"], "edge": 0, "t": 0.5, "heading": 1, "speed": 28, "delayMin": 0, "status": "в пути", "dwell": 0, "loco": {"model": "ТЭМ-9", "number": "118", "health": 74}, "crew": {"id": "508", "driver": "Маневров К.", "helper": "—"}, "wagons": [], "lengthM": 18, "massT": 126},
    ]
    names = {
        "ast": "Астана", "alm": "Алматы-2", "shy": "Шымкент", "kgf": "Караганда", "akx": "Актобе",
        "pwq": "Павлодар", "ppk": "Петропавл", "sco": "Актау", "guw": "Атырау", "ura": "Орал",
        "ukk": "Усть-Каменогорск", "plx": "Семей", "dos": "Достык", "ekb": "Экибастуз",
        "dzn": "Жезказган", "bxh": "Балхаш", "kzo": "Костанай", "kzo2": "Кызылорда",
        "shu": "Шу", "tar": "Тараз", "ary": "Арыс", "trk": "Туркестан", "bei": "Бейнеу",
        "atg": "Актогай", "alk": "Алтынколь", "tdk": "Талдыкорган", "sry": "Сарыагаш",
    }
    nm = lambda i: names.get(i, i)
    drivers = ["Ахметов С.К.", "Бекенов Е.Т.", "Галымов Р.", "Даулет Н.", "Ермеков А.", "Жумабаев С.", "Исмаилов К.", "Касымов Д.", "Ли В.П.", "Муканов Т.", "Нурпеисов А.", "Омарова Ж.", "Пак С.И.", "Рахимов Б.", "Садыков М."]
    corridors = [
        (["alm", "ast"], "пассажирский", "пассажиры", 96, "2ЭС7", 9),
        (["alm", "ast", "ppk"], "пассажирский", "пассажиры", 88, "KZ4", 8),
        (["ast", "pwq"], "пассажирский", "пассажиры", 90, "KZ4", 7),
        (["ast", "kzo"], "пассажирский", "пассажиры", 84, "KZ8", 8),
        (["alm", "shu", "tar", "ary", "shy"], "пассажирский", "пассажиры", 86, "KZ4", 8),
        (["shy", "kzo2"], "пассажирский", "пассажиры", 78, "KZ8", 6),
        (["ary", "trk"], "пассажирский", "пассажиры", 70, "KZ4", 5),
        (["ekb", "ast", "kgf"], "грузовой", "Уголь", 62, "2ТЭ-25КМ", 14),
        (["dzn", "kgf", "ast"], "грузовой", "Металл", 52, "ТЭ33А", 16),
        (["sco", "guw", "akx"], "грузовой", "Нефть", 44, "ТЭ33А", 12),
        (["bei", "akx"], "грузовой", "Сера", 40, "ТЭ36А", 15),
        (["pwq", "ekb", "ast"], "грузовой", "Уголь", 58, "2ТЭ-25КМ", 18),
        (["kzo2", "dzn", "kgf"], "грузовой", "Руда", 46, "ТЭ33А", 13),
        (["kgf", "bxh", "atg"], "грузовой", "Щебень", 50, "ТЭ36А", 11),
        (["atg", "plx"], "грузовой", "Зерно", 54, "ТЭ33А", 12),
        (["plx", "ukk"], "грузовой", "Металл", 42, "SKD-9", 10),
        (["kgf", "ukk"], "грузовой", "Уголь", 55, "2ТЭ-25КМ", 14),
        (["akx", "ast"], "грузовой", "Зерно", 60, "ТЭ33А", 12),
        (["guw", "akx", "ast"], "грузовой", "Нефть", 48, "ТЭ36А", 11),
        (["ura", "akx"], "грузовой", "Металл", 51, "ТЭ33А", 9),
        (["akx", "ast", "alm", "dos"], "международный", "Контейнеры", 72, "KZ8", 10),
        (["alm", "dos"], "международный", "Контейнеры", 68, "KZ8", 12),
        (["alm", "alk"], "международный", "Автозапчасти", 64, "KZ4", 8),
        (["shy", "sry"], "международный", "пассажиры", 75, "KZ4", 6),
        (["ast", "kgf"], "служебный", "служебный", 32, "ТЭМ-9", 0),
        (["alm", "tdk"], "пассажирский", "пассажиры", 82, "2ЭС7", 6),
        (["ura", "guw"], "пассажирский", "пассажиры", 74, "ТЭ36А", 5),
        (["akx", "kzo2"], "грузовой", "Соль", 47, "ТЭ36А", 14),
    ]
    extra = []
    n = 0
    for copy in range(2):
        for route, kind, cargo, speed, loco, cars in corridors:
            n += 1
            heading = 1 if (n + copy) % 2 == 0 else -1
            last = len(route) - 1
            edge = (n + copy) % max(1, last) if heading == 1 else min(last, 1 + ((n + copy) % max(1, last)))
            extra.append({
                "id": f"tf{2000 + n + copy * 100}",
                "number": str(2100 + n + copy * 40),
                "kind": kind,
                "route": route,
                "edge": edge,
                "t": ((n * 0.173 + copy * 0.41) % 0.9) + 0.04,
                "heading": heading,
                "speed": speed + ((n % 5) - 2) * 2,
                "delayMin": 3 + (n % 7) if n % 9 == 0 else 0,
                "status": "на станции" if n % 11 == 0 else "в пути",
                "dwell": 12 if n % 11 == 0 else 0,
                "loco": {"model": ("ТЭМ-11" if kind == "служебный" and copy == 0 else "SKD6e" if kind == "служебный" else loco), "number": f"{100 + n:04d}", "health": 70 + (n % 28)},
                "crew": {"id": str(300 + n), "driver": drivers[n % len(drivers)], "helper": drivers[(n * 3) % len(drivers)]},
                "wagons": _wagons(nm(route[0]), nm(route[-1]), cargo, cars, 54000000 + n * 20) if cars else [],
                "lengthM": cars * 14 + 22 if cars else 18,
                "massT": cars * 52 if kind == "пассажирский" else cars * 68 + 120,
            })
    return hero + extra



class Simulator:
    def __init__(self) -> None:
        world = json.loads(WORLD_PATH.read_text(encoding="utf-8"))
        self.stations: list[dict] = world["stations"]
        self.edges: list[dict] = world["edges"]
        self.trains: list[dict] = seed_trains()
        self.events: list[dict] = []
        self.closed_tracks: dict[str, list[str]] = {}
        self.docs: dict[str, dict] = {}
        self.time = START_MS
        self.speed = 1
        self.paused = False
        self.cfg = load_config()
        self.scenario = {"ktsm": False, "stopped": False, "repaired": False, "uncoupled": False, "rerouted": False}
        self.ticks = 0
        self.commands = 0
        self.ktsm_alerts = 0
        self._ev_n = 0
        self._push(
            "ok",
            "Поезд №101 отправлен",
            "Актобе → Достык, международный транзит",
            train_id="t101",
            ts=START_MS - 4 * 60_000,
        )
        self._push("fix", "Завершён ремонт вагона", "Вагонное депо Астана, 3 ч", station_id="ast", ts=START_MS - 2 * 60_000)

    def reload_config(self, patch: dict | None = None) -> dict:
        cfg = load_config()
        if patch:
            for k, v in patch.items():
                if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                    cfg[k].update(v)
                else:
                    cfg[k] = v
            save_config(cfg)
        self.cfg = cfg
        log.info("config reloaded")
        return cfg

    def st_name(self, sid: str) -> str:
        for s in self.stations:
            if s["id"] == sid:
                return s["name"]
        return sid

    def find_edge(self, a: str, b: str) -> dict | None:
        for e in self.edges:
            if (e["from"] == a and e["to"] == b) or (e["from"] == b and e["to"] == a):
                return e
        return None

    def _push(self, level: str, text: str, detail: str = "", train_id: str | None = None, station_id: str | None = None, ts: int | None = None) -> dict:
        self._ev_n += 1
        ev = {
            "id": f"ev{ts or self.time}-{self._ev_n}",
            "ts": ts or self.time,
            "level": level,
            "text": text,
            "detail": detail or None,
            "trainId": train_id,
            "stationId": station_id,
        }
        self.events = [ev, *self.events][:80]
        store.add_event(ev)
        return ev

    def kpi(self) -> dict:
        avg = round(sum(e["load"] for e in self.edges) / max(len(self.edges), 1))
        delays = sum(1 for t in self.trains if t["delayMin"] > 0)
        wagons = sum(len(t["wagons"]) for t in self.trains) + 1100
        faults = sum(1 for t in self.trains for w in t["wagons"] if w.get("fault"))
        stopped = sum(1 for t in self.trains if t["status"] == "остановлен")
        return {
            "avg": avg,
            "delays": delays,
            "locos": max(83, len(self.trains)),
            "wagons": wagons,
            "cargo": 286,
            "trains": len(self.trains),
            "faults": faults,
            "stopped": stopped,
        }

    def ai(self) -> dict:
        th = self.cfg["thresholds"]
        opt = self.cfg["optimization"]
        recs: list[dict] = []
        notes: list[str] = []
        bars = [
            ["Загруженность сети", self.kpi()["avg"]],
            ["Астана", next((s["occupied"] * 100 // max(s["tracks"], 1) for s in self.stations if s["id"] == "ast"), 91)],
            ["Караганда", next((s["occupied"] * 100 // max(s["tracks"], 1) for s in self.stations if s["id"] == "kgf"), 87)],
            ["Достык (коридор КНР)", next((e["load"] for e in self.edges if e["id"] == "alm-dos"), 44)],
        ]
        if self.scenario["ktsm"] and not self.scenario["stopped"]:
            stop_id = opt.get("ktsm_stop_station", "ast")
            recs.append({
                "id": "stop-4827",
                "action": "stop",
                "trainId": "t4827",
                "text": f"Остановить №4827 на станции {self.st_name(stop_id)}: КТСМ, перегрев буксы выше {th['axlebox_c']}°C.",
            })
        load_edge = next((e for e in self.edges if e["id"] == "ast-kgf"), None)
        if load_edge and load_edge["load"] >= opt.get("reroute_load_threshold", 85) and not self.scenario["rerouted"]:
            recs.append({
                "id": "reroute-5503",
                "action": "reroute",
                "trainId": opt.get("reroute_train_id", "t5503"),
                "text": f"Участок Астана — Караганда {load_edge['load']}%. Направить №5503 через {self.st_name(opt.get('alt_via_station','bxh'))}.",
            })
        for t in self.trains:
            if t["delayMin"] >= th["delay_alarm_min"]:
                notes.append(f"Поезд №{t['number']}: задержка +{t['delayMin']} мин (порог {th['delay_alarm_min']}).")
            if t["loco"]["health"] < th["loco_health_min"]:
                notes.append(f"Локомотив {t['loco']['model']} №{t['loco']['number']} требует ТО ({t['loco']['health']}%).")
        if not recs and not notes:
            notes.append("Сеть в норме. Существенных конфликтов маршрутов нет.")
        return {"bars": bars, "recs": recs, "notes": notes}

    def _cap_speed(self, train: dict) -> int:
        c = self.cfg["constraints"]
        kind = train["kind"]
        cap = c["max_speed_passenger"] if kind == "пассажирский" else c["max_speed_intl"] if kind == "международный" else c["max_speed_freight"]
        return min(int(train.get("cruise") or train["speed"] or cap), cap) if train["status"] != "остановлен" else 0

    def tick(self, dt: float) -> None:
        if self.paused or self.speed == 0:
            return
        sim_dt = dt * self.speed
        self.time += int(sim_dt * 1000)
        self.ticks += 1
        self.trains = [self._move(t, sim_dt) for t in self.trains]
        self._maybe_ktsm()
        if random.random() < 0.0007 * self.speed:
            pool = [
                ("warn", "Неисправность стрелочного перевода №18", "ast"),
                ("ok", "Смена бригады на станции Астана", "ast"),
                ("ok", "Поезд принят на путь 4", "kgf"),
                ("warn", "Задержка по станции Шымкент", "shy"),
            ]
            level, text, sid = random.choice(pool)
            ev = self._push(level, text, station_id=sid)
            # fire-and-forget publish from sync context via create_task in app loop

    def _maybe_ktsm(self) -> None:
        if self.scenario["ktsm"]:
            return
        clock = datetime.fromtimestamp(self.time / 1000, tz=timezone.utc)
        sec = clock.hour * 3600 + clock.minute * 60 + clock.second
        if sec < 14 * 3600 + 32 * 60 + 24:
            return
        th = self.cfg["thresholds"]
        self.scenario["ktsm"] = True
        self.ktsm_alerts += 1
        tr = next((t for t in self.trains if t["id"] == "t4827"), None)
        if tr:
            w = next((x for x in tr["wagons"] if x["number"] == "61877302"), tr["wagons"][2] if tr["wagons"] else None)
            if w:
                w["fault"] = f"Перегрев буксы {th['axlebox_alarm_c']}°C"
                w["tempC"] = th["axlebox_alarm_c"]
        stop_id = self.cfg["optimization"].get("ktsm_stop_station", "ast")
        self._push("warn", "КТСМ перегрев буксы", f"КТСМ-02 · Поезд №4827, вагон 61877302 · {th['axlebox_alarm_c']}°C", train_id="t4827")
        self._push("alarm", f"AI: остановить №4827 на станции {self.st_name(stop_id)}", "Отцепить вагон и направить в вагонное депо", train_id="t4827", station_id=stop_id)

    def _move(self, train: dict, dt: float) -> dict:
        t = copy.deepcopy(train)
        if t["status"] == "остановлен":
            return t
        if t["status"] == "на станции":
            t["dwell"] -= dt
            if t["dwell"] <= 0:
                t["status"] = "в пути"
            return t
        route = t["route"]
        a = route[t["edge"]]
        nxt = t["edge"] + t["heading"]
        b = route[nxt] if 0 <= nxt < len(route) else a
        edge = self.find_edge(a, b)
        if not edge:
            return t
        closed = self.closed_tracks.get(a) or self.closed_tracks.get(b)
        factor = 0.55 if closed else 1.0
        cruise = t.get("cruise") or t["speed"]
        t["cruise"] = cruise
        cap = self._cap_speed({**t, "speed": cruise, "status": "в пути"})
        t["speed"] = int(min(cap, cruise) * factor)
        km_s = (t["speed"] / 3600) * (1 if t["kind"] == "пассажирский" else 0.85)
        frac = (km_s * dt) / max(edge["km"], 8)
        t["t"] += frac
        if t["t"] >= 1:
            t["t"] = 0
            next_idx = t["edge"] + t["heading"]
            if next_idx <= 0 or next_idx >= len(route) - 1:
                t["heading"] = -t["heading"]
            else:
                t["edge"] = next_idx
            t["status"] = "на станции"
            c = self.cfg["constraints"]
            t["dwell"] = random.uniform(c["dwell_min_sec"], c["dwell_max_sec"])
            if t["delayMin"] > 0 and random.random() < 0.3:
                t["delayMin"] += 1
            arrived = route[t["edge"]]
            if t["id"].startswith("t") and not t["id"].startswith("tf") or random.random() < 0.04:
                self._push("ok", f"Поезд №{t['number']} на станции {self.st_name(arrived)}", train_id=t["id"], station_id=arrived)
        return t

    def apply(self, cmd: dict) -> dict:
        self.commands += 1
        action = cmd.get("action")
        if action == "pause":
            self.paused = not self.paused
        elif action == "speed":
            self.speed = int(cmd.get("speed") or 1)
            self.paused = self.speed == 0
        elif action == "stop":
            self._stop(cmd.get("trainId"))
        elif action == "resume":
            self._resume(cmd.get("trainId"))
        elif action == "repair":
            self._repair(cmd.get("trainId"), cmd.get("wagonId"))
        elif action == "uncouple":
            self._uncouple(cmd.get("trainId"), cmd.get("wagonId"))
        elif action == "closeTrack":
            self._close_track(cmd.get("stationId"), cmd.get("track") or "Путь 3")
        elif action == "openTrack":
            self._open_track(cmd.get("stationId"), cmd.get("track") or "Путь 3")
        elif action == "reroute":
            self._reroute(cmd.get("trainId"))
        elif action == "applyRec":
            rec_id = cmd.get("id")
            if rec_id == "stop-4827":
                self._stop("t4827")
            elif rec_id == "reroute-5503":
                self._reroute(self.cfg["optimization"].get("reroute_train_id", "t5503"))
        return {"ok": True, "action": action}

    def _stop(self, tid: str | None) -> None:
        tr = next((t for t in self.trains if t["id"] == tid), None)
        if not tr:
            return
        tr["status"] = "остановлен"
        tr["speed"] = 0
        self.scenario["stopped"] = True
        stop_id = self.cfg["optimization"].get("ktsm_stop_station", "ast")
        self._push("alarm", f"Поезд №{tr['number']} остановлен", f"Осмотр на станции {self.st_name(stop_id)}, путь 3", train_id=tid, station_id=stop_id)

    def _resume(self, tid: str | None) -> None:
        tr = next((t for t in self.trains if t["id"] == tid), None)
        if not tr:
            return
        tr["status"] = "в пути"
        tr["speed"] = tr.get("cruise") or 48
        self._push("ok", f"Поезд №{tr['number']} возобновил движение", train_id=tid)

    def _repair(self, tid: str | None, wid: str | None) -> None:
        tr = next((t for t in self.trains if t["id"] == tid), None)
        if not tr:
            return
        for w in tr["wagons"]:
            if w["id"] == wid or w["number"] == wid:
                w.pop("fault", None)
                w["health"] = 94
                w.pop("tempC", None)
        if tr["status"] == "остановлен":
            tr["status"] = "в пути"
            tr["speed"] = tr.get("cruise") or 48
        self.scenario["repaired"] = True
        self.docs[tid or ""] = {"vu45": "успешно обработана", "brakes": "исправны", "ts": self.time, "worker": "вагонник, смена 2"}
        self._push("fix", "Неисправность устранена", f"Вагон {wid} после диагностики вагонного депо", train_id=tid)

    def _uncouple(self, tid: str | None, wid: str | None) -> None:
        tr = next((t for t in self.trains if t["id"] == tid), None)
        if not tr:
            return
        keep, drop = [], None
        for w in tr["wagons"]:
            if w["id"] == wid or w["number"] == wid or (not wid and w.get("fault")):
                drop = w
            else:
                keep.append(w)
        if not drop:
            return
        tr["wagons"] = keep
        tr["lengthM"] = max(18, tr["lengthM"] - 14)
        self.scenario["uncoupled"] = True
        stid = tr["route"][tr["edge"]]
        for s in self.stations:
            if s["id"] == stid:
                s["repairTracks"] = s.get("repairTracks", 0) + 1
        self._push("warn", f"Вагон {drop['number']} отцеплен", f"Парк ремонта, {self.st_name(stid)}", train_id=tid, station_id=stid)

    def _close_track(self, sid: str | None, track: str) -> None:
        if not sid:
            return
        cur = self.closed_tracks.setdefault(sid, [])
        if track not in cur:
            cur.append(track)
        for t in self.trains:
            if sid in t["route"]:
                t["delayMin"] += 6
        self._push("warn", f"Закрыт {track} станции {self.st_name(sid)}", "Нагрузка на соседние пути, +6 мин", station_id=sid)

    def _open_track(self, sid: str | None, track: str) -> None:
        if not sid:
            return
        cur = self.closed_tracks.get(sid, [])
        self.closed_tracks[sid] = [x for x in cur if x != track]
        self._push("fix", f"Открыт {track} станции {self.st_name(sid)}", station_id=sid)

    def _reroute(self, tid: str | None) -> None:
        tr = next((t for t in self.trains if t["id"] == tid), None)
        via = self.cfg["optimization"].get("alt_via_station", "bxh")
        if not tr:
            return
        # Жезказган — Караганда — Балхаш instead of going to Astana
        tr["route"] = ["dzn", "kgf", "bxh"]
        tr["edge"] = min(tr["edge"], 1)
        tr["heading"] = 1
        self.scenario["rerouted"] = True
        for e in self.edges:
            if e["id"] == "ast-kgf":
                e["load"] = max(40, e["load"] - 12)
            if e["id"] == "kgf-bxh":
                e["load"] = min(95, e["load"] + 8)
        self._push("ok", f"Поезд №{tr['number']} перенаправлен через {self.st_name(via)}", "Разгрузка участка Астана — Караганда", train_id=tid)

    def public_state(self) -> dict:
        return {
            "time": self.time,
            "speed": self.speed,
            "paused": self.paused,
            "trains": self.trains,
            "stations": self.stations,
            "edges": self.edges,
            "events": self.events[:40],
            "closedTracks": self.closed_tracks,
            "scenario": self.scenario,
            "docs": self.docs,
            "kpi": self.kpi(),
            "ai": self.ai(),
            "config": self.cfg,
        }


sim = Simulator()

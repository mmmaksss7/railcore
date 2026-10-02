"""RailSim KZ API: REST + GraphQL + WebSocket + SSE + health."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from bus import bus
from sim import CFG_PATH, sim
from store import store

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "railsim.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("railsim.api")
STARTED = time.time()
WS_CLIENTS: set[WebSocket] = set()
METRICS = {"ws_connects": 0, "ws_messages": 0, "rest": 0}


async def sim_loop() -> None:
    last_snap = 0.0
    last_sample = 0.0
    last_purge = 0.0
    while True:
        t0 = time.perf_counter()
        sim.tick(0.1)
        state = {
            "type": "tick",
            "time": sim.time,
            "speed": sim.speed,
            "paused": sim.paused,
            "trains": sim.trains,
            "events": sim.events[:30],
            "kpi": sim.kpi(),
            "ai": sim.ai(),
            "scenario": sim.scenario,
            "closedTracks": sim.closed_tracks,
            "docs": sim.docs,
            "stations": [{"id": s["id"], "occupied": s["occupied"], "repairTracks": s["repairTracks"]} for s in sim.stations],
        }
        await bus.publish("sim.tick", state)
        now = time.time()
        if now - last_snap >= sim.cfg.get("snapshot_interval_sec", 15):
            store.add_snapshot(sim.time, sim.kpi())
            last_snap = now
        if now - last_sample >= sim.cfg.get("sample_interval_sec", 8):
            store.add_samples(sim.time, sim.trains)
            last_sample = now
        if now - last_purge >= 120:
            hours = int(sim.cfg.get("history_hours") or 72)
            store.purge(hours)
            last_purge = now
        elapsed = time.perf_counter() - t0
        await asyncio.sleep(max(0.02, 0.1 - elapsed))


async def command_worker() -> None:
    q = bus.subscribe("sim.commands")
    try:
        while True:
            env = await q.get()
            cmd = env.get("payload") or {}
            log.info("command queued %s", cmd.get("action"))
            await bus.publish("sim.events", {"action": cmd.get("action"), "ok": True})
    finally:
        bus.unsubscribe("sim.commands", q)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("RailSim API starting, config=%s", CFG_PATH)
    loop_task = asyncio.create_task(sim_loop())
    cmd_task = asyncio.create_task(command_worker())
    yield
    loop_task.cancel()
    cmd_task.cancel()


app = FastAPI(title="RailSim KZ", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def count_rest(request, call_next):
    METRICS["rest"] += 1
    return await call_next(request)


@app.get("/health")
def health():
    age_ms = int((time.time() - STARTED) * 1000)
    db = store.ping()
    body = {
        "status": "ok" if db else "degraded",
        "uptime_sec": round(time.time() - STARTED, 1),
        "sim_time": sim.time,
        "speed": sim.speed,
        "paused": sim.paused,
        "ws_clients": len(WS_CLIENTS),
        "queue_depth": bus.depth(),
        "bus_published": bus.published,
        "bus_dropped": bus.dropped,
        "topics": bus.topics(),
        "db_ok": db,
        "history": store.stats(),
        "ticks": sim.ticks,
        "config_file": str(CFG_PATH),
        "age_ms": age_ms,
    }
    return JSONResponse(body, status_code=200 if db else 503)


@app.get("/metrics")
def metrics():
    kpi = sim.kpi()
    lines = [
        f"railsim_up 1",
        f"railsim_uptime_seconds {time.time() - STARTED:.1f}",
        f"railsim_ticks_total {sim.ticks}",
        f"railsim_events_total {len(sim.events)}",
        f"railsim_commands_total {sim.commands}",
        f"railsim_ktsm_alerts_total {sim.ktsm_alerts}",
        f"railsim_ws_clients {len(WS_CLIENTS)}",
        f"railsim_ws_connects_total {METRICS['ws_connects']}",
        f"railsim_queue_depth {bus.depth()}",
        f"railsim_bus_published_total {bus.published}",
        f"railsim_sim_speed {sim.speed}",
        f"railsim_network_load {kpi['avg']}",
        f"railsim_delays {kpi['delays']}",
        f"railsim_rest_total {METRICS['rest']}",
        f"railsim_history_events {store.stats()['events']}",
        f"railsim_history_snapshots {store.stats()['snapshots']}",
    ]
    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.get("/api/state")
def api_state():
    return sim.public_state()


@app.get("/api/config")
def get_config():
    return sim.cfg


@app.put("/api/config")
def put_config(body: dict):
    cfg = sim.reload_config(body)
    log.info("config updated via REST")
    return cfg


@app.get("/api/history/events")
def history_events(hours: int = Query(24, ge=1, le=72), limit: int = Query(200, le=1000)):
    since = sim.time - hours * 3600 * 1000
    return {"hours": hours, "items": store.events(since, limit)}


@app.get("/api/history/snapshots")
def history_snapshots(hours: int = Query(24, ge=1, le=72)):
    since = sim.time - hours * 3600 * 1000
    return {"hours": hours, "items": store.snapshots(since)}


@app.get("/api/history/trains/{train_id}")
def history_train(train_id: str, hours: int = Query(24, ge=1, le=72)):
    since = sim.time - hours * 3600 * 1000
    return {"trainId": train_id, "items": store.train_history(train_id, since)}


@app.post("/api/commands")
async def post_command(body: dict):
    if not body.get("action"):
        raise HTTPException(400, "action required")
    await bus.publish("sim.commands", body)
    # apply immediately so REST callers see result without waiting the worker
    result = sim.apply(body)
    return result


@app.post("/graphql")
def graphql(body: dict):
    q = (body.get("query") or "").lower()
    hours = 24
    if "hours" in (body.get("variables") or {}):
        hours = int(body["variables"]["hours"])
    data: dict = {}
    if "config" in q:
        data["config"] = sim.cfg
    if "history" in q or "events" in q:
        since = sim.time - hours * 3600 * 1000
        data["history"] = {
            "events": store.events(since, 100),
            "snapshots": store.snapshots(since, 200),
        }
    if "health" in q:
        data["health"] = {"status": "ok" if store.ping() else "degraded", "ws": len(WS_CLIENTS)}
    if "kpi" in q or "state" in q:
        data["kpi"] = sim.kpi()
    if not data:
        data["error"] = "supported: config, history, health, kpi"
    return {"data": data}


@app.get("/api/stream")
async def sse():
    q = bus.subscribe("sim.tick", maxsize=8)

    async def gen():
        try:
            while True:
                env = await q.get()
                yield f"data: {json.dumps(env['payload'], ensure_ascii=False)}\n\n"
        except asyncio.CancelledError:
            return
        finally:
            bus.unsubscribe("sim.tick", q)

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    WS_CLIENTS.add(sock)
    METRICS["ws_connects"] += 1
    q = bus.subscribe("sim.tick", maxsize=4)
    log.info("ws connected clients=%s", len(WS_CLIENTS))
    try:
        await sock.send_json({"type": "hello", **sim.public_state()})
        async def reader():
            while True:
                msg = await sock.receive_json()
                METRICS["ws_messages"] += 1
                if msg.get("type") == "command" or msg.get("action"):
                    await bus.publish("sim.commands", msg)
                    sim.apply(msg)
        async def writer():
            while True:
                env = await q.get()
                await sock.send_json(env["payload"])
        await asyncio.gather(reader(), writer())
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws error")
    finally:
        WS_CLIENTS.discard(sock)
        bus.unsubscribe("sim.tick", q)
        log.info("ws gone clients=%s", len(WS_CLIENTS))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8780, reload=False)

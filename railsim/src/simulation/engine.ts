import type { Edge, Layers, SimEvent, SimState, Station, Train } from "./types";
import { START_MS, edges, stations, trains } from "./world";

const SPEEDS = [0, 1, 2, 10, 50, 100, 500, 1000] as const;

export const SPEED_OPTIONS = SPEEDS;

export const defaultLayers: Layers = {
  lines: true,
  stations: true,
  trains: true,
  electrification: true,
  signals: true,
  ktsm: true,
  industry: true,
  load: true,
  borders: true,
  relief: false,
};

export function initialState(): SimState {
  return {
    time: START_MS,
    speed: 1,
    paused: false,
    trains: structuredClone(trains),
    stations: structuredClone(stations),
    edges: structuredClone(edges),
    events: [
      {
        id: "e0",
        ts: START_MS - 4 * 60_000,
        level: "ok",
        text: "Поезд №101 отправлен",
        detail: "Актобе → Достык, международный транзит",
        trainId: "t101",
      },
      {
        id: "e1",
        ts: START_MS - 2 * 60_000,
        level: "fix",
        text: "Завершён ремонт вагона",
        detail: "Вагонное депо Астана, 3 ч",
        stationId: "ast",
      },
    ],
    selectedTrain: null,
    selectedStation: null,
    selectedWagon: null,
    layers: defaultLayers,
    role: "admin",
    panel: "trains",
    closedTracks: {},
    scenario: { ktsm: false, stopped: false, repaired: false },
    connected: false,
    config: null,
    ai: { bars: [], recs: [], notes: [] },
    docs: {},
  };
}

export function formatClock(ms: number) {
  const d = new Date(ms);
  const days = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const week = Math.ceil((((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7);
  return {
    time: `${hh}:${mm}:${ss}`,
    date: `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${hh}:${mm}:${ss}`,
    weekday: days[d.getUTCDay()],
    week,
  };
}

export function findEdge(list: Edge[], a: string, b: string) {
  return list.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
}

export function pointOnEdge(edge: Edge, t: number, fromId: string): { lat: number; lng: number } {
  const pts = edge.from === fromId ? edge.pts : [...edge.pts].reverse();
  const clamped = Math.max(0, Math.min(0.999, t));
  let total = 0;
  const seg: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push(d);
    total += d;
  }
  let dist = clamped * total;
  for (let i = 0; i < seg.length; i++) {
    if (dist <= seg[i]) {
      const k = seg[i] === 0 ? 0 : dist / seg[i];
      return {
        lat: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
        lng: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k,
      };
    }
    dist -= seg[i];
  }
  const last = pts[pts.length - 1];
  return { lat: last[0], lng: last[1] };
}

export function trainLatLng(train: Train, edgeList: Edge[], stationList: Station[]): { lat: number; lng: number } | null {
  const a = train.route[train.edge];
  const nxt = train.edge + train.heading;
  const b = nxt >= 0 && nxt < train.route.length ? train.route[nxt] : a;
  const edge = findEdge(edgeList, a, b);
  if (edge) {
    const p = pointOnEdge(edge, train.t, a);
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) return p;
  }
  const st = stationList.find((s) => s.id === a);
  if (!st || !Number.isFinite(st.lat)) return null;
  return { lat: st.lat, lng: st.lng };
}

function pushEvent(state: SimState, ev: Omit<SimEvent, "id" | "ts"> & { ts?: number }) {
  state.events = [
    { id: `ev${state.time}-${state.events.length}`, ts: ev.ts ?? state.time, ...ev },
    ...state.events,
  ].slice(0, 40);
}

export function tick(state: SimState, realDt: number): SimState {
  if (state.paused || state.speed === 0) return state;
  const next: SimState = {
    ...state,
    trains: state.trains.map((t) => ({ ...t, wagons: t.wagons.map((w) => ({ ...w })) })),
    events: [...state.events],
    scenario: { ...state.scenario },
  };
  const simDt = realDt * state.speed;
  next.time += simDt * 1000;

  next.trains = next.trains.map((train) => moveTrain(next, train, simDt));

  const clock = new Date(next.time);
  const sec = clock.getUTCHours() * 3600 + clock.getUTCMinutes() * 60 + clock.getUTCSeconds();
  if (!next.scenario.ktsm && sec >= 14 * 3600 + 32 * 60 + 24) {
    next.scenario.ktsm = true;
    const tr = next.trains.find((t) => t.id === "t4827");
    if (tr) {
      const w = tr.wagons.find((x) => x.number === "61877302") ?? tr.wagons[2];
      if (w) w.fault = "Перегрев буксы 87°C";
    }
    pushEvent(next, {
      level: "warn",
      text: "КТСМ перегрев буксы",
      detail: "КТСМ-02 · Поезд №4827, вагон 61877302 · 87°C",
      trainId: "t4827",
    });
    pushEvent(next, {
      level: "alarm",
      text: "AI: остановить №4827 на станции Астана",
      detail: "Рекомендуется отцепить вагон 61877302 и направить в вагонное депо",
      trainId: "t4827",
      stationId: "ast",
    });
  }

  if (Math.random() < 0.0008 * state.speed) {
    const pool = [
      "Неисправность стрелочного перевода №18",
      "Задержка по станции Шымкент",
      "Смена бригады на станции Астана",
      "Поезд принят на путь 4",
    ];
    const text = pool[Math.floor(Math.random() * pool.length)];
    pushEvent(next, { level: text.includes("Неисправность") ? "warn" : "ok", text });
  }

  return next;
}

function moveTrain(state: SimState, train: Train, dt: number): Train {
  if (train.status === "остановлен") return train;
  const t = { ...train };
  if (t.status === "на станции") {
    t.dwell -= dt;
    if (t.dwell <= 0) t.status = "в пути";
    return t;
  }
  const a = t.route[t.edge];
  const b = t.route[t.edge + t.heading] ?? t.route[t.edge];
  const edge = findEdge(state.edges, a, b);
  if (!edge) return t;
  const kmPerSec = (t.speed / 3600) * (t.kind === "пассажирский" ? 1 : 0.85);
  const frac = (kmPerSec * dt) / Math.max(edge.km, 8);
  t.t += frac;
  if (t.t >= 1) {
    t.t = 0;
    const nextIdx = t.edge + t.heading;
    if (nextIdx <= 0 || nextIdx >= t.route.length - 1) {
      t.heading = (t.heading * -1) as 1 | -1;
    } else {
      t.edge = nextIdx;
    }
    t.status = "на станции";
    t.dwell = 25 + Math.random() * 20;
    if (t.delayMin > 0 && Math.random() < 0.3) t.delayMin += 1;
  }
  return t;
}

export function stopTrain(state: SimState, id: string): SimState {
  const trains = state.trains.map((t) =>
    t.id === id ? { ...t, status: "остановлен" as const, speed: 0 } : t
  );
  const next = { ...state, trains, scenario: { ...state.scenario, stopped: true } };
  pushEvent(next, {
    level: "alarm",
    text: `Поезд №${trains.find((t) => t.id === id)?.number} остановлен`,
    detail: "Назначен осмотр на станции Астана, путь 3",
    trainId: id,
    stationId: "ast",
  });
  return next;
}

export function repairWagon(state: SimState, trainId: string, wagonId: string): SimState {
  const trains = state.trains.map((t) => {
    if (t.id !== trainId) return t;
    return {
      ...t,
      status: t.status === "остановлен" ? ("в пути" as const) : t.status,
      speed: t.status === "остановлен" ? 48 : t.speed,
      wagons: t.wagons.map((w) =>
        w.id === wagonId || w.number === wagonId
          ? { ...w, fault: undefined, health: 94 }
          : w
      ),
    };
  });
  const next = { ...state, trains, scenario: { ...state.scenario, repaired: true } };
  pushEvent(next, {
    level: "fix",
    text: "Неисправность устранена",
    detail: `Вагон ${wagonId} после диагностики вагонного депо`,
    trainId,
  });
  return next;
}

export function closeTrack(state: SimState, stationId: string, track: string): SimState {
  const closed = { ...state.closedTracks, [stationId]: [...(state.closedTracks[stationId] ?? []), track] };
  const trains = state.trains.map((t) =>
    t.route.includes(stationId) ? { ...t, delayMin: t.delayMin + 6 } : t
  );
  const next = { ...state, closedTracks: closed, trains };
  pushEvent(next, {
    level: "warn",
    text: `Закрыт ${track} станции`,
    detail: "Нагрузка перераспределена на соседние пути. Ожидаемая задержка +6 мин",
    stationId,
  });
  return next;
}

export function networkLoad(state: SimState) {
  const avg = Math.round(state.edges.reduce((s, e) => s + e.load, 0) / state.edges.length);
  const delays = state.trains.filter((t) => t.delayMin > 0).length;
  const locos = Math.max(83, state.trains.length);
  const wagons = state.trains.reduce((s, t) => s + t.wagons.length, 0) + 1100;
  const cargo = 286;
  return { avg, delays, locos, wagons, cargo, trains: state.trains.length };
}

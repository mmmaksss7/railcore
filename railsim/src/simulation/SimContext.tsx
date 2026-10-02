import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { openSimSocket } from "../api";
import { OSM_PTS } from "../data/osmPts";
import { closeTrack, initialState, repairWagon, stopTrain, tick } from "./engine";
import type { AiState, Edge, Layers, PanelTab, Role, SimState } from "./types";

export type Action =
  | { type: "tick"; dt: number }
  | { type: "speed"; speed: number }
  | { type: "pause" }
  | { type: "selectTrain"; id: string | null }
  | { type: "selectStation"; id: string | null }
  | { type: "selectWagon"; id: string | null }
  | { type: "layer"; key: keyof Layers }
  | { type: "role"; role: Role }
  | { type: "panel"; panel: PanelTab }
  | { type: "stop"; id: string }
  | { type: "resume"; id: string }
  | { type: "repair"; trainId: string; wagonId: string }
  | { type: "uncouple"; trainId: string; wagonId?: string }
  | { type: "closeTrack"; stationId: string; track: string }
  | { type: "openTrack"; stationId: string; track: string }
  | { type: "reroute"; id: string }
  | { type: "applyRec"; id: string }
  | { type: "hello"; payload: Partial<SimState> & { ai?: AiState } }
  | { type: "remote"; payload: Partial<SimState> & { ai?: AiState; stations?: { id: string; occupied: number; repairTracks: number }[] } }
  | { type: "connected"; value: boolean }
  | { type: "config"; config: SimState["config"] };

function mergeStations(state: SimState, patch?: { id: string; occupied: number; repairTracks: number }[]) {
  if (!patch?.length) return state.stations;
  const by = new Map(patch.map((s) => [s.id, s]));
  return state.stations.map((s) => {
    const u = by.get(s.id);
    return u ? { ...s, occupied: u.occupied, repairTracks: u.repairTracks } : s;
  });
}

function withOsm(edges: Edge[]) {
  return edges.map((e) => (OSM_PTS[e.id] ? { ...e, pts: OSM_PTS[e.id] } : e));
}

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case "tick":
      if (state.connected) return state;
      return tick(state, action.dt);
    case "speed":
      return { ...state, speed: action.speed, paused: action.speed === 0 };
    case "pause":
      return { ...state, paused: !state.paused };
    case "selectTrain":
      return { ...state, selectedTrain: action.id };
    case "selectStation":
      return { ...state, selectedStation: action.id };
    case "selectWagon":
      return { ...state, selectedWagon: action.id };
    case "layer":
      return { ...state, layers: { ...state.layers, [action.key]: !state.layers[action.key] } };
    case "role":
      return { ...state, role: action.role };
    case "panel":
      return { ...state, panel: state.panel === action.panel ? null : action.panel };
    case "stop":
      return stopTrain(state, action.id);
    case "resume": {
      const trains = state.trains.map((t) =>
        t.id === action.id ? { ...t, status: "в пути" as const, speed: t.speed || 48 } : t
      );
      return { ...state, trains };
    }
    case "repair":
      return repairWagon(state, action.trainId, action.wagonId);
    case "uncouple": {
      const trains = state.trains.map((t) => {
        if (t.id !== action.trainId) return t;
        const drop = t.wagons.find((w) => w.id === action.wagonId || w.number === action.wagonId || w.fault);
        return { ...t, wagons: t.wagons.filter((w) => w !== drop) };
      });
      return { ...state, trains, scenario: { ...state.scenario, uncoupled: true } };
    }
    case "closeTrack":
      return closeTrack(state, action.stationId, action.track);
    case "openTrack": {
      const list = (state.closedTracks[action.stationId] ?? []).filter((x) => x !== action.track);
      return { ...state, closedTracks: { ...state.closedTracks, [action.stationId]: list } };
    }
    case "reroute": {
      const trains = state.trains.map((t) =>
        t.id === action.id ? { ...t, route: ["dzn", "kgf", "bxh"], edge: Math.min(t.edge, 1) } : t
      );
      return { ...state, trains, scenario: { ...state.scenario, rerouted: true } };
    }
    case "applyRec":
      if (action.id === "stop-4827") return stopTrain(state, "t4827");
      if (action.id === "reroute-5503") {
        const trains = state.trains.map((t) =>
          t.id === "t5503" ? { ...t, route: ["dzn", "kgf", "bxh"], edge: Math.min(t.edge, 1) } : t
        );
        return { ...state, trains, scenario: { ...state.scenario, rerouted: true } };
      }
      return state;
    case "hello": {
      const p = action.payload;
      return {
        ...state,
        connected: true,
        time: p.time ?? state.time,
        speed: p.speed ?? state.speed,
        paused: p.paused ?? state.paused,
        trains: p.trains ?? state.trains,
        stations: p.stations ?? state.stations,
        edges: withOsm(p.edges ?? state.edges),
        events: p.events ?? state.events,
        closedTracks: p.closedTracks ?? state.closedTracks,
        scenario: { ...state.scenario, ...p.scenario },
        config: p.config ?? state.config,
        ai: p.ai ?? state.ai,
        docs: p.docs ?? state.docs,
        kpi: p.kpi ?? state.kpi,
      };
    }
    case "remote": {
      const p = action.payload;
      return {
        ...state,
        time: p.time ?? state.time,
        speed: p.speed ?? state.speed,
        paused: p.paused ?? state.paused,
        trains: p.trains ?? state.trains,
        events: p.events ?? state.events,
        closedTracks: p.closedTracks ?? state.closedTracks,
        scenario: { ...state.scenario, ...p.scenario },
        ai: p.ai ?? state.ai,
        docs: p.docs ?? state.docs,
        kpi: p.kpi ?? state.kpi,
        stations: mergeStations(state, p.stations),
      };
    }
    case "connected":
      return { ...state, connected: action.value };
    case "config":
      return { ...state, config: action.config };
    default:
      return state;
  }
}

const REMOTE_ACTIONS = new Set([
  "speed",
  "pause",
  "stop",
  "resume",
  "repair",
  "uncouple",
  "closeTrack",
  "openTrack",
  "reroute",
  "applyRec",
]);

const Ctx = createContext<{
  state: SimState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!connectedRef.current) dispatch({ type: "tick", dt });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let closed = false;
    let sock: WebSocket | null = null;
    let retry = 0;
    const connect = () => {
      if (closed) return;
      try {
        sock = openSimSocket();
      } catch {
        retry = Math.min(retry + 1, 8);
        window.setTimeout(connect, 1000 * retry);
        return;
      }
      wsRef.current = sock;
      sock.onopen = () => {
        retry = 0;
        connectedRef.current = true;
        dispatch({ type: "connected", value: true });
      };
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === "hello") dispatch({ type: "hello", payload: msg });
          else dispatch({ type: "remote", payload: msg });
        } catch {
          /* ignore */
        }
      };
      sock.onclose = () => {
        connectedRef.current = false;
        dispatch({ type: "connected", value: false });
        wsRef.current = null;
        retry = Math.min(retry + 1, 8);
        if (!closed) window.setTimeout(connect, 800 * retry);
      };
      sock.onerror = () => sock?.close();
    };
    connect();
    return () => {
      closed = true;
      sock?.close();
    };
  }, []);

  const dispatchWrapped: Dispatch<Action> = (action) => {
    if (connectedRef.current && REMOTE_ACTIONS.has(action.type) && wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: Record<string, unknown> = { ...action, type: "command" };
      if (action.type === "stop" || action.type === "resume" || action.type === "reroute") {
        msg.action = action.type;
        msg.trainId = action.id;
      } else if (action.type === "speed") {
        msg.action = "speed";
        msg.speed = action.speed;
      } else if (action.type === "pause") {
        msg.action = "pause";
      } else if (action.type === "repair" || action.type === "uncouple") {
        msg.action = action.type;
        msg.trainId = action.trainId;
        msg.wagonId = action.wagonId;
      } else if (action.type === "closeTrack" || action.type === "openTrack") {
        msg.action = action.type;
        msg.stationId = action.stationId;
        msg.track = action.track;
      } else if (action.type === "applyRec") {
        msg.action = "applyRec";
        msg.id = action.id;
      }
      wsRef.current.send(JSON.stringify(msg));
      return;
    }
    dispatch(action);
  };

  const value = useMemo(() => ({ state, dispatch: dispatchWrapped }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSim");
  return ctx;
}

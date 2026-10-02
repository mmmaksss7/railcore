export type Role =
  | "admin"
  | "dispatcher"
  | "station"
  | "shunter"
  | "depot"
  | "wagon";

export type TrainKind = "пассажирский" | "грузовой" | "международный" | "служебный";
export type LineType = "elec" | "diesel" | "freight" | "passenger" | "intl";

export type PanelTab = "trains" | "train" | "station" | "events" | "ai" | "layers" | "history" | "config";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "hub" | "yard" | "industry" | "border" | "depot" | "passenger";
  tracks: number;
  occupied: number;
  repairTracks: number;
  electrified: boolean;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: LineType;
  km: number;
  vmax: number;
  load: number;
  ktsm?: boolean;
  pts: [number, number][];
}

export interface Wagon {
  id: string;
  number: string;
  type: string;
  cargo: string;
  from: string;
  to: string;
  health: number;
  fault?: string;
}

export interface Train {
  id: string;
  number: string;
  kind: TrainKind;
  route: string[];
  edge: number;
  t: number;
  heading: 1 | -1;
  speed: number;
  delayMin: number;
  status: "в пути" | "на станции" | "остановлен";
  dwell: number;
  loco: { model: string; number: string; health: number };
  crew: { id: string; driver: string; helper: string };
  wagons: Wagon[];
  lengthM: number;
  massT: number;
}

export interface SimEvent {
  id: string;
  ts: number;
  level: "ok" | "warn" | "alarm" | "fix";
  text: string;
  detail?: string;
  trainId?: string;
  stationId?: string;
}

export interface Layers {
  lines: boolean;
  stations: boolean;
  trains: boolean;
  electrification: boolean;
  signals: boolean;
  ktsm: boolean;
  industry: boolean;
  load: boolean;
  borders: boolean;
  relief: boolean;
}

export interface SimState {
  time: number;
  speed: number;
  paused: boolean;
  trains: Train[];
  stations: Station[];
  edges: Edge[];
  events: SimEvent[];
  selectedTrain: string | null;
  selectedStation: string | null;
  selectedWagon: string | null;
  layers: Layers;
  role: Role;
  panel: PanelTab | null;
  closedTracks: Record<string, string[]>;
  scenario: { ktsm: boolean; stopped: boolean; repaired: boolean; uncoupled?: boolean; rerouted?: boolean };
  connected: boolean;
  config: SimConfig | null;
  ai: AiState;
  docs: Record<string, { vu45: string; brakes: string; ts: number; worker: string }>;
  kpi?: { avg: number; delays: number; locos: number; wagons: number; cargo: number; trains: number; faults?: number };
}


export interface SimConfig {
  history_hours: number;
  snapshot_interval_sec: number;
  thresholds: Record<string, number>;
  constraints: Record<string, number>;
  optimization: Record<string, string | number | boolean>;
  index: Record<string, number>;
}

export interface AiRec {
  id: string;
  action: string;
  trainId?: string;
  text: string;
}

export interface AiState {
  bars: [string, number][];
  recs: AiRec[];
  notes: string[];
}

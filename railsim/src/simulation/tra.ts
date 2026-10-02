import { TRA_CATALOG } from "../data/traStations";
import type { Station } from "./types";

export type TraRole = "main" | "po" | "sort" | "siding";

export interface TraTrack {
  no: string;
  spec: string;
  len: number;
  cap: number;
  role: TraRole;
  stub?: boolean;
}

export interface TraPark {
  name: string;
  tracks: TraTrack[];
}

export interface TraScheme {
  id: string;
  name: string;
  klass: string;
  left: string;
  right: string;
  parks: TraPark[];
}

type Catalog = {
  stations: TraScheme[];
  map: Record<string, string[]>;
};

const catalog = TRA_CATALOG as Catalog;

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[\s\-–—]/g, "");
}

const byName = new Map(catalog.stations.map((s) => [norm(s.name), s]));

const SPEC_MAIN = "Главный для пропуска пас., пригородн., грузовых поездов четного и нечетного направления";
const SPEC_PO = "Приемоотправочный для приема и отправления поездов";
const SPEC_SORT = "Сортировочно-отправочный для грузовых поездов и накопления вагонов";
const SPEC_SIDE = "Выставочный и для накопления вагонов";
const SPEC_STUB = "Вытяжной / тупик";

function synthesize(station: Station): TraScheme {
  const n = Math.max(3, station.tracks);
  const parks: TraPark[] = [];
  const main: TraTrack[] = [
    { no: "I", spec: SPEC_MAIN, len: 920, cap: 62, role: "main" },
  ];
  if (n >= 4) main.push({ no: "II", spec: SPEC_MAIN, len: 900, cap: 60, role: "main" });
  const po: TraTrack[] = [];
  const poN = station.kind === "hub" || station.kind === "yard" ? Math.min(7, Math.max(3, n - 4)) : Math.min(4, Math.max(2, n - 2));
  for (let i = 0; i < poN; i++) {
    po.push({ no: String(i + 3), spec: SPEC_PO, len: 860 - i * 18, cap: 58 - i, role: "po" });
  }
  parks.push({ name: "Приемоотправочный парк", tracks: [...main, ...po] });
  if (station.kind === "hub" || station.kind === "yard") {
    const sort: TraTrack[] = [];
    const sn = Math.min(6, Math.max(3, n - 6));
    for (let i = 0; i < sn; i++) {
      sort.push({ no: String(21 + i), spec: SPEC_SORT, len: 820 - i * 12, cap: 55 - i, role: "sort" });
    }
    sort.push({ no: "1Т", spec: SPEC_STUB, len: 280, cap: 18, role: "siding", stub: true });
    parks.push({ name: "Сортировочный парк", tracks: sort });
  }
  if (station.kind === "industry" || station.kind === "depot") {
    parks.push({
      name: "Погрузочно-выгрузочные",
      tracks: [
        { no: "8", spec: "Погрузочно-выгрузочный", len: 274, cap: 19, role: "siding", stub: true },
        { no: "9", spec: SPEC_SIDE, len: 420, cap: 28, role: "siding" },
      ],
    });
  }
  if (station.kind === "border") {
    parks.push({
      name: "Парк передачи (иностранная колея)",
      tracks: [
        { no: "1П", spec: SPEC_MAIN, len: 980, cap: 66, role: "main" },
        { no: "2П", spec: SPEC_PO, len: 920, cap: 62, role: "po" },
        { no: "3П", spec: SPEC_PO, len: 900, cap: 60, role: "po" },
      ],
    });
  }
  const klass =
    station.kind === "hub"
      ? "узловая"
      : station.kind === "yard"
        ? "сортировочная"
        : station.kind === "border"
          ? "пограничная"
          : station.kind === "industry"
            ? "грузовая"
            : "промежуточная";
  return { id: station.id, name: station.name, klass, left: "нечетное", right: "четное", parks };
}

export function schemesFor(station: Station): TraScheme[] {
  const names = catalog.map[station.id];
  if (names?.length) {
    return names.map((n) => byName.get(norm(n))).filter((x): x is TraScheme => !!x);
  }
  const hit = byName.get(norm(station.name));
  if (hit) return [hit];
  return [synthesize(station)];
}

export function allTracks(scheme: TraScheme): TraTrack[] {
  return scheme.parks.flatMap((p) => p.tracks);
}

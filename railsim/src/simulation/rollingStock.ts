export type LocoId =
  | "te33a"
  | "te36a"
  | "kz4"
  | "kz8"
  | "tem11"
  | "skd6e"
  | "skd9"
  | "2te25km"
  | "2es7"
  | "tem9";

export const LOCO_CATALOG: { id: LocoId; name: string; traction: "diesel" | "elec"; role: "freight" | "passenger" | "shunter" }[] = [
  { id: "te33a", name: "ТЭ33А", traction: "diesel", role: "freight" },
  { id: "te36a", name: "ТЭ36А", traction: "diesel", role: "freight" },
  { id: "kz4", name: "KZ4", traction: "elec", role: "passenger" },
  { id: "kz8", name: "KZ8", traction: "elec", role: "passenger" },
  { id: "tem11", name: "ТЭМ-11", traction: "diesel", role: "shunter" },
  { id: "skd6e", name: "SKD6e", traction: "diesel", role: "shunter" },
  { id: "skd9", name: "SKD-9", traction: "diesel", role: "shunter" },
  { id: "2te25km", name: "2ТЭ-25КМ", traction: "diesel", role: "freight" },
  { id: "2es7", name: "2ЭС7", traction: "elec", role: "passenger" },
  { id: "tem9", name: "ТЭМ-9", traction: "diesel", role: "shunter" },
];

const NAME_TO_ID: Record<string, LocoId> = Object.fromEntries(LOCO_CATALOG.map((l) => [l.name, l.id])) as Record<string, LocoId>;

const ALIAS: Record<string, string> = {
  "2ТЭ25КМ": "2ТЭ-25КМ",
  "2ТЭ10": "ТЭ36А",
  "ЧМЭ-3": "ТЭМ-11",
  "ТЭМ-2": "ТЭМ-9",
  "ЧС7": "KZ4",
  "ЭД9": "2ЭС7",
  "ТЭП70": "ТЭ36А",
  "2ES7": "2ЭС7",
};

export function canonicalLoco(model: string): string {
  const named = ALIAS[model] ?? model;
  return NAME_TO_ID[named] ? named : "ТЭ33А";
}

export function locoId(model: string): LocoId {
  return NAME_TO_ID[canonicalLoco(model)] ?? "te33a";
}

export function locoSrc(model: string, view: "iso" | "top" | "side" | "map"): string {
  return `/fleet/locos/${locoId(model)}-${view}.png`;
}

export type WagonSpriteId =
  | "covered-green"
  | "hopper-red"
  | "hopper-white"
  | "box-red"
  | "tank-black"
  | "tank-white"
  | "flat-blue"
  | "gondola-red"
  | "container-blue"
  | "autorack"
  | "reefer"
  | "gondola-dark"
  | "hopper-green"
  | "hopper-coal"
  | "flat-transformer"
  | "coach-blue";

export function wagonKind(cargo: string): { type: string; sprite: WagonSpriteId } {
  const c = cargo.toLowerCase();
  if (c.includes("пассаж")) return { type: "Пассажирский", sprite: "coach-blue" };
  if (c.includes("угол")) return { type: "Полувагон", sprite: "hopper-coal" };
  if (c.includes("нефть") || c.includes("мазут")) return { type: "Цистерна", sprite: "tank-black" };
  if (c.includes("контейнер")) return { type: "Контейнер", sprite: "container-blue" };
  if (c.includes("авто")) return { type: "Автовоз", sprite: "autorack" };
  if (c.includes("зерно")) return { type: "Зерновоз", sprite: "hopper-white" };
  if (c.includes("руд")) return { type: "Полувагон", sprite: "gondola-red" };
  if (c.includes("щеб")) return { type: "Хоппер", sprite: "hopper-red" };
  if (c.includes("сер")) return { type: "Хоппер", sprite: "hopper-green" };
  if (c.includes("соль")) return { type: "Хоппер", sprite: "hopper-white" };
  if (c.includes("металл")) return { type: "Полувагон", sprite: "gondola-dark" };
  if (c.includes("служеб")) return { type: "Платформа", sprite: "flat-blue" };
  return { type: "Крытый", sprite: "covered-green" };
}

export function wagonSrc(cargo: string, view: "side" | "top"): string {
  return `/fleet/wagons/${wagonKind(cargo).sprite}-${view}.png`;
}

export function mapCarCount(kind: string, wagons: number): number {
  if (kind === "служебный" || wagons === 0) return 0;
  if (kind === "пассажирский") return 2;
  return 2;
}

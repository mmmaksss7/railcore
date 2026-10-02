import { wagonKind } from "./rollingStock";
import type { Train, TrainKind } from "./types";

const NAME: Record<string, string> = {
  ast: "Астана", alm: "Алматы", shy: "Шымкент", kgf: "Караганда", akx: "Актобе",
  pwq: "Павлодар", ppk: "Петропавл", sco: "Актау", guw: "Атырау", ura: "Орал",
  ukk: "Усть-Каменогорск", plx: "Семей", dos: "Достык", ekb: "Экибастуз",
  dzn: "Жезказган", bxh: "Балхаш", kzo: "Костанай", kkc: "Кокшетау", kzo2: "Кызылорда",
  shu: "Шу", tar: "Тараз", ary: "Арыс", trk: "Туркестан", bei: "Бейнеу",
  atg: "Актогай", alk: "Алтынколь", tdk: "Талдыкорган", sry: "Сарыагаш",
};
const nm = (id: string) => NAME[id] ?? id;

const DRIVERS = [
  "Ахметов С.К.", "Бекенов Е.Т.", "Галымов Р.", "Даулет Н.", "Ермеков А.",
  "Жумабаев С.", "Исмаилов К.", "Касымов Д.", "Ли В.П.", "Муканов Т.",
  "Нурпеисов А.", "Омарова Ж.", "Пак С.И.", "Рахимов Б.", "Садыков М.",
];

type Spec = { route: string[]; kind: TrainKind; cargo: string; speed: number; loco: string; cars: number };

const CORRIDORS: Spec[] = [
  { route: ["alm", "ast"], kind: "пассажирский", cargo: "пассажиры", speed: 96, loco: "2ЭС7", cars: 9 },
  { route: ["alm", "ast", "ppk"], kind: "пассажирский", cargo: "пассажиры", speed: 88, loco: "KZ4", cars: 8 },
  { route: ["ast", "pwq"], kind: "пассажирский", cargo: "пассажиры", speed: 90, loco: "KZ4", cars: 7 },
  { route: ["ast", "kzo"], kind: "пассажирский", cargo: "пассажиры", speed: 84, loco: "KZ8", cars: 8 },
  { route: ["alm", "shu", "tar", "ary", "shy"], kind: "пассажирский", cargo: "пассажиры", speed: 86, loco: "KZ4", cars: 8 },
  { route: ["shy", "kzo2"], kind: "пассажирский", cargo: "пассажиры", speed: 78, loco: "KZ8", cars: 6 },
  { route: ["ary", "trk"], kind: "пассажирский", cargo: "пассажиры", speed: 70, loco: "KZ4", cars: 5 },
  { route: ["ekb", "ast", "kgf"], kind: "грузовой", cargo: "Уголь", speed: 62, loco: "2ТЭ-25КМ", cars: 14 },
  { route: ["dzn", "kgf", "ast"], kind: "грузовой", cargo: "Металл", speed: 52, loco: "ТЭ33А", cars: 16 },
  { route: ["sco", "guw", "akx"], kind: "грузовой", cargo: "Нефть", speed: 44, loco: "ТЭ33А", cars: 12 },
  { route: ["bei", "akx"], kind: "грузовой", cargo: "Сера", speed: 40, loco: "ТЭ36А", cars: 15 },
  { route: ["pwq", "ekb", "ast"], kind: "грузовой", cargo: "Уголь", speed: 58, loco: "2ТЭ-25КМ", cars: 18 },
  { route: ["kzo2", "dzn", "kgf"], kind: "грузовой", cargo: "Руда", speed: 46, loco: "ТЭ33А", cars: 13 },
  { route: ["kgf", "bxh", "atg"], kind: "грузовой", cargo: "Щебень", speed: 50, loco: "ТЭ36А", cars: 11 },
  { route: ["atg", "plx"], kind: "грузовой", cargo: "Зерно", speed: 54, loco: "ТЭ33А", cars: 12 },
  { route: ["plx", "ukk"], kind: "грузовой", cargo: "Металл", speed: 42, loco: "SKD-9", cars: 10 },
  { route: ["kgf", "ukk"], kind: "грузовой", cargo: "Уголь", speed: 55, loco: "2ТЭ-25КМ", cars: 14 },
  { route: ["akx", "ast"], kind: "грузовой", cargo: "Зерно", speed: 60, loco: "ТЭ33А", cars: 12 },
  { route: ["guw", "akx", "ast"], kind: "грузовой", cargo: "Нефть", speed: 48, loco: "ТЭ36А", cars: 11 },
  { route: ["ura", "akx"], kind: "грузовой", cargo: "Металл", speed: 51, loco: "ТЭ33А", cars: 9 },
  { route: ["akx", "ast", "alm", "dos"], kind: "международный", cargo: "Контейнеры", speed: 72, loco: "KZ8", cars: 10 },
  { route: ["alm", "dos"], kind: "международный", cargo: "Контейнеры", speed: 68, loco: "KZ8", cars: 12 },
  { route: ["alm", "alk"], kind: "международный", cargo: "Автозапчасти", speed: 64, loco: "KZ4", cars: 8 },
  { route: ["shy", "sry"], kind: "международный", cargo: "пассажиры", speed: 75, loco: "KZ4", cars: 6 },
  { route: ["ast", "kgf"], kind: "служебный", cargo: "служебный", speed: 32, loco: "ТЭМ-9", cars: 0 },
  { route: ["alm", "tdk"], kind: "пассажирский", cargo: "пассажиры", speed: 82, loco: "2ЭС7", cars: 6 },
  { route: ["ura", "guw"], kind: "пассажирский", cargo: "пассажиры", speed: 74, loco: "ТЭ36А", cars: 5 },
  { route: ["akx", "kzo2"], kind: "грузовой", cargo: "Соль", speed: 47, loco: "ТЭ36А", cars: 14 },
];

function cars(from: string, to: string, cargo: string, n: number, seed: number): Train["wagons"] {
  const { type } = wagonKind(cargo);
  return Array.from({ length: n }, (_, i) => ({
    id: `wf${seed}-${i}`,
    number: String(54000000 + seed * 20 + i),
    type,
    cargo,
    from,
    to,
    health: 80 + ((seed + i * 3) % 18),
  }));
}

export function extraTrains(): Train[] {
  const out: Train[] = [];
  let n = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const spec of CORRIDORS) {
      n += 1;
      const heading: 1 | -1 = (n + copy) % 2 === 0 ? 1 : -1;
      const last = spec.route.length - 1;
      const edge = heading === 1 ? (n + copy) % Math.max(1, last) : Math.min(last, 1 + ((n + copy) % Math.max(1, last)));
      const from = spec.route[0];
      const to = spec.route[last];
      const speed = spec.speed + ((n % 5) - 2) * 2;
      out.push({
        id: `tf${2000 + n + copy * 100}`,
        number: String(2100 + n + copy * 40),
        kind: spec.kind,
        route: spec.route,
        edge,
        t: ((n * 0.173 + copy * 0.41) % 0.9) + 0.04,
        heading,
        speed,
        delayMin: n % 9 === 0 ? 3 + (n % 7) : 0,
        status: n % 11 === 0 ? "на станции" : "в пути",
        dwell: n % 11 === 0 ? 12 : 0,
        loco: {
          model: spec.kind === "служебный" ? (copy === 0 ? "ТЭМ-11" : "SKD6e") : spec.loco,
          number: String(100 + n).padStart(4, "0"),
          health: 70 + (n % 28),
        },
        crew: {
          id: String(300 + n),
          driver: DRIVERS[n % DRIVERS.length],
          helper: DRIVERS[(n * 3) % DRIVERS.length],
        },
        wagons: spec.cars ? cars(nm(from), nm(to), spec.cargo, spec.cars, n + copy * 50) : [],
        lengthM: spec.cars ? spec.cars * 14 + 22 : 18,
        massT: spec.kind === "пассажирский" ? spec.cars * 52 : spec.cars * 68 + 120,
      });
    }
  }
  return out;
}

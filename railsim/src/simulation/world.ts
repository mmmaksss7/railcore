import type { Edge, Station, Train } from "./types";
import { OSM_PTS } from "../data/osmPts";
import { extraTrains } from "./fleet";
import { wagonKind } from "./rollingStock";

function st(
  id: string,
  name: string,
  lat: number,
  lng: number,
  kind: Station["kind"],
  tracks: number,
  occupied: number,
  electrified: boolean,
  repairTracks = 0
): Station {
  return { id, name, lat, lng, kind, tracks, occupied, repairTracks, electrified };
}

export const stations: Station[] = [
  st("ast", "Астана", 51.11245, 71.53177, "hub", 18, 9, true, 1),
  st("alm", "Алматы-2", 43.27400, 76.93903, "hub", 16, 7, true, 1),
  st("shy", "Шымкент", 42.29871, 69.61030, "hub", 10, 4, true),
  st("kgf", "Караганда", 49.79311, 73.09476, "yard", 22, 11, true, 2),
  st("akx", "Актобе", 50.28083, 57.21425, "border", 8, 3, true),
  st("pwq", "Павлодар", 52.30043, 76.97250, "passenger", 8, 3, true),
  st("ppk", "Петропавл", 54.85639, 69.17038, "border", 8, 2, true),
  st("sco", "Актау", 43.69695, 51.30896, "industry", 10, 4, false, 1),
  st("guw", "Атырау", 47.12949, 51.95683, "industry", 8, 3, true),
  st("ura", "Орал", 51.22880, 51.36977, "border", 6, 2, true),
  st("ukk", "Усть-Каменогорск", 49.95606, 82.64774, "industry", 8, 3, true),
  st("plx", "Семей", 50.43195, 80.26282, "passenger", 8, 3, true),
  st("dos", "Достык", 45.25286, 82.48665, "border", 6, 2, false),
  st("ekb", "Экибастуз", 51.75107, 75.31741, "industry", 6, 2, true),
  st("dzn", "Жезказган", 47.77745, 67.69172, "industry", 6, 2, false),
  st("bxh", "Балхаш", 46.85612, 74.98722, "industry", 5, 2, false),
  st("kzo", "Костанай", 53.22735, 63.60635, "passenger", 7, 2, true),
  st("kkc", "Кокшетау", 53.28883, 69.42318, "passenger", 6, 2, true),
  st("kzo2", "Кызылорда", 44.85473, 65.49539, "passenger", 6, 2, true),
  st("shu", "Шу", 43.60101, 73.76109, "passenger", 6, 2, true),
  st("mty", "Мойынты", 47.21832, 73.36037, "yard", 8, 3, false),
  st("trk", "Туркестан", 43.28570, 68.21300, "passenger", 5, 1, true),
  st("tar", "Тараз", 42.86968, 71.37892, "passenger", 7, 2, true),
  st("bei", "Бейнеу", 45.32211, 55.19662, "yard", 6, 2, false),
  st("atg", "Актогай", 46.95306, 79.68175, "yard", 6, 2, false),
  st("alk", "Алтынколь", 44.16491, 80.29542, "border", 4, 1, false),
  st("ary", "Арыс", 42.41928, 68.79353, "yard", 8, 3, true),
  st("tdk", "Талдыкорган", 45.00320, 78.37693, "passenger", 5, 1, true),
  st("knd", "Кандыагаш", 49.47058, 57.42743, "yard", 5, 2, true),
  st("sry", "Сарыагаш", 41.46507, 69.14757, "border", 4, 1, true),
];

function e(
  id: string,
  from: string,
  to: string,
  type: Edge["type"],
  km: number,
  vmax: number,
  load: number,
  pts: [number, number][],
  ktsm = false
): Edge {
  return { id, from, to, type, km, vmax, load, pts: OSM_PTS[id] ?? pts, ktsm };
}

export const edges: Edge[] = [
  e("alm-ast", "alm", "ast", "elec", 1214, 120, 74, [
    [43.274, 76.939], [43.341, 76.949], [43.48, 76.1], [43.536, 75.214],
    [43.598, 73.761], [44.55, 73.62], [45.8, 73.48], [47.221, 73.375],
    [48.55, 73.22], [49.806, 73.099], [50.48, 72.28], [51.112, 71.532],
  ], true),
  e("ast-ppk", "ast", "ppk", "elec", 464, 120, 68, [
    [51.112, 71.532], [52.2, 70.4], [53.283, 69.397], [54.2, 69.25], [54.873, 69.143],
  ], true),
  e("ast-pwq", "ast", "pwq", "elec", 438, 120, 71, [
    [51.112, 71.532], [51.4, 73.4], [51.723, 75.323], [52.1, 76.2], [52.287, 76.967],
  ]),
  e("ast-kzo", "ast", "kzo", "elec", 712, 110, 52, [
    [51.112, 71.532], [52.4, 70.1], [53.283, 69.397], [53.4, 66.5], [53.214, 63.624],
  ]),
  e("kgf-ukk", "kgf", "ukk", "elec", 890, 100, 48, [
    [49.806, 73.099], [50.1, 76.0], [50.411, 80.227], [50.2, 81.5], [49.948, 82.629],
  ]),
  e("alm-dos", "alm", "dos", "intl", 850, 80, 44, [
    [43.274, 76.939], [43.425, 77.02], [43.689, 77.126], [43.886, 77.082],
    [44.28, 77.62], [44.357, 77.978], [45.253, 77.976], [45.9, 78.72],
    [46.953, 79.682], [46.42, 80.68], [45.59, 82.18], [45.253, 82.486],
  ]),
  e("kgf-bxh", "kgf", "bxh", "freight", 380, 80, 62, [
    [49.806, 73.099], [47.221, 73.375], [46.843, 74.995],
  ]),
  e("bxh-atg", "bxh", "atg", "freight", 340, 80, 46, [
    [46.843, 74.995], [46.91, 77.36], [46.953, 79.682],
  ]),
  e("alm-shy", "alm", "shy", "elec", 702, 110, 64, [
    [43.274, 76.939], [43.22, 76.2], [43.598, 73.761], [42.92, 72.76],
    [42.9, 71.366], [42.55, 70.1], [42.43, 68.8], [42.32, 69.59],
  ]),
  e("shy-kzo2", "shy", "kzo2", "elec", 438, 100, 49, [
    [42.32, 69.59], [42.43, 68.8], [43.297, 68.252], [44.1, 66.8], [44.848, 65.509],
  ]),
  e("kzo2-dzn", "kzo2", "dzn", "diesel", 420, 80, 41, [
    [44.848, 65.509], [46.2, 66.4], [47.783, 67.71],
  ]),
  e("dzn-kgf", "dzn", "kgf", "freight", 460, 80, 53, [
    [47.783, 67.71], [48.9, 70.4], [49.806, 73.099],
  ]),
  e("akx-ast", "akx", "ast", "elec", 1010, 100, 57, [
    [50.284, 57.167], [49.469, 57.407], [50.0, 62.0], [50.248, 66.914],
    [51.955, 66.404], [51.81, 68.36], [51.4, 70.1], [51.112, 71.532],
  ]),
  e("guw-akx", "guw", "akx", "diesel", 520, 80, 46, [
    [47.116, 51.883], [46.958, 54.016], [48.2, 56.2], [49.469, 57.407], [50.284, 57.167],
  ]),
  e("sco-guw", "sco", "guw", "freight", 720, 70, 52, [
    [43.658, 51.158], [43.341, 52.855], [45.324, 55.187], [46.4, 54.6], [46.958, 54.016], [47.116, 51.883],
  ]),
  e("ura-guw", "ura", "guw", "diesel", 520, 90, 36, [
    [51.233, 51.367], [49.2, 51.6], [47.116, 51.883],
  ]),
  e("alm-tdk", "alm", "tdk", "elec", 268, 90, 38, [
    [43.274, 76.939], [43.689, 77.126], [44.357, 77.978], [45.003, 78.377],
  ]),
  e("alm-alk", "alm", "alk", "intl", 293, 80, 33, [
    [43.274, 76.939], [43.689, 77.126], [43.67, 78.01], [43.77, 79.19], [44.165, 80.295],
  ]),
  e("plx-ukk", "plx", "ukk", "diesel", 180, 80, 36, [
    [50.411, 80.227], [49.948, 82.629],
  ]),
  e("atg-plx", "atg", "plx", "elec", 430, 90, 41, [
    [46.953, 79.682], [47.965, 80.434], [49.2, 80.3], [50.411, 80.227],
  ]),
  e("ura-akx", "ura", "akx", "diesel", 480, 90, 38, [
    [51.233, 51.367], [50.9, 53.8], [50.55, 55.6], [50.284, 57.167],
  ]),
  e("akx-kzo2", "akx", "kzo2", "diesel", 820, 90, 40, [
    [50.284, 57.167], [49.469, 57.407], [47.833, 59.6], [46.8, 61.666], [44.848, 65.509],
  ]),
  e("ast-kgf", "ast", "kgf", "elec", 220, 120, 91, [
    [51.112, 71.532], [50.48, 72.28], [49.806, 73.099],
  ], true),
  e("pwq-ekb", "pwq", "ekb", "freight", 140, 80, 77, [
    [52.287, 76.967], [52.1, 76.2], [51.723, 75.323],
  ]),
  e("ekb-ast", "ekb", "ast", "freight", 310, 90, 73, [
    [51.723, 75.323], [51.4, 73.4], [51.112, 71.532],
  ]),
  e("shy-sry", "shy", "sry", "intl", 120, 90, 42, [
    [42.32, 69.59], [41.45, 69.168],
  ]),
  e("bei-akx", "bei", "akx", "freight", 640, 70, 35, [
    [45.324, 55.187], [46.5, 57.4], [47.833, 59.6], [48.7, 58.4], [49.469, 57.407], [50.284, 57.167],
  ]),
  e("alm-shu", "alm", "shu", "elec", 320, 110, 58, [
    [43.274, 76.939], [43.22, 76.2], [43.598, 73.761],
  ]),
  e("shu-tar", "shu", "tar", "elec", 210, 110, 47, [
    [43.598, 73.761], [42.92, 72.76], [42.9, 71.366],
  ]),
  e("tar-ary", "tar", "ary", "elec", 220, 100, 44, [
    [42.9, 71.366], [42.55, 70.1], [42.43, 68.8],
  ]),
  e("ary-shy", "ary", "shy", "elec", 110, 100, 51, [
    [42.43, 68.8], [42.32, 69.59],
  ]),
  e("ary-trk", "ary", "trk", "elec", 90, 100, 39, [
    [42.43, 68.8], [43.297, 68.252],
  ]),
];

function wagons(from: string, to: string, cargo: string, n: number, start = 61847290): Train["wagons"] {
  const { type } = wagonKind(cargo);
  return Array.from({ length: n }, (_, i) => ({
    id: `w${start + i}`,
    number: String(start + i),
    type,
    cargo,
    from,
    to,
    health: 88 + ((i * 7) % 12),
  }));
}

const baseTrains: Train[] = [
  {
    id: "t4827",
    number: "4827",
    kind: "грузовой",
    route: ["ekb", "ast", "kgf"],
    edge: 0,
    t: 0.42,
    heading: 1,
    speed: 64,
    delayMin: 12,
    status: "в пути",
    dwell: 0,
    loco: { model: "2ТЭ-25КМ", number: "0047", health: 82 },
    crew: { id: "182", driver: "Иванов А.С.", helper: "Петров Д.В." },
    wagons: wagons("Экибастуз", "ТЭЦ Караганда", "Уголь", 12).map((w, i) =>
      i === 2 ? { ...w, number: "61877302", id: "w61877302", health: 71 } : w
    ),
    lengthM: 720,
    massT: 5840,
  },
  {
    id: "t712",
    number: "712",
    kind: "пассажирский",
    route: ["alm", "ast", "ppk"],
    edge: 0,
    t: 0.35,
    heading: 1,
    speed: 88,
    delayMin: 0,
    status: "в пути",
    dwell: 0,
    loco: { model: "KZ4", number: "0012", health: 94 },
    crew: { id: "091", driver: "Садыков М.К.", helper: "Омаров Е.Т." },
    wagons: wagons("Алматы", "Петропавл", "пассажиры", 8, 70011000),
    lengthM: 210,
    massT: 640,
  },
  {
    id: "t5503",
    number: "5503",
    kind: "грузовой",
    route: ["dzn", "kgf", "ast"],
    edge: 0,
    t: 0.2,
    heading: 1,
    speed: 48,
    delayMin: 0,
    status: "в пути",
    dwell: 0,
    loco: { model: "ТЭ33А", number: "0034", health: 79 },
    crew: { id: "204", driver: "Ким В.П.", helper: "Нурланов А." },
    wagons: wagons("Жезказган", "Астана", "Металл", 16, 53001000),
    lengthM: 890,
    massT: 4120,
  },
  {
    id: "t101",
    number: "101",
    kind: "международный",
    route: ["akx", "ast", "alm", "dos"],
    edge: 2,
    t: 0.3,
    heading: 1,
    speed: 72,
    delayMin: 0,
    status: "в пути",
    dwell: 0,
    loco: { model: "KZ8", number: "0008", health: 91 },
    crew: { id: "017", driver: "Ли В.", helper: "Чжан Х." },
    wagons: wagons("Актобе", "Достык (КНР)", "Контейнеры", 10, 88001000),
    lengthM: 540,
    massT: 1980,
  },
  {
    id: "t001",
    number: "001",
    kind: "пассажирский",
    route: ["alm", "ast"],
    edge: 0,
    t: 0.55,
    heading: 1,
    speed: 96,
    delayMin: 8,
    status: "в пути",
    dwell: 0,
    loco: { model: "2ЭС7", number: "0003", health: 97 },
    crew: { id: "044", driver: "Белов И.Н.", helper: "Серов П.А." },
    wagons: wagons("Алматы", "Астана", "пассажиры", 9, 10001000),
    lengthM: 248,
    massT: 710,
  },
  {
    id: "t3301",
    number: "3301",
    kind: "грузовой",
    route: ["sco", "guw", "akx"],
    edge: 0,
    t: 0.7,
    heading: 1,
    speed: 41,
    delayMin: 4,
    status: "в пути",
    dwell: 0,
    loco: { model: "ТЭ33А", number: "0047", health: 68 },
    crew: { id: "311", driver: "Жумабаев С.", helper: "Ибраев Т." },
    wagons: wagons("Актау", "Актобе", "Нефть", 14, 44001000),
    lengthM: 610,
    massT: 3210,
  },
  {
    id: "t900",
    number: "900",
    kind: "служебный",
    route: ["ast", "kgf"],
    edge: 0,
    t: 0.5,
    heading: 1,
    speed: 28,
    delayMin: 0,
    status: "в пути",
    dwell: 0,
    loco: { model: "ТЭМ-9", number: "118", health: 74 },
    crew: { id: "508", driver: "Маневров К.", helper: "—" },
    wagons: [],
    lengthM: 18,
    massT: 126,
  },
];

export const trains: Train[] = [...baseTrains, ...extraTrains()];

export const START_MS = Date.UTC(2026, 9, 14, 14, 32, 10);

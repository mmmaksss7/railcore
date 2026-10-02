import type { Train } from "../simulation/types";

export type Alm2Cls = "main" | "po" | "sort" | "ink";

export type Alm2Seg = {
  no: string;
  cls: Alm2Cls;
  x1: number;
  x2: number;
  y: number;
  cap?: "left" | "right";
  dot?: boolean;
  labelX?: number;
};

const W = 1280;
const H = 420;

const Y = {
  p1b: 76,
  p1r: 96,
  t2: 112,
  t4: 126,
  a6: 140,
  t8: 153,
  t10: 166,
  tech0: 184,
  talgo0: 256,
  t27: 362,
  t36: 228,
  t37: 242,
  t213: 258,
  t205: 310,
  metro: 124,
};

function ty(i: number) {
  return Y.tech0 + i * 11;
}
function gy(i: number) {
  return Y.talgo0 + i * 11;
}

export const ALM2_SEGS: Alm2Seg[] = [
  { no: "1П", cls: "sort", x1: 40, x2: 500, y: Y.p1b, labelX: 200 },
  { no: "1Пм", cls: "main", x1: 40, x2: 760, y: Y.p1r, labelX: 200 },
  { no: "1А", cls: "po", x1: 240, x2: 700, y: Y.p1r, labelX: 560 },
  { no: "2", cls: "po", x1: 180, x2: 700, y: Y.t2, labelX: 560 },
  { no: "4", cls: "po", x1: 240, x2: 700, y: Y.t4, labelX: 560 },
  { no: "6А", cls: "po", x1: 300, x2: 700, y: Y.a6, labelX: 560 },
  { no: "8", cls: "po", x1: 300, x2: 700, y: Y.t8, labelX: 560 },
  { no: "10", cls: "po", x1: 300, x2: 700, y: Y.t10, labelX: 560 },
  { no: "1Ав", cls: "po", x1: 860, x2: 1244, y: Y.p1r },
  { no: "10в", cls: "po", x1: 860, x2: 1244, y: Y.t10 },
  { no: "33", cls: "sort", x1: 500, x2: 630, y: 60, cap: "right", labelX: 560 },
  { no: "34", cls: "sort", x1: 500, x2: 630, y: 72, cap: "right", labelX: 560 },
  ...[12, 13, 14, 15, 16, 17].map((no, i) => ({
    no: String(no),
    cls: "sort" as const,
    x1: 300,
    x2: 700,
    y: ty(i),
    cap: "left" as const,
    labelX: 560,
  })),
  ...[18, 19, 20, 21, 22, 23, 24, 25, 26].map((no, i) => ({
    no: String(no),
    cls: "sort" as const,
    x1: 300,
    x2: 640,
    y: gy(i),
    cap: "left" as const,
    dot: true,
    labelX: 560,
  })),
  { no: "27", cls: "sort", x1: 560, x2: 720, y: Y.t27, cap: "right", labelX: 640 },
  { no: "36", cls: "sort", x1: 1000, x2: 1160, y: Y.t36, cap: "right", labelX: 1070 },
  { no: "37", cls: "sort", x1: 1000, x2: 1160, y: Y.t37, cap: "right", labelX: 1070 },
  { no: "213", cls: "ink", x1: 920, x2: 1200, y: Y.t213, cap: "right", labelX: 1048 },
  { no: "205", cls: "sort", x1: 800, x2: 940, y: Y.t205, cap: "right", labelX: 870 },
  { no: "Метро", cls: "ink", x1: 24, x2: 150, y: Y.metro, cap: "left" },
  { no: "Метро2", cls: "ink", x1: 24, x2: 150, y: Y.metro + 12, cap: "left" },
];

const PO_FOR_TRAINS = ["1А", "2", "4", "6А", "8", "10"];

function clsName(s: Alm2Seg) {
  const c = s.cls === "main" ? "tra-main" : s.cls === "po" ? "tra-po" : s.cls === "ink" ? "tra-ink" : "tra-sort";
  return s.dot ? `${c} tra-dot` : c;
}

function Buf({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} className="tra-ink" />
      <line x1={x - 4} y1={y - 5} x2={x + 4} y2={y - 5} className="tra-ink" />
    </g>
  );
}

function Sig({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="tra-sig">
      <ellipse cx={x} cy={y} rx="4.5" ry="2.8" />
      <ellipse cx={x + 6} cy={y} rx="4.5" ry="2.8" />
      <text x={x + 3} y={y - 6} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function labelOf(no: string) {
  if (no === "1Пм" || no === "1П") return "1П";
  if (no.startsWith("Метро") || no.endsWith("в")) return "";
  return no;
}

export function Almaty2Plan({ trains, onTrain }: { trains: Train[]; onTrain: (t: Train) => void }) {
  const here = trains.slice(0, 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yard yard-pro tra-plan tra-sheet">
      <rect width={W} height={H} className="tra-paper" />

      <text x="10" y="22" className="tra-note">
        Приемоотправочный парк.
      </text>
      <rect x="568" y="8" width="120" height="34" rx="2" className="tra-pz" />
      <text x="628" y="23" textAnchor="middle" className="tra-pz-t">
        П/З
      </text>
      <text x="628" y="36" textAnchor="middle" className="tra-pz-t">
        ПК88+84,40
      </text>
      <line x1="628" y1="42" x2="628" y2="178" className="tra-bound" />
      <line x1="1254" y1="68" x2="1254" y2="190" className="tra-bound" />
      <text x="1266" y="200" className="tra-vert" transform="rotate(-90 1266 200)">
        Проспект Сейфуллина
      </text>

      <text x="10" y="70" className="tra-dir">
        ← Алматы-1
      </text>
      <text x="10" y="152" className="tra-note">
        П/ПУТЬ «МЕТРО»
      </text>
      <text x="10" y="176" className="tra-dir">
        ← Четное
      </text>
      <text x="308" y="178" className="tra-park">
        Технический парк
      </text>
      <text x="308" y="250" className="tra-park">
        Строительство ПТО «Тальго»
      </text>
      <text x="1168" y="236" className="tra-note">
        «АлЭС ТЭЦ»
      </text>
      <text x="1024" y="252" className="tra-note">
        П/ПУТЬ 213
      </text>
      <text x="812" y="304" className="tra-note">
        П/ПУТЬ 205
      </text>

      <path d={`M 500 ${Y.p1b} L 500 60`} className="tra-sort" />
      <path d={`M 500 ${Y.p1b} L 500 72`} className="tra-sort" />
      <path d={`M 150 ${Y.metro} L 180 ${Y.t2}`} className="tra-ink" />
      <path d={`M 150 ${Y.metro + 12} L 180 ${Y.t2}`} className="tra-ink" />
      <path d={`M 700 ${Y.p1r} L 860 ${Y.p1r}`} className="tra-po" />
      <path d={`M 700 ${Y.t2} L 800 ${Y.p1r}`} className="tra-po" />
      <path d={`M 700 ${Y.t4} L 820 ${Y.p1r}`} className="tra-po" />
      <path d={`M 700 ${Y.a6} L 820 ${Y.t10}`} className="tra-po" />
      <path d={`M 700 ${Y.t8} L 840 ${Y.t10}`} className="tra-po" />
      <path d={`M 700 ${Y.t10} L 860 ${Y.t10}`} className="tra-po" />
      <path d={`M 700 ${Y.p1r} L 718 70`} className="tra-sort" />
      <line x1="718" y1="70" x2="718" y2="178" className="tra-sort" data-track="28" />
      <text x="726" y="68" className="tra-num">
        28
      </text>
      <path d={`M 700 ${ty(0)} L 900 ${Y.t36}`} className="tra-sort" />
      <path d={`M 700 ${ty(1)} L 900 ${Y.t37}`} className="tra-sort" />
      <path d={`M 700 ${ty(2)} L 920 ${Y.t213}`} className="tra-sort" />
      <path d={`M 700 ${ty(3)} L 900 ${Y.t36 + 20}`} className="tra-sort" />
      <path d={`M 700 ${ty(4)} L 900 ${Y.t37}`} className="tra-sort" />
      <path d={`M 700 ${ty(5)} L 920 ${Y.t213}`} className="tra-sort" />
      <path d={`M 900 ${Y.t36} L 1000 ${Y.t36}`} className="tra-sort" />
      <path d={`M 900 ${Y.t37} L 1000 ${Y.t37}`} className="tra-sort" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <path key={"g" + i} d={`M 640 ${gy(i)} L 800 ${Y.t205}`} className="tra-sort tra-dot" />
      ))}
      <path d={`M 720 ${Y.t27} L 800 ${Y.t205}`} className="tra-sort" />

      {ALM2_SEGS.map((s) => (
        <g key={s.no + s.y} data-track={s.no}>
          <line x1={s.x1} y1={s.y} x2={s.x2} y2={s.y} className={clsName(s)} />
          {s.cap === "left" && <Buf x={s.x1} y={s.y} />}
          {s.cap === "right" && <Buf x={s.x2} y={s.y} />}
          {s.labelX != null && labelOf(s.no) && (
            <text x={s.labelX} y={s.y - 3} textAnchor="middle" className="tra-num">
              {labelOf(s.no)}
            </text>
          )}
        </g>
      ))}

      <rect x="508" y={Y.p1r - 4} width="90" height="8" className="tra-plat" />
      <rect x="508" y={Y.t2 - 4} width="90" height="8" className="tra-plat" />
      <rect x="508" y={Y.t4 - 4} width="90" height="8" className="tra-plat" />

      <Sig x={62} y={Y.p1r} label="Ч" />
      <Sig x={248} y={Y.p1r} label="ЧМ1" />
      <Sig x={768} y={Y.p1r} label="ЧМ2" />
      <Sig x={1184} y={Y.p1r} label="ЧМ15" />
      <Sig x={1184} y={Y.t10} label="ЧМ17" />

      {here.map((t, i) => {
        const no = PO_FOR_TRAINS[i] ?? "10";
        const seg = ALM2_SEGS.find((s) => s.no === no);
        if (!seg) return null;
        const x = 320 + (i % 3) * 48;
        return (
          <g key={t.id} data-train={t.id} data-track={no} onClick={() => onTrain(t)} style={{ cursor: "pointer" }}>
            <rect x={x} y={seg.y - 5} width="42" height="10" rx="1" className={`yocc ${t.kind}`} />
            <text x={x + 2} y={seg.y + 3} className="yt num">
              №{t.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

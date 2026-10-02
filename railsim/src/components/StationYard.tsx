import { useState } from "react";
import { allTracks, schemesFor, type TraRole, type TraScheme, type TraTrack } from "../simulation/tra";
import type { Edge, Station, Train } from "../simulation/types";
import { Almaty2Plan } from "./traPlans";

type Laid = TraTrack & { x1: number; x2: number; y: number };

function roleClass(role: TraRole) {
  if (role === "main") return "tra-main";
  if (role === "po") return "tra-po";
  if (role === "sort") return "tra-sort";
  return "tra-side";
}

function neighbors(id: string, edges: Edge[], stations: Station[]) {
  const ids = edges.filter((e) => e.from === id || e.to === id).map((e) => (e.from === id ? e.to : e.from));
  return [...new Set(ids)].map((x) => stations.find((s) => s.id === x)?.name ?? x);
}

function layout(scheme: TraScheme) {
  const w = 1000;
  let y = 56;
  const parks: { name: string; titleY: number; tracks: Laid[]; main: Laid | null }[] = [];
  for (const park of scheme.parks) {
    const titleY = y;
    y += 16;
    const laid: Laid[] = [];
    let main: Laid | null = null;
    const tech = /технич|тальго|тупик|сортир/i.test(park.name);
    for (const t of park.tracks) {
      const stub = Boolean(t.stub) || tech && t.role !== "main";
      let x1 = 160;
      let x2 = 780;
      if (t.role === "main") {
        x1 = 48;
        x2 = 952;
      } else if (stub || t.role === "sort" || t.role === "siding") {
        x1 = 200;
        x2 = 620;
      } else {
        x1 = 150;
        x2 = 760;
      }
      const row: Laid = { ...t, stub, x1, x2, y };
      if (t.role === "main" && !main) main = row;
      laid.push(row);
      y += t.role === "main" ? 18 : 14;
    }
    parks.push({ name: park.name, titleY, tracks: laid, main: main ?? laid[0] ?? null });
    y += 10;
  }
  return { w, h: y + 28, parks };
}

function Signal({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="tra-sig">
      <ellipse cx={x} cy={y} rx="5" ry="3.2" />
      <ellipse cx={x + 7} cy={y} rx="5" ry="3.2" />
      <text x={x + 3} y={y - 7} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export function StationYard({
  station,
  trains,
  edges,
  stations,
  closed,
  onTrain,
}: {
  station: Station;
  trains: Train[];
  edges: Edge[];
  stations: Station[];
  closed: string[];
  onTrain: (t: Train) => void;
}) {
  const schemes = schemesFor(station);
  const [si, setSi] = useState(0);
  const [page, setPage] = useState<"plan" | "tra">("plan");
  const scheme = schemes[Math.min(si, schemes.length - 1)] ?? schemes[0];
  const graphNb = neighbors(station.id, edges, stations);
  const left = (scheme.left && scheme.left !== "нечетное" ? scheme.left : graphNb[0] ?? "нечетное").toUpperCase();
  const right = (scheme.right && scheme.right !== "четное" ? scheme.right : graphNb[1] ?? "четное").toUpperCase();
  const laid = layout(scheme);
  const tracks = allTracks(scheme);
  const here = trains.filter(
    (t) => t.route[t.edge] === station.id || (t.status === "на станции" && t.route.includes(station.id))
  );
  const occN = Math.min(station.occupied, tracks.length);
  const firstPark = laid.parks[0];
  const main = firstPark?.main;
  const custom = scheme.id === "alm2";

  return (
    <div className="yard-wrap tra">
      <div className="yard-meta">
        <b>Схематический план станции {scheme.name}</b>
        <span>
          ({scheme.klass}) · {station.electrified ? "ЭЦ, 25 кВ" : "ЭЦ / МБ"} · по ТРА
        </span>
      </div>
      {schemes.length > 1 && (
        <div className="filters">
          {schemes.map((s, i) => (
            <button key={s.id} className={si === i ? "on" : ""} onClick={() => setSi(i)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="filters">
        <button className={page === "plan" ? "on" : ""} onClick={() => setPage("plan")}>
          План
        </button>
        <button className={page === "tra" ? "on" : ""} onClick={() => setPage("tra")}>
          Специализация путей
        </button>
      </div>

          {page === "plan" && custom && <Almaty2Plan trains={here} onTrain={onTrain} />}

      {page === "plan" && !custom && (
        <svg viewBox={`0 0 ${laid.w} ${laid.h}`} className="yard yard-pro tra-plan tra-sheet">
          <rect x="0" y="0" width={laid.w} height={laid.h} className="tra-paper" />
          <text x={laid.w / 2} y="20" textAnchor="middle" className="tra-title">
            Схематический план станции {scheme.name} ({scheme.klass})
          </text>
          <text x="16" y="40" className="tra-dir">
            ← {left}
          </text>
          <text x={laid.w - 16} y="40" textAnchor="end" className="tra-dir">
            {right} →
          </text>
          {main && (
            <g>
              <rect x={laid.w / 2 - 44} y={main.y - 28} width="88" height="18" rx="2" className="tra-pz" />
              <text x={laid.w / 2} y={main.y - 16} textAnchor="middle" className="tra-pz-t">
                П/З
              </text>
            </g>
          )}

          {laid.parks.map((park) => (
            <g key={park.name}>
              <text x="16" y={park.titleY} className="tra-park">
                {park.name}
              </text>
              {park.tracks.map((tr) => (
                <g key={park.name + tr.no}>
                  {tr.role !== "main" && park.main && !tr.stub && (
                    <path
                      d={`M ${tr.x1} ${tr.y} L ${Math.max(48, tr.x1 - 90)} ${park.main.y}`}
                      className={roleClass(tr.role)}
                    />
                  )}
                  {tr.stub && park.main && (
                    <path d={`M ${tr.x2} ${tr.y} L ${tr.x2 + 50} ${park.main.y}`} className={roleClass(tr.role)} />
                  )}
                  <line x1={tr.x1} y1={tr.y} x2={tr.x2} y2={tr.y} className={roleClass(tr.role)} />
                  {tr.stub && <line x1={tr.x1} y1={tr.y - 5} x2={tr.x1} y2={tr.y + 5} className={roleClass(tr.role)} />}
                  <text x={(tr.x1 + tr.x2) / 2} y={tr.y - 4} textAnchor="middle" className="tra-num">
                    {tr.no}
                  </text>
                </g>
              ))}
            </g>
          ))}

          {main && (
            <>
              <Signal x={58} y={main.y} label="Ч" />
              <Signal x={920} y={main.y} label="Н" />
            </>
          )}

          {laid.parks
            .flatMap((p) => p.tracks)
            .slice(0, occN)
            .map((tr, i) => {
              const train = here[i];
              const span = Math.max(40, tr.x2 - tr.x1 - 90);
              const ox = tr.x1 + 40 + ((i * 47) % span);
              const shut = closed.includes(`Путь ${i + 1}`) || closed.includes(tr.no);
              return (
                <g
                  key={"occ" + tr.no + i}
                  onClick={() => train && onTrain(train)}
                  style={{ cursor: train ? "pointer" : "default" }}
                >
                  <rect
                    x={ox}
                    y={tr.y - 3.5}
                    width={train ? 44 : 34}
                    height="7"
                    rx="1"
                    className={train ? `yocc ${train.kind}` : "tra-plat"}
                  />
                  {train && (
                    <text x={ox + 3} y={tr.y + 2} className="yt num">
                      №{train.number}
                    </text>
                  )}
                  {shut ? <title>закрыт</title> : null}
                </g>
              );
            })}
        </svg>
      )}

      {page === "tra" && (
        <div className="tra-table-wrap">
          <table className="tra-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Путь</th>
                <th>Парк</th>
                <th>Специализация согласно ТРА</th>
                <th>Полезн. дл.</th>
                <th>Вмест.</th>
                <th>Сост.</th>
              </tr>
            </thead>
            <tbody>
              {scheme.parks.flatMap((park) =>
                park.tracks.map((tr, i) => {
                  const idx =
                    scheme.parks.slice(0, scheme.parks.indexOf(park)).reduce((n, p) => n + p.tracks.length, 0) + i;
                  const shut = closed.includes(`Путь ${idx + 1}`) || closed.includes(tr.no);
                  const occ = idx < occN;
                  const train = here[idx];
                  return (
                    <tr key={park.name + tr.no + i} className={shut ? "shut" : occ ? "occ" : ""}>
                      <td>{idx + 1}</td>
                      <td>
                        <i className={roleClass(tr.role)} /> {tr.no}
                      </td>
                      <td>{park.name.replace(/приемоотправочный /i, "ПО ").replace(/сортировочный /i, "СО ")}</td>
                      <td>{tr.spec}</td>
                      <td>{tr.len || "—"}</td>
                      <td>{tr.cap || "—"}</td>
                      <td>{shut ? "закр." : train ? `№${train.number}` : occ ? "занят" : "своб."}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

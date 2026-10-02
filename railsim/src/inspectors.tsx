import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { getHistoryEvents, getHistorySnapshots, putConfig } from "./api";
import { StationYard } from "./components/StationYard";
import { formatClock, networkLoad } from "./simulation/engine";
import { locoSrc, wagonSrc } from "./simulation/rollingStock";
import { useSim } from "./simulation/SimContext";
import type { Train, TrainKind } from "./simulation/types";
import { useWorkspace } from "./workspace";

function kindMark(k: TrainKind) {
  return { пассажирский: "пас", грузовой: "груз", международный: "межд", служебный: "служ" }[k];
}

function stName(stations: { id: string; name: string }[], id: string) {
  return stations.find((s) => s.id === id)?.name ?? id;
}

export function TrainsInspector() {
  const { state, dispatch } = useSim();
  const { openEntity } = useWorkspace();
  const [filter, setFilter] = useState("все");
  const [q, setQ] = useState("");
  const listed = state.trains.filter((t) => {
    const route = `${t.number} ${stName(state.stations, t.route[0])} ${stName(state.stations, t.route[t.route.length - 1])}`;
    if (q && !route.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "пассажирские") return t.kind === "пассажирский";
    if (filter === "грузовые") return t.kind === "грузовой";
    if (filter === "международные") return t.kind === "международный";
    if (filter === "аварийные") return t.status === "остановлен" || t.wagons.some((w) => w.fault);
    return true;
  });
  return (
    <div className="insp">
      <div className="filters">
        <input className="search" value={q} placeholder="номер / станция" onChange={(e) => setQ(e.target.value)} />
        {["все", "пассажирские", "грузовые", "международные", "аварийные"].map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="table">
        <div className="row head">
          <span>№</span>
          <span>Тип</span>
          <span>Локомотив</span>
          <span>Маршрут</span>
          <span>Статус</span>
          <span>Скорость</span>
          <span>Задержка</span>
        </div>
        {listed.map((t) => (
          <button
            key={t.id}
            className={t.id === state.selectedTrain ? "row on" : "row"}
            onClick={() => {
              dispatch({ type: "selectTrain", id: t.id });
              openEntity("train", t.id, `Поезд №${t.number}`);
            }}
          >
            <b>№{t.number}</b>
            <em className={t.kind}>{kindMark(t.kind)}</em>
            <span className="loco-mini">
              <img src={locoSrc(t.loco.model, "side")} alt="" />
              {t.loco.model}
            </span>
            <span>
              {stName(state.stations, t.route[0])} → {stName(state.stations, t.route[t.route.length - 1])}
            </span>
            <span>{t.status}</span>
            <span>{t.speed} км/ч</span>
            <span className={t.delayMin ? "bad" : ""}>{t.delayMin ? `+${t.delayMin} мин` : "0"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StationsInspector() {
  const { state, dispatch } = useSim();
  const { openEntity } = useWorkspace();
  return (
    <div className="insp">
      <div className="table">
        <div className="row head stn">
          <span>Станция</span>
          <span>Тип</span>
          <span>Пути</span>
          <span>Электр.</span>
        </div>
        {state.stations.map((s) => (
          <button
            key={s.id}
            className={s.id === state.selectedStation ? "row on stn" : "row stn"}
            onClick={() => {
              dispatch({ type: "selectStation", id: s.id });
              openEntity("station", s.id, `Станция ${s.name}`);
            }}
          >
            <b>{s.name}</b>
            <span>{s.kind}</span>
            <span>
              {s.occupied}/{s.tracks}
            </span>
            <span>{s.electrified ? "25 кВ" : "нет"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrainInspector({ trainId }: { trainId: string }) {
  const { state, dispatch } = useSim();
  const { openEntity, followId, setFollow } = useWorkspace();
  const train = state.trains.find((t) => t.id === trainId) ?? null;
  const [tab, setTab] = useState<"info" | "wagons" | "route" | "docs">("info");
  const canOperate = state.role === "admin" || state.role === "dispatcher" || state.role === "station";
  const canRepair = state.role === "admin" || state.role === "depot" || state.role === "wagon";
  const canShunt = state.role === "admin" || state.role === "shunter";
  if (!train) return <p className="hint">Поезд снят с графика</p>;
  const next = nextStation(train, state.stations);
  const doc = state.docs[train.id];
  const clock = formatClock(state.time);
  return (
    <div className="insp">
      <div className="filters">
        {(
          [
            ["info", "Общая информация"],
            ["wagons", "Состав"],
            ["route", "Маршрут"],
            ["docs", "Документы"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "info" && (
        <div className="passport">
          <div className="loco-card">
            <img src={locoSrc(train.loco.model, "iso")} alt={train.loco.model} />
            <div>
              <b>
                {train.loco.model} №{train.loco.number}
              </b>
              <span>Состояние {train.loco.health}%</span>
            </div>
          </div>
          <div className="consist" title="Состав">
            <img className="spr loco" src={locoSrc(train.loco.model, "side")} alt="" />
            {train.wagons.slice(0, 8).map((w) => (
              <img key={w.id} className="spr car" src={wagonSrc(w.cargo, "side")} alt={w.type} title={`${w.type} ${w.number}`} />
            ))}
            {train.wagons.length > 8 && <span className="hint">+{train.wagons.length - 8}</span>}
          </div>
          <dl>
            <div>
              <dt>Статус</dt>
              <dd>{train.status}</dd>
            </div>
            <div>
              <dt>Скорость</dt>
              <dd>{train.speed} км/ч</dd>
            </div>
            <div>
              <dt>Задержка</dt>
              <dd className={train.delayMin ? "bad" : ""}>{train.delayMin ? `+${train.delayMin} мин` : "0"}</dd>
            </div>
            <div>
              <dt>Следующая станция</dt>
              <dd>
                <button
                  className="link"
                  onClick={() => {
                    dispatch({ type: "selectStation", id: next.id });
                    openEntity("station", next.id, `Станция ${next.name}`);
                  }}
                >
                  {next.name}
                </button>
              </dd>
            </div>
            <div>
              <dt>Локомотив</dt>
              <dd>
                {train.loco.model} №{train.loco.number}
              </dd>
            </div>
            <div>
              <dt>Бригада</dt>
              <dd>№{train.crew.id}</dd>
            </div>
            <div>
              <dt>Машинист</dt>
              <dd>{train.crew.driver}</dd>
            </div>
            <div>
              <dt>Длина / масса</dt>
              <dd>
                {train.lengthM} м · {train.massT.toLocaleString("ru-KZ")} т
              </dd>
            </div>
          </dl>
          {canOperate && train.status !== "остановлен" && (
            <button className="act alarm" onClick={() => dispatch({ type: "stop", id: train.id })}>
              Остановить поезд
            </button>
          )}
          {canOperate && train.status === "остановлен" && (
            <button className="act" onClick={() => dispatch({ type: "resume", id: train.id })}>
              Возобновить движение
            </button>
          )}
          <button
            className={followId === train.id ? "act track on" : "act track"}
            onClick={() => {
              dispatch({ type: "selectTrain", id: train.id });
              setFollow(followId === train.id ? null : train.id);
            }}
          >
            <LocateFixed size={13} />
            {followId === train.id ? "Отслеживание включено" : "Отслеживание"}
          </button>
        </div>
      )}
      {tab === "wagons" && (
        <div className="table wagons">
          {train.wagons.map((w, i) => (
            <button key={w.id} className={w.fault ? "row alarm" : "row"} onClick={() => dispatch({ type: "selectWagon", id: w.id })}>
              <img className="spr mini" src={wagonSrc(w.cargo, "side")} alt="" />
              <span>{i + 1}</span>
              <b>{w.number}</b>
              <span>{w.type}</span>
              <span>{w.cargo}</span>
              <span>{w.to}</span>
              <span>{w.health}%</span>
              {w.fault && <span className="bad">{w.fault}</span>}
            </button>
          ))}
          {canRepair && train.wagons.some((w) => w.fault) && (
            <button
              className="act"
              onClick={() =>
                dispatch({
                  type: "repair",
                  trainId: train.id,
                  wagonId: train.wagons.find((w) => w.fault)!.id,
                })
              }
            >
              Диагностика / ВУ-45
            </button>
          )}
          {canShunt && train.wagons.some((w) => w.fault) && (
            <button
              className="act warn"
              onClick={() =>
                dispatch({
                  type: "uncouple",
                  trainId: train.id,
                  wagonId: train.wagons.find((w) => w.fault)?.id,
                })
              }
            >
              Отцепить неисправный вагон
            </button>
          )}
        </div>
      )}
      {tab === "route" && (
        <ol className="route">
          {train.route.map((id, i) => (
            <li key={id} className={i === train.edge ? "here" : ""}>
              {stName(state.stations, id)}
            </li>
          ))}
        </ol>
      )}
      {tab === "docs" && (
        <div className="docs">
          <p>
            <b>ВУ-45</b> · {doc?.vu45 ?? (state.scenario.repaired ? "успешно обработана" : "ожидает")}
          </p>
          <p>Тормоза: {doc?.brakes ?? (state.scenario.repaired ? "исправны" : "проверка")}</p>
          <p>Время: {clock.time}</p>
          <p>Работник: {doc?.worker ?? "вагонник, смена 2"}</p>
        </div>
      )}
    </div>
  );
}

function nextStation(train: Train, stations: { id: string; name: string }[]) {
  const idx = Math.min(train.route.length - 1, Math.max(0, train.edge + (train.heading > 0 ? 1 : 0)));
  const id = train.route[idx] ?? train.route[train.route.length - 1];
  return { id, name: stName(stations, id) };
}

export function StationInspector({ stationId, variant = "tab" }: { stationId: string; variant?: "tab" | "page" }) {
  const { state, dispatch } = useSim();
  const { openEntity } = useWorkspace();
  const station = state.stations.find((s) => s.id === stationId) ?? null;
  const [tab, setTab] = useState<"schema" | "work" | "staff" | "cfg">("schema");
  const canOperate = state.role === "admin" || state.role === "dispatcher" || state.role === "station";
  if (!station) return <p className="hint">Станция недоступна</p>;
  const closed = state.closedTracks[station.id] ?? [];
  const here = state.trains.filter((t) => t.route[t.edge] === station.id || t.status === "на станции");
  const arriving = here.filter((t) => t.status !== "на станции").slice(0, 6);
  const departing = here.filter((t) => t.status === "на станции").slice(0, 6);
  return (
    <div className={`insp ${variant === "page" ? "page" : ""}`}>
      <div className="filters">
        {(
          [
            ["schema", "Схема"],
            ["work", "Работа станции"],
            ["staff", "Персонал"],
            ["cfg", "Настройки"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "schema" && (
        <>
          <StationYard
            station={station}
            trains={state.trains}
            edges={state.edges}
            stations={state.stations}
            closed={closed}
            onTrain={(t) => {
              dispatch({ type: "selectTrain", id: t.id });
              openEntity("train", t.id, `Поезд №${t.number}`);
            }}
          />
          <div className="split">
            <div>
              <h4>Прибывающие</h4>
              {arriving.length === 0 && <p className="hint">нет</p>}
              {arriving.map((t) => (
                <button key={t.id} className="link" onClick={() => openEntity("train", t.id, `Поезд №${t.number}`)}>
                  №{t.number} · {t.speed} км/ч
                </button>
              ))}
            </div>
            <div>
              <h4>Отправляющиеся</h4>
              {departing.length === 0 && <p className="hint">нет</p>}
              {departing.map((t) => (
                <button key={t.id} className="link" onClick={() => openEntity("train", t.id, `Поезд №${t.number}`)}>
                  №{t.number}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {tab === "work" && (
        <>
          <dl className="mini">
            <div>
              <dt>Пути</dt>
              <dd>
                {station.occupied}/{station.tracks}
              </dd>
            </div>
            <div>
              <dt>Ремонт</dt>
              <dd>{station.repairTracks}</dd>
            </div>
            <div>
              <dt>Горка</dt>
              <dd>{station.kind === "yard" || station.kind === "hub" ? "работает" : "—"}</dd>
            </div>
            <div>
              <dt>Электр.</dt>
              <dd>{station.electrified ? "25 кВ" : "нет"}</dd>
            </div>
          </dl>
          {canOperate && !closed.includes("Путь 3") && (
            <button className="act warn" onClick={() => dispatch({ type: "closeTrack", stationId: station.id, track: "Путь 3" })}>
              Закрыть путь №3
            </button>
          )}
          {canOperate && closed.includes("Путь 3") && (
            <button className="act" onClick={() => dispatch({ type: "openTrack", stationId: station.id, track: "Путь 3" })}>
              Открыть путь №3
            </button>
          )}
        </>
      )}
      {tab === "staff" && (
        <dl className="mini">
          <div>
            <dt>ДСП</dt>
            <dd>смена 2</dd>
          </div>
          <div>
            <dt>Составители</dt>
            <dd>{station.kind === "yard" ? 6 : 2}</dd>
          </div>
          <div>
            <dt>Вагонники</dt>
            <dd>{Math.max(2, Math.round(station.tracks / 4))}</dd>
          </div>
          <div>
            <dt>Сигналисты</dt>
            <dd>1</dd>
          </div>
        </dl>
      )}
      {tab === "cfg" && <p className="hint">Локальные ограничения станции задаёт дежурный. Глобальные пороги — во вкладке Настройки.</p>}
    </div>
  );
}

export function EventsInspector() {
  const { state, dispatch } = useSim();
  const { openEntity } = useWorkspace();
  return (
    <ul className="events">
      {state.events.map((ev) => (
        <li
          key={ev.id}
          className={ev.level}
          onClick={() => {
            if (ev.trainId) {
              const t = state.trains.find((x) => x.id === ev.trainId);
              dispatch({ type: "selectTrain", id: ev.trainId });
              if (t) openEntity("train", t.id, `Поезд №${t.number}`);
            } else if (ev.stationId) {
              const s = state.stations.find((x) => x.id === ev.stationId);
              dispatch({ type: "selectStation", id: ev.stationId });
              if (s) openEntity("station", s.id, `Станция ${s.name}`);
            }
          }}
        >
          <time>{formatClock(ev.ts).time}</time>
          <div>
            <b>
              {ev.level === "alarm" ? "🔴 " : ev.level === "warn" ? "⚠ " : ev.level === "fix" ? "✓ " : "• "}
              {ev.text}
            </b>
            {ev.detail && <span>{ev.detail}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsInspector() {
  const { state } = useSim();
  const kpi = state.kpi ?? networkLoad(state);
  const [tab, setTab] = useState<"now" | "trains" | "stations" | "cargo" | "delay">("now");
  const top = [...state.edges].sort((a, b) => b.load - a.load).slice(0, 6);
  const pass = state.trains.filter((t) => t.kind === "пассажирский").length;
  const freight = state.trains.filter((t) => t.kind === "грузовой").length;
  const avgDelay = state.trains.length ? Math.round(state.trains.reduce((s, t) => s + t.delayMin, 0) / state.trains.length) : 0;
  return (
    <div className="insp">
      <div className="filters">
        {(
          [
            ["now", "Текущая ситуация"],
            ["trains", "Поезда"],
            ["stations", "Станции"],
            ["cargo", "Грузы"],
            ["delay", "Задержки"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "now" && (
        <>
          <dl className="mini kpi4">
            <div>
              <dt>Поезда</dt>
              <dd>{kpi.trains}</dd>
            </div>
            <div>
              <dt>Средняя задержка</dt>
              <dd>{avgDelay} мин</dd>
            </div>
            <div>
              <dt>Загрузка сети</dt>
              <dd>{kpi.avg}%</dd>
            </div>
            <div>
              <dt>Грузооборот</dt>
              <dd>{kpi.cargo} тыс. т</dd>
            </div>
          </dl>
          <div className="bars">
            {top.map((e) => (
              <div key={e.id}>
                <span>
                  {e.from}–{e.to} <em>{e.load}%</em>
                </span>
                <i>
                  <b style={{ width: `${e.load}%` }} />
                </i>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "trains" && (
        <dl className="mini">
          <div>
            <dt>Пассажирские</dt>
            <dd>{pass}</dd>
          </div>
          <div>
            <dt>Грузовые</dt>
            <dd>{freight}</dd>
          </div>
          <div>
            <dt>Международные</dt>
            <dd>{state.trains.filter((t) => t.kind === "международный").length}</dd>
          </div>
          <div>
            <dt>Служебные</dt>
            <dd>{state.trains.filter((t) => t.kind === "служебный").length}</dd>
          </div>
        </dl>
      )}
      {tab === "stations" && (
        <p className="hint">
          Узлов: {state.stations.filter((s) => s.kind === "hub").length} · сортировочных:{" "}
          {state.stations.filter((s) => s.kind === "yard").length} · погранпереходов:{" "}
          {state.stations.filter((s) => s.kind === "border").length}
        </p>
      )}
      {tab === "cargo" && <p className="hint">Оценка грузооборота сети: {kpi.cargo} тыс. т в обращении. Пассажиропоток моделируется по пассажирским ниткам.</p>}
      {tab === "delay" && (
        <p className="hint">
          Поездов с задержкой: {kpi.delays}. Средняя: {avgDelay} мин. Порог тревоги: {state.config?.thresholds.delay_alarm_min ?? 15} мин.
        </p>
      )}
    </div>
  );
}

export function AiInspector() {
  const { state, dispatch } = useSim();
  const kpi = state.kpi ?? networkLoad(state);
  const bars = state.ai.bars.length
    ? state.ai.bars
    : ([
        ["Загрузка сети", kpi.avg],
        ["Центральная", 91],
        ["Сортировочная", 87],
      ] as [string, number][]);
  return (
    <div className="insp">
      <p className="ai-disc">AI показывает анализ, предупреждения и рекомендации. Критические решения принимает оператор.</p>
      <div className="bars">
        {bars.map(([n, v]) => (
          <div key={String(n)}>
            <span>
              {n} <em>{v}%</em>
            </span>
            <i>
              <b style={{ width: `${v}%` }} />
            </i>
          </div>
        ))}
      </div>
      {state.ai.notes.map((n) => (
        <p key={n} className="ai-note">
          {n}
        </p>
      ))}
      {state.ai.recs.map((r) => (
        <button key={r.id} className="act" onClick={() => dispatch({ type: "applyRec", id: r.id })}>
          Рекомендация: {r.text}
        </button>
      ))}
    </div>
  );
}

export function HistoryInspector() {
  const [hours, setHours] = useState(24);
  const [events, setEvents] = useState<{ ts: number; level: string; text: string; detail?: string }[]>([]);
  const [snaps, setSnaps] = useState<{ ts: number; load_avg: number; delays: number }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([getHistoryEvents(hours), getHistorySnapshots(hours)])
      .then(([e, s]) => {
        if (!live) return;
        setEvents(e.items);
        setSnaps(s.items);
        setErr("");
      })
      .catch(() => setErr("Нет связи с API /api/history"));
    return () => {
      live = false;
    };
  }, [hours]);
  const maxLoad = Math.max(1, ...snaps.map((s) => s.load_avg));
  return (
    <div className="insp">
      <div className="filters">
        {[24, 48, 72].map((h) => (
          <button key={h} className={hours === h ? "on" : ""} onClick={() => setHours(h)}>
            {h}ч
          </button>
        ))}
      </div>
      {err && <p className="hint">{err}</p>}
      <div className="spark">
        {snaps.map((s) => (
          <i key={s.ts} style={{ height: `${(s.load_avg / maxLoad) * 100}%` }} title={`${s.load_avg}% · задержки ${s.delays}`} />
        ))}
      </div>
      <p className="hint">
        {snaps.length} снимков KPI · {events.length} событий
      </p>
      <ul className="events">
        {events.slice(0, 12).map((ev) => (
          <li key={ev.ts + ev.text} className={ev.level}>
            <time>{formatClock(ev.ts).time}</time>
            <div>
              <b>{ev.text}</b>
              {ev.detail && <span>{ev.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SettingsInspector() {
  const { state, dispatch } = useSim();
  const { open } = useWorkspace();
  const cfg = state.config;
  const [axle, setAxle] = useState(String(cfg?.thresholds.axlebox_c ?? 80));
  const [load, setLoad] = useState(String(cfg?.optimization.reroute_load_threshold ?? 85));
  const [delay, setDelay] = useState(String(cfg?.thresholds.delay_alarm_min ?? 15));
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!cfg) return;
    setAxle(String(cfg.thresholds.axlebox_c));
    setLoad(String(cfg.optimization.reroute_load_threshold));
    setDelay(String(cfg.thresholds.delay_alarm_min));
  }, [cfg]);
  async function save() {
    try {
      const next = await putConfig({
        thresholds: {
          axlebox_c: Number(axle),
          axlebox_alarm_c: Number(axle) + 7,
          delay_alarm_min: Number(delay),
        },
        optimization: { reroute_load_threshold: Number(load) },
      });
      dispatch({ type: "config", config: next });
      setMsg("Сохранено в config.yaml");
    } catch {
      setMsg("API недоступен");
    }
  }
  return (
    <div className="insp">
      <button className="act" onClick={() => open("history", { title: "История" })}>
        Открыть историю 24–72 ч
      </button>
      {state.role !== "admin" ? (
        <p className="hint">Пороги меняет только администратор</p>
      ) : (
        <>
          <div className="cfg">
            <label>
              КТСМ буксы °C
              <input value={axle} onChange={(e) => setAxle(e.target.value)} />
            </label>
            <label>
              Тревога задержки, мин
              <input value={delay} onChange={(e) => setDelay(e.target.value)} />
            </label>
            <label>
              Перенаправление при загрузке %
              <input value={load} onChange={(e) => setLoad(e.target.value)} />
            </label>
          </div>
          <p className="hint">backend/data/config.yaml · хранение {cfg?.index.snapshot_retention_hours ?? 72} ч</p>
          <button className="act" onClick={save}>
            Записать пороги
          </button>
          {msg && <p className="hint">{msg}</p>}
        </>
      )}
    </div>
  );
}

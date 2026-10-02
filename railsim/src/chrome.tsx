import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  Factory,
  Gauge,
  GitBranch,
  Globe,
  Layers,
  Map as MapIcon,
  Minus,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pin,
  Radio,
  Settings,
  Sparkles,
  Thermometer,
  TrainFront,
  User,
  X,
  Zap,
  Maximize2,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { formatClock, SPEED_OPTIONS } from "./simulation/engine";
import { useSim } from "./simulation/SimContext";
import type { Layers as LayerState, Role } from "./simulation/types";
import { useWorkspace, type TabKind, type WTab } from "./workspace";

const ROLES: { id: Role; label: string }[] = [
  { id: "admin", label: "Администратор" },
  { id: "dispatcher", label: "Поездной диспетчер" },
  { id: "station", label: "Дежурный по станции" },
  { id: "shunter", label: "Составитель" },
  { id: "depot", label: "Работник депо" },
  { id: "wagon", label: "Вагонник" },
];

const LAYER_ITEMS: { key: keyof LayerState; label: string; icon: typeof Layers }[] = [
  { key: "lines", label: "Железнодорожные линии", icon: GitBranch },
  { key: "stations", label: "Станции", icon: Building2 },
  { key: "trains", label: "Поезда", icon: TrainFront },
  { key: "electrification", label: "Электрификация", icon: Zap },
  { key: "signals", label: "Сигналы и стрелки", icon: Radio },
  { key: "ktsm", label: "КТСМ", icon: Thermometer },
  { key: "industry", label: "Предприятия и грузы", icon: Factory },
  { key: "load", label: "Загруженность участков", icon: Gauge },
  { key: "borders", label: "Границы стран", icon: Globe },
  { key: "relief", label: "Рельеф", icon: Mountain },
];

const LEGEND: { cls: string; label: string }[] = [
  { cls: "lg elec", label: "Электрифицированный участок" },
  { cls: "lg diesel", label: "Неэлектрифицированный участок" },
  { cls: "dot pass", label: "Пассажирская станция" },
  { cls: "dot freight", label: "Грузовая станция" },
  { cls: "dot yard", label: "Сортировочная станция" },
  { cls: "dot border", label: "Пограничный переход" },
  { cls: "dot depot", label: "Локомотивное депо" },
  { cls: "dot wagon", label: "Вагонное депо" },
  { cls: "dot repair", label: "Ремонтное предприятие" },
  { cls: "dot ind", label: "Промышленное предприятие" },
  { cls: "dot quarry", label: "Карьер" },
  { cls: "dot port", label: "Порт" },
  { cls: "dot air", label: "Аэропорт" },
  { cls: "dot town", label: "Населенный пункт" },
];

const DOCK: { kind: TabKind; label: string; icon: typeof TrainFront }[] = [
  { kind: "trains", label: "Поезда", icon: TrainFront },
  { kind: "stations", label: "Станции", icon: Building2 },
  { kind: "events", label: "События", icon: Bell },
  { kind: "analytics", label: "Аналитика", icon: Activity },
  { kind: "ai", label: "AI Анализ", icon: Sparkles },
];

export function TopBar() {
  const { state, dispatch } = useSim();
  const { open, stationPage, closeStationPage } = useWorkspace();
  const clock = formatClock(state.time);
  const kpi = state.kpi;
  const alarms = state.events.filter((e) => e.level === "alarm" || e.level === "warn").length;
  return (
    <header className="rc-top">
      <div
        className="rc-brand"
        onClick={() => stationPage && closeStationPage()}
        title={stationPage ? "К карте" : undefined}
        style={stationPage ? { cursor: "pointer" } : undefined}
      >
        <div className="rc-mark" />
        <div>
          <strong>RAILCORE</strong>
          <em>Railway Operations Simulator</em>
        </div>
      </div>
      <div className="rc-clock">
        <b>{clock.time}</b>
        <span>
          {clock.date} · {clock.weekday}
        </span>
      </div>
      <div className="rc-speeds">
        <button className={state.paused ? "on" : ""} onClick={() => dispatch({ type: "pause" })} title="Пауза">
          <Pause size={12} />
        </button>
        {SPEED_OPTIONS.filter((s) => s > 0).map((s) => (
          <button
            key={s}
            className={!state.paused && state.speed === s ? "on" : ""}
            onClick={() => dispatch({ type: "speed", speed: s })}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="rc-kpi">
        <span title="Поезда">
          🚂 <b>{kpi?.trains ?? state.trains.length}</b>
        </span>
        <span title="Локомотивы">
          🚆 <b>{kpi?.locos ?? "—"}</b>
        </span>
        <span title="Вагоны">
          ▣ <b>{(kpi?.wagons ?? 0).toLocaleString("ru-KZ")}</b>
        </span>
        <span title="Грузы">
          📦 <b>{kpi?.cargo ?? 0}</b>
          <i>тыс. т</i>
        </span>
        <span className={(kpi?.delays ?? 0) > 0 ? "bad" : ""} title="Задержки">
          ⚠ <b>{kpi?.delays ?? 0}</b>
        </span>
      </div>
      <div className="rc-tools">
        <span className={state.connected ? "live" : "live off"}>{state.connected ? "● LIVE" : "● LOCAL"}</span>
        <button
          className="icon-btn"
          onClick={() => open("events", { title: "События" })}
          title="Notifications"
        >
          <Bell size={14} />
          {alarms > 0 && <em>{alarms}</em>}
        </button>
        <button className="icon-btn" onClick={() => open("settings", { title: "Настройки" })} title="Settings">
          <Settings size={14} />
        </button>
        <label className="rc-profile" title="Profile">
          <User size={14} />
          <select value={state.role} onChange={(e) => dispatch({ type: "role", role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}

export function LayerPanel() {
  const { state, dispatch } = useSim();
  const { layersCollapsed, setLayersCollapsed } = useWorkspace();
  return (
    <aside className={layersCollapsed ? "rc-layers collapsed" : "rc-layers"}>
      <header>
        <Layers size={14} />
        {!layersCollapsed && <span>СЛОИ КАРТЫ</span>}
        <button onClick={() => setLayersCollapsed(!layersCollapsed)} title="Свернуть">
          {layersCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </header>
      <div className="rc-layer-list">
        {LAYER_ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <label key={it.key} title={it.label} className={state.layers[it.key] ? "on" : ""}>
              {layersCollapsed ? (
                <button type="button" onClick={() => dispatch({ type: "layer", key: it.key })}>
                  <Icon size={15} />
                </button>
              ) : (
                <>
                  <input
                    type="checkbox"
                    checked={state.layers[it.key]}
                    onChange={() => dispatch({ type: "layer", key: it.key })}
                  />
                  <Icon size={13} />
                  <span>{it.label}</span>
                </>
              )}
            </label>
          );
        })}
      </div>
    </aside>
  );
}

export function LegendDrawer() {
  const { legendOpen, setLegendOpen } = useWorkspace();
  if (!legendOpen) return null;
  return (
    <aside className="rc-legend">
      <header>
        <span>УСЛОВНЫЕ ОБОЗНАЧЕНИЯ</span>
        <button onClick={() => setLegendOpen(false)}>
          <X size={14} />
        </button>
      </header>
      <div>
        {LEGEND.map((it) => (
          <p key={it.label}>
            <i className={it.cls} />
            {it.label}
          </p>
        ))}
      </div>
    </aside>
  );
}

export function LegendButton() {
  const { legendOpen, setLegendOpen } = useWorkspace();
  return (
    <button className={legendOpen ? "rc-legend-btn on" : "rc-legend-btn"} onClick={() => setLegendOpen(!legendOpen)}>
      <BookOpen size={13} />
      LEGEND
    </button>
  );
}

export function BottomDock() {
  const { tabs, open, activeId, focusMap, stationPage } = useWorkspace();
  const { state } = useSim();
  const alarms = state.events.filter((e) => e.level === "alarm").length;
  const mapOn = !stationPage && (!activeId || tabs.every((t) => t.minimized));
  return (
    <nav className="rc-dock">
      <button className={mapOn ? "rc-dock-map on" : "rc-dock-map"} title="Карта" onClick={focusMap}>
        <MapIcon size={14} />
        Карта
      </button>
      {DOCK.map((d) => {
        const Icon = d.icon;
        const on = tabs.some((t) => t.kind === d.kind && t.id === activeId);
        return (
          <button key={d.kind} className={on ? "on" : ""} onClick={() => open(d.kind, { title: d.label })}>
            <Icon size={14} />
            {d.label}
            {d.kind === "events" && alarms > 0 && <em>{alarms}</em>}
          </button>
        );
      })}
    </nav>
  );
}

export function TabStrip() {
  const { tabs, activeId, activate, close } = useWorkspace();
  if (!tabs.length) return null;
  return (
    <div className="rc-tabs">
      {tabs.map((t) => (
        <button key={t.id} className={t.id === activeId ? "on" : ""} onClick={() => activate(t.id)}>
          {t.pinned && <Pin size={10} />}
          {t.title}
          <i
            onClick={(e) => {
              e.stopPropagation();
              close(t.id);
            }}
          >
            <X size={11} />
          </i>
        </button>
      ))}
    </div>
  );
}

export function WindowChrome({ tab, children }: { tab: WTab; children: ReactNode }) {
  const { close, togglePin, toggleMin, toggleFloat, move, activate, activeId } = useWorkspace();
  const drag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!tab.floating || (e.target as HTMLElement).closest("button")) return;
    const ox = e.clientX - tab.x;
    const oy = e.clientY - tab.y;
    const onMove = (ev: globalThis.PointerEvent) => move(tab.id, Math.max(48, ev.clientX - ox), Math.max(52, ev.clientY - oy));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (
    <div
      className={`rc-win ${tab.floating ? "float" : "docked"} ${tab.id === activeId ? "active" : ""} ${tab.minimized ? "min" : ""}`}
      style={tab.floating && !tab.minimized ? { left: tab.x, top: tab.y, width: tab.w, height: tab.h } : undefined}
      onPointerDown={() => activate(tab.id)}
    >
      <header onPointerDown={drag}>
        <strong>{tab.title}</strong>
        <span className="rc-win-acts">
          <button title="Закрепить" className={tab.pinned ? "on" : ""} onClick={() => togglePin(tab.id)}>
            <Pin size={12} />
          </button>
          <button title="Свернуть" onClick={() => toggleMin(tab.id)}>
            <Minus size={12} />
          </button>
          <button title={tab.floating ? "Пристыковать" : "Открепить"} onClick={() => toggleFloat(tab.id)}>
            <Maximize2 size={12} />
          </button>
          <button title="Закрыть" onClick={() => close(tab.id)}>
            <X size={12} />
          </button>
        </span>
      </header>
      {!tab.minimized && <div className="rc-win-body">{children}</div>}
    </div>
  );
}

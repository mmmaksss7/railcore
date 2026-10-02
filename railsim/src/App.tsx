import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { MapView } from "./components/MapView";
import { BottomDock, LayerPanel, LegendButton, LegendDrawer, TabStrip, TopBar, WindowChrome } from "./chrome";
import {
  AiInspector,
  AnalyticsInspector,
  EventsInspector,
  HistoryInspector,
  SettingsInspector,
  StationInspector,
  StationsInspector,
  TrainInspector,
  TrainsInspector,
} from "./inspectors";
import { SimProvider, useSim } from "./simulation/SimContext";
import type { Station } from "./simulation/types";
import { WorkspaceProvider, useWorkspace, type WTab } from "./workspace";

const STATION_KIND: Record<Station["kind"], string> = {
  hub: "узловая",
  yard: "сортировочная",
  passenger: "пассажирская",
  border: "пограничная",
  industry: "грузовая",
  depot: "депо",
};

function TabBody({ tab }: { tab: WTab }) {
  switch (tab.kind) {
    case "train":
      return tab.refId ? <TrainInspector trainId={tab.refId} /> : null;
    case "station":
      return tab.refId ? <StationInspector stationId={tab.refId} variant="page" /> : null;
    case "trains":
      return <TrainsInspector />;
    case "stations":
      return <StationsInspector />;
    case "events":
      return <EventsInspector />;
    case "analytics":
      return <AnalyticsInspector />;
    case "ai":
      return <AiInspector />;
    case "settings":
      return <SettingsInspector />;
    case "history":
      return <HistoryInspector />;
  }
}

function StationPage({ stationId }: { stationId: string }) {
  const { closeStationPage } = useWorkspace();
  const { state } = useSim();
  const station = state.stations.find((s) => s.id === stationId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStationPage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeStationPage]);
  return (
    <section className="rc-station-page">
      <header className="rc-station-head">
        <button type="button" className="icon-btn back" onClick={closeStationPage}>
          <ArrowLeft size={14} />
          К карте
        </button>
        <div>
          <strong>{station?.name ?? "Станция"}</strong>
          <em>
            {station ? `${STATION_KIND[station.kind]} · путей ${station.tracks}` : stationId}
            {station?.electrified ? " · 25 кВ" : ""}
          </em>
        </div>
      </header>
      <div className="rc-station-body">
        <StationInspector stationId={stationId} variant="page" />
      </div>
    </section>
  );
}

function Shell() {
  const { tabs, activeId, layersCollapsed, stationPage } = useWorkspace();
  const floating = tabs.filter((t) => t.floating && !t.minimized);
  const docked = tabs.find((t) => t.id === activeId && !t.floating && !t.minimized) ?? null;
  return (
    <div className={`rc-shell ${layersCollapsed ? "layers-min" : "layers-open"} ${stationPage ? "page" : ""}`}>
      <TopBar />
      <div className="rc-stage" hidden={!!stationPage} aria-hidden={!!stationPage}>
        <LayerPanel />
        <main className="map-wrap">
          <MapView />
          <LegendButton />
          {floating.map((t) => (
            <WindowChrome key={t.id} tab={t}>
              <TabBody tab={t} />
            </WindowChrome>
          ))}
        </main>
        <LegendDrawer />
      </div>
      {stationPage && <StationPage stationId={stationPage} />}
      {!stationPage && docked && (
        <section className="rc-inspector">
          <WindowChrome tab={docked}>
            <TabBody tab={docked} />
          </WindowChrome>
        </section>
      )}
      {!stationPage && <TabStrip />}
      {!stationPage && <BottomDock />}
    </div>
  );
}

export default function App() {
  return (
    <SimProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </SimProvider>
  );
}

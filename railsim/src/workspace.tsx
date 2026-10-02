import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TabKind =
  | "train"
  | "station"
  | "trains"
  | "stations"
  | "events"
  | "analytics"
  | "ai"
  | "settings"
  | "history";

export interface WTab {
  id: string;
  kind: TabKind;
  title: string;
  refId?: string;
  pinned: boolean;
  minimized: boolean;
  floating: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

type OpenOpts = { title: string; refId?: string };

interface WorkspaceValue {
  tabs: WTab[];
  activeId: string | null;
  layersCollapsed: boolean;
  legendOpen: boolean;
  open: (kind: TabKind, opts: OpenOpts) => void;
  openEntity: (kind: "train" | "station", refId: string, title: string) => void;
  activate: (id: string) => void;
  close: (id: string) => void;
  togglePin: (id: string) => void;
  toggleMin: (id: string) => void;
  toggleFloat: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  setLayersCollapsed: (v: boolean) => void;
  setLegendOpen: (v: boolean) => void;
  notifyLayout: () => void;
  focusMap: () => void;
  followId: string | null;
  setFollow: (id: string | null) => void;
  lockedStationId: string | null;
  setLockedStation: (id: string | null) => void;
  stationPage: string | null;
  closeStationPage: () => void;
}

const Ctx = createContext<WorkspaceValue | null>(null);

function layoutPing() {
  window.dispatchEvent(new Event("railcore-layout"));
}

function defaults(kind: TabKind, n: number): Pick<WTab, "floating" | "x" | "y" | "w" | "h" | "minimized" | "pinned"> {
  const float = kind === "train" || kind === "station";
  return {
    floating: float,
    minimized: false,
    pinned: false,
    x: 72 + n * 28,
    y: 64 + n * 22,
    w: kind === "station" ? 460 : float ? 380 : 720,
    h: kind === "station" ? 520 : float ? 460 : 320,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [followId, setFollowState] = useState<string | null>(null);
  const [lockedStationId, setLockedStationState] = useState<string | null>(null);
  const [stationPage, setStationPage] = useState<string | null>(null);
  useEffect(() => {
    if (window.innerWidth <= 1366) setLayersCollapsed(true);
  }, []);
  const notifyLayout = useCallback(() => {
    requestAnimationFrame(layoutPing);
  }, []);

  const setFollow = useCallback((id: string | null) => {
    if (id) setLockedStationState(null);
    setFollowState(id);
  }, []);

  const setLockedStation = useCallback((id: string | null) => {
    if (id) setFollowState(null);
    setLockedStationState(id);
  }, []);

  const open = useCallback((kind: TabKind, opts: OpenOpts) => {
    if (kind === "station" && opts.refId) {
      setStationPage(null);
      setFollowState(null);
      setLockedStationState(opts.refId);
      setActiveId(null);
      setTabs((prev) =>
        prev.filter((t) => t.kind !== "station").map((t) => (t.pinned ? t : { ...t, minimized: true }))
      );
      requestAnimationFrame(layoutPing);
      return;
    }
    setStationPage(null);
    const id = opts.refId ? `${kind}:${opts.refId}` : kind;
    setTabs((prev) => {
      const found = prev.find((t) => t.id === id);
      const floats = prev.filter((x) => x.floating && !x.minimized).length;
      const base = found
        ? prev
        : [...prev, { id, kind, title: opts.title, refId: opts.refId, ...defaults(kind, floats) }];
      return base.map((t) => {
        if (t.id === id) return { ...t, minimized: false, title: opts.title };
        if (t.floating && !t.pinned) return { ...t, minimized: true };
        return t;
      });
    });
    setActiveId(id);
    requestAnimationFrame(layoutPing);
  }, []);

  const openEntity = useCallback(
    (kind: "train" | "station", refId: string, title: string) => open(kind, { title, refId }),
    [open]
  );

  const activate = useCallback((id: string) => {
    setActiveId(id);
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === id) return { ...t, minimized: false };
        if (t.floating && !t.pinned) return { ...t, minimized: true };
        return t;
      })
    );
    requestAnimationFrame(layoutPing);
  }, []);

  const closeStationPage = useCallback(() => {
    setStationPage(null);
    requestAnimationFrame(layoutPing);
  }, []);

  const focusMap = useCallback(() => {
    setStationPage(null);
    setLockedStationState(null);
    setLegendOpen(false);
    setActiveId(null);
    setTabs((prev) => prev.map((tab) => (tab.pinned ? tab : { ...tab, minimized: true })));
    requestAnimationFrame(layoutPing);
  }, []);

  const close = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        return next.at(-1)?.id ?? null;
      });
      return next;
    });
    setFollowState((cur) => {
      if (cur && id === `train:${cur}`) return null;
      return cur;
    });
    requestAnimationFrame(layoutPing);
  }, []);

  const patch = useCallback((id: string, fn: (t: WTab) => WTab) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    requestAnimationFrame(layoutPing);
  }, []);

  const value = useMemo<WorkspaceValue>(
    () => ({
      tabs,
      activeId,
      layersCollapsed,
      legendOpen,
      open,
      openEntity,
      activate,
      close,
      togglePin: (id) => patch(id, (t) => ({ ...t, pinned: !t.pinned })),
      toggleMin: (id) =>
        patch(id, (t) => ({ ...t, minimized: !t.minimized, floating: t.minimized ? t.floating : t.floating })),
      toggleFloat: (id) => patch(id, (t) => ({ ...t, floating: !t.floating, minimized: false })),
      move: (id, x, y) => patch(id, (t) => ({ ...t, x, y })),
      setLayersCollapsed: (v) => {
        setLayersCollapsed(v);
        requestAnimationFrame(layoutPing);
      },
      setLegendOpen: (v) => {
        setLegendOpen(v);
        requestAnimationFrame(layoutPing);
      },
      notifyLayout,
      focusMap,
      followId,
      setFollow,
      lockedStationId,
      setLockedStation,
      stationPage,
      closeStationPage,
    }),
    [tabs, activeId, layersCollapsed, legendOpen, open, openEntity, activate, close, patch, notifyLayout, focusMap, followId, setFollow, lockedStationId, setLockedStation, stationPage, closeStationPage]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("workspace");
  return v;
}

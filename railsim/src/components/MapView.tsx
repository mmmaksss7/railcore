import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { findEdge, pointOnEdge, trainLatLng } from "../simulation/engine";
import { locoSrc, wagonSrc } from "../simulation/rollingStock";
import { stationShot } from "../simulation/stationView";
import { useSim } from "../simulation/SimContext";
import { useWorkspace } from "../workspace";
import type { Station, Train } from "../simulation/types";

type BearingMap = L.Map & { setBearing: (deg: number) => void; getBearing: () => number };

function metersBetween(a: [number, number], b: [number, number]) {
  const lat = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const east = (b[1] - a[1]) * 111320 * Math.cos(lat);
  const north = (b[0] - a[0]) * 110540;
  return Math.hypot(east, north);
}

function zoomToFit(lat: number, meters: number, pixels: number) {
  const span = Math.max(meters, 80);
  const px = Math.max(pixels, 80);
  const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180) * px) / span);
  return z;
}

const NEIGHBORS = [
  { name: "РОССИЯ", lat: 55.35, lng: 67.1 },
  { name: "КИТАЙ", lat: 45.7, lng: 86.0 },
  { name: "УЗБЕКИСТАН", lat: 41.2, lng: 64.4 },
  { name: "КЫРГЫЗСТАН", lat: 41.65, lng: 75.3 },
  { name: "ТУРКМЕНИСТАН", lat: 40.15, lng: 58.0 },
];

type Pack = {
  base: L.TileLayer;
  mask?: L.Layer;
  borders?: L.Layer;
  hill: L.TileLayer;
  rails?: L.GeoJSON;
  lines: L.LayerGroup;
  stations: L.LayerGroup;
  trains: L.LayerGroup;
  extras: L.LayerGroup;
  trainMarks: Map<string, L.Marker>;
  trainHtml: Map<string, string>;
};

function stationColor(kind: Station["kind"]) {
  if (kind === "hub") return "#ef5a55";
  if (kind === "industry") return "#3dd68c";
  if (kind === "border") return "#c084fc";
  if (kind === "yard") return "#f08a3a";
  if (kind === "depot") return "#5ec8e8";
  return "#ffffff";
}

const ICON: Record<"far" | "mid" | "near", { size: [number, number]; anchor: [number, number] }> = {
  far: { size: [42, 18], anchor: [21, 9] },
  mid: { size: [58, 22], anchor: [29, 11] },
  near: { size: [78, 26], anchor: [39, 13] },
};

function zoomBand(z: number): "far" | "mid" | "near" {
  if (z >= 8.2) return "near";
  if (z >= 6.4) return "mid";
  return "far";
}

function consistHtml(train: Train, ang: number, on: string, stop: string, band: "far" | "mid" | "near") {
  const loco = locoSrc(train.loco.model, "map");
  const cargo = train.wagons[0]?.cargo ?? (train.kind === "служебный" ? "служебный" : "Уголь");
  const car = wagonSrc(cargo, "top");
  const n =
    train.kind === "служебный" || train.wagons.length === 0
      ? 0
      : band === "near"
        ? 2
        : 1;
  const cars = Array.from({ length: n }, () => `<img class="spr car" src="${car}" alt="">`).join("");
  const num = band === "far" && !on && !stop ? "" : `<b>№${train.number}</b>`;
  return `<div class="train-ico ${band} ${on} ${stop}"><span class="train-body" style="transform:rotate(${ang}deg)"><img class="spr loco" src="${loco}" alt="">${cars}</span>${num}</div>`;
}

export function MapView() {
  const { state, dispatch } = useSim();
  const { openEntity, followId, setFollow, lockedStationId, setLockedStation } = useWorkspace();
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const packRef = useRef<Pack | null>(null);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const openRef = useRef(openEntity);
  openRef.current = openEntity;
  const stateRef = useRef(state);
  stateRef.current = state;
  const followArmed = useRef<string | null>(null);
  const followFlying = useRef(false);
  const savedView = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const lockRef = useRef<string | null>(null);
  lockRef.current = lockedStationId;
  const railsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const railLookRef = useRef<(z: number, scheme: boolean) => L.PathOptions>(() => ({}));
  const [railsTick, setRailsTick] = useState(0);
  const [band, setBand] = useState<"far" | "mid" | "near">("far");

  useEffect(() => {
    if (!elRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: true,
      center: [48.2, 67.5],
      zoom: 5.35,
      minZoom: 4,
      maxZoom: 18,
      zoomSnap: 0.25,
      attributionControl: true,
      rotate: true,
      bearing: 0,
      rotateControl: false,
      shiftKeyRotate: false,
      touchRotate: false,
    } as L.MapOptions);
    map.attributionControl.setPrefix("");
    const base = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const spin = map.getPane("overlayPane") ?? undefined;
    const rotor = map.getPane("rotatePane") ?? spin;
    map.createPane("maskPane", spin);
    const maskPane = map.getPane("maskPane");
    if (maskPane) {
      maskPane.style.zIndex = "350";
      maskPane.style.pointerEvents = "none";
    }
    map.createPane("bordersPane", spin);
    const bordersPane = map.getPane("bordersPane");
    if (bordersPane) {
      bordersPane.style.zIndex = "380";
      bordersPane.style.pointerEvents = "none";
    }
    map.createPane("railPane", spin);
    const railPane = map.getPane("railPane");
    if (railPane) railPane.style.zIndex = "450";
    map.createPane("trainPane", rotor);
    const trainPane = map.getPane("trainPane");
    if (trainPane) trainPane.style.zIndex = "650";

    const pack: Pack = {
      base,
      hill: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 17, opacity: 0.38 }
      ),
      lines: L.layerGroup().addTo(map),
      stations: L.layerGroup().addTo(map),
      trains: L.layerGroup().addTo(map),
      extras: L.layerGroup().addTo(map),
      trainMarks: new Map(),
      trainHtml: new Map(),
    };
    packRef.current = pack;
    mapRef.current = map;

    let cancelled = false;
    const railRenderer = L.canvas({ padding: 0.5, pane: "railPane" });
    const railStyle = (z: number, scheme: boolean): L.PathOptions => ({
      renderer: railRenderer,
      pane: "railPane",
      interactive: false,
      color: scheme ? "#1b2430" : "#6b5344",
      weight: scheme ? (z >= 15 ? 3.2 : 2.5) : z >= 14 ? 2.4 : z >= 10 ? 1.7 : 1.15,
      opacity: 1,
    });
    railLookRef.current = railStyle;
    fetch("/rails.geojson")
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection) => {
        if (cancelled || mapRef.current !== map) return;
        railsFcRef.current = fc;
        setRailsTick((n) => n + 1);
        const layer = L.geoJSON(fc, {
          style: () => railStyle(map.getZoom(), map.getContainer().classList.contains("scheme")),
        });
        pack.rails = layer;
        if (stateRef.current.layers.lines) layer.addTo(map);
      })
      .catch(() => undefined);

    fetch("/countries.geo.json")
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection<GeoJSON.Geometry, { iso?: string; name?: string }>) => {
        if (cancelled || mapRef.current !== map) return;
        const kaz = fc.features.find((f) => f.properties.iso === "KAZ" || f.properties.name === "Kazakhstan");
        const holes: L.LatLngExpression[][] = [];
        if (kaz) {
          const g = kaz.geometry;
          const polys =
            g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
          for (const poly of polys) {
            holes.push(poly[0].map(([lng, lat]) => [lat, lng] as L.LatLngExpression));
          }
        }
        const world: L.LatLngExpression[] = [
          [90, -180],
          [90, 180],
          [-90, 180],
          [-90, -180],
          [90, -180],
        ];
        pack.mask = L.polygon([world, ...holes], {
          stroke: false,
          fillColor: "#05070a",
          fillOpacity: 0.62,
          interactive: false,
          pane: "maskPane",
        });
        pack.borders = L.geoJSON(fc, {
          pane: "bordersPane",
          interactive: false,
          style: (f) => {
            const isKaz = f?.properties && (f.properties.iso === "KAZ" || f.properties.name === "Kazakhstan");
            return {
              color: isKaz ? "#b7e4f4" : "rgba(255,255,255,0.38)",
              weight: isKaz ? 2.6 : 1.05,
              opacity: 1,
              fill: false,
            };
          },
        });
        if (stateRef.current.layers.borders && !map.getContainer().classList.contains("scheme")) {
          pack.mask.addTo(map);
          pack.borders.addTo(map);
        }
      })
      .catch(() => undefined);

    const onResize = () => map.invalidateSize();
    const onZoom = () => {
      const z = map.getZoom();
      setBand(zoomBand(z));
      pack.rails?.setStyle(railStyle(z, map.getContainer().classList.contains("scheme")));
    };
    map.on("zoomend", onZoom);
    onZoom();
    window.addEventListener("resize", onResize);
    window.addEventListener("railcore-layout", onResize);
    const timer = window.setTimeout(onResize, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("railcore-layout", onResize);
      map.off("zoomend", onZoom);
      map.remove();
      mapRef.current = null;
      packRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const pack = packRef.current;
    if (!map || !pack) return;
    const { layers, stations, edges, selectedStation } = state;
    const scheme = map.getContainer().classList.contains("scheme");

    if (scheme) {
      map.removeLayer(pack.hill);
      if (pack.mask) map.removeLayer(pack.mask);
      if (pack.borders) map.removeLayer(pack.borders);
    } else if (layers.relief) pack.hill.addTo(map);
    else map.removeLayer(pack.hill);

    if (!scheme && pack.mask && pack.borders) {
      if (layers.borders) {
        pack.mask.addTo(map);
        pack.borders.addTo(map);
      } else {
        map.removeLayer(pack.mask);
        map.removeLayer(pack.borders);
      }
    }

    pack.lines.clearLayers();
    pack.stations.clearLayers();
    pack.extras.clearLayers();

    if (pack.rails) {
      if (layers.lines) pack.rails.addTo(map);
      else map.removeLayer(pack.rails);
    }

    if (layers.ktsm) {
      for (const edge of edges) {
        if (!edge.ktsm) continue;
        const mid = pointOnEdge(edge, 0.32, edge.from);
        if (!Number.isFinite(mid.lat) || !Number.isFinite(mid.lng)) continue;
        L.marker([mid.lat, mid.lng], {
          icon: L.divIcon({
            className: "ktsm-mark",
            html: "КТСМ",
            iconSize: [36, 16],
            iconAnchor: [18, 8],
          }),
          interactive: false,
        }).addTo(pack.extras);
      }
    }

    if (layers.stations) {
      for (const s of stations) {
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
        if (!layers.industry && (s.kind === "industry" || s.kind === "yard")) continue;
        const selected = s.id === selectedStation;
        L.circleMarker([s.lat, s.lng], {
          radius: s.kind === "hub" ? 8 : 5.5,
          color: selected ? "#5ec8e8" : "#243044",
          weight: selected ? 3 : 2,
          fillColor: stationColor(s.kind),
          fillOpacity: 1,
        })
          .bindTooltip(s.name, { direction: "top", offset: [0, -8] })
          .on("click", () => {
            dispatchRef.current({ type: "selectStation", id: s.id });
            openRef.current("station", s.id, `Станция ${s.name}`);
          })
          .addTo(pack.stations);
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "stn-label",
            html: s.name,
            iconSize: [160, 18],
            iconAnchor: [80, -10],
          }),
          interactive: true,
          keyboard: false,
        })
          .on("click", () => {
            dispatchRef.current({ type: "selectStation", id: s.id });
            openRef.current("station", s.id, `Станция ${s.name}`);
          })
          .addTo(pack.stations);

        if (layers.signals) {
          L.circleMarker([s.lat + 0.12, s.lng + 0.12], {
            radius: 3,
            color: "#4ade80",
            fillColor: "#4ade80",
            fillOpacity: 1,
            weight: 0,
            interactive: false,
          }).addTo(pack.extras);
        }
      }
    }

    if (layers.borders) {
      for (const n of NEIGHBORS) {
        L.marker([n.lat, n.lng], {
          icon: L.divIcon({
            className: "nb-label",
            html: n.name,
            iconSize: [140, 18],
            iconAnchor: [70, 9],
          }),
          interactive: false,
        }).addTo(pack.extras);
      }
    }
  }, [state.layers, state.edges, state.selectedStation]);

  useEffect(() => {
    const pack = packRef.current;
    const map = mapRef.current;
    if (!pack) return;
    const { trains, edges, layers, selectedTrain, stations } = state;
    if (!layers.trains) {
      pack.trains.clearLayers();
      pack.trainMarks.clear();
      pack.trainHtml.clear();
      return;
    }
    const seen = new Set<string>();
    for (const train of trains) {
      const a = train.route[train.edge];
      const nxt = train.edge + train.heading;
      const b = nxt >= 0 && nxt < train.route.length ? train.route[nxt] : a;
      const edge = findEdge(edges, a, b);
      let lat = 0;
      let lng = 0;
      let ang = 0;
      if (edge) {
        const p = pointOnEdge(edge, train.t, a);
        lat = p.lat;
        lng = p.lng;
        const p2 = pointOnEdge(edge, Math.max(0.001, Math.min(0.999, train.t + 0.03 * train.heading)), a);
        if (map) {
          const A = map.latLngToLayerPoint([p.lat, p.lng]);
          const B = map.latLngToLayerPoint([p2.lat, p2.lng]);
          ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
        }
      } else {
        const st = stations.find((s) => s.id === a);
        if (!st) continue;
        lat = st.lat;
        lng = st.lng;
      }
      seen.add(train.id);
      const on = train.id === selectedTrain ? "on" : "";
      const stop = train.status === "остановлен" ? "stop" : "";
      const html = consistHtml(train, ang, on, stop, band);
      let m = pack.trainMarks.get(train.id);
      const z = train.id === selectedTrain ? 900 : train.status === "остановлен" ? 700 : 0;
      const icon = ICON[band];
      if (!m) {
        const from = stations.find((s) => s.id === train.route[0])?.name ?? train.route[0];
        const to = stations.find((s) => s.id === train.route[train.route.length - 1])?.name ?? train.route[train.route.length - 1];
        m = L.marker([lat, lng], {
          icon: L.divIcon({ className: "train-wrap", html, iconSize: icon.size, iconAnchor: icon.anchor }),
          pane: "trainPane",
          zIndexOffset: z,
        })
          .bindTooltip(`№${train.number} · ${train.loco.model} · ${train.kind} · ${from} → ${to}`, {
            sticky: true,
            className: "train-tip",
          })
          .on("click", () => {
            dispatchRef.current({ type: "selectTrain", id: train.id });
            openRef.current("train", train.id, `Поезд №${train.number}`);
          });
        m.addTo(pack.trains);
        pack.trainMarks.set(train.id, m);
        pack.trainHtml.set(train.id, html);
      } else {
        m.setLatLng([lat, lng]);
        if (pack.trainHtml.get(train.id) !== html) {
          m.setIcon(L.divIcon({ className: "train-wrap", html, iconSize: icon.size, iconAnchor: icon.anchor }));
          pack.trainHtml.set(train.id, html);
        }
        m.setZIndexOffset(z);
      }
    }
    for (const [id, m] of pack.trainMarks) {
      if (!seen.has(id)) {
        pack.trains.removeLayer(m);
        pack.trainMarks.delete(id);
        pack.trainHtml.delete(id);
      }
    }
  }, [state.trains, state.edges, state.layers.trains, state.selectedTrain, state.stations, band]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onDrag = () => {
      if (lockRef.current) return;
      setFollow(null);
    };
    map.on("dragstart", onDrag);
    return () => {
      map.off("dragstart", onDrag);
    };
  }, [setFollow]);

  useEffect(() => {
    const map = mapRef.current as BearingMap | null;
    if (!map) return;
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const showScheme = (on: boolean) => {
      const pack = packRef.current;
      map.getContainer().classList.toggle("scheme", on);
      pack?.rails?.setStyle(railLookRef.current(map.getZoom(), on));
      if (!pack) return;
      if (on) {
        map.removeLayer(pack.hill);
        if (pack.mask) map.removeLayer(pack.mask);
        if (pack.borders) map.removeLayer(pack.borders);
        pack.rails?.addTo(map);
      } else if (stateRef.current.layers.borders && pack.mask && pack.borders) {
        pack.mask.addTo(map);
        pack.borders.addTo(map);
      }
    };
    const frameStation = () => {
      if (cancelled || !lockedStationId) return;
      const station = stateRef.current.stations.find((s) => s.id === lockedStationId);
      if (!station) return;
      map.invalidateSize();
      const fc = railsFcRef.current;
      const shot = fc ? stationShot(station.lat, station.lng, fc) : null;
      if (shot && typeof map.setBearing === "function") {
        const along = metersBetween(shot.corners[0], shot.corners[1]);
        const cross = metersBetween(shot.corners[0], shot.corners[3]);
        const size = map.getSize();
        const lat = shot.corners.reduce((sum, c) => sum + c[0], 0) / shot.corners.length;
        const lng = shot.corners.reduce((sum, c) => sum + c[1], 0) / shot.corners.length;
        const z = Math.max(
          12,
          Math.min(
            17,
            zoomToFit(lat, along, size.x - 160),
            zoomToFit(lat, cross, size.y - 140)
          )
        );
        map.setBearing(0);
        map.setView([lat, lng], z, { animate: false });
        map.setBearing(shot.bearing);
        showScheme(true);
      } else {
        if (typeof map.setBearing === "function") map.setBearing(0);
        map.setView([station.lat, station.lng], 16, { animate: false });
        showScheme(true);
      }
    };
    if (lockedStationId) {
      if (!savedView.current) {
        const c = map.getCenter();
        savedView.current = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      }
      map.dragging.disable();
      later(frameStation, 280);
      return () => {
        cancelled = true;
        for (const id of timers) window.clearTimeout(id);
      };
    }
    map.dragging.enable();
    showScheme(false);
    if (typeof map.setBearing === "function" && map.getBearing()) map.setBearing(0);
    const back = savedView.current;
    savedView.current = null;
    if (back && !followId) {
      later(() => {
        if (!cancelled) map.setView([back.lat, back.lng], back.zoom, { animate: false });
      }, 60);
    }
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [lockedStationId, followId, railsTick]);

  useEffect(() => {
    if (!lockedStationId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLockedStation(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lockedStationId, setLockedStation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followId) {
      followArmed.current = null;
      return;
    }
    const train = state.trains.find((t) => t.id === followId);
    if (!train) return;
    const pos = trainLatLng(train, state.edges, state.stations);
    if (!pos) return;
    if (followArmed.current !== followId) {
      followArmed.current = followId;
      followFlying.current = true;
      map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 9), { animate: false });
      followFlying.current = false;
    } else if (!followFlying.current) {
      map.panTo([pos.lat, pos.lng], { animate: false });
    }
  }, [followId, state.trains, state.edges, state.stations]);

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.invalidateSize(), 180);
    return () => window.clearTimeout(timer);
  }, [state.layers, state.selectedTrain, state.selectedStation]);

  const nPass = state.trains.filter((x) => x.kind === "пассажирский").length;
  const nFreight = state.trains.filter((x) => x.kind === "грузовой").length;
  const nIntl = state.trains.filter((x) => x.kind === "международный").length;
  const nSvc = state.trains.filter((x) => x.kind === "служебный").length;
  const nStop = state.trains.filter((x) => x.status === "остановлен").length;

  const followTrain = followId ? state.trains.find((t) => t.id === followId) : null;
  const lockedStation = lockedStationId ? state.stations.find((s) => s.id === lockedStationId) : null;

  return (
    <>
      <div ref={elRef} className="map-el" />
      {lockedStation && (
        <div className="follow-chip">
          <span>Станция · {lockedStation.name}</span>
          <button type="button" onClick={() => setLockedStation(null)}>
            ×
          </button>
        </div>
      )}
      {followTrain && (
        <div className="follow-chip">
          <span>Отслеживание · №{followTrain.number} · {followTrain.loco.model}</span>
          <button type="button" onClick={() => setFollow(null)}>
            ×
          </button>
        </div>
      )}
      {state.layers.trains && (
        <div className="map-hud">
          <strong>{state.trains.length}</strong>
          <em>поездов на сети</em>
          <span className="пассажирский">{nPass} пас</span>
          <span className="грузовой">{nFreight} груз</span>
          <span className="международный">{nIntl} межд</span>
          <span className="служебный">{nSvc} служ</span>
          {nStop > 0 && <span className="stop">{nStop} стоп</span>}
        </div>
      )}
    </>
  );
}

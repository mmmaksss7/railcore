(() => {
  const D = window.KZRAIL;
  const byId = Object.fromEntries(D.stations.map((s) => [s.id, s]));
  const state = {
    view: "map",
    filters: { usage: new Set(), cat: new Set(), status: new Set(["active"]) },
    selected: null,
    selectedStation: null,
    showStations: true,
    showHubs: true,
    showIntl: true,
    showLabels: true,
    stats: false,
    plannedIds: new Set(),
  };

  const map = L.map("map", {
    zoomControl: true,
    center: [48.2, 67.5],
    zoom: 5.4,
    minZoom: 4,
    maxZoom: 17,
    attributionControl: true,
    zoomSnap: 0.25,
  });
  map.attributionControl.setPrefix("");

  const satLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 17, maxNativeZoom: 17, keepBuffer: 6, attribution: "Esri, Maxar · КТЖ · <a href=\"" + D.meta.sourceUrl + "\">RailsMaps</a>" }
  );
  const mapLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 17, attribution: "© OpenStreetMap · КТЖ" }
  );
  satLayer.addTo(map);
  let base = "sat";

  map.createPane("maskPane");
  map.getPane("maskPane").style.zIndex = 350;
  map.getPane("maskPane").style.pointerEvents = "none";
  map.createPane("bordersPane");
  map.getPane("bordersPane").style.zIndex = 380;
  map.getPane("bordersPane").style.pointerEvents = "none";

  let maskLayer = null;

  function maskStyle() {
    return {
      stroke: false,
      fillColor: "#05070a",
      fillOpacity: isDark() ? 0.62 : 0.4,
      interactive: false,
      pane: "maskPane",
    };
  }

  function toLatLngRing(ring) {
    return ring.map(([lng, lat]) => [lat, lng]);
  }

  function addCountryMask(fc) {
    const kaz = fc.features.find((f) => f.properties.iso === "KAZ" || f.properties.name === "Kazakhstan");
    const holes = [];
    if (kaz) {
      const g = kaz.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      polys.forEach((poly) => holes.push(toLatLngRing(poly[0])));
    } else {
      holes.push(D.country.slice());
    }
    const world = [
      [90, -180], [90, 180], [-90, 180], [-90, -180], [90, -180],
    ];
    if (maskLayer) map.removeLayer(maskLayer);
    maskLayer = L.polygon([world, ...holes], maskStyle()).addTo(map);
    L.geoJSON(fc, {
      pane: "bordersPane",
      interactive: false,
      style: (f) => {
        const isKaz = f.properties.iso === "KAZ" || f.properties.name === "Kazakhstan";
        return {
          color: isKaz ? "#b7e4f4" : "rgba(255,255,255,0.38)",
          weight: isKaz ? 2.6 : 1.05,
          opacity: 1,
          fill: false,
        };
      },
    }).addTo(map);
  }

  fetch("countries.geo.json")
    .then((r) => r.json())
    .then(addCountryMask)
    .catch(() => {
      const world = [[90, -180], [90, 180], [-90, 180], [-90, -180], [90, -180]];
      maskLayer = L.polygon([world, D.country.slice().reverse()], maskStyle()).addTo(map);
      L.polygon(D.country, {
        color: "#b7e4f4",
        weight: 2.6,
        fill: false,
        interactive: false,
        pane: "bordersPane",
      }).addTo(map);
    });

  function setBasemap(kind) {
    base = kind;
    if (kind === "sat") {
      if (map.hasLayer(mapLayer)) map.removeLayer(mapLayer);
      if (!map.hasLayer(satLayer)) satLayer.addTo(map);
      document.documentElement.classList.add("dark");
    } else {
      if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
      if (!map.hasLayer(mapLayer)) mapLayer.addTo(map);
    }
  }

  const railLayer = L.layerGroup().addTo(map);
  const markLayer = L.layerGroup().addTo(map);
  const lineById = new Map();
  const markById = new Map();

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function styleOf(r, emphasize) {
    const muted = (state.selected && state.selected !== r.id && !emphasize) ||
      (state.selectedStation && !r.via.includes(state.selectedStation) && !emphasize);
    const stats = state.stats;
    let color = "#3b7ddd";
    let weight = 2.2;
    let dashArray = null;
    if (r.cat === "main") { color = "#e23b32"; weight = 4.2; }
    if (r.cat === "intl") { color = "#e0a126"; weight = 2.5; dashArray = "8 5"; }
    if (r.cat === "regional") {
      color = r.usage === "freight" ? "#2f9e6a" : "#3b7ddd";
      weight = 2.3;
    }
    if (r.status === "planned" || r.status === "construction") {
      color = "#88939c";
      weight = 1.8;
      dashArray = "3 6";
    }
    if (isDark()) {
      if (r.cat === "main") color = "#ef534a";
      else if (r.cat === "intl") color = "#e8b34a";
      else if (r.cat === "regional") color = r.usage === "freight" ? "#47c08a" : "#5b95e6";
      if (r.status === "planned") color = "#6b7680";
    }
    if (stats && r.usage === "freight") weight += 1.8;
    if (stats && r.cat === "main") weight += 0.6;
    if (muted) return { color, weight: Math.max(1, weight - 1.4), opacity: 0.16, dashArray };
    if (emphasize || state.selected === r.id) {
      return { color, weight: weight + 1.7, opacity: 1, dashArray };
    }
    return { color, weight, opacity: 0.92, dashArray };
  }

  function visibleRoute(r) {
    const f = state.filters;
    if (f.status.size && !f.status.has(r.status)) return false;
    if (f.usage.size && !f.usage.has(r.usage)) return false;
    if (f.cat.size && !f.cat.has(r.cat)) return false;
    if (state.view === "freight" && r.usage === "passenger") return false;
    if (state.view === "passenger" && r.usage === "freight") return false;
    if (!state.showIntl && r.cat === "intl") return false;
    return true;
  }

  function drawRails() {
    railLayer.clearLayers();
    lineById.clear();
    D.routes.forEach((r) => {
      if (!visibleRoute(r)) return;
      const casing = L.polyline(r.path, {
        color: "#000",
        weight: (styleOf(r).weight || 3) + 2.4,
        opacity: 0.35,
        interactive: false,
      }).addTo(railLayer);
      const pl = L.polyline(r.path, styleOf(r)).addTo(railLayer);
      pl.on("mouseover", (e) => {
        pl.setStyle(styleOf(r, true));
        showHover(e.originalEvent, r);
      });
      pl.on("mousemove", (e) => showHover(e.originalEvent, r));
      pl.on("mouseout", () => {
        pl.setStyle(styleOf(r));
        hideHover();
      });
      pl.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selectRoute(r.id);
      });
      lineById.set(r.id, pl);
    });
  }

  function drawMarks() {
    markLayer.clearLayers();
    markById.clear();
    if (!state.showStations && state.view !== "infra") return;
    const ink = isDark() ? "#eef2f5" : "#17202a";
    const paper = isDark() ? "#181d23" : "#ffffff";
    const z = map.getZoom();
    D.stations.forEach((s) => {
      const foreign = ["КНР", "Россия", "Узбекистан", "Кыргызстан", "Туркменистан"].includes(s.city);
      if (foreign && !state.showIntl) return;
      const hub = s.kind === "hub" || s.kind === "junction";
      if (s.kind === "junction" && !state.showHubs) return;
      if (state.view === "infra" && !hub && !s.freight) return;
      let radius = hub ? (s.kind === "hub" ? 6 : 4.5) : 3.2;
      if (state.stats && hub) radius += 2.2;
      if (state.view === "infra" && hub) radius += 1.4;
      const hubFill = s.kind === "hub" ? (isDark() ? "#ef534a" : "#e23b32") : paper;
      const m = L.circleMarker([s.lat, s.lng], {
        radius,
        color: s.kind === "hub" ? "#fff" : ink,
        weight: s.kind === "hub" ? 2 : 1.15,
        fillColor: hubFill,
        fillOpacity: 1,
      }).addTo(markLayer);
      const showName = state.showLabels && !foreign && (s.kind === "hub" || (hub && z >= 6) || z >= 7);
      if (showName) {
        m.bindTooltip(s.name, {
          permanent: s.kind === "hub" || z >= 6.5,
          direction: "right",
          className: "lbl",
          offset: [8, 0],
        });
      }
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selectStation(s.id);
      });
      markById.set(s.id, m);
    });
  }

  function showHover(ev, r) {
    const el = document.getElementById("hover");
    el.hidden = false;
    el.innerHTML = `<b>${r.name}</b><span>${r.km.toLocaleString("ru-KZ")} км · ${labelUsage(r.usage)}</span><span>~${fmtHours(r.hours)}</span>`;
    const rect = document.getElementById("map").getBoundingClientRect();
    el.style.left = `${Math.min(ev.clientX - rect.left + 12, rect.width - 190)}px`;
    el.style.top = `${Math.min(ev.clientY - rect.top + 12, rect.height - 80)}px`;
  }
  function hideHover() {
    document.getElementById("hover").hidden = true;
  }
  function labelUsage(u) {
    return { mixed: "Пассажирский и грузовой", passenger: "Пассажирский", freight: "Грузовой" }[u] || u;
  }
  function fmtHours(h) {
    if (!h) return "—";
    const hr = Math.floor(h);
    const m = Math.round((h - hr) * 60);
    return `${hr} ч ${String(m).padStart(2, "0")} мин`;
  }

  function selectRoute(id) {
    state.selected = id;
    state.selectedStation = null;
    const r = D.routes.find((x) => x.id === id);
    drawRails();
    const pl = lineById.get(id);
    if (pl) map.fitBounds(pl.getBounds().pad(0.42), { maxZoom: 8, duration: 0.45 });
    openSheet(routeHTML(r));
    hideSchema();
  }

  function selectStation(id) {
    const s = byId[id];
    state.selected = null;
    state.selectedStation = id;
    drawRails();
    const own = D.routes.filter((r) => r.via.includes(id));
    const cityIds = new Set(D.stations.filter((x) => x.city === s.city).map((x) => x.id));
    const cityRoutes = D.routes.filter((r) => r.via.some((sid) => cityIds.has(sid)));
    cityRoutes.forEach((r) => {
      const pl = lineById.get(r.id);
      if (pl) pl.setStyle(styleOf(r, true));
    });
    const mk = markById.get(id);
    if (mk) {
      mk.setStyle({ weight: 2.6, color: "#fff" });
      mk.setRadius((mk.getRadius() || 5) + 1.5);
    }
    map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 8), { duration: 0.5 });
    openSheet(stationHTML(s, own));
    renderSchema(s, cityRoutes.length ? cityRoutes : own);
  }

  function timelineHTML(stops) {
    return `<div class="timeline"><ol>${stops.map((s) => `<li>${s.name}</li>`).join("")}</ol></div>`;
  }

  function routeHTML(r) {
    const stops = r.via.map((id) => byId[id]).filter(Boolean);
    const dest = stops[stops.length - 1];
    return `
      <button class="close-x" id="closeSheet">✕</button>
      <h2>${r.name}</h2>
      <div class="sub">${r.cat === "intl" ? "Международное направление" : "Маршрут"}</div>
      <div class="tags">
        <span class="tag">${labelUsage(r.usage)}</span>
        ${r.cat === "intl" && dest ? `<span class="tag">${dest.city}</span>` : ""}
      </div>
      <div class="metrics">
        <div><b>${r.km.toLocaleString("ru-KZ")} км</b><span>Расстояние</span></div>
        <div><b>${fmtHours(r.hours)}</b><span>В пути</span></div>
        <div><b>${stops.length}</b><span>Станции</span></div>
        <div><b>${r.cat === "main" ? "Магистраль" : r.cat === "intl" ? "Граница" : "Регион"}</b><span>Тип линии</span></div>
      </div>
      ${timelineHTML(stops)}
      <ol class="stops">${stops.map((s) => `<li>${s.name}<em>${s.city}</em></li>`).join("")}</ol>
    `;
  }

  function stationHTML(s, connected) {
    const kind = s.kind === "hub" ? "Крупный узел" : s.kind === "junction" ? "Узел" : "Станция";
    return `
      <button class="close-x" id="closeSheet">✕</button>
      <h2>${s.name}</h2>
      <div class="sub">${s.city} · ${kind}</div>
      <div class="tags">
        ${s.freight ? `<span class="tag">Грузовой узел</span>` : ""}
        ${s.intl ? `<span class="tag">Международный</span>` : ""}
      </div>
      <div class="metrics">
        <div><b>${connected.length}</b><span>Направления</span></div>
        <div><b>${s.daily}</b><span>Рейсов в сутки</span></div>
      </div>
      <div class="links">${connected.map((r) => `<div>${r.name}</div>`).join("")}</div>
    `;
  }

  function hideSchema() {
    const el = document.getElementById("schema");
    if (!el) return;
    el.hidden = true;
    el.innerHTML = "";
    document.querySelector(".stage").classList.remove("has-schema");
  }

  function towardLabel(station, dest, route) {
    if (dest.id === "ska" || dest.name === "Саяк") return "Уголь";
    const acc = {
      Астана: "На Астану",
      Алматы: "На Алматы",
      Шымкент: "На Шымкент",
      Кызылорда: "На Кызылорду",
      Караганда: "На Караганду",
      Достык: "На Достык (Китай)",
      Хоргос: "На Хоргос (Китай)",
      КНР: "На Китай",
      Россия: "В Россию",
      Узбекистан: "На Ташкент",
      Кыргызстан: "На Бишкек",
      Туркменистан: "В Туркменистан",
      Актобе: "На Актобе",
      Павлодар: "На Павлодар",
      Семей: "На Семей",
      "Усть-Каменогорск": "На Усть-Каменогорск",
      Костанай: "На Костанай",
      Петропавловск: "На Петропавловск",
      Атырау: "На Атырау",
      Актау: "На Актау",
      Тараз: "На Тараз",
      Туркестан: "На Туркестан",
      Жезказган: "На Жезказган",
      Балхаш: "На Балхаш",
      Талдыкорган: "На Талдыкорган",
      Актау: "На Актау",
    };
    if (route.usage === "freight" && dest.kind !== "hub" && dest.kind !== "junction") {
      return dest.city === "Саяк" ? "Уголь" : `На ${dest.city}`;
    }
    return acc[dest.city] || `На ${dest.city}`;
  }

  function otherEnd(station, route) {
    const idx = route.via.indexOf(station.id);
    const a = byId[route.via[0]];
    const b = byId[route.via[route.via.length - 1]];
    if (!a || !b) return byId[route.via.find((id) => id !== station.id)];
    if (a.id === station.id) return b;
    if (b.id === station.id) return a;
    const da = Math.hypot(a.lat - station.lat, a.lng - station.lng);
    const db = Math.hypot(b.lat - station.lat, b.lng - station.lng);
    return db >= da ? b : a;
  }

  function renderSchema(station, connected) {
    const el = document.getElementById("schema");
    if (!el) return;
    const seen = new Set();
    const rays = [];
    connected.forEach((r) => {
      const dest = otherEnd(station, r);
      if (!dest || dest.id === station.id || dest.city === station.city) return;
      const key = dest.city + dest.id;
      if (seen.has(dest.city)) return;
      seen.add(dest.city);
      const ang = Math.atan2(dest.lat - station.lat, dest.lng - station.lng);
      const col = styleOf(r, true).color;
      rays.push({ r, dest, ang, col, label: towardLabel(station, dest, r) });
    });
    rays.sort((a, b) => a.ang - b.ang);
    const W = 1000;
    const H = 240;
    const cx = 390;
    const cy = 150;
    let yard = "";
    for (let i = -9; i <= 9; i++) {
      const y = cy + i * 3.2;
      const op = 0.05 + (1 - Math.abs(i) / 10) * 0.22;
      yard += `<path d="M20 ${y + 14} C 250 ${y - 22}, 560 ${y - 8}, 980 ${y + i * 1.8}" fill="none" stroke="rgba(255,196,80,${op})" stroke-width="${Math.abs(i) < 2 ? 2.8 : 1.35}"/>`;
    }
    const branches = rays.map((ray, i) => {
      const len = 240 + (i % 4) * 40;
      const lift = 0.55;
      const x2 = cx + Math.cos(ray.ang) * len;
      const y2 = cy - Math.sin(ray.ang) * (len * lift);
      const x1 = cx + Math.cos(ray.ang) * 34;
      const y1 = cy - Math.sin(ray.ang) * 14;
      const cxm = (x1 + x2) / 2 - Math.sin(ray.ang) * 40;
      const cym = (y1 + y2) / 2 - 28;
      const nx = x2 - x1;
      const ny = y2 - y1;
      const mag = Math.hypot(nx, ny) || 1;
      const ux = nx / mag;
      const uy = ny / mag;
      const ax = x2 - ux * 14;
      const ay = y2 - uy * 14;
      const arrow = `${x2},${y2} ${ax - uy * 6},${ay + ux * 6} ${ax + uy * 6},${ay - ux * 6}`;
      return `
        <path d="M${x1} ${y1} Q ${cxm} ${cym} ${x2} ${y2}" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" opacity="0.35"/>
        <path d="M${x1} ${y1} Q ${cxm} ${cym} ${x2} ${y2}" fill="none" stroke="${ray.col}" stroke-width="6.5" stroke-linecap="round" opacity="0.35"/>
        <path d="M${x1} ${y1} Q ${cxm} ${cym} ${x2} ${y2}" fill="none" stroke="${ray.col}" stroke-width="3.2" stroke-linecap="round" filter="url(#glow)"/>
        <polygon points="${arrow}" fill="${ray.col}"/>`;
    }).join("");
    const labels = rays.map((ray) => {
      const left = 42 + Math.cos(ray.ang) * 32;
      const top = 52 - Math.sin(ray.ang) * 34;
      return `<span style="left:${Math.max(4, Math.min(78, left))}%;top:${Math.max(18, Math.min(78, top))}%">${ray.label}</span>`;
    }).join("");
    el.hidden = false;
    document.querySelector(".stage").classList.add("has-schema");
    el.innerHTML = `
      <div class="schema-head">
        <h3>Схема узла</h3>
        <button type="button" id="schemaOpen">Открыть на карте</button>
      </div>
      <div class="schema-stage">
        <svg class="schema-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          ${yard}
          ${branches}
          <circle cx="${cx}" cy="${cy}" r="18" fill="#0a1016" stroke="#3da6ff" stroke-width="4"/>
          <circle cx="${cx}" cy="${cy}" r="7" fill="#3da6ff"/>
        </svg>
        <div class="schema-labels">
          <span class="hub-name" style="left:46%;top:42%">${station.name}</span>
          <span class="hub-city" style="left:46%;top:52%">${station.city}</span>
          ${labels}
        </div>
      </div>`;
    document.getElementById("schemaOpen").onclick = (e) => {
      e.stopPropagation();
      map.flyTo([station.lat, station.lng], 11, { duration: 0.6 });
    };
  }

  function openSheet(html) {
    const sh = document.getElementById("sheet");
    sh.hidden = false;
    sh.innerHTML = html;
    document.getElementById("closeSheet").onclick = closeSheet;
  }
  function closeSheet() {
    document.getElementById("sheet").hidden = true;
    state.selected = null;
    state.selectedStation = null;
    hideSchema();
    drawRails();
    drawMarks();
  }

  function search(q) {
    q = q.trim().toLowerCase();
    const box = document.getElementById("results");
    if (!q) { box.hidden = true; return; }
    const hits = [];
    D.stations.forEach((s) => {
      if (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.kk && s.kk.toLowerCase().includes(q))
      ) {
        hits.push({ kind: "Станция", title: s.name, go: () => selectStation(s.id) });
      }
    });
    D.routes.forEach((r) => {
      if (r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) {
        hits.push({ kind: "Маршрут", title: r.name, go: () => selectRoute(r.id) });
      }
    });
    if (/china|китай|қытай|кнр/.test(q)) {
      hits.push({ kind: "Граница", title: "Китай — Казахстан", go: () => selectRoute("i04") });
    }
    if (/russia|росси|ресей/.test(q)) {
      hits.push({ kind: "Граница", title: "Россия — Казахстан", go: () => selectRoute("i01") });
    }
    if (/uzbek|узбек/.test(q)) hits.push({ kind: "Граница", title: "Узбекистан — Казахстан", go: () => selectRoute("i06") });
    if (/kyrgyz|киргиз|қырғ/.test(q)) hits.push({ kind: "Граница", title: "Кыргызстан — Казахстан", go: () => selectRoute("i07") });
    if (/turkmen|туркмен/.test(q)) hits.push({ kind: "Граница", title: "Туркменистан — Казахстан", go: () => selectRoute("i09") });
    box.hidden = !hits.length;
    box.innerHTML = hits.slice(0, 12).map((h, i) =>
      `<button data-i="${i}"><em>${h.kind}</em>${h.title}</button>`
    ).join("");
    box.querySelectorAll("button").forEach((b, i) => {
      b.onclick = () => { hits[i].go(); box.hidden = true; };
    });
  }

  function setView(v) {
    state.view = v;
    state.stats = v === "stats";
    document.querySelectorAll(".rail-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    document.querySelectorAll(".mobile-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    const dock = document.getElementById("dock");
    dock.hidden = !["routes", "stations"].includes(v);
    if (v === "routes") fillDock("routes");
    if (v === "stations") fillDock("stations");
    if (v === "search") document.getElementById("search").focus();
    if (v === "stats") showStats();
    else document.getElementById("statNote")?.remove();
    drawRails();
    drawMarks();
    map.invalidateSize();
  }

  function fillDock(kind) {
    const list = document.getElementById("dockList");
    if (kind === "routes") {
      list.innerHTML = D.routes.filter((r) => r.cat !== "intl" || state.showIntl).map((r) =>
        `<button data-rid="${r.id}"><small>${r.km} км · ${labelUsage(r.usage)}</small>${r.name}</button>`
      ).join("");
      list.querySelectorAll("button").forEach((b) => { b.onclick = () => selectRoute(b.dataset.rid); });
    } else {
      list.innerHTML = D.stations.filter((s) => s.kind === "hub" || s.kind === "junction").map((s) =>
        `<button data-sid="${s.id}"><small>${s.city}</small>${s.name}</button>`
      ).join("");
      list.querySelectorAll("button").forEach((b) => { b.onclick = () => selectStation(b.dataset.sid); });
    }
  }

  function showStats() {
    document.getElementById("statNote")?.remove();
    const el = document.createElement("div");
    el.id = "statNote";
    el.className = "stat-note";
    const hubs = D.stations.filter((s) => s.kind === "hub").length;
    const intl = D.routes.filter((r) => r.cat === "intl").length;
    el.innerHTML = `<b>Сеть КТЖ</b>
      ${D.stations.length} станций в атласе<br>
      ${D.routes.length} коридоров · ${hubs} крупных узлов<br>
      ${intl} международных выходов<br>
      ${D.meta.electrified.toLocaleString("ru-KZ")} электрифицированных участков<br>
      Источник: <a href="${D.meta.sourceUrl}" target="_blank" rel="noreferrer">RailsMaps</a>`;
    document.querySelector(".stage").appendChild(el);
  }

  function buildGraph() {
    const g = {};
    D.routes.forEach((r) => {
      if (r.status !== "active") return;
      for (let i = 0; i < r.via.length - 1; i++) {
        const a = r.via[i];
        const b = r.via[i + 1];
        g[a] = g[a] || [];
        g[b] = g[b] || [];
        g[a].push({ to: b, route: r.id });
        g[b].push({ to: a, route: r.id });
      }
    });
    return g;
  }
  const graph = buildGraph();

  function findPath(from, to) {
    const q = [[from]];
    const seen = new Set([from]);
    while (q.length) {
      const path = q.shift();
      const cur = path[path.length - 1];
      if (cur === to) return path;
      (graph[cur] || []).forEach((e) => {
        if (!seen.has(e.to)) {
          seen.add(e.to);
          q.push([...path, e.to]);
        }
      });
    }
    return null;
  }

  function resolveStation(text) {
    const q = text.trim().toLowerCase();
    if (!q) return null;
    return D.stations.find((s) =>
      s.name.toLowerCase() === q ||
      s.city.toLowerCase() === q ||
      s.code.toLowerCase() === q
    ) || D.stations.find((s) =>
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q)
    );
  }

  function trace() {
    const a = resolveStation(document.getElementById("from").value);
    const b = resolveStation(document.getElementById("to").value);
    if (!a || !b) {
      openSheet(`<button class="close-x" id="closeSheet">✕</button><h2>Станция не найдена</h2><div class="sub">Выберите станции из списка</div>`);
      return;
    }
    const path = findPath(a.id, b.id);
    if (!path) {
      openSheet(`<button class="close-x" id="closeSheet">✕</button><h2>Маршрут не найден</h2><div class="sub">Попробуйте другие станции</div>`);
      return;
    }
    const used = [];
    for (let i = 0; i < path.length - 1; i++) {
      const edge = (graph[path[i]] || []).find((e) => e.to === path[i + 1]);
      if (edge && !used.includes(edge.route)) used.push(edge.route);
    }
    state.selected = used[0] || null;
    state.selectedStation = null;
    hideSchema();
    drawRails();
    used.forEach((id) => {
      const pl = lineById.get(id);
      const r = D.routes.find((x) => x.id === id);
      if (pl && r) {
        pl.setStyle(styleOf(r, true));
        const el = pl.getElement && pl.getElement();
        if (el && el.getTotalLength) {
          const len = el.getTotalLength();
          el.style.strokeDasharray = `${len}`;
          el.style.strokeDashoffset = `${len}`;
          el.style.transition = "stroke-dashoffset 1.35s linear";
          requestAnimationFrame(() => { el.style.strokeDashoffset = "0"; });
        }
      }
    });
    const km = used.reduce((n, id) => n + (D.routes.find((r) => r.id === id)?.km || 0), 0);
    const hr = used.reduce((n, id) => n + (D.routes.find((r) => r.id === id)?.hours || 0), 0);
    const stops = path.map((id) => byId[id]).filter(Boolean);
    const borders = used.map((id) => D.routes.find((r) => r.id === id)).filter((r) => r && r.cat === "intl");
    openSheet(`
      <button class="close-x" id="closeSheet">✕</button>
      <h2>${a.city} — ${b.city}</h2>
      <div class="sub">Построенный маршрут</div>
      <div class="metrics">
        <div><b>~${km} км</b><span>Расстояние</span></div>
        <div><b>~${fmtHours(hr)}</b><span>В пути</span></div>
        <div><b>${path.length}</b><span>Станции</span></div>
        <div><b>${borders.length || "—"}</b><span>Границы</span></div>
      </div>
      ${timelineHTML(stops)}
      <ol class="stops">${stops.map((s) => `<li>${s.name}</li>`).join("")}</ol>
    `);
  }

  document.getElementById("search").addEventListener("input", (e) => search(e.target.value));
  document.querySelector(".rail").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) setView(b.dataset.view);
  });
  document.querySelector(".mobile-nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    if (b.dataset.view === "search") document.getElementById("search").focus();
    else setView(b.dataset.view);
  });
  document.getElementById("filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const set = state.filters[b.dataset.f];
    const v = b.dataset.v;
    if (set.has(v)) set.delete(v);
    else set.add(v);
    b.classList.toggle("on", set.has(v));
    drawRails();
  });
  document.getElementById("filtersBtn").onclick = () => {
    const p = document.getElementById("filters");
    p.hidden = !p.hidden;
  };
  document.getElementById("layersBtn").onclick = () => {
    const p = document.getElementById("layersPop");
    p.hidden = !p.hidden;
  };
  document.getElementById("togStations").onchange = (e) => { state.showStations = e.target.checked; drawMarks(); };
  document.getElementById("togHubs").onchange = (e) => { state.showHubs = e.target.checked; drawMarks(); };
  document.getElementById("togIntl").onchange = (e) => { state.showIntl = e.target.checked; drawRails(); drawMarks(); };
  document.getElementById("togLabels").onchange = (e) => { state.showLabels = e.target.checked; drawMarks(); };
  document.getElementById("baseSat").onchange = () => setBasemap("sat");
  document.getElementById("baseMap").onchange = () => setBasemap("map");
  document.getElementById("themeBtn").onclick = () => {
    document.documentElement.classList.toggle("dark");
    if (maskLayer) maskLayer.setStyle(maskStyle());
    drawRails();
    drawMarks();
  };
  document.getElementById("trace").onclick = trace;
  ["from", "to"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") trace();
    });
  });
  map.on("zoomend", drawMarks);
  map.on("click", closeSheet);
  map.on("mousemove", (e) => {
    const el = document.getElementById("coord");
    if (!el) return;
    const ns = e.latlng.lat >= 0 ? "N" : "S";
    const ew = e.latlng.lng >= 0 ? "E" : "W";
    el.textContent = `${Math.abs(e.latlng.lat).toFixed(3)} ${ns} · ${Math.abs(e.latlng.lng).toFixed(3)} ${ew}`;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  const list = document.getElementById("stlist");
  D.stations.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.name;
    list.appendChild(o);
    if (s.city !== s.name) {
      const o2 = document.createElement("option");
      o2.value = s.city;
      list.appendChild(o2);
    }
  });

  drawRails();
  drawMarks();
  map.fitBounds([[41.2, 46.5], [55.5, 87.3]]);
})();

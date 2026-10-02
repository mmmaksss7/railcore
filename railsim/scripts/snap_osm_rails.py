#!/usr/bin/env python3
"""Snap simulator edges onto OpenStreetMap railway=rail geometry."""
from __future__ import annotations

import heapq
import json
import math
import subprocess
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path("/tmp/osm-kz")
CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "src" / "data" / "osmEdges.json"
WORLD = ROOT / "backend" / "data" / "world.json"

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "RailSimKZ/1.0 (local railway simulator)"

STATIONS = {
    "ast": (51.112, 71.532),
    "alm": (43.274, 76.939),
    "shy": (42.32, 69.59),
    "kgf": (49.806, 73.099),
    "akx": (50.284, 57.167),
    "pwq": (52.287, 76.967),
    "ppk": (54.873, 69.143),
    "sco": (43.658, 51.158),
    "guw": (47.116, 51.883),
    "ura": (51.233, 51.367),
    "ukk": (49.948, 82.629),
    "plx": (50.411, 80.227),
    "dos": (45.253, 82.486),
    "ekb": (51.723, 75.323),
    "dzn": (47.783, 67.71),
    "bxh": (46.843, 74.995),
    "kzo": (53.214, 63.624),
    "kkc": (53.283, 69.397),
    "kzo2": (44.848, 65.509),
    "shu": (43.598, 73.761),
    "mty": (47.221, 73.375),
    "trk": (43.297, 68.252),
    "tar": (42.9, 71.366),
    "bei": (45.324, 55.187),
    "atg": (46.953, 79.682),
    "alk": (44.165, 80.295),
    "ary": (42.43, 68.8),
    "tdk": (45.003, 78.377),
    "knd": (49.469, 57.407),
    "sry": (41.45, 69.168),
}

EDGES = [
    "alm-ast", "ast-ppk", "ast-pwq", "ast-kzo", "kgf-ukk", "alm-dos",
    "kgf-bxh", "bxh-atg", "alm-shy", "shy-kzo2", "kzo2-dzn", "dzn-kgf",
    "akx-ast", "guw-akx", "sco-guw", "ura-guw", "alm-tdk", "alm-alk",
    "plx-ukk", "atg-plx", "ura-akx", "akx-kzo2", "ast-kgf", "pwq-ekb",
    "ekb-ast", "shy-sry", "bei-akx", "alm-shu", "shu-tar", "tar-ary",
    "ary-shy", "ary-trk",
]

REGIONS = [
    ("south-y", 40.9, 64.8, 45.5, 78.8),
    ("west-y", 42.4, 50.4, 52.2, 62.8),
    ("north-y", 50.4, 61.2, 55.6, 78.2),
    ("center-y", 45.4, 64.8, 51.6, 76.4),
    ("east-y", 42.8, 76.2, 51.6, 83.8),
]

WAYPOINTS: dict[str, list[tuple[float, float]]] = {
    "alm-ast": [(43.274, 76.939), (43.341, 76.949), (43.48, 76.1), (43.536, 75.214), (43.598, 73.761), (44.55, 73.62), (45.8, 73.48), (47.221, 73.375), (48.55, 73.22), (49.806, 73.099), (50.48, 72.28), (51.112, 71.532)],
    "ast-ppk": [(51.112, 71.532), (52.2, 70.4), (53.283, 69.397), (54.2, 69.25), (54.873, 69.143)],
    "ast-pwq": [(51.112, 71.532), (51.4, 73.4), (51.723, 75.323), (52.1, 76.2), (52.287, 76.967)],
    "ast-kzo": [(51.112, 71.532), (52.4, 70.1), (53.283, 69.397), (53.4, 66.5), (53.214, 63.624)],
    "kgf-ukk": [(49.806, 73.099), (50.1, 76.0), (50.411, 80.227), (50.2, 81.5), (49.948, 82.629)],
    "alm-dos": [(43.274, 76.939), (43.425, 77.02), (43.689, 77.126), (43.886, 77.082), (44.28, 77.62), (44.357, 77.978), (45.253, 77.976), (45.9, 78.72), (46.953, 79.682), (46.42, 80.68), (45.59, 82.18), (45.253, 82.486)],
    "kgf-bxh": [(49.806, 73.099), (47.221, 73.375), (46.843, 74.995)],
    "bxh-atg": [(46.843, 74.995), (46.91, 77.36), (46.953, 79.682)],
    "alm-shy": [(43.274, 76.939), (43.22, 76.2), (43.598, 73.761), (42.92, 72.76), (42.9, 71.366), (42.55, 70.1), (42.43, 68.8), (42.32, 69.59)],
    "shy-kzo2": [(42.32, 69.59), (42.43, 68.8), (43.297, 68.252), (44.1, 66.8), (44.848, 65.509)],
    "kzo2-dzn": [(44.848, 65.509), (46.2, 66.4), (47.783, 67.71)],
    "dzn-kgf": [(47.783, 67.71), (48.9, 70.4), (49.806, 73.099)],
    "akx-ast": [(50.284, 57.167), (49.469, 57.407), (50.0, 62.0), (50.248, 66.914), (51.955, 66.404), (51.81, 68.36), (51.4, 70.1), (51.112, 71.532)],
    "guw-akx": [(47.116, 51.883), (46.958, 54.016), (48.2, 56.2), (49.469, 57.407), (50.284, 57.167)],
    "sco-guw": [(43.658, 51.158), (43.341, 52.855), (45.324, 55.187), (46.4, 54.6), (46.958, 54.016), (47.116, 51.883)],
    "ura-guw": [(51.233, 51.367), (49.2, 51.6), (47.116, 51.883)],
    "alm-tdk": [(43.274, 76.939), (43.689, 77.126), (44.357, 77.978), (45.003, 78.377)],
    "alm-alk": [(43.274, 76.939), (43.689, 77.126), (43.67, 78.01), (43.77, 79.19), (44.165, 80.295)],
    "plx-ukk": [(50.411, 80.227), (49.948, 82.629)],
    "atg-plx": [(46.953, 79.682), (47.965, 80.434), (49.2, 80.3), (50.411, 80.227)],
    "ura-akx": [(51.233, 51.367), (50.9, 53.8), (50.55, 55.6), (50.284, 57.167)],
    "akx-kzo2": [(50.284, 57.167), (49.469, 57.407), (47.833, 59.6), (46.8, 61.666), (44.848, 65.509)],
    "ast-kgf": [(51.112, 71.532), (50.48, 72.28), (49.806, 73.099)],
    "pwq-ekb": [(52.287, 76.967), (52.1, 76.2), (51.723, 75.323)],
    "ekb-ast": [(51.723, 75.323), (51.4, 73.4), (51.112, 71.532)],
    "shy-sry": [(42.32, 69.59), (41.45, 69.168)],
    "bei-akx": [(45.324, 55.187), (46.5, 57.4), (47.833, 59.6), (48.7, 58.4), (49.469, 57.407), (50.284, 57.167)],
    "alm-shu": [(43.274, 76.939), (43.22, 76.2), (43.598, 73.761)],
    "shu-tar": [(43.598, 73.761), (42.92, 72.76), (42.9, 71.366)],
    "tar-ary": [(42.9, 71.366), (42.55, 70.1), (42.43, 68.8)],
    "ary-shy": [(42.43, 68.8), (42.32, 69.59)],
    "ary-trk": [(42.43, 68.8), (43.297, 68.252)],
}


def qkey(lat: float, lon: float) -> tuple[int, int]:
    return (round(lat * 1e5), round(lon * 1e5))


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def overpass(query: str, dest: Path, retries: int = 5) -> dict:
    if dest.exists() and dest.stat().st_size > 2000:
        try:
            data = json.loads(dest.read_text())
            if data.get("elements"):
                print(f"  cache {dest.name} ({len(data['elements'])} ways)")
                return data
        except json.JSONDecodeError:
            dest.unlink()
    last: object = None
    for i in range(retries):
        time.sleep(3 + i * 7)
        try:
            subprocess.run(
                ["curl", "-sS", "-A", UA, "--max-time", "200", "-X", "POST", "-d", query, OVERPASS, "-o", str(dest)],
                check=True,
            )
        except subprocess.CalledProcessError as e:
            last = e
            continue
        raw = dest.read_text(errors="replace")
        if raw.lstrip().startswith("<"):
            last = RuntimeError(raw[:240])
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            last = e
            continue
        if data.get("remark"):
            last = RuntimeError(data["remark"])
            continue
        if not data.get("elements"):
            last = RuntimeError("empty elements")
            continue
        print(f"  fetched {dest.name} ({len(data['elements'])} ways)")
        return data
    raise RuntimeError(f"overpass failed for {dest.name}: {last}")


def fetch_region(name: str, s: float, w: float, n: float, e: float) -> list[dict]:
    q = (
        f"[out:json][timeout:150];"
        f'way["railway"="rail"]["service"!~"siding|spur"]({s},{w},{n},{e});'
        f"out geom;"
    )
    data = overpass(q, CACHE / f"{name}.json")
    return [el for el in data["elements"] if el.get("type") == "way" and el.get("geometry")]


def fetch_corridor(eid: str, hops: list[tuple[float, float]]) -> list[dict]:
    lats = [p[0] for p in hops]
    lons = [p[1] for p in hops]
    pad = 0.35
    s, n = min(lats) - pad, max(lats) + pad
    w, e = min(lons) - pad, max(lons) + pad
    q = (
        f"[out:json][timeout:120];"
        f'way["railway"="rail"]({s},{w},{n},{e});'
        f"out geom;"
    )
    data = overpass(q, CACHE / f"corr-{eid}.json")
    return [el for el in data["elements"] if el.get("type") == "way" and el.get("geometry")]


class Graph:
    def __init__(self) -> None:
        self.coord: dict[tuple[int, int], tuple[float, float]] = {}
        self.adj: dict[tuple[int, int], dict[tuple[int, int], float]] = defaultdict(dict)
        self.grid: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)

    def add_way(self, geom: list[dict]) -> None:
        keys = []
        for p in geom:
            lat, lon = float(p["lat"]), float(p["lon"])
            k = qkey(lat, lon)
            self.coord[k] = (lat, lon)
            keys.append(k)
        for a, b in zip(keys, keys[1:]):
            if a == b:
                continue
            d = haversine(self.coord[a], self.coord[b])
            self.adj[a][b] = min(self.adj[a].get(b, 1e9), d)
            self.adj[b][a] = min(self.adj[b].get(a, 1e9), d)

    def stitch(self, max_km: float = 0.04) -> int:
        """Join dangling endpoints that sit a few dozen metres apart."""
        ends = [k for k, nb in self.adj.items() if len(nb) == 1]
        added = 0
        for k in ends:
            lat, lon = self.coord[k]
            gi, gj = int(lat * 50), int(lon * 50)
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    for o in self.grid.get((gi + di, gj + dj), ()):
                        if o == k or o in self.adj[k]:
                            continue
                        d = haversine(self.coord[k], self.coord[o])
                        if d <= max_km:
                            self.adj[k][o] = d
                            self.adj[o][k] = d
                            added += 1
        return added

    def index(self) -> None:
        self.grid.clear()
        for k, (lat, lon) in self.coord.items():
            self.grid[(int(lat * 50), int(lon * 50))].append(k)

    def nearest(self, pt: tuple[float, float], radius_km: float = 8.0) -> tuple[int, int] | None:
        best = None
        best_d = radius_km
        gi, gj = int(pt[0] * 50), int(pt[1] * 50)
        span = max(2, int(radius_km / 2) + 1)
        for di in range(-span, span + 1):
            for dj in range(-span, span + 1):
                for k in self.grid.get((gi + di, gj + dj), ()):
                    d = haversine(pt, self.coord[k])
                    if d < best_d:
                        best_d = d
                        best = k
        return best

    def route(self, src: tuple[int, int], dst: tuple[int, int], limit_km: float) -> list[tuple[float, float]] | None:
        if src == dst:
            return [self.coord[src]]
        inf = 1e18
        gscore = {src: 0.0}
        prev: dict[tuple[int, int], tuple[int, int]] = {}
        goal = self.coord[dst]
        heap = [(haversine(self.coord[src], goal), 0.0, src)]
        seen: set[tuple[int, int]] = set()
        while heap:
            _, d, u = heapq.heappop(heap)
            if u in seen:
                continue
            if d > limit_km:
                continue
            seen.add(u)
            if u == dst:
                path_k = [dst]
                while path_k[-1] != src:
                    path_k.append(prev[path_k[-1]])
                path_k.reverse()
                return [self.coord[k] for k in path_k]
            for v, w in self.adj[u].items():
                nd = d + w
                if nd < gscore.get(v, inf):
                    gscore[v] = nd
                    prev[v] = u
                    heapq.heappush(heap, (nd + haversine(self.coord[v], goal), nd, v))
        return None


def perp_dist(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    if a == b:
        return haversine(p, a)
    x, y = p[1], p[0]
    x1, y1 = a[1], a[0]
    x2, y2 = b[1], b[0]
    dx, dy = x2 - x1, y2 - y1
    den = dx * dx + dy * dy
    t = 0.0 if den == 0 else max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / den))
    return haversine(p, (y1 + t * dy, x1 + t * dx))


def douglas(pts: list[tuple[float, float]], eps_km: float) -> list[tuple[float, float]]:
    if len(pts) < 3:
        return pts
    stack = [(0, len(pts) - 1)]
    keep = {0, len(pts) - 1}
    while stack:
        i, j = stack.pop()
        mx, idx = -1.0, None
        a, b = pts[i], pts[j]
        for k in range(i + 1, j):
            d = perp_dist(pts[k], a, b)
            if d > mx:
                mx, idx = d, k
        if idx is not None and mx > eps_km:
            keep.add(idx)
            stack.append((i, idx))
            stack.append((idx, j))
    return [pts[i] for i in sorted(keep)]


def simplify(pts: list[tuple[float, float]], eps_km: float = 0.12) -> list[tuple[float, float]]:
    out = douglas(pts, eps_km)
    while len(out) > 520 and eps_km < 1.2:
        eps_km *= 1.3
        out = douglas(pts, eps_km)
    return out


def build_graph(ways: list[dict]) -> Graph:
    g = Graph()
    seen = set()
    for w in ways:
        wid = w.get("id")
        if wid in seen:
            continue
        seen.add(wid)
        g.add_way(w["geometry"])
    g.index()
    extra = g.stitch(0.05)
    print(f"graph nodes={len(g.coord)} ways={len(seen)} stitched={extra}")
    return g


def snap_edge(g: Graph, eid: str) -> list[list[float]] | None:
    a_id, b_id = eid.split("-", 1)
    hops = WAYPOINTS.get(eid) or [STATIONS[a_id], STATIONS[b_id]]
    keys: list[tuple[int, int]] = []
    for pt in hops:
        k = g.nearest(pt, 20)
        if k is None:
            print(f"  {eid}: no rail near {pt}")
            return None
        if not keys or keys[-1] != k:
            keys.append(k)
    path: list[tuple[float, float]] = []
    for sa, sb in zip(keys, keys[1:]):
        hop_km = haversine(g.coord[sa], g.coord[sb])
        piece = g.route(sa, sb, max(50.0, hop_km * 3.6 + 50))
        if not piece or len(piece) < 2:
            print(f"  {eid}: hop fail {g.coord[sa]} -> {g.coord[sb]} ({hop_km:.0f} km)")
            return None
        path.extend(piece if not path else piece[1:])
    km = sum(haversine(path[i], path[i + 1]) for i in range(len(path) - 1))
    path = simplify(path)
    print(f"  {eid}: {km:.0f} km, {len(path)} pts")
    return [[round(p[0], 5), round(p[1], 5)] for p in path]


def main() -> None:
    ways: list[dict] = []
    for spec in REGIONS:
        print("region", spec[0])
        try:
            ways.extend(fetch_region(*spec))
        except Exception as ex:
            print("  region fail", spec[0], ex)

    g = build_graph(ways)
    result: dict[str, list[list[float]]] = {}
    missing: list[str] = []
    for eid in EDGES:
        pts = snap_edge(g, eid)
        if pts:
            result[eid] = pts
        else:
            missing.append(eid)

    for eid in list(missing):
        hops = WAYPOINTS.get(eid) or []
        print("corridor retry", eid)
        try:
            extra = fetch_corridor(eid, hops or [STATIONS[eid.split("-")[0]], STATIONS[eid.split("-")[1]]])
        except Exception as ex:
            print("  corridor fail", eid, ex)
            continue
        g2 = build_graph(ways + extra)
        pts = snap_edge(g2, eid)
        if pts:
            result[eid] = pts
            missing.remove(eid)
            ways.extend(extra)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False))
    print("wrote", OUT, "edges", len(result), "missing", missing)

    world = json.loads(WORLD.read_text())
    for e in world.get("edges", []):
        pts = result.get(e["id"])
        if pts:
            e["pts"] = pts
    WORLD.write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")))
    print("updated", WORLD)


if __name__ == "__main__":
    main()

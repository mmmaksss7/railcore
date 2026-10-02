const M_LAT = 110540;

function metersPerLng(lat: number) {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

type Seg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  dist: number;
};

export type StationShot = {
  bearing: number;
  corners: [number, number][];
};

/** Frame the yard along its tracks so the camera sits sideways to the station. */
export function stationShot(lat: number, lng: number, fc: GeoJSON.FeatureCollection): StationShot | null {
  const ml = metersPerLng(lat);
  const segs: Seg[] = [];
  for (const feature of fc.features) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== "LineString") continue;
    const coords = geometry.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const x1 = (coords[i - 1][0] - lng) * ml;
      const y1 = (coords[i - 1][1] - lat) * M_LAT;
      const x2 = (coords[i][0] - lng) * ml;
      const y2 = (coords[i][1] - lat) * M_LAT;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dist = Math.hypot(mx, my);
      if (dist > 2600) continue;
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 4) continue;
      segs.push({ x1, y1, x2, y2, len, dist });
    }
  }
  if (segs.length < 2) return null;

  const near = segs.filter((s) => s.dist < 900);
  const basis = near.length >= 2 ? near : segs;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const s of basis) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    xx += s.len * dx * dx;
    xy += s.len * dx * dy;
    yy += s.len * dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  const ex = Math.cos(theta);
  const ey = Math.sin(theta);
  const px = -ey;
  const py = ex;

  const samples: { a: number; c: number }[] = [];
  for (const s of segs) {
    for (const t of [0, 0.5, 1]) {
      const x = s.x1 + (s.x2 - s.x1) * t;
      const y = s.y1 + (s.y2 - s.y1) * t;
      samples.push({ a: x * ex + y * ey, c: x * px + y * py });
    }
  }

  let corridor = 380;
  let band = samples.filter((s) => Math.abs(s.c) <= corridor);
  if (band.length < 8) {
    corridor = 720;
    band = samples.filter((s) => Math.abs(s.c) <= corridor);
  }
  if (band.length < 4) return null;

  const bin = 100;
  const bins = new Map<number, Set<number>>();
  for (const s of band) {
    const k = Math.round(s.a / bin);
    const tracks = bins.get(k) ?? new Set<number>();
    tracks.add(Math.round(s.c / 12));
    bins.set(k, tracks);
  }
  const dense = [...bins.entries()].filter(([, tracks]) => tracks.size >= 2).map(([k]) => k);
  let a0: number;
  let a1: number;
  if (dense.length) {
    a0 = Math.min(...dense) * bin - 240;
    a1 = Math.max(...dense) * bin + 240;
  } else {
    a0 = Math.min(...band.map((s) => s.a));
    a1 = Math.max(...band.map((s) => s.a));
  }
  a0 = Math.min(a0, -160);
  a1 = Math.max(a1, 160);
  if (a1 - a0 > 3600) {
    let best = 0;
    let bestN = -1;
    for (const [k, tracks] of bins) {
      if (tracks.size > bestN) {
        bestN = tracks.size;
        best = k * bin;
      }
    }
    a0 = best - 1700;
    a1 = best + 1700;
  }
  if (a1 - a0 < 700) {
    const mid = (a0 + a1) / 2;
    a0 = mid - 360;
    a1 = mid + 360;
  }

  const used = band.filter((s) => s.a >= a0 && s.a <= a1);
  let c0 = Math.min(...used.map((s) => s.c));
  let c1 = Math.max(...used.map((s) => s.c));
  if (!Number.isFinite(c0)) {
    c0 = -150;
    c1 = 150;
  }
  const cPad = Math.max(100, (c1 - c0) * 0.3);
  c0 -= cPad;
  c1 += cPad;
  if (c1 - c0 < 320) {
    const mid = (c0 + c1) / 2;
    c0 = mid - 160;
    c1 = mid + 160;
  }
  if (c1 - c0 > 860) {
    const mid = (c0 + c1) / 2;
    c0 = mid - 430;
    c1 = mid + 430;
  }
  const aPad = Math.max(80, (a1 - a0) * 0.06);
  a0 -= aPad;
  a1 += aPad;

  const corner = (a: number, c: number): [number, number] => {
    const east = ex * a + px * c;
    const north = ey * a + py * c;
    return [lat + north / M_LAT, lng + east / ml];
  };

  let bearing = -((Math.atan2(-ey, ex) * 180) / Math.PI);
  bearing = ((bearing % 360) + 360) % 360;
  if (bearing > 180) bearing -= 360;
  if (Math.abs(bearing) > 90) bearing += bearing > 0 ? -180 : 180;

  return {
    bearing,
    corners: [corner(a0, c0), corner(a1, c0), corner(a1, c1), corner(a0, c1)],
  };
}

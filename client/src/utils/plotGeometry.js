import { CITIES } from './comfort.js';

/* A plot drawn on the map, as the project's site: see components/PlotMap.jsx. */
// local metres around a point: x east, y south
export const toLocal = (lat0, lng0) => ([lat, lng]) => [(lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110540];
const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const COMPASS = (deg) => ['N', 'E', 'S', 'W'][Math.round((((deg % 360) + 360) % 360) / 90) % 4];

/** Everything the plot gives the project, from its corners (lat/lng) and which edge is on the road. */
export function plotFromCorners(corners, roadEdge, front = 'S', neighbours = []) {
  const lat0 = corners.reduce((s, c) => s + c[0], 0) / corners.length, lng0 = corners.reduce((s, c) => s + c[1], 0) / corners.length;
  const L = toLocal(lat0, lng0);
  const pts = corners.map(L);
  const a = pts[roadEdge], b = pts[(roadEdge + 1) % pts.length];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // the road edge's outward normal (away from the plot's middle), in local metres (x east, y south)
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  if (((a[0] + b[0]) / 2 - cx) * nx + ((a[1] + b[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
  const roadDeg = ((Math.atan2(nx, -ny) * 180) / Math.PI + 360) % 360;      // compass bearing the road side faces
  // turn so the road is at the bottom: the normal goes to (0, 1)
  const rot = Math.atan2(1, 0) - Math.atan2(ny, nx);
  const R = ([x, y]) => [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  const turned = pts.map(R);
  const x0 = Math.min(...turned.map(p => p[0])), y0 = Math.min(...turned.map(p => p[1]));
  const poly = turned.map(([x, y]) => [Math.round((x - x0) * 100) / 100, Math.round((y - y0) * 100) / 100]);
  const w = Math.max(...poly.map(p => p[0])), d = Math.max(...poly.map(p => p[1]));
  const near = neighbours.map(n => ({ h: n.h, pts: n.pts.map(L).map(R).map(([x, y]) => [Math.round((x - x0) * 10) / 10, Math.round((y - y0) * 10) / 10]) }));
  // north on the plan: the house's front side faces the road, so the plan turns with the plot
  const order = ['up', 'right', 'down', 'left'];
  const i = { N: 0, E: 1, S: 2, W: 3 }[front] ?? 2;
  const aUp = roadDeg - 90 * i;
  const north = order[((Math.round(-aUp / 90) % 4) + 4) % 4];
  const city = CITIES.map(([name, la, lo]) => [name, Math.hypot(la - lat0, (lo - lng0) * Math.cos((lat0 * Math.PI) / 180))]).sort((p, q) => p[1] - q[1])[0];
  return {
    plot_m: [Math.round(w * 100) / 100, Math.round(d * 100) / 100], facing: COMPASS(roadDeg), facing_deg: Math.round(roadDeg), north,
    lat: Math.round(lat0 * 1e6) / 1e6, lng: Math.round(lng0 * 1e6) / 1e6, city: city[0], city_km: Math.round(city[1] * 111),
    polygon: poly, plot_area_m2: Math.round(area(pts) * 10) / 10, neighbours: near, source: 'map',
  };
}


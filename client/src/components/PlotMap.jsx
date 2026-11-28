import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, MapPin, Loader2, Undo2, Trash2, Check, Crosshair, Layers } from 'lucide-react';
import { CITIES } from '../utils/comfort';

/*
 * Plot from the map: find the place, click the plot's corners, pick the side on the road. From that come
 * the plot's size and shape, which way it faces, which way north is on the plan, the nearest city (for
 * sun, rain and solar figures), and the buildings around it (OpenStreetMap, through Overpass) for the
 * site plan. The map is drawn here from map or satellite tiles; no mapping library.
 *   site = { plot_m: [w, d], facing, north, lat, lng, city, polygon: [[x, y]…], neighbours: [{ pts, h }],
 *            source: 'map' }   polygon and neighbours in metres, the road side at the bottom (y = d).
 */
const TILE = 256;
const SOURCES = {
  map: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, max: 19, credit: '© OpenStreetMap contributors' },
  satellite: { url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, max: 19, credit: 'Imagery © Esri, Maxar, Earthstar Geographics' },
};
const lng2x = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
const lat2y = (lat, z) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z; };
const x2lng = (x, z) => (x / (TILE * 2 ** z)) * 360 - 180;
const y2lat = (y, z) => { const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z); return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

// local metres around a point: x east, y south
const toLocal = (lat0, lng0) => ([lat, lng]) => [(lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110540];
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

export async function neighboursAround(lat, lng) {
  const q = `[out:json][timeout:20];way["building"](around:70,${lat},${lng});out geom tags 60;`;
  // the public Overpass servers are busy at times: 25 s, then a mirror
  let d = null;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      if (res.ok) { d = await res.json(); break; }
    } catch { /* try the next server */ } finally { clearTimeout(timer); }
  }
  if (!d) throw new Error('neighbours');
  return (d.elements || []).filter(e => e.geometry?.length > 2).map(e => {
    const t = e.tags || {};
    const h = parseFloat(t.height) || (parseFloat(t['building:levels']) ? parseFloat(t['building:levels']) * 3.2 : 6.4);
    return { h: Math.round(h * 10) / 10, pts: e.geometry.map(g => [g.lat, g.lon]) };
  });
}

export default function PlotMap({ site, front = 'S', onSave, onClose }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 460 });
  const [view, setView] = useState(() => ({ lat: site?.lat || 12.9716, lng: site?.lng || 77.5946, z: site?.lat ? 19 : 12 }));
  const [layer, setLayer] = useState('satellite');
  const [corners, setCorners] = useState([]);
  const [road, setRoad] = useState(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const drag = useRef(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = SOURCES[layer];
  const cx = lng2x(view.lng, view.z), cy = lat2y(view.lat, view.z);
  const left = cx - size.w / 2, top = cy - size.h / 2;
  const tiles = useMemo(() => {
    const out = [], n = 2 ** view.z;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        out.push({ key: `${view.z}/${tx}/${ty}`, x: tx * TILE - left, y: ty * TILE - top, url: src.url(view.z, ((tx % n) + n) % n, ty) });
      }
    }
    return out;
  }, [left, top, size.w, size.h, view.z, src]);
  const screen = ([lat, lng]) => [lng2x(lng, view.z) - left, lat2y(lat, view.z) - top];

  const zoom = (dz, at = null) => setView(v => {
    const z = Math.max(3, Math.min(src.max, v.z + dz));
    if (z === v.z) return v;
    if (!at) return { ...v, z };
    const lat = y2lat(lat2y(v.lat, v.z) - size.h / 2 + at[1], v.z), lng = x2lng(lng2x(v.lng, v.z) - size.w / 2 + at[0], v.z);
    // keep the point under the cursor in place
    const nx = lng2x(lng, z) - at[0] + size.w / 2, ny = lat2y(lat, z) - at[1] + size.h / 2;
    return { lat: y2lat(ny, z), lng: x2lng(nx, z), z };
  });

  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, lat: view.lat, lng: view.lng, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView(v => ({ ...v, lng: x2lng(lng2x(d.lng, v.z) - dx, v.z), lat: y2lat(lat2y(d.lat, v.z) - dy, v.z) }));
  };
  const up = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || d.moved) return;
    if (view.z < 17) { setError('Zoom in close to the plot before marking its corners.'); return; }
    if (corners.length >= 10) return;
    const r = box.current.getBoundingClientRect();
    const x = e.clientX - r.left + left, y = e.clientY - r.top + top;
    setError('');
    setCorners(c => [...c, [y2lat(y, view.z), x2lng(x, view.z)]]);
    setRoad(null);
  };

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy('search'); setError('');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      setHits(d);
      if (!d.length) setError('No place found. Try the area and city, e.g. "HSR Layout Sector 2, Bengaluru".');
      else go(d[0]);
    } catch { setError("The place search isn't reachable right now."); } finally { setBusy(''); }
  };
  const go = (h) => { setView({ lat: Number(h.lat), lng: Number(h.lon), z: 18 }); setHits([]); };
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setView({ lat: p.coords.latitude, lng: p.coords.longitude, z: 19 }),
    () => setError("Couldn't get your location. Allow it in the browser, or search instead."));

  const pts = corners.map(screen);
  const local = useMemo(() => (corners.length >= 3 ? corners.map(toLocal(corners[0][0], corners[0][1])) : null), [corners]);
  const edgeLen = (i) => (local ? Math.hypot(local[(i + 1) % local.length][0] - local[i][0], local[(i + 1) % local.length][1] - local[i][1]) : 0);
  const preview = corners.length >= 3 && road != null ? plotFromCorners(corners, road, front) : null;

  const save = async () => {
    setBusy('save'); setError('');
    let neighbours = [], fetched = true;
    try { neighbours = await neighboursAround(preview.lat, preview.lng); } catch { fetched = false; /* the plot stands without them */ }
    const s = plotFromCorners(corners, road, front, neighbours);
    try {
      await onSave({ ...(site || {}), ...s, corners: corners.map(([la, lo]) => [Math.round(la * 1e7) / 1e7, Math.round(lo * 1e7) / 1e7]), road_edge: road });
      if (fetched) onClose();
      else setError("Plot saved. The buildings around it couldn't be fetched (OpenStreetMap's server is busy); press Use this plot again later to add them.");
    } catch (e) { setError(e.message || "Couldn't save the plot."); } finally { setBusy(''); }
  };

  const ft = (m) => `${m.toFixed(1)} m (${Math.round(m * 3.28084)} ft)`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><MapPin className="h-4 w-4 text-zinc-400" /> Plot from the map</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Find the plot, click its corners, then pick the side on the road.</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 custom-scrollbar md:grid-cols-[1fr_17rem]">
          <div>
            <form onSubmit={search} className="relative mb-2 flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place: area, street, landmark, city"
                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
              <button className="btn-secondary px-3 py-1.5 text-xs">{busy === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Find</button>
              <button type="button" onClick={locate} title="My location" className="btn-secondary px-2.5 py-1.5 text-xs"><Crosshair className="h-3.5 w-3.5" /></button>
              {hits.length > 1 && (
                <ul className="absolute left-0 right-0 top-9 z-20 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 text-xs shadow-xl">
                  {hits.map(h => <li key={h.place_id}><button type="button" onClick={() => go(h)} className="w-full truncate px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-900">{h.display_name}</button></li>)}
                </ul>
              )}
            </form>
            <div ref={box} className="relative h-[460px] cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => { drag.current = null; }}
              onWheel={(e) => { const r = box.current.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1 : -1, [e.clientX - r.left, e.clientY - r.top]); }}>
              {tiles.map(t => <img key={t.key} src={t.url} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: t.x, top: t.y, width: TILE, height: TILE }} />)}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {pts.length >= 3 && <polygon points={pts.map(p => p.join(',')).join(' ')} fill="rgba(200,121,74,0.22)" stroke="#c8794a" strokeWidth="2" />}
                {pts.length === 2 && <line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} stroke="#c8794a" strokeWidth="2" />}
                {road != null && pts.length >= 3 && <line x1={pts[road][0]} y1={pts[road][1]} x2={pts[(road + 1) % pts.length][0]} y2={pts[(road + 1) % pts.length][1]} stroke="#38bdf8" strokeWidth="5" />}
                {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#fff" stroke="#c8794a" strokeWidth="2" />)}
              </svg>
              <div className="absolute right-2 top-2 flex flex-col gap-1">
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(1)} className="h-7 w-7 rounded-md bg-zinc-950/90 text-sm text-white">+</button>
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(-1)} className="h-7 w-7 rounded-md bg-zinc-950/90 text-sm text-white">−</button>
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setLayer(l => (l === 'map' ? 'satellite' : 'map'))} title="Map or satellite"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950/90 text-white"><Layers className="h-3.5 w-3.5" /></button>
              </div>
              <p className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 text-[9px] text-zinc-300">{src.credit}</p>
              {view.z < 17 && <p className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-zinc-200">Zoom in to the plot to mark its corners</p>}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-zinc-800 p-3">
              <p className="label-caps">1. Corners</p>
              <p className="mt-1 text-zinc-400">{corners.length ? `${corners.length} marked${corners.length < 3 ? '; at least 3' : ''}.` : 'Click each corner of the plot on the map, in order.'}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { setCorners(c => c.slice(0, -1)); setRoad(null); }} disabled={!corners.length} className="btn-secondary px-2.5 py-1 text-[11px]"><Undo2 className="h-3 w-3" /> Undo</button>
                <button onClick={() => { setCorners([]); setRoad(null); }} disabled={!corners.length} className="btn-secondary px-2.5 py-1 text-[11px]"><Trash2 className="h-3 w-3" /> Clear</button>
              </div>
            </div>
            {corners.length >= 3 && (
              <div className="rounded-xl border border-zinc-800 p-3">
                <p className="label-caps">2. Which side is on the road?</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {corners.map((_, i) => (
                    <button key={i} onClick={() => setRoad(i)} className={`${road === i ? 'chip-on' : 'chip'} text-[11px]`}>Side {i + 1} · {edgeLen(i).toFixed(1)} m</button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-500">Side 1 runs from the first corner to the second.</p>
              </div>
            )}
            {preview && (
              <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-3 text-zinc-300">
                <p className="label-caps">The plot</p>
                <p className="mt-1">{ft(preview.plot_m[0])} along the road × {ft(preview.plot_m[1])} deep</p>
                <p>{Math.round(preview.plot_area_m2)} m² ({Math.round(preview.plot_area_m2 * 10.7639).toLocaleString('en-IN')} sq ft)</p>
                <p>Faces {({ N: 'north', E: 'east', S: 'south', W: 'west' })[preview.facing]} ({preview.facing_deg}°); north is to the {({ up: 'top', right: 'right', down: 'bottom', left: 'left' })[preview.north]} of the plan</p>
                <p>Climate: {preview.city}{preview.city_km > 60 ? ` (nearest of the cities, ${preview.city_km} km away)` : ''}</p>
              </div>
            )}
            {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-200">{error}</p>}
            <button onClick={save} disabled={!preview || !!busy} className="btn-primary w-full py-2 text-xs">
              {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {busy === 'save' ? 'Saving, with the buildings around…' : 'Use this plot'}
            </button>
            <p className="text-[10px] leading-snug text-zinc-600">Also fetches the buildings around it from OpenStreetMap for the site plan. Sizes from a map are approximate; use the survey or sale deed for the real dimensions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

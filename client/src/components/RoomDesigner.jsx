import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  AlertTriangle, ArrowLeft, Box, Check, Copy, Loader2, Redo2, RotateCcw, RotateCw, Save, Search, Sparkles, Square,
  Trash2, Undo2,
} from 'lucide-react';
import { CATALOG, CATEGORIES, catalogItem } from '../utils/furnitureCatalog';
import { drawSymbol } from '../utils/planSymbols';
import { HouseModel } from './Canvas3D';
import { formatArea, formatMoney, isImperial } from '../utils/units';

/*
 * Room Designer: furnish one room yourself. Pick pieces from the catalogue, drag them where you want
 * them (they snap to the walls), rotate, resize and recolour them, and check the room in 3D. It warns
 * about pieces that overlap, stick out of the room or block a door. Saving writes the furniture into
 * the plan, where the Studio, the 3D house, the walkthrough, the drawings and the costs all see it;
 * Photo Render can then capture the room with this furniture and make it a photo.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const U = 20;                     // plan units per metre
const WALL_HALF = 4;              // walls are 8 units thick, centred on the room outline
const SNAP = 1;                   // 5 cm
const WALL_SNAP = 5;              // 25 cm: a piece this close to a wall is pushed flush against it
const KIND_LABEL = {
  living: 'Living room', lounge: 'Lounge', dining: 'Dining room', kitchen: 'Kitchen', master_bedroom: 'Master bedroom',
  bedroom: 'Bedroom', bathroom: 'Bathroom', study: 'Study', utility: 'Utility', closet: 'Walk-in closet', balcony: 'Balcony', patio: 'Patio', hallway: 'Hallway',
};
const SWATCHES = [null, '#f4f4f2', '#d6cfc2', '#c8a27a', '#5b3a29', '#27272a', '#5b6b94', '#2f6574', '#4d7c4a', '#b45309', '#be123c', '#7c3aed'];
const newId = () => `furn_${Math.random().toString(36).slice(2, 9)}`;
const rad = (deg) => (deg * Math.PI) / 180;

// ---- geometry -----------------------------------------------------------------------------------
const toItem = (e) => {
  const a = rad(e.angle || 0);
  const { left, top, width, height, angle, type, id, color, ...extra } = e;
  return { id: id || newId(), type, cx: left + (width / 2) * Math.cos(a), cy: top + (width / 2) * Math.sin(a), w: width, d: height, angle: angle || 0, color: color || null, extra };
};
const toElement = (it, floor) => {
  const a = rad(it.angle);
  return {
    ...it.extra, id: it.id, type: it.type, floor,
    left: Math.round((it.cx - (it.w / 2) * Math.cos(a)) * 10) / 10, top: Math.round((it.cy - (it.w / 2) * Math.sin(a)) * 10) / 10,
    width: it.w, height: it.d, angle: it.angle, ...(it.color ? { color: it.color } : {}),
  };
};
function corners(it) {
  const a = rad(it.angle), c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [it.cx + (sx * it.w / 2) * c - (sy * it.d / 2) * s, it.cy + (sx * it.w / 2) * s + (sy * it.d / 2) * c]);
}
function bbox(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
function overlaps(pa, pb) {             // separating-axis test for two convex polygons
  for (const poly of [pa, pb]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1, ny = x1 - x2;
      const proj = (p) => p.map(([x, y]) => x * nx + y * ny);
      const a = proj(pa), b = proj(pb);
      if (Math.max(...a) <= Math.min(...b) + 0.5 || Math.max(...b) <= Math.min(...a) + 0.5) return false;
    }
  }
  return true;
}
function inside(pts, [px, py]) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const lineEnds = (e) => { const a = rad(e.angle || 0); return [e.left, e.top, e.left + e.width * Math.cos(a), e.top + e.width * Math.sin(a)]; };

/** Where each door of the room swings into it: a square as wide as the door, on the room's side. */
function doorZones(room, doors) {
  const x0 = room.left, x1 = room.left + room.width, y0 = room.top - room.height / 2, y1 = room.top + room.height / 2;
  const zones = [];
  for (const d of doors) {
    const [ax, ay, bx, by] = lineEnds(d);
    const mx = (ax + bx) / 2, my = (ay + by) / 2, w = d.width;
    const tol = 8;
    if (Math.abs(my - y0) < tol && mx > x0 && mx < x1) zones.push([[mx - w / 2, y0], [mx + w / 2, y0], [mx + w / 2, y0 + w], [mx - w / 2, y0 + w]]);
    else if (Math.abs(my - y1) < tol && mx > x0 && mx < x1) zones.push([[mx - w / 2, y1 - w], [mx + w / 2, y1 - w], [mx + w / 2, y1], [mx - w / 2, y1]]);
    else if (Math.abs(mx - x0) < tol && my > y0 && my < y1) zones.push([[x0, my - w / 2], [x0 + w, my - w / 2], [x0 + w, my + w / 2], [x0, my + w / 2]]);
    else if (Math.abs(mx - x1) < tol && my > y0 && my < y1) zones.push([[x1 - w, my - w / 2], [x1, my - w / 2], [x1, my + w / 2], [x1 - w, my + w / 2]]);
  }
  return zones;
}

// ---- catalogue icon -----------------------------------------------------------------------------
function CatalogIcon({ item, size = 44 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const w = item.w * U, d = item.d * U;
    const k = (size - 6) / Math.max(w, d);
    ctx.translate(size / 2, size / 2);
    ctx.scale(k, k);
    drawSymbol(item.type, ctx, w, d);
  }, [item, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="shrink-0 rounded-md bg-zinc-900" />;
}

// ---- 3D view -----------------------------------------------------------------------------------
function Room3D({ elements, room }) {
  const cx = (room.left + room.width / 2) * 0.05, cz = room.top * 0.05;
  const span = Math.max(room.width, room.height) * 0.05;
  return (
    <Canvas camera={{ position: [cx + span * 0.3, span * 1.25 + 5, cz + span * 0.7], fov: 45 }} shadows>
      <color attach="background" args={['#18181b']} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#c9b89f', 0.6]} />
      <directionalLight position={[cx + 10, 18, cz + 8]} intensity={1.1} castShadow />
      <HouseModel elements={elements} roofStyle="none" isDay />
      <OrbitControls makeDefault target={[cx, 0.6, cz]} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={1.5} maxDistance={40} />
    </Canvas>
  );
}

// ---- page ---------------------------------------------------------------------------------------
export default function RoomDesigner() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId');
  const roomId = params.get('room');
  const navigate = useNavigate();
  const imperial = isImperial();

  const [project, setProject] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [history, setHistory] = useState({ list: [[]], at: 0 });
  const items = history.list[history.at];
  const [baseIds, setBaseIds] = useState([]);           // furniture ids this room had when loaded
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('2d');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('suggested');
  const [save, setSave] = useState('saved');            // saved | dirty | saving | error
  const [saveError, setSaveError] = useState('');
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const viewT = useRef(null);

  // ---- loading ------------------------------------------------------------------------------------
  useEffect(() => {
    if (!projectId) return;
    fetch(`${API_URL}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async r => {
        if (r.status === 401) { localStorage.removeItem('token'); navigate('/auth', { replace: true }); throw new Error('Please sign in again.'); }
        if (!r.ok) throw new Error(r.status === 404 ? "This project doesn't exist any more." : `Couldn't load the project (${r.status}).`);
        return r.json();
      })
      .then(setProject)
      .catch(e => setLoadError(e.message));
  }, [projectId, navigate]);

  const elements = useMemo(() => (project?.elements_data || []).filter(e => e && typeof e.type === 'string'), [project]);
  const rooms = useMemo(() => elements.filter(e => e.type === 'room' && e.kind !== 'hallway'), [elements]);
  const room = rooms.find(r => r.id === roomId) || null;
  const floor = room?.floor || 1;
  const onFloor = useMemo(() => elements.filter(e => (e.floor || 1) === floor), [elements, floor]);

  // the room's own furniture (by centre) becomes the editable set, once per room opened
  const [loadedFor, setLoadedFor] = useState(null);
  if (room && loadedFor !== room.id) {
    const x0 = room.left, x1 = room.left + room.width, y0 = room.top - room.height / 2, y1 = room.top + room.height / 2;
    const mine = onFloor.filter(e => e.type.startsWith('furniture_')).map(toItem)
      .filter(it => it.cx >= x0 && it.cx <= x1 && it.cy >= y0 && it.cy <= y1);
    setLoadedFor(room.id);
    setHistory({ list: [mine], at: 0 });
    setBaseIds(mine.map(it => it.id));
    setSelected(null);
    setSave('saved');
  }

  const commit = useCallback((next) => {
    setHistory(h => ({ list: [...h.list.slice(0, h.at + 1), next].slice(-80), at: Math.min(h.at + 1, 79) }));
    setSave('dirty');
  }, []);
  const replaceCurrent = useCallback((next) => {       // while dragging: no new undo step per pixel
    setHistory(h => ({ ...h, list: h.list.map((l, i) => (i === h.at ? next : l)) }));
    setSave('dirty');
  }, []);
  const undo = () => setHistory(h => ({ ...h, at: Math.max(0, h.at - 1) }));
  const redo = () => setHistory(h => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) }));

  // ---- room geometry, warnings ---------------------------------------------------------------------
  const inner = room ? { x0: room.left + WALL_HALF, x1: room.left + room.width - WALL_HALF, y0: room.top - room.height / 2 + WALL_HALF, y1: room.top + room.height / 2 - WALL_HALF } : null;
  const zones = useMemo(() => (room ? doorZones(room, onFloor.filter(e => e.type === 'door')) : []), [room, onFloor]);
  const problems = useMemo(() => {
    const out = {};
    if (!inner) return out;
    const polys = items.map(corners);
    items.forEach((it, i) => {
      const box = bbox(polys[i]);
      const flat = catalogItem(it.type)?.cat === 'decor' && (catalogItem(it.type)?.h || 1) < 0.05;   // a rug lies under things
      const list = [];
      if (box.x0 < inner.x0 - 1 || box.x1 > inner.x1 + 1 || box.y0 < inner.y0 - 1 || box.y1 > inner.y1 + 1) list.push('outside the room');
      if (!flat && items.some((o, j) => j !== i && !(catalogItem(o.type)?.h < 0.05) && overlaps(polys[i], polys[j]))) list.push('overlaps another piece');
      if (!flat && zones.some(z => overlaps(polys[i], z))) list.push('blocks a door');
      if (list.length) out[it.id] = list;
    });
    return out;
  }, [items, inner?.x0, inner?.x1, inner?.y0, inner?.y1, zones]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- drawing ---------------------------------------------------------------------------------------
  const draw = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap || !room) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; }
    const margin = 1.4 * U;
    const rx0 = room.left - margin, ry0 = room.top - room.height / 2 - margin;
    const rw = room.width + margin * 2, rh = room.height + margin * 2;
    const k = Math.min(W / rw, H / rh);
    const ox = (W - rw * k) / 2 - rx0 * k, oy = (H - rh * k) / 2 - ry0 * k;
    viewT.current = { k, ox, oy };
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0f0e0d';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    // neighbouring rooms faint, this room lit, a 0.5 m grid on its floor
    for (const r of onFloor.filter(e => e.type === 'room')) {
      ctx.fillStyle = r.id === room.id ? '#1d1b19' : '#151413';
      ctx.fillRect(r.left, r.top - r.height / 2, r.width, r.height);
    }
    ctx.strokeStyle = 'rgba(231,226,217,0.06)'; ctx.lineWidth = 1 / k;
    for (let x = room.left; x <= room.left + room.width; x += 10) { ctx.beginPath(); ctx.moveTo(x, room.top - room.height / 2); ctx.lineTo(x, room.top + room.height / 2); ctx.stroke(); }
    for (let y = room.top - room.height / 2; y <= room.top + room.height / 2; y += 10) { ctx.beginPath(); ctx.moveTo(room.left, y); ctx.lineTo(room.left + room.width, y); ctx.stroke(); }
    // door swing zones
    ctx.fillStyle = 'rgba(250, 204, 21, 0.07)';
    zones.forEach(z => { ctx.beginPath(); z.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); });
    // walls, then doors and windows over them
    ctx.strokeStyle = '#e4e4e7'; ctx.lineCap = 'square';
    for (const w of onFloor.filter(e => e.type === 'wall')) {
      const [ax, ay, bx, by] = lineEnds(w);
      ctx.lineWidth = w.height || 8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    for (const o of onFloor.filter(e => e.type === 'door' || e.type === 'window')) {
      const a = rad(o.angle || 0);
      ctx.save();
      ctx.translate(o.left + (o.width / 2) * Math.cos(a), o.top + (o.width / 2) * Math.sin(a));
      ctx.rotate(a);
      drawSymbol(o.type, ctx, o.width, o.height || 5, { swing: o.swing ?? 1, hinge: o.hinge ?? 1, bg: '#1d1b19' });
      ctx.restore();
    }
    // furniture: rugs first, the selected piece last
    const order = [...items].sort((p, q) => ((catalogItem(p.type)?.h ?? 1) < 0.05 ? -1 : 0) - ((catalogItem(q.type)?.h ?? 1) < 0.05 ? -1 : 0)
      || (p.id === selected) - (q.id === selected));
    for (const it of order) {
      ctx.save();
      ctx.translate(it.cx, it.cy);
      ctx.rotate(rad(it.angle));
      drawSymbol(it.type, ctx, it.w, it.d);
      const bad = problems[it.id];
      if (it.id === selected || bad) {
        ctx.setLineDash(it.id === selected ? [3 / k * 2, 2 / k * 2] : []);
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = bad ? '#f43f5e' : '#c8794a';
        ctx.strokeRect(-it.w / 2 - 1, -it.d / 2 - 1, it.w + 2, it.d + 2);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    // the room's size along two edges
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#a8a29a'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
    const fmt = (u) => (imperial ? `${((u / U) * 3.28084).toFixed(1)} ft` : `${(u / U).toFixed(2)} m`);
    ctx.fillText(fmt(room.width), ox + (room.left + room.width / 2) * k, oy + (room.top - room.height / 2) * k - 14);
    ctx.save();
    ctx.translate(ox + room.left * k - 14, oy + room.top * k);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(fmt(room.height), 0, 0);
    ctx.restore();
  }, [room, onFloor, items, selected, problems, zones, imperial]);

  useEffect(() => { if (view === '2d') draw(); }, [draw, view]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ---- interaction --------------------------------------------------------------------------------
  const toPlan = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { k, ox, oy } = viewT.current;
    return [(e.clientX - rect.left - ox) / k, (e.clientY - rect.top - oy) / k];
  };
  const snapToWalls = (it) => {
    if (!inner) return it;
    const box = bbox(corners(it));
    let dx = 0, dy = 0;
    if (Math.abs(box.x0 - inner.x0) < WALL_SNAP) dx = inner.x0 - box.x0;
    else if (Math.abs(box.x1 - inner.x1) < WALL_SNAP) dx = inner.x1 - box.x1;
    if (Math.abs(box.y0 - inner.y0) < WALL_SNAP) dy = inner.y0 - box.y0;
    else if (Math.abs(box.y1 - inner.y1) < WALL_SNAP) dy = inner.y1 - box.y1;
    return { ...it, cx: it.cx + dx, cy: it.cy + dy };
  };
  const onPointerDown = (e) => {
    if (!viewT.current) return;
    const p = toPlan(e);
    const hit = [...items].reverse().find(it => inside(corners(it), p) && (catalogItem(it.type)?.h ?? 1) >= 0.05)
      || [...items].reverse().find(it => inside(corners(it), p));
    setSelected(hit ? hit.id : null);
    if (hit) {
      drag.current = { id: hit.id, dx: p[0] - hit.cx, dy: p[1] - hit.cy, moved: false };
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    const g = drag.current;
    if (!g) return;
    const [px, py] = toPlan(e);
    const next = items.map(it => (it.id === g.id
      ? snapToWalls({ ...it, cx: Math.round((px - g.dx) / SNAP) * SNAP, cy: Math.round((py - g.dy) / SNAP) * SNAP }) : it));
    if (!g.moved) { g.moved = true; commit(next); } else replaceCurrent(next);
  };
  const onPointerUp = () => { drag.current = null; };

  /** A free place for a new piece: clear of other pieces and door swings, against a wall if it can be
   *  (backed onto the wall, facing into the room), else anywhere free, else the middle. */
  const findSpot = (it) => {
    if (!inner) return it;
    const flat = (catalogItem(it.type)?.h ?? 1) < 0.05;
    const solid = items.filter(o => (catalogItem(o.type)?.h ?? 1) >= 0.05).map(corners);
    const free = (c) => {
      const p = corners(c), b = bbox(p);
      if (b.x0 < inner.x0 - 0.5 || b.x1 > inner.x1 + 0.5 || b.y0 < inner.y0 - 0.5 || b.y1 > inner.y1 + 0.5) return false;
      return flat || (!solid.some(o => overlaps(p, o)) && !zones.some(z => overlaps(p, z)));
    };
    const mx = (inner.x0 + inner.x1) / 2, my = (inner.y0 + inner.y1) / 2;
    const cands = [];
    // back to a wall: angle 0 = back on the top wall, 180 = bottom, 90 = right, 270 = left
    for (const [angle, fixed, along0, along1, horiz] of [
      [0, inner.y0 + it.d / 2, inner.x0 + it.w / 2, inner.x1 - it.w / 2, true],
      [180, inner.y1 - it.d / 2, inner.x0 + it.w / 2, inner.x1 - it.w / 2, true],
      [270, inner.x0 + it.d / 2, inner.y0 + it.w / 2, inner.y1 - it.w / 2, false],
      [90, inner.x1 - it.d / 2, inner.y0 + it.w / 2, inner.y1 - it.w / 2, false],
    ]) {
      for (let a = along0; a <= along1 + 0.01; a += 2) {
        cands.push(horiz ? { ...it, angle, cx: a, cy: fixed } : { ...it, angle, cx: fixed, cy: a });
      }
    }
    const byCentre = (c) => Math.hypot(c.cx - mx, c.cy - my);
    const wall = cands.filter(free).sort((p, q) => byCentre(p) - byCentre(q));
    if (!flat && wall.length) return wall[0];
    const open = [];
    for (let x = inner.x0 + it.w / 2; x <= inner.x1 - it.w / 2 + 0.01; x += 4) {
      for (let y = inner.y0 + it.d / 2; y <= inner.y1 - it.d / 2 + 0.01; y += 4) open.push({ ...it, cx: x, cy: y });
    }
    const any = open.filter(free).sort((p, q) => byCentre(p) - byCentre(q));
    return any[0] || it;
  };

  const add = (item) => {
    if (!room || !inner) return;
    const it = findSpot({ id: newId(), type: item.type, cx: (inner.x0 + inner.x1) / 2, cy: (inner.y0 + inner.y1) / 2, w: Math.round(item.w * U), d: Math.round(item.d * U), angle: 0, color: null, extra: {} });
    commit([...items, it]);
    setSelected(it.id);
  };
  const update = (id, change) => commit(items.map(it => (it.id === id ? { ...it, ...change } : it)));
  const remove = (id) => { commit(items.filter(it => it.id !== id)); setSelected(null); };
  const duplicate = (id) => {
    const src = items.find(it => it.id === id);
    if (!src) return;
    const copy = { ...src, id: newId(), cx: src.cx + 10, cy: src.cy + 10 };
    commit([...items, copy]);
    setSelected(copy.id);
  };
  const rotate = (id, by) => {
    const it = items.find(x => x.id === id);
    if (it) update(id, snapToWalls({ ...it, angle: ((it.angle + by) % 360 + 360) % 360 }));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selected); }
      else if (e.key.toLowerCase() === 'r') rotate(selected, e.shiftKey ? -90 : 90);
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(selected); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const it = items.find(x => x.id === selected);
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (it) update(selected, { cx: it.cx + d[0], cy: it.cy + d[1] });
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const warn = (e) => { if (save === 'dirty') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  // ---- saving --------------------------------------------------------------------------------------
  const saveRoom = async () => {
    if (!project || !room) return false;
    setSave('saving'); setSaveError('');
    const f = room.floor || 1, x0 = room.left, x1 = room.left + room.width, y0 = room.top - room.height / 2, y1 = room.top + room.height / 2;
    const wasHere = (e) => {                     // the room's old furniture: what we loaded, or anything centred in it
      if (baseIds.includes(e.id)) return true;
      if (typeof e.type !== 'string' || !e.type.startsWith('furniture_') || (e.floor || 1) !== f) return false;
      const { cx, cy } = toItem(e);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    };
    const keep = (project.elements_data || []).filter(e => e && !wasHere(e));
    const next = [...keep, ...items.map(it => toElement(it, room.floor || 1))];
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements_data: next }),
      });
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      try { localStorage.setItem(`archetech_project_${projectId}`, JSON.stringify(next)); } catch { /* private mode */ }
      setProject(p => ({ ...p, elements_data: next }));
      setBaseIds(items.map(it => it.id));
      setSave('saved');
      return true;
    } catch (e) {
      setSave('error');
      setSaveError(`Couldn't save: ${e.message}`);
      return false;
    }
  };
  const go = async (path) => {
    if (save === 'dirty' && !(await saveRoom())) return;
    navigate(path);
  };
  const switchRoom = async (id) => {
    if (save === 'dirty' && !window.confirm('Save this room before switching?')) return;
    if (save === 'dirty') await saveRoom();
    setParams({ projectId, room: id });
  };

  // ---- catalogue ------------------------------------------------------------------------------------
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = CATALOG;
    if (q) list = list.filter(it => it.name.toLowerCase().includes(q) || it.cat.includes(q));
    else if (cat === 'suggested' && room) list = list.filter(it => it.rooms.includes(room.kind));
    else if (cat !== 'all' && cat !== 'suggested') list = list.filter(it => it.cat === cat);
    return list;
  }, [query, cat, room]);

  const sel = items.find(it => it.id === selected);
  const selItem = sel ? catalogItem(sel.type) : null;
  const toUnits = (m) => (imperial ? m * 3.28084 : m);
  const fromUnits = (v) => (imperial ? v / 3.28084 : v);
  const cost = items.reduce((s, it) => s + (catalogItem(it.type)?.price || 300), 0);
  const used = inner ? items.filter(it => (catalogItem(it.type)?.h ?? 1) >= 0.05).reduce((s, it) => s + it.w * it.d, 0) / ((inner.x1 - inner.x0) * (inner.y1 - inner.y0)) : 0;
  const issues = Object.entries(problems);
  const scene3d = useMemo(() => {
    if (!room) return [];
    const others = onFloor.filter(e => !baseIds.includes(e.id));
    return [...others, ...items.map(it => toElement(it, room.floor || 1))].map(e => ({ ...e, floor: 1 }));
  }, [onFloor, items, baseIds, room]);

  // ---- render --------------------------------------------------------------------------------------
  if (!projectId) {
    return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-300">Open the Room Designer from a project.</div>;
  }
  if (loadError) {
    return <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300"><p>{loadError}</p><Link to="/dashboard" className="text-sm underline">Go to your projects</Link></div>;
  }
  if (!project) {
    return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!room) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <Link to={`/studio?projectId=${projectId}`} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Studio</Link>
        <h1 className="mt-6 text-2xl font-semibold">Which room do you want to design?</h1>
        <ul className="mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {rooms.map(r => (
            <li key={r.id}>
              <button onClick={() => setParams({ projectId, room: r.id })} className="w-full rounded-xl border border-zinc-800 p-4 text-left hover:bg-zinc-900">
                <span className="block text-sm text-zinc-100">{r.name}</span>
                <span className="text-xs text-zinc-500">{KIND_LABEL[r.kind] || r.kind} · {formatArea(r.area)}{(r.floor || 1) > 1 ? ` · floor ${r.floor}` : ''}</span>
              </button>
            </li>
          ))}
          {!rooms.length && <li className="text-sm text-zinc-500">This plan has no rooms yet.</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <button onClick={() => go(`/studio?projectId=${projectId}`)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Back to Studio"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.25em] text-zinc-500">ROOM DESIGNER</p>
          <select value={room.id} onChange={(e) => switchRoom(e.target.value)} className="-ml-1 rounded bg-transparent text-sm font-semibold text-zinc-100 focus:outline-none">
            {rooms.map(r => <option key={r.id} value={r.id} className="bg-zinc-900">{r.name}{(r.floor || 1) > 1 ? ` (floor ${r.floor})` : ''}</option>)}
          </select>
        </div>
        <span className="text-xs text-zinc-500">{KIND_LABEL[room.kind] || room.kind} · {formatArea(room.area)}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
            <button onClick={() => setView('2d')} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${view === '2d' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}><Square className="h-3.5 w-3.5" /> Plan</button>
            <button onClick={() => setView('3d')} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${view === '3d' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}><Box className="h-3.5 w-3.5" /> 3D</button>
          </div>
          <button onClick={undo} disabled={history.at === 0} title="Undo (Ctrl/Cmd+Z)" className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={history.at >= history.list.length - 1} title="Redo (Ctrl/Cmd+Shift+Z)" className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => go(`/render-studio?projectId=${projectId}&room=${encodeURIComponent(room.id)}`)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800" title="Save, then make a photo of this room with your furniture">
            <Sparkles className="h-3.5 w-3.5" /> Make it a photo
          </button>
          <button onClick={saveRoom} disabled={save === 'saving' || save === 'saved'}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-60">
            {save === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : save === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {save === 'saved' ? 'Saved' : save === 'saving' ? 'Saving…' : 'Save room'}
          </button>
        </div>
      </header>
      {saveError && <p className="bg-rose-500/10 px-4 py-1.5 text-xs text-rose-200">{saveError}</p>}

      <div className="flex min-h-0 flex-1">
        {/* catalogue */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
          <div className="border-b border-zinc-800 p-3">
            <label className="flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search furniture" className="w-full bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none" />
            </label>
            <div className="mt-2 flex flex-wrap gap-1">
              {[['suggested', `For a ${(KIND_LABEL[room.kind] || 'room').toLowerCase()}`], ['all', 'All'], ...CATEGORIES].map(([id, label]) => (
                <button key={id} onClick={() => { setCat(id); setQuery(''); }}
                  className={`rounded-full px-2 py-0.5 text-[10px] ${cat === id && !query ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto p-2">
            {shown.map(it => (
              <li key={it.type}>
                <button onClick={() => add(it)} className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-zinc-900" title={`Add ${it.name.toLowerCase()}`}>
                  <CatalogIcon item={it} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-zinc-100">{it.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      {imperial ? `${(it.w * 3.28084).toFixed(1)} × ${(it.d * 3.28084).toFixed(1)} ft` : `${it.w.toFixed(2)} × ${it.d.toFixed(2)} m`} · {formatMoney(it.price)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="p-3 text-xs text-zinc-500">Nothing matches.</li>}
          </ul>
        </aside>

        {/* plan / 3D */}
        <main ref={wrapRef} className="relative min-w-0 flex-1">
          {view === '2d' ? (
            <canvas ref={canvasRef} className="absolute inset-0 touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
          ) : (
            <div className="absolute inset-0"><Room3D elements={scene3d} room={{ ...room, floor: 1 }} /></div>
          )}
          {view === '2d' && !items.length && (
            <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-zinc-500">Pick furniture on the left. Drag to move · R to rotate · Delete to remove.</p>
          )}
        </main>

        {/* properties and summary */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 p-4">
          {sel ? (
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">SELECTED</p>
              <p className="mt-1 text-sm font-medium">{selItem?.name || sel.type.replace('furniture_', '')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[['w', 'Width'], ['d', 'Depth']].map(([key, label]) => (
                  <label key={key} className="text-[10px] text-zinc-400">{label} ({imperial ? 'ft' : 'm'})
                    <input type="number" step="0.05" min="0.1" value={toUnits(sel[key] / U).toFixed(2)}
                      onChange={(e) => { const v = fromUnits(Number(e.target.value)); if (v > 0.05 && v < 12) update(sel.id, { [key]: Math.round(v * U) }); }}
                      className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">Height {selItem ? (imperial ? `${(selItem.h * 3.28084).toFixed(1)} ft` : `${selItem.h.toFixed(2)} m`) : '—'} · facing {Math.round(sel.angle)}°</p>
              <div className="mt-3 flex gap-1.5">
                {[[-90, <RotateCcw key="a" className="h-3.5 w-3.5" />, '90°'], [-15, null, '15°'], [15, null, '15°'], [90, <RotateCw key="b" className="h-3.5 w-3.5" />, '90°']].map(([by, icon, label], i) => (
                  <button key={i} onClick={() => rotate(sel.id, by)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-700 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800" title={`Turn ${by > 0 ? 'right' : 'left'} ${Math.abs(by)}°`}>
                    {icon || (by > 0 ? '↻' : '↺')} {label}
                  </button>
                ))}
              </div>
              {selItem && !selItem.builtin && (
                <div className="mt-3">
                  <p className="text-[10px] text-zinc-400">Colour</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {SWATCHES.map((c, i) => (
                      <button key={i} onClick={() => update(sel.id, { color: c })} title={c || 'Original'}
                        className={`h-5 w-5 rounded-full border ${sel.color === c ? 'border-white ring-1 ring-white' : 'border-zinc-700'}`}
                        style={{ background: c || 'repeating-linear-gradient(45deg,#3f3f46 0 3px,#27272a 3px 6px)' }} />
                    ))}
                  </div>
                </div>
              )}
              {problems[sel.id] && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This piece {problems[sel.id].join(' and ')}.
                </p>
              )}
              <div className="mt-3 flex gap-1.5">
                <button onClick={() => duplicate(sel.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                <button onClick={() => remove(sel.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Click a piece on the plan to move, turn, resize or recolour it.</p>
          )}

          <div className="mt-6 border-t border-zinc-800 pt-4">
            <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">THIS ROOM</p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-zinc-400">Pieces</dt><dd>{items.length}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-400">Furniture cost</dt><dd>{formatMoney(cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-400">Floor covered</dt><dd>{Math.round(used * 100)}%</dd></div>
            </dl>
            {used > 0.55 && <p className="mt-2 text-[11px] text-amber-200">Over about half the floor is covered: the room may feel cramped.</p>}
            {issues.length > 0 && (
              <ul className="mt-3 space-y-1">
                {issues.map(([id, list]) => {
                  const it = items.find(x => x.id === id);
                  return (
                    <li key={id}>
                      <button onClick={() => setSelected(id)} className="flex w-full items-start gap-1.5 text-left text-[11px] text-rose-200 hover:text-rose-100">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {catalogItem(it?.type)?.name || 'A piece'} {list.join(', ')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!issues.length && items.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300"><Check className="h-3 w-3" /> Everything fits, and every door opens.</p>}
          </div>
          <p className="mt-6 text-[10px] leading-relaxed text-zinc-600">Drag to move (pieces snap to walls) · R / Shift+R to turn · arrows to nudge (Shift for 25 cm) · Ctrl/Cmd+D duplicate · Delete removes · Ctrl/Cmd+Z undo.</p>
        </aside>
      </div>
    </div>
  );
}

import { catalogItem } from './furnitureCatalog';
import { roomsAlong, setSideRange } from './designStyles';

/*
 * Fitted furniture: a modular kitchen or a run of wardrobes laid out in a room from a few choices.
 * Pieces are catalogue modules (base, sink and hob units, tall units, wall cabinets, wardrobes) placed
 * along the room's walls, clear of its doors, with their colours set per part (cabinet body, countertop).
 * Everything made here is marked `fitted: 'kitchen' | 'wardrobe'`, so laying out again replaces it.
 * Plan units: 20 = 1 m. A piece's (left, top) is the middle of its start edge; its back is -y at angle 0.
 */
const U = 20;
const WALL_HALF = 4;

export const CABINET_FINISHES = [
  ['Matte white', '#eeebe5'], ['Warm grey', '#b9b3aa'], ['Sage', '#9fae95'], ['Navy', '#2d3d5a'],
  ['Charcoal', '#3a3a3d'], ['Walnut', '#6a4a35'], ['Light oak', '#c39a6b'], ['Terracotta', '#b7643f'],
];
export const COUNTERTOPS = [
  ['Black granite', '#202022'], ['White quartz', '#f2f1ee'], ['Grey stone', '#8d8c89'], ['Beige marble', '#ddcdb2'], ['Butcher block', '#b27b45'],
];
export const BACKSPLASHES = [
  ['None', null], ['Subway tile', 'mat_subway'], ['Marble', 'mat_marble'], ['White brick', 'clad_whitebrick'],
  ['Slate', 'mat_slate'], ['Terracotta', 'mat_terracotta'], ['Sage paint', '#a8b79c'],
];
export const KITCHEN_LAYOUTS = [
  { id: 'straight', name: 'Straight', desc: 'One run along a wall' },
  { id: 'L', name: 'L-shaped', desc: 'Two walls meeting in a corner' },
  { id: 'parallel', name: 'Parallel', desc: 'Two facing runs, a galley' },
  { id: 'U', name: 'U-shaped', desc: 'Three walls' },
  { id: 'island', name: 'L with island', desc: 'Two walls and an island' },
];
export const WARDROBE_STYLES = [
  { id: 'hinged', name: 'Hinged doors' }, { id: 'sliding', name: 'Sliding doors' }, { id: 'mirror', name: 'Mirrored sliding' },
];
export const WARDROBE_FINISHES = [
  ['Walnut', '#5c3f2b'], ['Light oak', '#c39a6b'], ['Matte white', '#eeebe5'], ['Grey', '#8f8b85'], ['Navy', '#2d3d5a'], ['Charcoal', '#3a3a3d'],
];

const box = (r) => ({ x0: r.left + WALL_HALF, x1: r.left + r.width - WALL_HALF, y0: r.top - r.height / 2 + WALL_HALF, y1: r.top + r.height / 2 - WALL_HALF });
const mid = (o) => { const a = ((o.angle || 0) * Math.PI) / 180; return [o.left + (o.width / 2) * Math.cos(a), o.top + (o.width / 2) * Math.sin(a)]; };
const ANGLE = { N: 0, S: 180, E: 90, W: 270 };

/** Openings on one side of the room, as [from, to] along that side (plan units from its start). */
function openingsOn(side, b, items, pad) {
  return items.map(o => {
    const [mx, my] = mid(o);
    const half = o.width / 2 + pad;
    if ((side === 'N' && Math.abs(my - b.y0) < 12) || (side === 'S' && Math.abs(my - b.y1) < 12)) return mx > b.x0 - 6 && mx < b.x1 + 6 ? [mx - b.x0 - half, mx - b.x0 + half] : null;
    if ((side === 'W' && Math.abs(mx - b.x0) < 12) || (side === 'E' && Math.abs(mx - b.x1) < 12)) return my > b.y0 - 6 && my < b.y1 + 6 ? [my - b.y0 - half, my - b.y0 + half] : null;
    return null;
  }).filter(Boolean);
}
const sideLen = (side, b) => (side === 'N' || side === 'S' ? b.x1 - b.x0 : b.y1 - b.y0);

/** Free stretches [a, b] along a side, between `start` and `end`, avoiding the given gaps. */
function freeSpans(start, end, gaps) {
  let spans = [[start, end]];
  for (const [g0, g1] of gaps) spans = spans.flatMap(([a, c]) => (g1 <= a || g0 >= c ? [[a, c]] : [[a, g0], [g1, c]].filter(([p, q]) => q - p > 1)));
  return spans;
}

/** A module of `type`, w units wide, backed onto `side` at offset `at` (its centre) along that side. */
function module(type, side, b, at, w, extra = {}) {
  const it = catalogItem(type);
  const d = Math.round(it.d * U);
  const [cx, cy] = side === 'N' ? [b.x0 + at, b.y0 + d / 2] : side === 'S' ? [b.x0 + at, b.y1 - d / 2]
    : side === 'W' ? [b.x0 + d / 2, b.y0 + at] : [b.x1 - d / 2, b.y0 + at];
  const a = ANGLE[side], r = (a * Math.PI) / 180;
  return { id: `fit_${Math.random().toString(36).slice(2, 9)}`, type, left: Math.round(cx - (w / 2) * Math.cos(r)), top: Math.round(cy - (w / 2) * Math.sin(r)), width: w, height: d, angle: a, ...extra };
}

/** The walls of a room by side, ranked: longest without a door first. */
function rankSides(b, doors) {
  return ['N', 'S', 'E', 'W'].map(s => ({ s, len: sideLen(s, b), doors: openingsOn(s, b, doors, 6).length }))
    .sort((p, q) => p.doors - q.doors || q.len - p.len).map(o => o.s);
}
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const ADJ = { N: ['W', 'E'], S: ['W', 'E'], E: ['N', 'S'], W: ['N', 'S'] };

/**
 * A modular kitchen for `room`. opts: { layout, cabinet, counter, backsplash, fridge, tower, dishwasher }.
 * Returns { elements } with the room's old kitchen furniture replaced and the backsplash on the walls.
 */
export function layoutKitchen(elements, room, opts) {
  const f = room.floor || 1;
  const b = box(room);
  const here = elements.filter(e => (e.floor || 1) === f);
  const doors = here.filter(e => e.type === 'door'), windows = here.filter(e => e.type === 'window');
  const inRoom = (e) => { const [x, y] = mid(e); return x > b.x0 - 6 && x < b.x1 + 6 && y > b.y0 - 6 && y < b.y1 + 6; };
  const isKitchenPiece = (e) => e.type?.startsWith('furniture_') && inRoom(e) && (e.fitted === 'kitchen' || e.type === 'furniture_kitchen' || catalogItem(e.type)?.cat === 'kitchen');
  const keep = elements.filter(e => !((e.floor || 1) === f && isKitchenPiece(e)));

  const ranked = rankSides(b, doors);
  const first = ranked[0];
  const adj = ADJ[first].sort((p, q) => openingsOn(p, b, doors, 6).length - openingsOn(q, b, doors, 6).length || sideLen(q, b) - sideLen(p, b))[0];
  const runs = { straight: [first], L: [first, adj], parallel: [first, OPP[first]], U: [first, ADJ[first][0], ADJ[first][1]], island: [first, adj] }[opts.layout] || [first];
  const D = 12;                                     // 60 cm of counter depth
  const pieces = [];
  const splash = [];
  const colours = (kind) => {
    const c = opts.cabinet, t = opts.counter;
    return { base: [c, t], sink: [c, t], hob: [c, t], tall: [c], wall: [c], island: [c, t], tower: [c] }[kind];
  };
  let usedFridge = false, usedTower = false, usedSink = false, usedHob = false, usedDish = false;
  runs.forEach((side, ri) => {
    const len = sideLen(side, b);
    // a run that meets an earlier run in a corner starts after that run's depth
    const corner = (s) => runs.slice(0, ri).some(o => o !== OPP[side] && o !== side && (
      (s === 'start' && ((side === 'N' || side === 'S') ? o === 'W' : o === 'N')) || (s === 'end' && ((side === 'N' || side === 'S') ? o === 'E' : o === 'S'))));
    const start = corner('start') ? D : 0, end = len - (corner('end') ? D : 0);
    const gaps = openingsOn(side, b, doors, 8);
    const wins = openingsOn(side, b, windows, 0);
    freeSpans(start, end, gaps).forEach(([a, c]) => {
      let x = a;
      const room_ = c - a;
      if (room_ < 12) return;
      const put = (type, w, kind, extra = {}) => {
        pieces.push(module(type, side, b, x + w / 2, w, { fitted: 'kitchen', colors: colours(kind), gloss: [0.5, 0.25], ...extra }));
        x += w;
      };
      // tall units at the end of the first run: fridge, then an oven tower
      if (ri === 0 && opts.fridge && !usedFridge && c - x >= 18 + 36) { put('furniture_fridge', 18, 'tall', { colors: undefined }); usedFridge = true; }
      if (ri === 0 && opts.tower && !usedTower && c - x >= 12 + 36) { put('furniture_oven_tower', 12, 'tower'); usedTower = true; }
      // the sink under a window if there is one in this stretch, else the first 90 cm
      const win = wins.find(([w0, w1]) => w0 > x && w1 < c);
      while (c - x >= 12) {
        const here_ = x;
        const underWindow = win && here_ + 18 > (win[0] + win[1]) / 2 - 9 && here_ <= (win[0] + win[1]) / 2;
        if (!usedSink && c - x >= 18 && (underWindow || !win)) { put('furniture_sink_unit', 18, 'sink'); usedSink = true; continue; }
        if (!usedHob && usedSink && c - x >= 18 + 12) {
          const at = x;
          put('furniture_hob_unit', 18, 'hob');
          pieces.push(module('furniture_chimney', side, b, at + 9, 18, { fitted: 'kitchen' }));
          usedHob = true; continue;
        }
        if (opts.dishwasher && !usedDish && usedSink && c - x >= 12) { put('furniture_dishwasher', 12, 'base', { colors: undefined }); usedDish = true; continue; }
        const w = c - x >= 12 ? 12 : c - x;
        put('furniture_base_cabinet', w, 'base');
      }
      // wall cabinets over the counter, except over the hob (chimney) and any window
      const hobs = pieces.filter(p => p.type === 'furniture_chimney');
      for (let y = a; y + 12 <= c; y += 12) {
        const centre = y + 6;
        if (wins.some(([w0, w1]) => centre > w0 - 6 && centre < w1 + 6)) continue;
        if (hobs.some(h => { const [hx, hy] = mid(h); const along = side === 'N' || side === 'S' ? hx - b.x0 : hy - b.y0; return Math.abs(along - centre) < 15; })) continue;
        if (ri === 0 && pieces.some(p => ['furniture_fridge', 'furniture_oven_tower'].includes(p.type) && (() => { const [px, py] = mid(p); const along = side === 'N' || side === 'S' ? px - b.x0 : py - b.y0; return Math.abs(along - centre) < 12; })())) continue;
        pieces.push(module('furniture_wall_cabinet', side, b, centre, 12, { fitted: 'kitchen', colors: colours('wall') }));
      }
      splash.push({ side, from: a, to: c });
    });
  });
  if (opts.layout === 'island' && b.x1 - b.x0 >= 72 && b.y1 - b.y0 >= 72) {
    const along = b.x1 - b.x0 >= b.y1 - b.y0;
    const w = 36, d = 18, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const a = along ? 0 : 90, r = (a * Math.PI) / 180;
    pieces.push({ id: `fit_${Math.random().toString(36).slice(2, 9)}`, type: 'furniture_island', left: Math.round(cx - (w / 2) * Math.cos(r)), top: Math.round(cy - (w / 2) * Math.sin(r)), width: w, height: d, angle: a, fitted: 'kitchen', colors: [opts.cabinet, opts.counter] });
  }
  let out = [...keep, ...pieces.map(p => ({ ...p, floor: f }))];
  // the backsplash: a band from the counter (0.9 m) to under the wall cabinets (1.5 m) on the run walls
  if (opts.backsplash) {
    const isColour = opts.backsplash.startsWith('#');
    out = out.map(w => {
      if (w.type !== 'wall' || (w.floor || 1) !== f) return w;
      let next = w;
      roomsAlong(w, [room]).forEach(seg => {
        const sideOfRoom = (() => {
          const r = box(room);
          const { left, top, angle } = w; const a = ((angle || 0) * Math.PI) / 180;
          const horiz = Math.abs(Math.sin(a)) < 0.01;
          if (horiz) return Math.abs(top - (r.y0 - WALL_HALF)) < 8 ? 'N' : 'S';
          return Math.abs(left - (r.x0 - WALL_HALF)) < 8 ? 'W' : 'E';
        })();
        if (!splash.some(s => s.side === sideOfRoom)) return;
        next = setSideRange(next, seg.side, { material: opts.backsplash, isColor: isColour, from: seg.from, to: seg.to, y0: 0.9, y1: 1.5, fitted: 'kitchen' });
      });
      return next;
    });
  }
  return { elements: out, count: pieces.length };
}

/**
 * Wardrobes along one wall of a bedroom. opts: { style, finish, width ('full' | metres), wall ('auto' | N S E W) }.
 */
export function layoutWardrobe(elements, room, opts) {
  const f = room.floor || 1;
  const b = box(room);
  const here = elements.filter(e => (e.floor || 1) === f);
  const doors = here.filter(e => e.type === 'door'), windows = here.filter(e => e.type === 'window');
  const inRoom = (e) => { const [x, y] = mid(e); return x > b.x0 - 6 && x < b.x1 + 6 && y > b.y0 - 6 && y < b.y1 + 6; };
  const keep = elements.filter(e => !((e.floor || 1) === f && e.type?.startsWith('furniture_') && inRoom(e) && (e.fitted === 'wardrobe' || /wardrobe/.test(e.type))));
  // not the wall the bed's head is against, nor one with a window
  const bed = here.find(e => /furniture_bed/.test(e.type) && inRoom(e));
  const bedSide = bed ? ({ 0: 'N', 180: 'S', 90: 'E', 270: 'W' }[Math.round(((bed.angle || 0) % 360 + 360) % 360)]) : null;
  const sides = ['N', 'S', 'E', 'W'].filter(s => s !== bedSide)
    .map(s => ({ s, len: sideLen(s, b) - openingsOn(s, b, doors, 8).reduce((t, [a, c]) => t + (c - a), 0), win: openingsOn(s, b, windows, 0).length }))
    .sort((p, q) => p.win - q.win || q.len - p.len);
  const side = opts.wall && opts.wall !== 'auto' ? opts.wall : sides[0]?.s;
  if (!side) return { elements, count: 0 };
  const spans = freeSpans(0, sideLen(side, b), [...openingsOn(side, b, doors, 8), ...openingsOn(side, b, windows, 2)]).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  const [a, c] = spans[0] || [0, 0];
  const want = opts.width === 'full' ? c - a : Math.min(c - a, Math.round(Number(opts.width) * U));
  if (want < 18) return { elements, count: 0, why: 'There is no wall long enough for a wardrobe here.' };
  const pieces = [];
  const type = opts.style === 'hinged' ? 'furniture_wardrobe3' : 'furniture_wardrobe_sliding';
  const unit = opts.style === 'hinged' ? 36 : 48;
  const n = Math.max(1, Math.round(want / unit));
  const w = want / n;
  for (let i = 0; i < n; i++) {
    const colors = opts.style === 'mirror' ? [opts.finish, '#dfe8ee'] : opts.style === 'sliding' ? [opts.finish, opts.finish] : [opts.finish];
    pieces.push(module(type, side, b, a + w * i + w / 2, Math.round(w), { fitted: 'wardrobe', colors, gloss: opts.style === 'mirror' ? [0.6, 0.05] : undefined, floor: f }));
  }
  return { elements: [...keep, ...pieces], count: pieces.length, side };
}

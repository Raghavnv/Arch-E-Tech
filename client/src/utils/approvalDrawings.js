import { formatArea, isImperial } from './units';
import { footprint, outline, roofRects } from './roofShape';
import { frontOf } from './facade';

/*
 * The rest of an approval set, after the floor plans (planSheet.js): each an A3 landscape page with the
 * same frame and title block.
 *   site plan      the plot with the road, the house's ground-floor outline set back from each boundary,
 *                  setback dimensions, coverage and FAR, north, and the rainwater tank and solar if planned
 *   elevations     the front (the side with the main door) and one side, drawn from the house's outside
 *                  walls storey by storey (nearer walls drawn over farther ones), with doors, windows,
 *                  balcony railings, plinth, parapet or hipped roof, and floor levels
 *   section A-A    a cut through the stairs: slabs, the walls it cuts (with their doors and windows), the
 *                  stair flight, rooms named, indicative footings, and levels; the cut is marked on the plan
 *   schedules      every door and window grouped into types (D1, W1…) with size, sill and lintel, count,
 *                  where they are, and frame; the same marks are printed beside them on the floor plans
 * Heights follow the 3D model: 3.0 m walls, 3.2 m floor to floor, doors 2.2 m, windows 0.9 to 2.2 m,
 * a 0.45 m plinth and a 0.5 m parapet.
 */
const U = 20;
const PAGE = { w: 420, h: 297 };
const AREA = { x: 22, y: 30, w: 288, h: 240 };
const BLOCK_X = 322;
const SCALES = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
const WALL_H = 3.0, STOREY = 3.2, DOOR_H = 2.2, SILL = 0.9, HEAD = 2.2, PLINTH = 0.45, PARAPET = 0.5, RAIL = 1.05, SLAB = 0.15;
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const FRAMES = { black: 'Black aluminium', white: 'White UPVC', wood: 'Teak wood', grey: 'Grey aluminium', bronze: 'Bronze aluminium' };
const SIDE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };

const FT = 3.28084;
const len = (m) => {
  if (!isImperial()) return `${m.toFixed(2)} m`;
  const inches = Math.round(m * FT * 12);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};
const keyOf = (o) => o.id || `${o.type}_${Math.round(o.left)}_${Math.round(o.top)}_${o.floor || 1}`;
const lvl = (m) => (Math.abs(m) < 0.005 ? '±0.00' : `${m > 0 ? '+' : '-'}${Math.abs(m).toFixed(2)}`);

const lineOf = (e) => {
  const a = ((e.angle || 0) * Math.PI) / 180;
  const x0 = e.left / U, y0 = e.top / U, ux = Math.cos(a), uy = Math.sin(a), L = e.width / U;
  return { x0, y0, x1: x0 + ux * L, y1: y0 + uy * L, ux, uy, L };
};
const box = (r) => ({ x0: r.left / U, x1: (r.left + r.width) / U, y0: (r.top - r.height / 2) / U, y1: (r.top + r.height / 2) / U });
const floorsOf = (els) => [...new Set(els.map(e => e.floor || 1))].sort((a, b) => a - b);
const roomsOn = (els, f, inside = true) => els.filter(e => e.type === 'room' && (e.floor || 1) === f && (!inside || !OUTDOOR.has(e.kind)));
const rectsOf = (rooms) => rooms.map(r => { const b = box(r); return { x: b.x0, z: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 }; });
const pickScale = (wM, hM, w, h) => SCALES.find(s => (wM * 1000) / s <= w && (hM * 1000) / s <= h) || SCALES[SCALES.length - 1];

// ---- the frame and title block -------------------------------------------------------------------
function frame(pdf, { project, title, scale, sheet, notes = [] }) {
  pdf.setDrawColor(40); pdf.setLineWidth(0.5);
  pdf.rect(10, 10, PAGE.w - 20, PAGE.h - 20);
  pdf.line(BLOCK_X - 4, 10, BLOCK_X - 4, PAGE.h - 10);
  let y = 20;
  pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text('ARCH-E-TECH', BLOCK_X, y); y += 9;
  pdf.setFontSize(11); pdf.text(project || 'Untitled project', BLOCK_X, y, { maxWidth: 84 }); y += 7;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  [['Sheet', `${title}${sheet ? ` (${sheet})` : ''}`], ...(scale ? [['Scale', `1:${scale} at A3`]] : []),
   ['Date', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
   ['Units', isImperial() ? 'feet and inches; levels in metres' : 'metres']]
    .forEach(([a, b]) => { pdf.setTextColor(110); pdf.text(a.toUpperCase(), BLOCK_X, y); pdf.setTextColor(25); pdf.text(b, BLOCK_X + 18, y, { maxWidth: 66 }); y += 5; });
  y += 3;
  pdf.setDrawColor(180); pdf.line(BLOCK_X, y, PAGE.w - 14, y); y += 6;
  pdf.setFontSize(7); pdf.setTextColor(60);
  notes.forEach(n => { const lines = pdf.splitTextToSize(n, 84); pdf.text(lines, BLOCK_X, y); y += lines.length * 3.4 + 1.5; });
  pdf.setFontSize(6); pdf.setTextColor(120);
  pdf.text('For planning and discussion. A licensed architect or engineer must check and sign drawings submitted for approval.', BLOCK_X, PAGE.h - 18, { maxWidth: 84 });
  pdf.setTextColor(25);
  return y;
}

function heading(pdf, text, x, y) {
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(25);
  pdf.text(text, x, y);
  pdf.setFont('helvetica', 'normal');
}

// ---- door and window marks -------------------------------------------------------------------------
/** Doors and windows grouped into types: { types: [...], markOf: Map(id -> 'D1') }. */
export function openingTypes(elements) {
  const rooms = elements.filter(e => e.type === 'room');
  const inRoom = (x, y, f) => rooms.find(r => (r.floor || 1) === f && (() => { const b = box(r); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; })());
  const front = frontOf(elements);
  const groups = new Map();
  const markOf = new Map();
  elements.filter(e => e.type === 'door' || e.type === 'window').forEach((o) => {
    const l = lineOf(o), f = o.floor || 1;
    const mx = (l.x0 + l.x1) / 2, my = (l.y0 + l.y1) / 2, nx = -l.uy, ny = l.ux;
    const a = inRoom(mx + nx * 0.6, my + ny * 0.6, f), b = inRoom(mx - nx * 0.6, my - ny * 0.6, f);
    const outside = !a || !b;
    const main = o.type === 'door' && f === 1 && front.x != null && Math.hypot(mx * U - front.x, my * U - front.y) < 4;
    const w = Math.round(l.L * 20) / 20;
    let kind;
    if (o.type === 'door') kind = main ? 'Main entrance door' : outside ? ((a || b) && OUTDOOR.has((a || b).kind) ? 'Door to outdoor space' : 'External door') : 'Internal door';
    else kind = 'Window';
    const frameName = o.type === 'window' ? (FRAMES[o.frame] || 'Aluminium') : main ? 'Solid teak, teak frame' : outside ? 'Hardwood, weatherproof' : 'Flush door, hardwood frame';
    const key = `${o.type}|${kind}|${w}|${frameName}`;
    if (!groups.has(key)) groups.set(key, { type: o.type, kind, w, frame: frameName, h: o.type === 'door' ? DOOR_H : HEAD - SILL, sill: o.type === 'door' ? 0 : SILL, where: new Map(), ids: [] });
    const g = groups.get(key);
    g.ids.push(keyOf(o));
    const place = [a, b].filter(Boolean).map(r => r.name || r.kind).join(' / ') || 'Outside';
    const label = `${place}${f > 1 ? ` (F${f})` : ''}`;
    g.where.set(label, (g.where.get(label) || 0) + 1);
  });
  const sorted = [...groups.values()].sort((p, q) => (p.type === q.type ? 0 : p.type === 'door' ? -1 : 1) || q.w - p.w);
  let d = 0, w = 0;
  sorted.forEach(g => { g.mark = g.type === 'door' ? `D${++d}` : `W${++w}`; g.ids.forEach(id => markOf.set(id, g.mark)); });
  return { types: sorted, markOf };
}

// ---- schedules page -------------------------------------------------------------------------------------
export function drawSchedules(pdf, elements, { project }) {
  const { types } = openingTypes(elements);
  frame(pdf, { project, title: 'Door and window schedule', notes: [
    'Sizes are clear openings. Door heights 2.2 m; window sills 0.9 m and lintels 2.2 m above finished floor level, as in the 3D model.',
    'Marks (D1, W1…) are printed beside each opening on the floor plans.',
  ] });
  let y = AREA.y;
  const cols = [[22, 'MARK'], [36, 'TYPE'], [86, 'SIZE (W × H)'], [122, 'SILL'], [138, 'LINTEL'], [156, 'QTY'], [168, 'FRAME / LEAF'], [218, 'WHERE']];
  const table = (title, list) => {
    heading(pdf, title, 22, y); y += 6;
    pdf.setFontSize(6.5); pdf.setTextColor(110);
    cols.forEach(([x, t]) => pdf.text(t, x, y));
    y += 2; pdf.setDrawColor(160); pdf.line(22, y, 310, y); y += 4;
    pdf.setTextColor(25); pdf.setFontSize(7);
    list.forEach(g => {
      const where = [...g.where.entries()].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', ');
      const lines = pdf.splitTextToSize(where, 90);
      pdf.setFont('helvetica', 'bold'); pdf.text(g.mark, 22, y); pdf.setFont('helvetica', 'normal');
      pdf.text(g.kind, 36, y);
      pdf.text(`${len(g.w)} × ${len(g.h)}`, 86, y);
      pdf.text(g.type === 'door' ? '—' : len(g.sill), 122, y);
      pdf.text(len(g.type === 'door' ? DOOR_H : HEAD), 138, y);
      pdf.text(String(g.ids.length), 156, y);
      pdf.text(g.frame, 168, y, { maxWidth: 48 });
      pdf.text(lines, 218, y);
      y += Math.max(4.5, lines.length * 3.2 + 1.3);
      if (y > PAGE.h - 24) { pdf.addPage('a3', 'landscape'); frame(pdf, { project, title: 'Door and window schedule (continued)' }); y = AREA.y; }
    });
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${list.reduce((s, g) => s + g.ids.length, 0)} in all`, 156, y + 1);
    pdf.setFont('helvetica', 'normal');
    y += 12;
  };
  table('DOORS', types.filter(g => g.type === 'door'));
  table('WINDOWS', types.filter(g => g.type === 'window'));
  return true;
}

// ---- elevations ---------------------------------------------------------------------------------------------
const NORMAL = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const RIGHT = { S: [1, 0], N: [-1, 0], E: [0, -1], W: [0, 1] };     // the viewer's right, seen from that side

/** Everything the viewer on `side` sees, as shapes in elevation coordinates (h along, v up, d depth). */
function elevationShapes(elements, side, roofStyle) {
  const n = NORMAL[side], r = RIGHT[side];
  const H = (x, y) => x * r[0] + y * r[1], D = (x, y) => x * n[0] + y * n[1];
  const floors = floorsOf(elements);
  const shapes = [];
  floors.forEach((f, fi) => {
    const base = (f - 1) * STOREY;
    const isTop = fi === floors.length - 1;
    const rooms = roomsOn(elements, f);
    if (!rooms.length) return;
    const fp = footprint(rectsOf(rooms), 0.115);
    const faces = outline(fp).filter(s => s.out[0] === n[0] && s.out[1] === n[1]);
    const ops = elements.filter(e => (e.type === 'door' || e.type === 'window') && (e.floor || 1) === f).map(o => ({ o, l: lineOf(o) }));
    faces.forEach(s => {
      const [ax, az] = s.a, [bx, bz] = s.b;
      const h0 = Math.min(H(ax, az), H(bx, bz)), h1 = Math.max(H(ax, az), H(bx, bz));
      const top = isTop ? WALL_H + 0.24 + (roofStyle === 'flat' ? PARAPET : 0) : STOREY;
      // openings on this face: parallel to it and on its line
      const openings = ops.filter(({ l }) => {
        const along = Math.abs(l.ux * (bx - ax) + l.uy * (bz - az)) > 0.5 * Math.hypot(bx - ax, bz - az) * Math.hypot(l.ux, l.uy);
        const dist = Math.abs(D((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2) - D(ax, az));
        const hm = H((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2);
        return along && dist < 0.35 && hm > h0 - 0.05 && hm < h1 + 0.05;
      }).map(({ o, l }) => ({ o, h0: Math.min(H(l.x0, l.y0), H(l.x1, l.y1)), h1: Math.max(H(l.x0, l.y0), H(l.x1, l.y1)) }));
      shapes.push({ kind: 'face', d: D(ax, az), h0, h1, v0: base, v1: base + top, openings, base, parapet: isTop && roofStyle === 'flat' });
    });
    // railings of balconies and terraces on this floor, facing the viewer
    elements.filter(e => e.type === 'railing' && (e.floor || 1) === f).forEach(e => {
      const l = lineOf(e);
      if (Math.abs(l.ux * r[0] + l.uy * r[1]) < 0.7) return;           // not facing this way
      shapes.push({ kind: 'rail', d: D(l.x0, l.y0) + 0.01, h0: Math.min(H(l.x0, l.y0), H(l.x1, l.y1)), h1: Math.max(H(l.x0, l.y0), H(l.x1, l.y1)), v0: base, v1: base + RAIL });
    });
    if (isTop && roofStyle === 'pitched') {
      roofRects(footprint(rectsOf(rooms), 0.2)).forEach(rc => {
        const e = 0.35, w = rc.w + 2 * e, dd = rc.d + 2 * e;
        const hh = Math.min(3.4, (Math.min(w, dd) / 2) * 0.55);
        const cx = rc.x + rc.w / 2, cz = rc.z + rc.d / 2;
        const alongLen = Math.abs(r[0]) ? w : dd, across = Math.abs(r[0]) ? dd : w;
        const hc = H(cx, cz), half = alongLen / 2;
        const ridgeHalf = Math.max(0, (alongLen - across) / 2);
        shapes.push({ kind: 'roof', d: D(cx, cz) + across / 2, pts: [[hc - half, base + WALL_H + 0.1], [hc - ridgeHalf, base + WALL_H + 0.1 + hh], [hc + ridgeHalf, base + WALL_H + 0.1 + hh], [hc + half, base + WALL_H + 0.1]] });
      });
    }
  });
  return shapes;
}

export function drawElevation(pdf, elements, { project, side, label, roofStyle = 'flat', facade }) {
  const shapes = elevationShapes(elements, side, roofStyle);
  if (!shapes.length) return false;
  const hs = shapes.flatMap(s => (s.pts ? s.pts.map(p => p[0]) : [s.h0, s.h1]));
  const vs = shapes.flatMap(s => (s.pts ? s.pts.map(p => p[1]) : [s.v1]));
  const h0 = Math.min(...hs), h1 = Math.max(...hs), vTop = Math.max(...vs), vBot = -PLINTH;
  const scale = pickScale(h1 - h0 + 4, vTop - vBot + 2, AREA.w - 40, AREA.h - 40);
  const k = 1000 / scale;
  const ox = AREA.x + 26 + (AREA.w - 40 - (h1 - h0) * k) / 2, gy = AREA.y + (AREA.h + (vTop - vBot) * k) / 2;
  const X = (h) => ox + (h - h0) * k, Y = (v) => gy - (v - vBot) * k;
  frame(pdf, { project, title: `${label} elevation`, scale, notes: [
    `Seen from the ${SIDE_NAME[side]}${label === 'Front' ? ', the side with the main entrance' : ''}. Nearer walls hide those behind.`,
    `Exterior: ${facade?.paint ? 'painted plaster' : 'plastered and painted'}${roofStyle === 'pitched' ? '; hipped tiled roof' : roofStyle === 'flat' ? '; flat RCC roof with a 0.5 m parapet' : ''}.`,
    'Doors 2.2 m high; windows 0.9 m sill to 2.2 m lintel; plinth 0.45 m above ground.',
  ] });
  heading(pdf, `${label.toUpperCase()} ELEVATION (${SIDE_NAME[side].toUpperCase()})`, AREA.x, AREA.y - 6);
  // ground and plinth
  pdf.setDrawColor(30); pdf.setLineWidth(0.6);
  pdf.line(X(h0) - 12, Y(vBot), X(h1) + 12, Y(vBot));
  pdf.setLineWidth(0.15);
  for (let x = X(h0) - 12; x < X(h1) + 12; x += 3) pdf.line(x, Y(vBot), x - 2, Y(vBot) + 2);
  const ground = shapes.filter(s => s.kind === 'face' && s.base === 0);
  if (ground.length) {
    pdf.setFillColor(205, 200, 192); pdf.setDrawColor(40); pdf.setLineWidth(0.25);
    const g0 = Math.min(...ground.map(s => s.h0)), g1 = Math.max(...ground.map(s => s.h1));
    pdf.rect(X(g0), Y(0), (g1 - g0) * k, PLINTH * k, 'FD');
  }
  // far to near
  [...shapes].sort((a, b) => a.d - b.d).forEach(s => {
    if (s.kind === 'roof') {
      pdf.setFillColor(150, 120, 105); pdf.setDrawColor(40); pdf.setLineWidth(0.3);
      const pts = s.pts.map(([h, v]) => [X(h), Y(v)]);
      pdf.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'FD', true);
      return;
    }
    if (s.kind === 'rail') {
      pdf.setDrawColor(40); pdf.setLineWidth(0.25);
      pdf.line(X(s.h0), Y(s.v1), X(s.h1), Y(s.v1));
      pdf.setLineWidth(0.1);
      for (let h = s.h0; h <= s.h1 + 0.001; h += 0.15) pdf.line(X(h), Y(s.v0), X(h), Y(s.v1));
      return;
    }
    pdf.setFillColor(250, 249, 246); pdf.setDrawColor(30); pdf.setLineWidth(0.35);
    pdf.rect(X(s.h0), Y(s.v1), (s.h1 - s.h0) * k, (s.v1 - s.v0) * k, 'FD');
    if (s.parapet) { pdf.setLineWidth(0.15); pdf.line(X(s.h0), Y(s.v1 - PARAPET), X(s.h1), Y(s.v1 - PARAPET)); }
    if (s.base > 0) { pdf.setLineWidth(0.15); pdf.line(X(s.h0), Y(s.base + 0.15), X(s.h1), Y(s.base + 0.15)); }
    s.openings.forEach(({ o, h0: a, h1: b }) => {
      const door = o.type === 'door';
      const v0 = s.base + (door ? 0 : SILL), v1 = s.base + (door ? DOOR_H : HEAD);
      pdf.setFillColor(...(door ? [120, 92, 70] : [196, 214, 228])); pdf.setDrawColor(30); pdf.setLineWidth(0.25);
      pdf.rect(X(a), Y(v1), (b - a) * k, (v1 - v0) * k, 'FD');
      pdf.setLineWidth(0.1);
      if (!door) { pdf.line(X((a + b) / 2), Y(v1), X((a + b) / 2), Y(v0)); pdf.line(X(a) - 0.6, Y(v0), X(b) + 0.6, Y(v0)); }
      else pdf.line(X(b) - 1.2, Y(v0 + 1.05), X(b) - 0.6, Y(v0 + 1.05));
    });
  });
  // levels on the right
  const floors = floorsOf(elements);
  const lx = X(h1) + 8;
  pdf.setFontSize(6.5); pdf.setDrawColor(60); pdf.setLineWidth(0.15);
  const mark = (v, text) => { pdf.line(lx - 3, Y(v), lx + 2, Y(v)); pdf.triangle(lx, Y(v), lx - 1.2, Y(v) - 1.8, lx + 1.2, Y(v) - 1.8, 'S'); pdf.text(`${lvl(v)} ${text}`, lx + 4, Y(v) + 1); };
  mark(-PLINTH, 'Ground level');
  floors.forEach(f => mark((f - 1) * STOREY, f === 1 ? 'Ground floor' : `Floor ${f}`));
  const roofV = (floors.length - 1) * STOREY + WALL_H + 0.24;
  mark(roofV, 'Roof');
  if (vTop - roofV > 0.2) mark(vTop, roofStyle === 'flat' ? 'Parapet' : 'Ridge');
  // overall width
  pdf.setFontSize(7); pdf.setLineWidth(0.15);
  const dy = Y(vBot) + 8;
  pdf.line(X(h0), dy, X(h1), dy);
  [h0, h1].forEach(h => pdf.line(X(h) - 1, dy + 1, X(h) + 1, dy - 1));
  pdf.text(len(h1 - h0), (X(h0) + X(h1)) / 2, dy - 1.2, { align: 'center' });
  return true;
}

// ---- section ------------------------------------------------------------------------------------------------
/** Where the section cuts the plan: through the middle of the stairs, across their run; else mid-house. */
export function sectionLine(elements) {
  const st = elements.find(e => e.type === 'stairs' && !e.arrival);
  const ground = roomsOn(elements, 1);
  if (!ground.length && !st) return null;
  if (st) {
    const l = lineOf(st);
    // cut along the run so the flight shows in profile
    if (Math.abs(l.ux) >= Math.abs(l.uy)) return { axis: 'y', at: (l.y0 + l.y1) / 2 };
    return { axis: 'x', at: (l.x0 + l.x1) / 2 };
  }
  const ys = ground.flatMap(r => { const b = box(r); return [b.y0, b.y1]; });
  return { axis: 'y', at: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export function drawSection(pdf, elements, { project, roofStyle = 'flat' }) {
  const cut = sectionLine(elements);
  if (!cut) return false;
  // positions along the cut and across it
  const along = (x, y) => (cut.axis === 'y' ? x : y), across = (x, y) => (cut.axis === 'y' ? y : x);
  const floors = floorsOf(elements);
  const pieces = [];       // what is drawn: { t: 'slab'|'wall'|'room'|'stair'|'roof', ... }
  floors.forEach((f, fi) => {
    const base = (f - 1) * STOREY, isTop = fi === floors.length - 1;
    const rooms = elements.filter(e => e.type === 'room' && (e.floor || 1) === f).map(r => ({ r, b: box(r) }))
      .filter(({ b }) => (cut.axis === 'y' ? b.y0 < cut.at && b.y1 > cut.at : b.x0 < cut.at && b.x1 > cut.at));
    rooms.forEach(({ r, b }) => {
      const a0 = cut.axis === 'y' ? b.x0 : b.y0, a1 = cut.axis === 'y' ? b.x1 : b.y1;
      pieces.push({ t: 'slab', a0, a1, v0: base - (f === 1 ? PLINTH : SLAB), v1: base, ground: f === 1 });
      if (!OUTDOOR.has(r.kind)) pieces.push({ t: 'slab', a0, a1, v0: base + WALL_H, v1: base + WALL_H + (isTop ? 0.24 : SLAB) });
      pieces.push({ t: 'room', a0, a1, v: base + 1.4, name: r.name || r.kind });
      if (isTop && roofStyle === 'flat' && !OUTDOOR.has(r.kind)) pieces.push({ t: 'top', a0, a1, v: base + WALL_H + 0.24 });
    });
    // walls the cut passes through: walls running across it
    elements.filter(e => e.type === 'wall' && (e.floor || 1) === f).forEach(w => {
      const l = lineOf(w);
      const crosses = cut.axis === 'y' ? Math.abs(l.uy) > 0.7 && Math.min(l.y0, l.y1) < cut.at && Math.max(l.y0, l.y1) > cut.at
        : Math.abs(l.ux) > 0.7 && Math.min(l.x0, l.x1) < cut.at && Math.max(l.x0, l.x1) > cut.at;
      if (!crosses) return;
      const a = along(l.x0, l.y0);
      // an opening in this wall at the cut?
      const op = elements.find(o => (o.type === 'door' || o.type === 'window') && (o.floor || 1) === f && (() => {
        const q = lineOf(o);
        return Math.abs(along(q.x0, q.y0) - a) < 0.2 && Math.min(across(q.x0, q.y0), across(q.x1, q.y1)) < cut.at && Math.max(across(q.x0, q.y0), across(q.x1, q.y1)) > cut.at;
      })());
      pieces.push({ t: 'wall', a, v0: base, v1: base + WALL_H, op: op?.type || null, base, ground: f === 1 });
    });
    // the stair flight from this floor
    elements.filter(e => e.type === 'stairs' && !e.arrival && (e.floor || 1) === f).forEach(st => {
      const l = lineOf(st);
      const w = (st.height || 24) / U;
      const inCut = cut.axis === 'y' ? Math.abs((l.y0 + l.y1) / 2 - cut.at) < w / 2 + 0.05 : Math.abs((l.x0 + l.x1) / 2 - cut.at) < w / 2 + 0.05;
      if (!inCut) return;
      pieces.push({ t: 'stair', a0: along(l.x0, l.y0), a1: along(l.x1, l.y1), v0: base, v1: base + STOREY });
    });
    if (isTop && roofStyle === 'pitched') {
      const rs = rooms.filter(({ r }) => !OUTDOOR.has(r.kind));
      if (rs.length) {
        const a0 = Math.min(...rs.map(({ b }) => (cut.axis === 'y' ? b.x0 : b.y0))) - 0.35, a1 = Math.max(...rs.map(({ b }) => (cut.axis === 'y' ? b.x1 : b.y1))) + 0.35;
        const hh = Math.min(3.4, ((a1 - a0) / 2) * 0.55);
        pieces.push({ t: 'roof', a0, a1, v: base + WALL_H + 0.1, hh });
      }
    }
  });
  if (!pieces.length) return false;
  const as = pieces.flatMap(p => [p.a0 ?? p.a, p.a1 ?? p.a]).filter(Number.isFinite);
  const a0 = Math.min(...as), a1 = Math.max(...as);
  const vTop = Math.max(...pieces.map(p => (p.t === 'roof' ? p.v + p.hh : p.t === 'top' ? p.v + PARAPET : p.v1 ?? p.v)));
  const vBot = -1.8;
  const scale = pickScale(a1 - a0 + 4, vTop - vBot + 2, AREA.w - 40, AREA.h - 36);
  const k = 1000 / scale;
  const ox = AREA.x + 26 + (AREA.w - 40 - (a1 - a0) * k) / 2, gy = AREA.y + (AREA.h + (vTop - vBot) * k) / 2;
  const X = (a) => ox + (a - a0) * k, Y = (v) => gy - (v - vBot) * k;
  frame(pdf, { project, title: 'Section A-A', scale, notes: [
    'Cut through the stairs; the cut is marked A-A on the ground floor plan.',
    'RCC slabs 150 mm (roof 240 mm with waterproofing); walls 230 mm outside, 115 mm inside; 3.2 m floor to floor.',
    'Footings are indicative: isolated RCC footings about 1.5 m deep. Size them from a soil test and a structural design.',
  ] });
  heading(pdf, 'SECTION A-A', AREA.x, AREA.y - 6);
  // ground line
  pdf.setDrawColor(30); pdf.setLineWidth(0.6);
  pdf.line(X(a0) - 10, Y(-PLINTH), X(a1) + 10, Y(-PLINTH));
  pdf.setLineWidth(0.15);
  for (let x = X(a0) - 10; x < X(a1) + 10; x += 3) pdf.line(x, Y(-PLINTH), x - 2, Y(-PLINTH) + 2);
  // slabs
  pieces.filter(p => p.t === 'slab').forEach(p => {
    pdf.setFillColor(...(p.ground ? [200, 194, 184] : [120, 120, 120])); pdf.setDrawColor(30); pdf.setLineWidth(0.2);
    pdf.rect(X(p.a0), Y(p.v1), (p.a1 - p.a0) * k, (p.v1 - p.v0) * k, 'FD');
  });
  // parapets at the ends of a flat roof
  const tops = pieces.filter(p => p.t === 'top');
  if (tops.length) {
    const t0 = Math.min(...tops.map(p => p.a0)), t1 = Math.max(...tops.map(p => p.a1)), v = tops[0].v;
    pdf.setFillColor(120, 120, 120);
    [t0, t1 - 0.115].forEach(a => pdf.rect(X(a), Y(v + PARAPET), 0.115 * k, PARAPET * k, 'FD'));
  }
  // walls cut, with any opening at the cut, and indicative footings under the ground floor
  pieces.filter(p => p.t === 'wall').forEach(p => {
    const t = 0.23, x = X(p.a - t / 2), w = t * k;
    pdf.setFillColor(40, 40, 40); pdf.setDrawColor(30); pdf.setLineWidth(0.15);
    if (!p.op) pdf.rect(x, Y(p.v1), w, (p.v1 - p.v0) * k, 'FD');
    else {
      const lo = p.op === 'door' ? 0 : SILL, hi = p.op === 'door' ? DOOR_H : HEAD;
      if (lo > 0) pdf.rect(x, Y(p.base + lo), w, lo * k, 'FD');
      pdf.rect(x, Y(p.v1), w, (WALL_H - hi) * k, 'FD');
      pdf.setDrawColor(70, 120, 200); pdf.setLineWidth(0.3);
      if (p.op === 'window') pdf.line(x + w / 2, Y(p.base + hi), x + w / 2, Y(p.base + lo));
    }
    if (p.ground) {
      pdf.setDrawColor(90); pdf.setLineWidth(0.15); pdf.setLineDashPattern([1, 0.8], 0);
      pdf.rect(x, Y(-PLINTH), w, (1.5 - PLINTH - 0.3) * k, 'S');
      pdf.rect(X(p.a - 0.6), Y(-1.2), 1.2 * k, 0.3 * k, 'S');
      pdf.setLineDashPattern([], 0);
    }
  });
  // stairs in profile
  pieces.filter(p => p.t === 'stair').forEach(p => {
    const n = 18, run = (p.a1 - p.a0) / n, rise = (p.v1 - p.v0) / n;
    pdf.setDrawColor(30); pdf.setLineWidth(0.25);
    let ax = p.a0, v = p.v0;
    for (let i = 0; i < n; i++) {
      pdf.line(X(ax), Y(v), X(ax), Y(v + rise));
      pdf.line(X(ax), Y(v + rise), X(ax + run), Y(v + rise));
      ax += run; v += rise;
    }
    pdf.setLineWidth(0.15);
    pdf.line(X(p.a0), Y(p.v0 - 0.15), X(p.a1), Y(p.v1 - 0.15));     // the waist slab's underside
  });
  // pitched roof outline
  pieces.filter(p => p.t === 'roof').forEach(p => {
    pdf.setFillColor(150, 120, 105); pdf.setDrawColor(30); pdf.setLineWidth(0.3);
    pdf.triangle(X(p.a0), Y(p.v), X((p.a0 + p.a1) / 2), Y(p.v + p.hh), X(p.a1), Y(p.v), 'FD');
  });
  // room names
  pdf.setFontSize(6.5); pdf.setTextColor(60);
  pieces.filter(p => p.t === 'room' && (p.a1 - p.a0) * k > 12).forEach(p => pdf.text(String(p.name).toUpperCase(), (X(p.a0) + X(p.a1)) / 2, Y(p.v), { align: 'center', maxWidth: (p.a1 - p.a0) * k - 2 }));
  pdf.setTextColor(25);
  // levels
  const lx = X(a1) + 10;
  pdf.setFontSize(6.5); pdf.setDrawColor(60); pdf.setLineWidth(0.15);
  const mark = (v, text) => { pdf.line(lx - 3, Y(v), lx + 2, Y(v)); pdf.triangle(lx, Y(v), lx - 1.2, Y(v) - 1.8, lx + 1.2, Y(v) - 1.8, 'S'); pdf.text(`${lvl(v)} ${text}`, lx + 4, Y(v) + 1); };
  mark(-PLINTH, 'Ground level');
  floors.forEach(f => mark((f - 1) * STOREY, f === 1 ? 'Ground floor' : `Floor ${f}`));
  mark((floors.length - 1) * STOREY + WALL_H + 0.24, 'Roof');
  pdf.text('Footing (indicative)', X(a0) - 4, Y(-1.35), { align: 'right' });
  return true;
}

/** Door and window marks beside each opening on a floor plan page (X/Y map plan units to paper). */
export function markOpenings(pdf, els, X, Y, markOf) {
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5);
  els.filter(e => e.type === 'door' || e.type === 'window').forEach((o) => {
    const mark = markOf.get(keyOf(o));
    if (!mark) return;
    const a = ((o.angle || 0) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
    const mx = o.left + (ux * o.width) / 2, my = o.top + (uy * o.width) / 2;
    const px = X(mx) - uy * 3.2, py = Y(my) + ux * 3.2;
    pdf.setTextColor(...(o.type === 'door' ? [140, 80, 40] : [50, 100, 170]));
    pdf.text(mark, px, py + 0.8, { align: 'center' });
  });
  pdf.setTextColor(25); pdf.setFont('helvetica', 'normal');
}

/** The section line on a floor plan page: called with the plan page's X/Y mapping (plan units). */
export function markSection(pdf, elements, X, Y) {
  const cut = sectionLine(elements);
  const ground = elements.filter(e => (e.floor || 1) === 1 && e.type === 'room');
  if (!cut || !ground.length) return;
  const bs = ground.map(box);
  const lo = cut.axis === 'y' ? Math.min(...bs.map(b => b.x0)) - 1 : Math.min(...bs.map(b => b.y0)) - 1;
  const hi = cut.axis === 'y' ? Math.max(...bs.map(b => b.x1)) + 1 : Math.max(...bs.map(b => b.y1)) + 1;
  const P = (s, t) => (cut.axis === 'y' ? [X(s * U), Y(t * U)] : [X(t * U), Y(s * U)]);
  const [x0, y0] = P(lo, cut.at), [x1, y1] = P(hi, cut.at);
  pdf.setDrawColor(200, 60, 40); pdf.setLineWidth(0.3); pdf.setLineDashPattern([4, 1.2, 0.8, 1.2], 0);
  pdf.line(x0, y0, x1, y1);
  pdf.setLineDashPattern([], 0);
  pdf.setTextColor(200, 60, 40); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
  // arrows show the direction of view: towards north on the plan (−y), or towards +x for a cut along y
  const [dx, dy] = cut.axis === 'y' ? [0, -3] : [3, 0];
  [[x0, y0], [x1, y1]].forEach(([x, y]) => { pdf.line(x, y, x + dx, y + dy); pdf.text('A', x - dy * 0.8 + dx * 1.6, y + dx * 0.8 + dy * 1.6 + 1, { align: 'center' }); });
  pdf.setTextColor(25); pdf.setFont('helvetica', 'normal');
}

// ---- site plan ---------------------------------------------------------------------------------------------
export function drawSitePlan(pdf, elements, { project, site, north = 'up', solar }) {
  const rooms = roomsOn(elements, 1);
  if (!rooms.length) return false;
  const fpRects = rectsOf(roomsOn(elements, 1, false));     // with patios: they need room on the plot too
  const x0 = Math.min(...fpRects.map(r => r.x)), y0 = Math.min(...fpRects.map(r => r.z));
  const x1 = Math.max(...fpRects.map(r => r.x + r.w)), y1 = Math.max(...fpRects.map(r => r.z + r.d));
  // turn the house so its front faces the road, at the bottom of the sheet
  const side = frontOf(elements).side;
  const R = { S: (x, y) => [x, y], N: (x, y) => [-x, -y], E: (x, y) => [-y, x], W: (x, y) => [y, -x] }[side] || ((x, y) => [x, y]);
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => R(x, y));
  const rx0 = Math.min(...corners.map(c => c[0])), ry0 = Math.min(...corners.map(c => c[1]));
  const T = (x, y) => { const [a, b] = R(x, y); return [a - rx0, b - ry0]; };        // house box from (0, 0)
  const hw = Math.max(...corners.map(c => c[0])) - rx0, hd = Math.max(...corners.map(c => c[1])) - ry0;

  const plot = site?.plot_m?.length === 2 ? { w: site.plot_m[0], d: site.plot_m[1] } : null;
  const sb = site?.setbacks_m || { front: 1.5, rear: 1, sides: 1 };
  const pw = plot ? plot.w : hw + sb.sides * 2, pd = plot ? plot.d : hd + sb.front + sb.rear;
  // the house sits at the front setback, centred across the plot's width
  const hx = Math.max(sb.sides, (pw - hw) / 2), hy = pd - sb.front - hd;
  const road = 4;
  const scale = pickScale(pw + 6, pd + road + 6, AREA.w - 30, AREA.h - 30);
  const k = 1000 / scale;
  const ox = AREA.x + 15 + (AREA.w - 30 - pw * k) / 2, oy = AREA.y + 10 + (AREA.h - 30 - (pd + road) * k) / 2;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k;
  const built = elements.filter(e => e.type === 'room' && !OUTDOOR.has(e.kind)).reduce((s, r) => s + (r.width / U) * (r.height / U), 0);
  const groundArea = rooms.reduce((s, r) => s + (r.width / U) * (r.height / U), 0);
  const plotArea = pw * pd;
  const notes = [
    plot ? `Plot ${len(pw)} × ${len(pd)} (${formatArea(site.plot_area_m2 || plotArea)}), road on the ${SIDE_NAME[site.facing] || 'front'}${site.source === 'map' ? `; drawn from the map at ${site.lat}, ${site.lng}, ${(site.neighbours || []).length} buildings around it from OpenStreetMap (heights where known)` : ''}.` : 'Plot size not set: shown with typical setbacks around the house. Generate the house with a plot size to draw the real plot.',
    `Ground coverage ${formatArea(groundArea)}${plot ? ` (${Math.round((groundArea / plotArea) * 100)} % of the plot)` : ''}; built-up area ${formatArea(built)}${plot ? `, FAR ${(built / plotArea).toFixed(2)}` : ''}.`,
    `Setbacks as drawn: front ${len(pd - hy - hd)}, rear ${len(Math.max(0, hy))}, sides ${len(hx)} and ${pw - hx - hw < 0 ? `${len(hx + hw - pw)} over the boundary` : len(pw - hx - hw)}${site?.setbacks_m ? '' : ' (typical values; check your local rules)'}.`,
  ];
  if (solar?.kw) notes.push(`Rooftop solar ${solar.kw} kWp (${solar.panels} panels). Rainwater: ${solar.tank_l ? `${solar.tank_l.toLocaleString('en-IN')} litre storage tank` : 'harvesting'}${solar.pit ? ` and a ${solar.pit} recharge pit` : ''}.`);
  frame(pdf, { project, title: 'Site plan', scale, notes });
  heading(pdf, 'SITE PLAN', AREA.x, AREA.y - 6);
  // road
  pdf.setFillColor(225, 225, 225); pdf.setDrawColor(150); pdf.setLineWidth(0.2);
  pdf.rect(X(-2), Y(pd), (pw + 4) * k, road * k, 'F');
  pdf.setFontSize(9); pdf.setTextColor(120); pdf.text('ROAD', X(pw / 2), Y(pd + road / 2) + 1.5, { align: 'center' });
  // buildings around the plot (from the map), with their heights
  (site?.neighbours || []).forEach(nb => {
    const pts = nb.pts.filter(([x, y]) => x > -40 && x < pw + 40 && y > -40 && y < pd + 2);
    if (pts.length < 3) return;
    const sp = pts.map(([x, y]) => [X(x), Y(y)]);
    pdf.setFillColor(232, 230, 226); pdf.setDrawColor(150); pdf.setLineWidth(0.15);
    pdf.lines(sp.slice(1).map((p, i) => [p[0] - sp[i][0], p[1] - sp[i][1]]), sp[0][0], sp[0][1], [1, 1], 'FD', true);
    const mx = sp.reduce((s, p) => s + p[0], 0) / sp.length, my = sp.reduce((s, p) => s + p[1], 0) / sp.length;
    if (mx > AREA.x && mx < AREA.x + AREA.w && my > AREA.y && my < AREA.y + AREA.h) {
      pdf.setFontSize(5); pdf.setTextColor(130); pdf.text(`${nb.h} m`, mx, my + 1, { align: 'center' }); pdf.setTextColor(25);
    }
  });
  // plot boundary (compound wall): its real shape when drawn on the map
  pdf.setDrawColor(30); pdf.setLineWidth(0.6); pdf.setLineDashPattern(plot ? [] : [2, 1.5], 0);
  if (site?.polygon?.length >= 3) {
    const sp = site.polygon.map(([x, y]) => [X(x), Y(y)]);
    pdf.lines(sp.slice(1).map((p, i) => [p[0] - sp[i][0], p[1] - sp[i][1]]), sp[0][0], sp[0][1], [1, 1], 'S', true);
  } else pdf.rect(X(0), Y(0), pw * k, pd * k, 'S');
  pdf.setLineDashPattern([], 0);
  // setback zone, then the house outline (ground floor rooms, turned)
  pdf.setDrawColor(160); pdf.setLineWidth(0.15); pdf.setLineDashPattern([1, 1], 0);
  pdf.rect(X(sb.sides), Y(sb.rear), (pw - sb.sides * 2) * k, (pd - sb.front - sb.rear) * k, 'S');
  pdf.setLineDashPattern([], 0);
  pdf.setFillColor(215, 208, 196); pdf.setDrawColor(30); pdf.setLineWidth(0.35);
  rooms.forEach(r => {
    const b = box(r);
    const pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => T(x, y));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    pdf.rect(X(hx + Math.min(...xs)), Y(hy + Math.min(...ys)), (Math.max(...xs) - Math.min(...xs)) * k, (Math.max(...ys) - Math.min(...ys)) * k, 'F');
  });
  pdf.setDrawColor(30); pdf.setLineWidth(0.4);
  outline(footprint(rectsOf(rooms))).forEach(({ a, b }) => {
    const [ax, ay] = T(a[0], a[1]), [bx, by] = T(b[0], b[1]);
    pdf.line(X(hx + ax), Y(hy + ay), X(hx + bx), Y(hy + by));
  });
  pdf.setFontSize(8); pdf.setTextColor(25); pdf.setFont('helvetica', 'bold');
  pdf.text('PROPOSED HOUSE', X(hx + hw / 2), Y(hy + hd / 2), { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5);
  pdf.text(`${len(hw)} × ${len(hd)}`, X(hx + hw / 2), Y(hy + hd / 2) + 3.5, { align: 'center' });
  // outdoor ground-floor spaces
  roomsOn(elements, 1, false).filter(r => OUTDOOR.has(r.kind)).forEach(r => {
    const b = box(r);
    const pts = [[b.x0, b.y0], [b.x1, b.y1]].map(([x, y]) => T(x, y));
    pdf.setDrawColor(90); pdf.setLineWidth(0.2); pdf.setLineDashPattern([0.8, 0.8], 0);
    pdf.rect(X(hx + Math.min(pts[0][0], pts[1][0])), Y(hy + Math.min(pts[0][1], pts[1][1])), Math.abs(pts[1][0] - pts[0][0]) * k, Math.abs(pts[1][1] - pts[0][1]) * k, 'S');
    pdf.setLineDashPattern([], 0);
  });
  // gate on the road side
  pdf.setDrawColor(255); pdf.setLineWidth(1.2);
  pdf.line(X(hx + hw / 2 - 1.5), Y(pd), X(hx + hw / 2 + 1.5), Y(pd));
  // rainwater tank and recharge pit, by the rear corner
  if (solar?.tank_l) {
    pdf.setDrawColor(70, 120, 200); pdf.setLineWidth(0.3);
    const ts = Math.max(1.2, Math.min(sb.sides * 0.8, 2.2));
    pdf.rect(X(pw - ts - 0.3), Y(0.3), ts * k, ts * k, 'S');
    pdf.setFontSize(5.5); pdf.setTextColor(70, 120, 200);
    pdf.text('RWH TANK', X(pw - ts / 2 - 0.3), Y(0.3 + ts / 2) + 1, { align: 'center' });
    if (solar.pit) { pdf.circle(X(0.3 + ts / 2), Y(0.3 + ts / 2), (ts / 2) * k, 'S'); pdf.text('PIT', X(0.3 + ts / 2), Y(0.3 + ts / 2) + 1, { align: 'center' }); }
    pdf.setTextColor(25);
  }
  // setback dimensions
  pdf.setDrawColor(200, 60, 40); pdf.setTextColor(200, 60, 40); pdf.setLineWidth(0.15); pdf.setFontSize(6);
  const dim = (xa, ya, xb, yb, text, dx = 1.5, dy = 0) => { pdf.line(X(xa), Y(ya), X(xb), Y(yb)); pdf.text(text, (X(xa) + X(xb)) / 2 + dx, (Y(ya) + Y(yb)) / 2 + dy); };
  const midX = hx + hw * 0.25, midY = hy + hd * 0.5;
  dim(midX, hy + hd, midX, pd, len(pd - hy - hd));
  dim(midX, 0, midX, hy, len(hy));
  dim(0, midY, hx, midY, len(hx), -3, -1);
  dim(hx + hw, midY, pw, midY, len(pw - hx - hw), -3, -1);
  pdf.setTextColor(25);
  // north arrow: north on the plan, turned with the house
  const nv = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }[north] || [0, -1];
  const [nx, ny] = R(nv[0], nv[1]);
  const cx = AREA.x + AREA.w - 10, cy = AREA.y + 8, rr = 5;
  pdf.setDrawColor(30); pdf.setLineWidth(0.3); pdf.circle(cx, cy, rr, 'S');
  pdf.setFillColor(30, 30, 30);
  const px = -ny, py = nx;
  pdf.triangle(cx + nx * (rr - 0.5), cy + ny * (rr - 0.5), cx - nx * 2 + px * 2, cy - ny * 2 + py * 2, cx - nx * 2 - px * 2, cy - ny * 2 - py * 2, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text('N', cx + nx * (rr + 2.5), cy + ny * (rr + 2.5) + 1, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  return true;
}

// ---- the extra pages, in order --------------------------------------------------------------------------
/** Site plan, front and side elevations, section and schedules, each on its own A3 page. */
export function addApprovalPages(pdf, elements, opts) {
  const front = frontOf(elements).side;
  const sideOf = { S: 'E', N: 'W', E: 'N', W: 'S' }[front] || 'E';
  const pages = [
    () => drawSitePlan(pdf, elements, opts),
    () => drawElevation(pdf, elements, { ...opts, side: front, label: 'Front' }),
    () => drawElevation(pdf, elements, { ...opts, side: sideOf, label: 'Side' }),
    () => drawSection(pdf, elements, opts),
    () => drawSchedules(pdf, elements, opts),
  ];
  let added = 0;
  for (const draw of pages) {
    pdf.addPage('a3', 'landscape');
    if (draw()) added += 1; else pdf.deletePage(pdf.getNumberOfPages());
  }
  return added;
}

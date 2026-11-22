import { jsPDF } from 'jspdf';
import { formatArea, isImperial } from './units';

/*
 * A dimensioned plan sheet: A3 landscape, one page per floor, drawn as vectors (not a screenshot) at a
 * standard scale. Walls are filled, doors show their swing, windows their glazing; rooms carry their name,
 * size and area; overall and wall-by-wall dimension chains run along the top and left; a north arrow,
 * scale bar, title block and room schedule complete the sheet.
 */
const U = 20;                                      // plan units per metre
const PAGE = { w: 420, h: 297 };                  // A3 landscape, mm
const PLAN = { x: 22, y: 26, w: 288, h: 250 };    // drawing area, mm (leaves room for dimensions)
const BLOCK_X = 322;                               // title block column
const SCALES = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
const FT = 3.28084;
const ROOM_TINT = {
  living: [250, 243, 228], dining: [250, 240, 222], lounge: [248, 244, 232], kitchen: [250, 233, 220],
  master_bedroom: [230, 238, 248], bedroom: [234, 241, 249], bathroom: [228, 242, 244], balcony: [235, 245, 230],
  study: [236, 244, 234], utility: [243, 238, 230], closet: [244, 236, 226], hallway: [244, 244, 244],
};

const len = (m) => {
  if (!isImperial()) return `${m.toFixed(2)}`;
  const inches = Math.round(m * FT * 12);
  return `${Math.floor(inches / 12)}'-${inches % 12}"`;
};

function lineFrame(e) {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return { x: e.left, y: e.top, ux: Math.cos(a), uy: Math.sin(a), l: e.width, t: e.height || 8 };
}

function corners(f, thick = f.t) {
  const nx = -f.uy, ny = f.ux, h = thick / 2;
  const ex = f.x + f.ux * f.l, ey = f.y + f.uy * f.l;
  return [[f.x + nx * h, f.y + ny * h], [ex + nx * h, ey + ny * h], [ex - nx * h, ey - ny * h], [f.x - nx * h, f.y - ny * h]];
}

function extents(els) {
  const xs = [], ys = [];
  for (const e of els) {
    if (e.type === 'room') { xs.push(e.left, e.left + e.width); ys.push(e.top - e.height / 2, e.top + e.height / 2); continue; }
    if (!['wall', 'door', 'window', 'stairs', 'railing'].includes(e.type)) continue;
    const f = lineFrame(e);
    xs.push(f.x, f.x + f.ux * f.l); ys.push(f.y, f.y + f.uy * f.l);
  }
  return xs.length ? { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } : null;
}

function drawFloor(pdf, els, { project, floor, floors, north, site, title = 'plan' }) {
  const ext = extents(els);
  if (!ext) return null;
  const wM = (ext.x1 - ext.x0) / U, dM = (ext.y1 - ext.y0) / U;
  const scale = SCALES.find(s => (wM * 1000) / s <= PLAN.w - 24 && (dM * 1000) / s <= PLAN.h - 24) || SCALES[SCALES.length - 1];
  const k = 1000 / scale / U;                       // mm on paper per plan unit
  const ox = PLAN.x + 12 + (PLAN.w - 24 - (ext.x1 - ext.x0) * k) / 2;
  const oy = PLAN.y + 12 + (PLAN.h - 24 - (ext.y1 - ext.y0) * k) / 2;
  const X = (x) => ox + (x - ext.x0) * k;
  const Y = (y) => oy + (y - ext.y0) * k;
  const poly = (pts, style) => {
    const [p0, ...rest] = pts.map(([x, y]) => [X(x), Y(y)]);
    const deltas = rest.map((p, i) => [p[0] - (i ? rest[i - 1][0] : p0[0]), p[1] - (i ? rest[i - 1][1] : p0[1])]);
    pdf.lines(deltas, p0[0], p0[1], [1, 1], style, true);
  };

  // sheet frame
  pdf.setDrawColor(40); pdf.setLineWidth(0.5);
  pdf.rect(10, 10, PAGE.w - 20, PAGE.h - 20);
  pdf.line(BLOCK_X - 4, 10, BLOCK_X - 4, PAGE.h - 10);

  // rooms: tint, then labels after the walls
  const rooms = els.filter(e => e.type === 'room');
  for (const r of rooms) {
    pdf.setFillColor(...(ROOM_TINT[r.kind] || [246, 246, 246]));
    pdf.rect(X(r.left), Y(r.top - r.height / 2), r.width * k, r.height * k, 'F');
  }
  // furniture and stairs, thin
  pdf.setDrawColor(150); pdf.setLineWidth(0.15);
  for (const e of els) {
    if (e.type?.startsWith('furniture_')) poly(corners(lineFrame(e)), 'S');
    if (e.type === 'stairs') {
      const f = lineFrame(e); f.t = e.height || 24;
      poly(corners(f), 'S');
      const steps = Math.max(2, Math.floor(f.l / U / 0.28));
      for (let i = 1; i < steps; i++) {
        const px = f.x + f.ux * f.l * i / steps, py = f.y + f.uy * f.l * i / steps;
        pdf.line(X(px - f.uy * -f.t / 2), Y(py + f.ux * -f.t / 2), X(px - f.uy * f.t / 2), Y(py + f.ux * f.t / 2));
      }
    }
  }
  // walls, solid
  pdf.setFillColor(35, 35, 35); pdf.setDrawColor(35, 35, 35); pdf.setLineWidth(0.1);
  for (const w of els.filter(e => e.type === 'wall')) poly(corners(lineFrame(w)), 'FD');
  // windows: clear the wall, draw the frame and glass
  for (const w of els.filter(e => e.type === 'window')) {
    const f = lineFrame(w);
    pdf.setFillColor(255, 255, 255); poly(corners(f, 9), 'F');
    pdf.setDrawColor(35); pdf.setLineWidth(0.2); poly(corners(f, 9), 'S');
    pdf.setDrawColor(70, 120, 200); pdf.setLineWidth(0.35);
    pdf.line(X(f.x), Y(f.y), X(f.x + f.ux * f.l), Y(f.y + f.uy * f.l));
  }
  // doors: clear the opening, draw the leaf and its swing
  for (const d of els.filter(e => e.type === 'door')) {
    const f = lineFrame(d);
    pdf.setFillColor(255, 255, 255); poly(corners(f, 9), 'F');
    const side = (d.swing || 1) > 0 ? 1 : -1;
    const atEnd = (d.hinge || 1) < 0;
    const hx = atEnd ? f.x + f.ux * f.l : f.x, hy = atEnd ? f.y + f.uy * f.l : f.y;
    const ax = atEnd ? -f.ux : f.ux, ay = atEnd ? -f.uy : f.uy;
    const lx = -f.uy * side, ly = f.ux * side;
    pdf.setDrawColor(35); pdf.setLineWidth(0.25);
    pdf.line(X(hx), Y(hy), X(hx + lx * f.l), Y(hy + ly * f.l));
    pdf.setLineWidth(0.12);
    const a0 = Math.atan2(ay, ax), a1 = Math.atan2(ly, lx);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    let px = hx + Math.cos(a0) * f.l, py = hy + Math.sin(a0) * f.l;
    for (let i = 1; i <= 12; i++) {
      const a = a0 + (da * i) / 12;
      const nx = hx + Math.cos(a) * f.l, ny = hy + Math.sin(a) * f.l;
      pdf.line(X(px), Y(py), X(nx), Y(ny));
      px = nx; py = ny;
    }
  }
  // room labels
  pdf.setTextColor(25);
  for (const r of rooms) {
    if (r.kind === 'hallway') continue;
    const cx = X(r.left + r.width / 2), cy = Y(r.top);
    const wm = r.width / U, dm = r.height / U;
    const fs = Math.max(5, Math.min(9, Math.min(r.width, r.height) * k * 0.18));
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fs);
    pdf.text((r.name || r.kind).toUpperCase(), cx, cy - fs * 0.25, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fs * 0.8);
    pdf.text(`${len(wm)} × ${len(dm)}`, cx, cy + fs * 0.2, { align: 'center' });
    pdf.text(formatArea(r.area || wm * dm), cx, cy + fs * 0.55, { align: 'center' });
  }

  // dimension chains: every wall line along the top and left, then the overall size
  const walls = els.filter(e => e.type === 'wall');
  const chain = (vals, min) => [...new Set(vals.map(v => Math.round(v)))].sort((a, b) => a - b)
    .filter((v, i, arr) => i === 0 || v - arr[i - 1] >= min);
  const xs = chain(walls.flatMap(w => { const f = lineFrame(w); return Math.abs(f.uy) > 0.5 ? [f.x] : []; }).concat([ext.x0, ext.x1]), U * 0.6);
  const ys = chain(walls.flatMap(w => { const f = lineFrame(w); return Math.abs(f.ux) > 0.5 ? [f.y] : []; }).concat([ext.y0, ext.y1]), U * 0.6);
  pdf.setDrawColor(60); pdf.setLineWidth(0.15); pdf.setFont('helvetica', 'normal');
  const tick = (x, y) => pdf.line(x - 1, y + 1, x + 1, y - 1);
  const top1 = Y(ext.y0) - 6, top2 = Y(ext.y0) - 12;
  const left1 = X(ext.x0) - 6, left2 = X(ext.x0) - 12;
  pdf.setFontSize(5.5);
  pdf.line(X(xs[0]), top1, X(xs[xs.length - 1]), top1);
  xs.forEach((v, i) => { tick(X(v), top1); if (i) pdf.text(len((v - xs[i - 1]) / U), (X(v) + X(xs[i - 1])) / 2, top1 - 1, { align: 'center' }); });
  pdf.line(left1, Y(ys[0]), left1, Y(ys[ys.length - 1]));
  ys.forEach((v, i) => { tick(left1, Y(v)); if (i) pdf.text(len((v - ys[i - 1]) / U), left1 - 1, (Y(v) + Y(ys[i - 1])) / 2, { align: 'center', angle: 90 }); });
  pdf.setFontSize(7);
  pdf.line(X(ext.x0), top2, X(ext.x1), top2); tick(X(ext.x0), top2); tick(X(ext.x1), top2);
  pdf.text(len(wM), (X(ext.x0) + X(ext.x1)) / 2, top2 - 1.2, { align: 'center' });
  pdf.line(left2, Y(ext.y0), left2, Y(ext.y1)); tick(left2, Y(ext.y0)); tick(left2, Y(ext.y1));
  pdf.text(len(dM), left2 - 1.2, (Y(ext.y0) + Y(ext.y1)) / 2, { align: 'center', angle: 90 });

  // north arrow (north = which way is up on the plan), scale bar
  const turn = { up: 0, right: 90, down: 180, left: 270 }[north] || 0;
  const nax = PLAN.x + PLAN.w - 8, nay = PLAN.y + 6, r = 5;
  const rot = (dx, dy) => { const a = (turn * Math.PI) / 180; return [nax + dx * Math.cos(a) - dy * Math.sin(a), nay + dx * Math.sin(a) + dy * Math.cos(a)]; };
  pdf.setDrawColor(30); pdf.setLineWidth(0.3); pdf.circle(nax, nay, r, 'S');
  pdf.setFillColor(30, 30, 30);
  const [t1, t2, t3] = [rot(0, -r + 0.5), rot(-2, 2), rot(2, 2)];
  pdf.triangle(t1[0], t1[1], t2[0], t2[1], t3[0], t3[1], 'F');
  const nl = rot(0, -r - 2.5);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text('N', nl[0], nl[1] + 1, { align: 'center' });
  const barM = isImperial() ? 10 / FT : 5;            // 10 ft or 5 m
  const bx = PLAN.x + 4, by = PAGE.h - 16, bl = barM * 1000 / scale;
  pdf.setLineWidth(0.3);
  for (let i = 0; i < 5; i++) {
    pdf.setFillColor(...(i % 2 ? [255, 255, 255] : [30, 30, 30]));
    pdf.rect(bx + (bl / 5) * i, by, bl / 5, 1.6, 'FD');
  }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6);
  pdf.text('0', bx, by - 1, { align: 'center' });
  pdf.text(isImperial() ? '10 ft' : '5 m', bx + bl, by - 1, { align: 'center' });
  pdf.text(`Scale 1:${scale} at A3`, bx + bl + 6, by + 1.4);

  // title block and room schedule
  let y = 20;
  pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text('ARCH-E-TECH', BLOCK_X, y); y += 9;
  pdf.setFontSize(11); pdf.text(project || 'Untitled project', BLOCK_X, y, { maxWidth: 84 }); y += 7;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  const floorLabel = floor === 1 ? 'Ground floor' : `Floor ${floor}`;
  [[`Sheet`, `${floorLabel} ${title} (${floor} of ${floors})`], ['Scale', `1:${scale} at A3`],
   ['Date', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
   ['Units', isImperial() ? 'feet and inches' : 'metres'],
   ...(site?.plot_m ? [['Plot', `${site.plot_m[0]} × ${site.plot_m[1]} m, road ${({ N: 'north', E: 'east', S: 'south', W: 'west' })[site.facing] || ''}`]] : [])]
    .forEach(([a, b]) => { pdf.setTextColor(110); pdf.text(a.toUpperCase(), BLOCK_X, y); pdf.setTextColor(25); pdf.text(b, BLOCK_X + 18, y); y += 5; });
  y += 4;
  pdf.setDrawColor(180); pdf.line(BLOCK_X, y, PAGE.w - 14, y); y += 6;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('ROOM SCHEDULE', BLOCK_X, y); y += 5;
  pdf.setFontSize(7); pdf.setTextColor(110);
  pdf.text('ROOM', BLOCK_X, y); pdf.text('SIZE', BLOCK_X + 42, y); pdf.text('AREA', PAGE.w - 14, y, { align: 'right' }); y += 4;
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(25);
  let total = 0;
  for (const r of rooms.filter(r => r.kind !== 'hallway').sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
    if (y > PAGE.h - 30) { pdf.text('…', BLOCK_X, y); y += 4; break; }
    const a = r.area || (r.width / U) * (r.height / U);
    total += a;
    pdf.text((r.name || r.kind).slice(0, 22), BLOCK_X, y);
    pdf.text(`${len(r.width / U)} × ${len(r.height / U)}`, BLOCK_X + 42, y);
    pdf.text(formatArea(a), PAGE.w - 14, y, { align: 'right' });
    y += 4;
  }
  pdf.setDrawColor(180); pdf.line(BLOCK_X, y - 2, PAGE.w - 14, y - 2); y += 2;
  pdf.setFont('helvetica', 'bold'); pdf.text('Rooms total', BLOCK_X, y); pdf.text(formatArea(total), PAGE.w - 14, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(120);
  pdf.text('Dimensions from wall centre lines. For planning only; check on site before building.', BLOCK_X, PAGE.h - 16, { maxWidth: 84 });
  return { X, Y, scheduleEnd: y };
}

// services symbols: a short code in a coloured circle (electrical warm, plumbing blue)
export const SERVICE_CODES = {
  light: 'L', fan: 'F', switch: 'SW', socket: 'S', power: 'P', ac: 'AC', geyser: 'G', exhaust: 'EX', db: 'DB',
  supply: 'W', drain: 'FT', stack: 'ST',
};
const PLUMBING = new Set(['supply', 'drain', 'stack']);

function drawServices(pdf, map, points, labels, top) {
  for (const p of points) {
    const x = map.X(p.x), y = map.Y(p.y), code = SERVICE_CODES[p.type] || '?';
    const blue = PLUMBING.has(p.type);
    pdf.setFillColor(...(blue ? [225, 238, 252] : [253, 236, 222]));
    pdf.setDrawColor(...(blue ? [40, 100, 190] : [190, 90, 30])); pdf.setLineWidth(0.25);
    if (p.type === 'stack' || p.type === 'db') pdf.rect(x - 1.8, y - 1.3, 3.6, 2.6, 'FD');
    else pdf.circle(x, y, code.length > 1 ? 1.7 : 1.3, 'FD');
    pdf.setTextColor(...(blue ? [30, 70, 150] : [140, 60, 20])); pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(code.length > 1 ? 3.6 : 4.4);
    pdf.text(code, x, y + 0.6, { align: 'center' });
  }
  // legend with counts under the title block
  const counts = {};
  points.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
  let y = Math.max(top, 40) + 6;
  pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('SERVICES ON THIS FLOOR', BLOCK_X, y); y += 5;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
  for (const [type, code] of Object.entries(SERVICE_CODES)) {
    if (!counts[type]) continue;
    pdf.setTextColor(...(PLUMBING.has(type) ? [30, 70, 150] : [140, 60, 20])); pdf.text(code, BLOCK_X, y);
    pdf.setTextColor(25); pdf.text(labels?.[type] || type, BLOCK_X + 9, y);
    pdf.text(String(counts[type]), PAGE.w - 14, y, { align: 'right' });
    y += 4;
  }
}

/** The sheet as a jsPDF document (one A3 page per floor, plus a services page per floor when
 *  services = { points, labels } is given), and how many pages it has. */
export function buildPlanSheet(elements, { project = 'Plan', north = 'up', site = null, services = null } = {}) {
  const floors = [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  let pages = 0;
  floors.forEach((f) => {
    const els = elements.filter(e => (e.floor || 1) === f);
    if (pages) pdf.addPage('a3', 'landscape');
    if (drawFloor(pdf, els, { project, floor: f, floors: floors.length, north, site })) pages += 1;
    else if (pages) pdf.deletePage(pdf.getNumberOfPages());
    const pts = services?.points?.filter(p => p.floor === f) || [];
    if (pts.length) {
      pdf.addPage('a3', 'landscape');
      const map = drawFloor(pdf, els, { project, floor: f, floors: floors.length, north, site, title: 'services' });
      if (map) { drawServices(pdf, map, pts, services.labels, map.scheduleEnd); pages += 1; }
    }
  });
  if (!pages) throw new Error('There is nothing on the plan to draw yet.');
  return { pdf, pages };
}

/** Build the sheet and save it as <project>-plan-sheet.pdf. Returns the number of pages. */
export function downloadPlanSheet(elements, options = {}) {
  const { pdf, pages } = buildPlanSheet(elements, options);
  const safe = (options.project || 'plan').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'plan';
  pdf.save(`${safe}-plan-sheet.pdf`);
  return pages;
}

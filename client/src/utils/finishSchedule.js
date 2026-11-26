import { jsPDF } from 'jspdf';
import { formatArea, formatMoney } from './units';
import { roomsAlong } from './designStyles';
import { ARCHITECTURAL_TEXTURES, WOOD_FINISHES, WALLPAPERS, CLADDING, PAINT_COLOURS, SCANNED_WALLS } from './textureLibrary';
import { FLOOR_BY_ID } from './floorFinishes';
import { CEILING_STYLES, LIGHT_TYPES } from '../components/Ceilings';
import { WINDOW_FRAMES, WINDOW_TREATMENTS } from '../components/Canvas3D';
import { catalogItem } from './furnitureCatalog';

/*
 * A finish schedule: one A4 section per room with what goes on its walls (paint shade or finish and how
 * many square metres), its floor, ceiling design and light, windows (frame, curtains or blinds, fabric),
 * and the furniture in it, each priced; then the whole house's paint by shade in litres and the totals.
 * For the painter, the flooring and false-ceiling contractors and the owner's budget.
 */
const U = 20;
const WALL_H = 3.0;
const PAGE = { w: 210, h: 297, m: 16 };
const PAINT_NAMES = Object.fromEntries(PAINT_COLOURS.flatMap(g => g.colours.map(([n, hex]) => [hex.toLowerCase(), n])));
const FINISH_NAMES = Object.fromEntries([...ARCHITECTURAL_TEXTURES, ...WOOD_FINISHES, ...WALLPAPERS, ...CLADDING].map(t => [t.id, t.name]));
const FABRIC_NAMES = { '#e9e2d4': 'Linen', '#f3eee2': 'Ivory', '#d8c4a2': 'Sand', '#9ea0a3': 'Grey', '#3f3f42': 'Charcoal', '#a8b79c': 'Sage', '#2a3b57': 'Navy', '#9a4a2a': 'Rust', '#c9962e': 'Mustard', '#e3bdb8': 'Blush', '#e6e2da': 'White' };
const FINISH_RATE = { paint: 4, wood: 60, wallpaper: 18, cladding: 45, tile: 35 };     // USD per m2, supplied and fixed
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const hexRgb = (hex) => { const v = parseInt(String(hex).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

/** A paint's name, or the nearest named shade for a custom colour. */
function paintName(hex) {
  const h = String(hex).toLowerCase();
  if (PAINT_NAMES[h]) return `${PAINT_NAMES[h]} (${h.toUpperCase()})`;
  const [r, g, b] = hexRgb(h);
  const near = Object.entries(PAINT_NAMES).map(([k, n]) => { const [r2, g2, b2] = hexRgb(k); return [n, (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2]; }).sort((p, q) => p[1] - q[1])[0];
  return `Shade ${h.toUpperCase()}${near ? `, near ${near[0]}` : ''}`;
}

function describe(f) {
  if (f.isColor) return { name: paintName(f.material), kind: 'paint', swatch: f.material };
  const id = f.material;
  const kind = /^wood_/.test(id) ? 'wood' : /^wp_/.test(id) ? 'wallpaper' : /^clad_/.test(id) ? 'cladding' : 'tile';
  return { name: FINISH_NAMES[id] || SCANNED_WALLS.find(t => t.id === id)?.name || 'Finish', kind, swatch: null };
}

/** What a room's walls carry: [{ name, kind, swatch, m2, band }], from its own side of each wall. */
function roomWalls(room, elements) {
  const out = new Map();
  const doors = elements.filter(e => e.type === 'door' && (e.floor || 1) === (room.floor || 1));
  const wins = elements.filter(e => e.type === 'window' && (e.floor || 1) === (room.floor || 1));
  elements.filter(e => e.type === 'wall' && (e.floor || 1) === (room.floor || 1)).forEach(w => {
    roomsAlong(w, [room]).forEach(seg => {
      listOf(w.sides?.[seg.side]).forEach(f => {
        const from = Math.max(seg.from, f.from ?? 0), to = Math.min(seg.to, f.to ?? 99);
        if (to - from < 0.05) return;
        const band = f.y0 != null || f.y1 != null;
        const h = band ? (f.y1 ?? WALL_H) - (f.y0 ?? 0) : WALL_H;
        const d = describe(f);
        const key = `${d.name}|${band}`;
        const cur = out.get(key) || { ...d, m2: 0, band };
        cur.m2 += (to - from) * h;
        out.set(key, cur);
      });
    });
  });
  // openings come off the painted area (roughly: doors 2.1 m tall, windows 1.2 m)
  const open = doors.length * 1.5 * 2.1 * 0.5 + wins.length * 1.5 * 1.2 * 0.5;
  const paint = [...out.values()].filter(f => !f.band).sort((a, b) => b.m2 - a.m2)[0];
  if (paint) paint.m2 = Math.max(0, paint.m2 - open);
  return [...out.values()];
}

function roomWindows(room, elements) {
  const b = { x0: room.left, x1: room.left + room.width, y0: room.top - room.height / 2, y1: room.top + room.height / 2 };
  return elements.filter(e => e.type === 'window' && (e.floor || 1) === (room.floor || 1)).filter(w => {
    const a = ((w.angle || 0) * Math.PI) / 180, mx = w.left + (w.width / 2) * Math.cos(a), my = w.top + (w.width / 2) * Math.sin(a);
    return ((Math.abs(my - b.y0) < 8 || Math.abs(my - b.y1) < 8) && mx > b.x0 && mx < b.x1) || ((Math.abs(mx - b.x0) < 8 || Math.abs(mx - b.x1) < 8) && my > b.y0 && my < b.y1);
  });
}

function roomFurniture(room, elements) {
  const b = { x0: room.left, x1: room.left + room.width, y0: room.top - room.height / 2, y1: room.top + room.height / 2 };
  const counts = new Map();
  elements.filter(e => (e.floor || 1) === (room.floor || 1) && e.type?.startsWith('furniture_')).forEach(e => {
    const a = ((e.angle || 0) * Math.PI) / 180, cx = e.left + (e.width / 2) * Math.cos(a), cy = e.top + (e.width / 2) * Math.sin(a);
    if (cx < b.x0 || cx > b.x1 || cy < b.y0 || cy > b.y1) return;
    const it = catalogItem(e.type);
    const name = it?.name || e.type.replace('furniture_', '').replace(/_/g, ' ');
    const c = counts.get(name) || { name, n: 0, price: it?.price || 300 };
    c.n += 1; counts.set(name, c);
  });
  return [...counts.values()];
}

export function buildFinishSchedule(elements, { project = 'House' } = {}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = PAGE.m;
  const need = (h) => { if (y + h > PAGE.h - PAGE.m) { pdf.addPage(); y = PAGE.m; } };
  const text = (s, x, size = 9, style = 'normal', color = [30, 30, 30]) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.setTextColor(...color); pdf.text(String(s), x, y); };
  const money = (usd) => formatMoney(usd).replace('₹', 'Rs ');     // the PDF's base font has no rupee sign
  const swatch = (hex, x) => { if (!hex) return; pdf.setFillColor(...hexRgb(hex)); pdf.setDrawColor(150); pdf.rect(x, y - 3, 4, 4, 'FD'); };

  // cover
  text('Finish schedule', PAGE.m, 20, 'bold'); y += 8;
  text(project, PAGE.m, 12, 'normal', [90, 90, 90]); y += 6;
  text(new Date().toLocaleDateString(), PAGE.m, 9, 'normal', [120, 120, 120]); y += 10;

  const rooms = elements.filter(e => e.type === 'room' && e.kind !== 'hallway').sort((a, b) => (a.floor || 1) - (b.floor || 1));
  const paintTotals = new Map();
  const totals = { walls: 0, floors: 0, ceilings: 0, lights: 0, windows: 0, furniture: 0 };

  rooms.forEach(room => {
    const walls = roomWalls(room, elements), wins = roomWindows(room, elements), furn = roomFurniture(room, elements);
    const m2 = (room.width / U) * (room.height / U);
    need(30);
    pdf.setDrawColor(200); pdf.line(PAGE.m, y - 4, PAGE.w - PAGE.m, y - 4);
    y += 2;
    text(room.name || room.kind, PAGE.m, 12, 'bold');
    text(`${formatArea(m2)}${(room.floor || 1) > 1 ? ` · floor ${room.floor}` : ''}`, PAGE.w - PAGE.m - 40, 9, 'normal', [110, 110, 110]);
    y += 6;
    let sub = 0;
    const row = (label, value, cost, hex = null) => {
      need(6);
      text(label, PAGE.m, 8.5, 'bold', [100, 100, 100]);
      swatch(hex, PAGE.m + 26);
      text(value, PAGE.m + (hex ? 32 : 26), 9);
      if (cost) { text(money(cost), PAGE.w - PAGE.m - 28, 9); sub += cost; }
      y += 5.2;
    };
    walls.forEach(f => {
      const cost = f.m2 * FINISH_RATE[f.kind];
      totals.walls += cost;
      if (f.kind === 'paint') paintTotals.set(f.name, { m2: (paintTotals.get(f.name)?.m2 || 0) + f.m2, hex: f.swatch });
      row(f.band ? 'Backsplash' : 'Walls', `${f.name}, ${f.m2.toFixed(1)} m²`, cost, f.swatch);
    });
    if (!walls.length) row('Walls', 'Not chosen (plain white)', 0);
    const fl = room.flooring && FLOOR_BY_ID[room.flooring];
    if (fl) { const c = m2 * fl.price; totals.floors += c; row('Floor', `${fl.name}, ${m2.toFixed(1)} m²`, c, fl.color); } else row('Floor', 'Standard', 0);
    if (room.ceiling) {
      const st = CEILING_STYLES.find(s => s.id === room.ceiling.style), li = LIGHT_TYPES.find(l => l.id === room.ceiling.light);
      const cc = (st?.rate || 0) * m2; totals.ceilings += cc;
      row('Ceiling', `${st?.name || 'Plain'}${st?.rate ? `, ${m2.toFixed(1)} m²` : ''}`, cc, room.ceiling.color);
      if (li && li.id !== 'none') { totals.lights += li.price; row('Light', li.name, li.price); }
    }
    if (wins.length) {
      const w0 = wins[0];
      const tr = WINDOW_TREATMENTS.find(t => t.id === w0.treatment);
      const c = wins.reduce((s, w) => s + (WINDOW_TREATMENTS.find(t => t.id === w.treatment)?.price || 0), 0);
      totals.windows += c;
      row('Windows', `${wins.length} × ${(WINDOW_FRAMES[w0.frame] || WINDOW_FRAMES.black).name}${tr && tr.id !== 'none' ? `, ${tr.name.toLowerCase()} in ${FABRIC_NAMES[w0.fabric] || 'fabric'}` : ''}`, c, w0.treatment && w0.treatment !== 'none' ? w0.fabric : null);
    }
    if (furn.length) {
      const c = furn.reduce((s, f) => s + f.n * f.price, 0);
      totals.furniture += c;
      const names = furn.map(f => (f.n > 1 ? `${f.n} × ${f.name}` : f.name)).join(', ');
      const lines = pdf.splitTextToSize(names, PAGE.w - 2 * PAGE.m - 60);
      need(lines.length * 4.5 + 2);
      text('Furniture', PAGE.m, 8.5, 'bold', [100, 100, 100]);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 30, 30);
      pdf.text(lines, PAGE.m + 26, y);
      text(money(c), PAGE.w - PAGE.m - 28, 9);
      sub += c;
      y += lines.length * 4.5 + 1;
    }
    need(7);
    text('Room total', PAGE.m + 26, 9, 'bold');
    text(money(sub), PAGE.w - PAGE.m - 28, 9, 'bold');
    y += 9;
  });

  // paint by shade, then totals
  pdf.addPage(); y = PAGE.m;
  text('Paint by shade', PAGE.m, 14, 'bold'); y += 8;
  text('Two coats at about 11 m² a litre; buy 10 % over.', PAGE.m, 8.5, 'normal', [110, 110, 110]); y += 7;
  [...paintTotals.entries()].sort((a, b) => b[1].m2 - a[1].m2).forEach(([name, v]) => {
    need(6);
    swatch(v.hex, PAGE.m);
    text(name, PAGE.m + 7, 9);
    text(`${v.m2.toFixed(1)} m²`, PAGE.m + 100, 9);
    text(`${Math.ceil((v.m2 * 2 / 11) * 1.1)} L`, PAGE.m + 135, 9, 'bold');
    y += 5.5;
  });
  y += 8;
  text('Totals', PAGE.m, 14, 'bold'); y += 8;
  const all = Object.values(totals).reduce((s, v) => s + v, 0);
  [['Wall finishes', totals.walls], ['Floors', totals.floors], ['False ceilings', totals.ceilings], ['Light fittings', totals.lights], ['Curtains and blinds', totals.windows], ['Furniture', totals.furniture]]
    .forEach(([label, v]) => { text(label, PAGE.m, 10); text(money(v), PAGE.m + 100, 10); y += 6; });
  y += 2; pdf.setDrawColor(150); pdf.line(PAGE.m, y - 4, PAGE.m + 140, y - 4);
  text('All finishes and furniture', PAGE.m, 11, 'bold'); text(money(all), PAGE.m + 100, 11, 'bold'); y += 10;
  text('Indicative supply-and-fix prices; get quotes from your contractors.', PAGE.m, 8, 'italic', [120, 120, 120]);
  return pdf;
}

export function downloadFinishSchedule(elements, options = {}) {
  const pdf = buildFinishSchedule(elements, options);
  pdf.save(`${(options.project || 'house').replace(/[^\w-]+/g, '_')}_finish_schedule.pdf`);
}

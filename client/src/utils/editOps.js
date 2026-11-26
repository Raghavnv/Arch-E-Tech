import { PAINT_COLOURS, WOOD_FINISHES, WALLPAPERS, CLADDING, ARCHITECTURAL_TEXTURES } from './textureLibrary';
import { FLOOR_FINISHES } from './floorFinishes';
import { CEILING_STYLES, LIGHT_TYPES } from '../components/Ceilings';
import { WINDOW_FRAMES, WINDOW_TREATMENTS } from '../components/Canvas3D';
import { DESIGN_STYLES, applyDesignStyle, roomsAlong, setSideRange } from './designStyles';

/*
 * AI Edit, the Studio's half. The server changes the plan's shape (walls, rooms, doors, windows, furniture)
 * and answers finishes as "client ops", which are applied here with the same tools the finishes panel uses:
 *   paint_walls   { rooms: [ids] | 'all', material, isColor, feature }   every inside face of those rooms, or one accent wall
 *   set_floor     { rooms, finish }                set_ceiling { rooms, style?, light? }
 *   set_windows   { rooms, frame?, treatment?, fabric? }   apply_style { style }   set_exterior { paint?, roof?, roofStyle?, railing? }
 * The catalogue sent with each request lets people ask for any of these by name ("sage", "herringbone oak", "cove ceiling").
 */
const U = 20;

export function editCatalog() {
  return {
    paints: PAINT_COLOURS.flatMap(g => g.colours.map(([name, hex]) => [name, hex])),
    wall_finishes: [...WOOD_FINISHES, ...WALLPAPERS, ...CLADDING, ...ARCHITECTURAL_TEXTURES].map(f => [f.id, f.name]),
    floors: FLOOR_FINISHES.map(f => [f.id, f.name]),
    ceilings: CEILING_STYLES.map(c => [c.id, c.name]),
    lights: LIGHT_TYPES.map(l => [l.id, l.name]),
    frames: Object.entries(WINDOW_FRAMES).map(([id, f]) => [id, f.name]),
    treatments: WINDOW_TREATMENTS.map(t => [t.id, t.name]),
    styles: DESIGN_STYLES.map(s => [s.id, s.name]),
  };
}

const box = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);

function windowRoom(w, rooms) {
  const a = ((w.angle || 0) * Math.PI) / 180, mx = w.left + (w.width / 2) * Math.cos(a), my = w.top + (w.width / 2) * Math.sin(a);
  return rooms.find(r => {
    if ((r.floor || 1) !== (w.floor || 1)) return false;
    const b = box(r);
    return ((Math.abs(my - b.y0) < 8 || Math.abs(my - b.y1) < 8) && mx > b.x0 && mx < b.x1) || ((Math.abs(mx - b.x0) < 8 || Math.abs(mx - b.x1) < 8) && my > b.y0 && my < b.y1);
  });
}

/** The plan with the finish ops applied, and the exterior changes (for the front elevation) pulled out. */
export function applyClientOps(elements, ops) {
  let els = elements;
  let exterior = null;
  for (const op of ops || []) {
    const rooms = els.filter(e => e.type === 'room');
    const picked = op.rooms === 'all' || !op.rooms ? rooms.filter(r => !OUTDOOR.has(r.kind)) : rooms.filter(r => op.rooms.includes(r.id));
    const ids = new Set(picked.map(r => r.id));
    if (op.do === 'paint_walls' && op.material) {
      const finish = { material: op.material, isColor: !!op.isColor };
      if (op.feature) {
        // one accent wall per room: its longest stretch of wall, preferring one with no window
        const plan = new Map();
        for (const r of picked) {
          let best = null;
          els.filter(w => w.type === 'wall' && (w.floor || 1) === (r.floor || 1)).forEach(w => {
            roomsAlong(w, [r]).forEach(seg => {
              const L = seg.to - seg.from;
              if (!best || L > best.L) best = { id: w.id, seg, L };
            });
          });
          if (best) plan.set(best.id, [...(plan.get(best.id) || []), best.seg]);
        }
        els = els.map(w => (plan.has(w.id) ? plan.get(w.id).reduce((acc, seg) => setSideRange(acc, seg.side, { ...finish, from: seg.from, to: seg.to }), w) : w));
      } else {
        els = els.map(w => {
          if (w.type !== 'wall') return w;
          const segs = roomsAlong(w, picked.filter(r => (r.floor || 1) === (w.floor || 1)));
          return segs.reduce((acc, seg) => setSideRange(acc, seg.side, { ...finish, from: seg.from, to: seg.to }), w);
        });
      }
    } else if (op.do === 'set_floor' && op.finish) {
      els = els.map(e => (ids.has(e.id) ? { ...e, flooring: op.finish } : e));
    } else if (op.do === 'set_ceiling') {
      els = els.map(e => {
        if (!ids.has(e.id) || OUTDOOR.has(e.kind)) return e;
        const now = e.ceiling || { style: 'plain', light: 'flush', color: '#f3f1ed' };
        return { ...e, ceiling: { ...now, ...(op.style ? { style: op.style } : {}), ...(op.light ? { light: op.light } : {}) } };
      });
    } else if (op.do === 'set_windows') {
      const patch = {};
      if (op.frame) patch.frame = op.frame;
      if (op.treatment) patch.treatment = op.treatment;
      if (op.fabric) patch.fabric = op.fabric;
      els = els.map(w => (w.type === 'window' && ids.has(windowRoom(w, picked)?.id) ? { ...w, ...patch } : w));
    } else if (op.do === 'apply_style') {
      const style = DESIGN_STYLES.find(s => s.id === op.style);
      if (style) els = applyDesignStyle(els, style).elements;
    } else if (op.do === 'set_exterior') {
      exterior = { ...(exterior || {}) };
      if (op.paint) exterior.paint = op.paint;
      if (op.roof) exterior.roof = op.roof;
      if (op.roofStyle) exterior.roofStyle = op.roofStyle;
      if (op.railing) exterior.railing = op.railing;
    }
  }
  return { elements: els, exterior };
}

export const roomSizeText = (r) => `${(r.width / U).toFixed(1)} × ${(r.height / U).toFixed(1)} m`;

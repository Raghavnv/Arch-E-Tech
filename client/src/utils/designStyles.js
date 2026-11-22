import { catalogItem } from './furnitureCatalog';

/*
 * "Design my house": a whole interior style in one click. A style gives every room its wall colour
 * (painted on that room's side of each wall, over that room's stretch only), a feature wall in the main
 * rooms, an exterior colour, floors, a ceiling design and light, and a few decor pieces placed where they
 * fit (a rug, plants, a floor lamp, wall art). Everything it adds is marked `decor: true` / `styled: true`
 * so applying another style replaces it rather than piling up. Plain JS on plan elements (20 units = 1 m).
 */
const U = 20;

const fin = (material, isColor = true) => ({ material, isColor });

export const DESIGN_STYLES = [
  {
    id: 'modern', name: 'Modern minimal', desc: 'Warm whites, oak, black accents, clean false ceilings',
    swatch: ['#f4f2ee', '#c8c3ba', '#b98a5b', '#222'],
    exterior: '#efede8',
    walls: { default: '#f4f2ee', bedroom: '#ece8e1', master_bedroom: '#e7e2da', kitchen: '#f6f4ef', bathroom: '#eef0f1' },
    feature: { living: fin('wood_oak_h', false), master_bedroom: fin('#3b3b3d') },
    floors: { default: 'vitrified_grey', bedroom: 'oak', master_bedroom: 'oak', bathroom: 'mosaic', kitchen: 'vitrified_grey', closet: 'oak' },
    ceilings: { living: ['cove', 'ring'], dining: ['backlit', 'linear'], master_bedroom: ['cove', 'fan'], bedroom: ['plain', 'fan'], kitchen: ['plain', 'spots'], default: ['plain', 'flush'] },
    decor: { rug: '#c9c2b6', art: '#2a2a2c', plant: true, lamp: true },
  },
  {
    id: 'japandi', name: 'Japandi', desc: 'Soft greige, pale wood, slatted ceilings, calm and natural',
    swatch: ['#e6e0d4', '#cbbfa8', '#c69c6d', '#4d5a4e'],
    exterior: '#e9e4da',
    walls: { default: '#e9e3d7', bedroom: '#e2dccf', master_bedroom: '#ddd6c7', bathroom: '#e7e3dc' },
    feature: { living: fin('wood_pine_white', false), master_bedroom: fin('wood_oak_h', false), dining: fin('wp_grasscloth', false) },
    floors: { default: 'oak', kitchen: 'concrete', bathroom: 'terrazzo', utility: 'concrete' },
    ceilings: { living: ['wood', 'globes'], dining: ['plain', 'pendant'], master_bedroom: ['wood', 'flush'], bedroom: ['plain', 'flush'], kitchen: ['plain', 'track'], default: ['plain', 'flush'] },
    decor: { rug: '#d8cdb8', art: '#7d8a74', plant: true, lamp: true },
  },
  {
    id: 'indian', name: 'Modern Indian', desc: 'Terracotta and teak, Athangudi tiles, brass lanterns',
    swatch: ['#f0e3cf', '#c46a45', '#9a6232', '#2f5d4a'],
    exterior: '#efe1c8',
    walls: { default: '#f1e6d3', bedroom: '#efe0c9', master_bedroom: '#eadcc4', kitchen: '#f4ecdd', bathroom: '#eee7da' },
    feature: { living: fin('#c46a45'), dining: fin('wood_teak_h', false), master_bedroom: fin('#2f5d4a') },
    floors: { default: 'kota', living: 'athangudi', dining: 'athangudi', bedroom: 'teak', master_bedroom: 'teak', bathroom: 'terracotta', kitchen: 'kota' },
    ceilings: { living: ['beams', 'lantern'], dining: ['plain', 'lantern'], master_bedroom: ['coffered_wood', 'fan'], bedroom: ['plain', 'fan'], default: ['plain', 'flush'] },
    decor: { rug: '#9c3b2e', art: '#b8862b', plant: true, lamp: true },
  },
  {
    id: 'luxury', name: 'Luxury classic', desc: 'Marble, deep colours, coffers and crystal chandeliers',
    swatch: ['#efeeeb', '#1f1f22', '#6b2131', '#c8a96a'],
    exterior: '#ecebe7',
    walls: { default: '#f0eeea', bedroom: '#e9e4dc', master_bedroom: '#e4ddd2', bathroom: '#efeeeb' },
    feature: { living: fin('wp_damask', false), dining: fin('wp_deco', false), master_bedroom: fin('#6b2131') },
    floors: { default: 'marble_white', bedroom: 'herringbone', master_bedroom: 'chevron', bathroom: 'marble_beige', kitchen: 'marble_white', closet: 'herringbone' },
    ceilings: { living: ['coffered', 'crystal'], dining: ['tray', 'chandelier'], master_bedroom: ['tray', 'chandelier'], bedroom: ['cove', 'flush'], hallway: ['peripheral', 'spots'], default: ['plain', 'spots'] },
    decor: { rug: '#6b2131', art: '#c8a96a', plant: true, lamp: true },
  },
  {
    id: 'scandi', name: 'Scandinavian', desc: 'Bright and airy, sage and dusty blue, light floors',
    swatch: ['#f6f4ef', '#a8b79c', '#7f98b0', '#e3dccf'],
    exterior: '#f4f2ee',
    walls: { default: '#f6f4ef', bedroom: '#dfe8ec', master_bedroom: '#cfd9cf', study: '#e9eef0', bathroom: '#f1f2f0' },
    feature: { living: fin('#a8b79c'), master_bedroom: fin('#7f98b0') },
    floors: { default: 'greyoak', bathroom: 'hexagon', kitchen: 'checker', utility: 'vitrified' },
    ceilings: { living: ['plain', 'pendant'], dining: ['plain', 'globes'], master_bedroom: ['plain', 'ring'], bedroom: ['plain', 'flush'], default: ['plain', 'flush'] },
    decor: { rug: '#e3dccf', art: '#7f98b0', plant: true, lamp: true },
  },
  {
    id: 'industrial', name: 'Industrial loft', desc: 'Exposed brick and concrete, dark metal, track lights',
    swatch: ['#9b9995', '#9e2e20', '#3b3b3d', '#a59d92'],
    exterior: '#bdbab4',
    walls: { default: '#d7d4ce', bedroom: '#cfcbc4', master_bedroom: '#c6c1b8', bathroom: '#dcdad5' },
    feature: { living: fin('mat_brick', false), dining: fin('mat_concrete', false), master_bedroom: fin('#3b3b3d') },
    floors: { default: 'concrete', bedroom: 'walnut', master_bedroom: 'walnut', bathroom: 'checker', kitchen: 'concrete' },
    ceilings: { living: ['beams', 'track'], dining: ['plain', 'linear'], kitchen: ['plain', 'track'], master_bedroom: ['beams', 'globes'], default: ['plain', 'flush'] },
    decor: { rug: '#5f584f', art: '#9e2e20', plant: true, lamp: true },
  },
  {
    id: 'tropical', name: 'Tropical boho', desc: 'Palm wallpaper, rattan tones, terrazzo, greenery everywhere',
    swatch: ['#f1ece1', '#2f6b4f', '#c9b894', '#b5653f'],
    exterior: '#f0eadc',
    walls: { default: '#f2ede2', bedroom: '#efe6d6', master_bedroom: '#e8dfcc', bathroom: '#edf0ea' },
    feature: { living: fin('wp_palm', false), master_bedroom: fin('wp_botanical', false), dining: fin('#2f6b4f') },
    floors: { default: 'terrazzo', bedroom: 'oak', master_bedroom: 'oak', bathroom: 'moroccan', kitchen: 'terracotta' },
    ceilings: { living: ['wave', 'globes'], dining: ['plain', 'lantern'], master_bedroom: ['wood', 'fan'], bedroom: ['plain', 'fan'], default: ['plain', 'flush'] },
    decor: { rug: '#c9b894', art: '#2f6b4f', plant: true, lamp: true },
  },
];

const pick = (map, kind) => (map[kind] !== undefined ? map[kind] : map.default);

// ---- geometry ---------------------------------------------------------------------------------------
const box = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
const ends = (e) => { const a = ((e.angle || 0) * Math.PI) / 180; return { ax: e.left, ay: e.top, ux: Math.cos(a), uy: Math.sin(a), len: e.width }; };

/** Each room edge lying along this wall: [{ room, side: 'A' | 'B', from, to }] in metres along the wall. */
function roomsAlong(wall, rooms) {
  const { ax, ay, ux, uy, len } = ends(wall);
  const out = [];
  const tol = 6;
  for (const r of rooms) {
    const b = box(r);
    const horiz = Math.abs(uy) < 0.01, vert = Math.abs(ux) < 0.01;
    let on = false;
    if (horiz && (Math.abs(ay - b.y0) < tol || Math.abs(ay - b.y1) < tol)) on = true;
    if (vert && (Math.abs(ax - b.x0) < tol || Math.abs(ax - b.x1) < tol)) on = true;
    if (!on) continue;
    const proj = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([px, py]) => ((px - ax) * ux + (py - ay) * uy) / U);
    const from = Math.max(0, Math.min(...proj)), to = Math.min(len / U, Math.max(...proj));
    if (to - from < 0.3) continue;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const side = (cx - ax) * -uy + (cy - ay) * ux > 0 ? 'A' : 'B';
    out.push({ room: r, side, from: Math.round(from * 100) / 100, to: Math.round(to * 100) / 100 });
  }
  return out;
}

/** Put a finish on one side of a wall over [from, to], replacing what was there on that stretch. */
export function setSideRange(wall, side, finish, range = finish) {
  const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const from = range?.from ?? 0, to = range?.to ?? wall.width / U;
  const kept = listOf(wall.sides?.[side]).filter(f => (f.to ?? wall.width / U) <= from + 0.01 || (f.from ?? 0) >= to - 0.01);
  const list = finish ? [...kept, finish] : kept;
  const sides = { ...(wall.sides || {}) };
  if (list.length) sides[side] = list; else delete sides[side];
  return { ...wall, sides: Object.keys(sides).length ? sides : undefined };
}

// ---- decor placement ----------------------------------------------------------------------------------
function rectOf(e) {
  const a = ((e.angle || 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const cx = e.left + (e.width / 2) * Math.cos(a), cy = e.top + (e.width / 2) * Math.sin(a);
  const hw = (e.width * c + e.height * s) / 2, hd = (e.width * s + e.height * c) / 2;
  return { x0: cx - hw, x1: cx + hw, y0: cy - hd, y1: cy + hd };
}
const hit = (p, q, gap = 0) => p.x0 < q.x1 + gap && q.x0 < p.x1 + gap && p.y0 < q.y1 + gap && q.y0 < p.y1 + gap;

function doorZones(room, doors) {
  const b = box(room), out = [];
  for (const d of doors) {
    const { ax, ay, ux, uy } = ends(d);
    const mx = ax + (ux * d.width) / 2, my = ay + (uy * d.width) / 2, w = d.width + 6;
    if (Math.abs(my - b.y0) < 8 || Math.abs(my - b.y1) < 8) out.push({ x0: mx - w / 2, x1: mx + w / 2, y0: Math.abs(my - b.y0) < 8 ? b.y0 : b.y1 - w, y1: Math.abs(my - b.y0) < 8 ? b.y0 + w : b.y1 });
    else if (Math.abs(mx - b.x0) < 8 || Math.abs(mx - b.x1) < 8) out.push({ y0: my - w / 2, y1: my + w / 2, x0: Math.abs(mx - b.x0) < 8 ? b.x0 : b.x1 - w, x1: Math.abs(mx - b.x0) < 8 ? b.x0 + w : b.x1 });
  }
  return out;
}

/** A furniture element of `type` centred at (cx, cy), backed onto the wall on side `back` (N S E W). */
function piece(type, cx, cy, back, floor, extra = {}) {
  const it = catalogItem(type);
  const w = Math.round(it.w * U), d = Math.max(1, Math.round(it.d * U));
  const a = { N: 0, S: 180, E: 90, W: 270 }[back] ?? 0;
  const r = (a * Math.PI) / 180;
  return { id: `decor_${Math.random().toString(36).slice(2, 9)}`, type, floor, left: Math.round(cx - (w / 2) * Math.cos(r)), top: Math.round(cy - (w / 2) * Math.sin(r)), width: w, height: d, angle: a, decor: true, ...extra };
}

function decorate(room, style, furniture, doors, windows) {
  if (!['living', 'lounge', 'dining', 'master_bedroom', 'bedroom', 'study'].includes(room.kind)) return [];
  const b = box(room), inset = 6, f = room.floor || 1;
  const taken = [...furniture.map(rectOf), ...doorZones(room, doors)];
  const out = [];
  const free = (e) => { const q = rectOf(e); return q.x0 >= b.x0 + 3 && q.x1 <= b.x1 - 3 && q.y0 >= b.y0 + 3 && q.y1 <= b.y1 - 3 && !taken.some(t => hit(q, t, 1)); };
  const add = (e) => { out.push(e); taken.push(rectOf(e)); return e; };
  // a rug in the middle (under the furniture), in the style's colour
  if (style.decor.rug && room.kind !== 'study') {
    const w = Math.min(3.0, (b.x1 - b.x0) / U * 0.55), d = Math.min(2.2, (b.y1 - b.y0) / U * 0.5);
    out.push({ ...piece('furniture_rug', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 'N', f, { color: style.decor.rug }), width: Math.round(w * U), height: Math.round(d * U), left: Math.round((b.x0 + b.x1) / 2 - (w * U) / 2) });
  }
  // plants and a floor lamp in free corners
  const corners = [[b.x0 + inset + 5, b.y0 + inset + 5, 'N'], [b.x1 - inset - 5, b.y0 + inset + 5, 'N'], [b.x0 + inset + 5, b.y1 - inset - 5, 'S'], [b.x1 - inset - 5, b.y1 - inset - 5, 'S']];
  const wants = [];
  if (style.decor.plant) wants.push('furniture_plant');
  if (style.decor.lamp && !['dining'].includes(room.kind)) wants.push('furniture_floor_lamp');
  if (style.decor.plant && ['living', 'lounge'].includes(room.kind)) wants.push('furniture_plant');
  for (const type of wants) {
    for (const [cx, cy, back] of corners) {
      const e = piece(type, cx, cy, back, f);
      if (free(e)) { add(e); break; }
    }
  }
  // wall art on the longest wall with no window or door on it
  const sides = [['N', b.y0, b.x1 - b.x0], ['S', b.y1, b.x1 - b.x0], ['W', b.x0, b.y1 - b.y0], ['E', b.x1, b.y1 - b.y0]].sort((p, q) => q[2] - p[2]);
  const openingOn = (side, line) => [...doors, ...windows].some(o => {
    const { ax, ay, ux, uy } = ends(o);
    const mx = ax + (ux * o.width) / 2, my = ay + (uy * o.width) / 2;
    return side === 'N' || side === 'S' ? Math.abs(my - line) < 8 && mx > b.x0 && mx < b.x1 : Math.abs(mx - line) < 8 && my > b.y0 && my < b.y1;
  });
  const wall = sides.find(([side, line]) => !openingOn(side, line));
  if (wall) {
    const [side, line] = wall;
    const cx = side === 'N' || side === 'S' ? (b.x0 + b.x1) / 2 : side === 'W' ? line + 4 : line - 4;
    const cy = side === 'N' ? line + 4 : side === 'S' ? line - 4 : (b.y0 + b.y1) / 2;
    out.push(piece('furniture_wall_art', cx, cy, side, f, { color: style.decor.art }));
  }
  return out;
}

/**
 * The plan with `style` applied. `parts` picks what changes: walls, floors, ceilings, decor.
 * Returns { elements, summary } where summary counts what was done.
 */
export function applyDesignStyle(elements, style, parts = { walls: true, floors: true, ceilings: true, decor: true }) {
  const els = elements.filter(e => !(parts.decor && e.decor));           // the last style's decor goes
  const rooms = els.filter(e => e.type === 'room');
  const byFloor = (f) => rooms.filter(r => (r.floor || 1) === f);
  const summary = { rooms: 0, walls: 0, decor: 0 };
  // one feature wall per room that has a feature finish: its longest stretch along a wall
  const featureFor = new Map();
  if (parts.walls) {
    for (const r of rooms) {
      if (!style.feature[r.kind]) continue;
      let best = null;
      els.filter(e => e.type === 'wall' && (e.floor || 1) === (r.floor || 1)).forEach(w => {
        roomsAlong(w, [r]).forEach(seg => {
          const L = seg.to - seg.from;
          const hasWindow = els.some(o => o.type === 'window' && (o.floor || 1) === (r.floor || 1) && Math.abs(((o.angle || 0) - (w.angle || 0)) % 180) < 1
            && Math.abs(((o.left - w.left) * -ends(w).uy + (o.top - w.top) * ends(w).ux)) < 6);
          const score = L - (hasWindow ? 100 : 0);
          if (!best || score > best.score) best = { wallId: w.id, from: seg.from, to: seg.to, score };
        });
      });
      if (best) featureFor.set(r.id, best);
    }
  }
  let out = els.map(e => {
    if (e.type === 'room') {
      summary.rooms += 1;
      const next = { ...e };
      if (parts.floors) { const fl = pick(style.floors, e.kind); if (fl) next.flooring = fl; }
      if (parts.ceilings && e.kind !== 'balcony') {
        const [cs, light] = pick(style.ceilings, e.kind) || ['plain', 'flush'];
        next.ceiling = { style: cs, light, color: '#f3f1ed' };
      }
      return next;
    }
    if (e.type === 'wall' && parts.walls) {
      summary.walls += 1;
      let w = { ...e, material: style.exterior, isColor: true, sides: undefined };   // the outside of the house
      roomsAlong(e, byFloor(e.floor || 1)).forEach(seg => {
        const feat = featureFor.get(seg.room.id);
        const isFeature = feat && feat.wallId === e.id && Math.abs(feat.from - seg.from) < 0.01;
        const paint = isFeature ? style.feature[seg.room.kind] : fin(pick(style.walls, seg.room.kind) || style.walls.default);
        w = setSideRange(w, seg.side, { ...paint, from: seg.from, to: seg.to });
      });
      return w;
    }
    return e;
  });
  if (parts.decor) {
    const add = [];
    for (const r of rooms) {
      const f = r.floor || 1;
      const here = out.filter(e => (e.floor || 1) === f);
      const b = box(r);
      const inside = here.filter(e => e.type?.startsWith('furniture_')).filter(e => { const q = rectOf(e); const cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2; return cx > b.x0 && cx < b.x1 && cy > b.y0 && cy < b.y1; });
      const pieces = decorate(r, style, inside, here.filter(e => e.type === 'door'), here.filter(e => e.type === 'window'));
      add.push(...pieces);
    }
    summary.decor = add.length;
    out = [...out, ...add];
  }
  return { elements: out, summary };
}

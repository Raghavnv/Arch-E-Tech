import { roomsAlong, setSideRange } from './designStyles';

/*
 * The front elevation: what the house looks like from the street. Stored on the project (`facade`):
 *   paint      exterior wall colour
 *   accent     a cladding or colour on the front: { material, isColor, where: 'entrance' | 'front' | 'none' }
 *   roof       pitched roof tile colour; parapet (flat roof edge) colour
 *   railing    balcony railings: 'glass' | 'metal' | 'wood'
 *   gate       'bars' | 'wood' | 'solid' | 'mesh', with gateColor
 *   compound   compound wall colour, height (m) and finish ('plaster' | 'stone' | 'brick')
 *   lights     outdoor lights: sconces by the door, bollards along the path, uplights on the front
 * The paint and accent are written onto the outside faces of the walls (marked `facade: true`), so every
 * view of the house shows them; the rest is drawn by the street scene and the roof.
 */
const U = 20;

export const DEFAULT_FACADE = {
  paint: '#efede8', accent: { material: 'clad_stacked', isColor: false, where: 'entrance' },
  roof: '#8a4b2c', parapet: '#cfc8bd', railing: 'glass', gate: 'bars', gateColor: '#2f2b27',
  compound: { color: '#d9d2c5', height: 1.2, finish: 'plaster' }, lights: { sconces: true, bollards: true, uplights: false },
};

export const EXTERIOR_PAINTS = [['Warm white', '#efede8'], ['Ivory', '#f1e6d3'], ['Sand', '#e2cfae'], ['Greige', '#cfc6b8'], ['Grey', '#a7a39c'], ['Charcoal', '#4a4a4c'], ['Terracotta', '#c46a45'], ['Sage', '#a8b79c'], ['Sky', '#bcd4e6']];
export const FACADE_ACCENTS = [
  ['None', null, false], ['Stacked stone', 'clad_stacked', false], ['White brick', 'clad_whitebrick', false], ['Red brick', 'mat_brick', false],
  ['Teak panelling', 'wood_teak_h', false], ['Smoked oak', 'wood_ebony_v', false], ['Concrete', 'mat_concrete', false], ['Charcoal paint', '#3a3a3c', true],
];
export const ROOF_COLOURS = [['Terracotta tile', '#8a4b2c'], ['Charcoal tile', '#3b3b3f'], ['Slate grey', '#5f6670'], ['Forest green', '#3d5a45'], ['Clay red', '#a3442f']];
export const GATES = [['bars', 'Metal bars'], ['wood', 'Wooden slats'], ['solid', 'Solid panel'], ['mesh', 'Mesh']];
export const GATE_COLOURS = [['Black', '#2f2b27'], ['Charcoal', '#4a4a4c'], ['Bronze', '#6b5236'], ['White', '#efede8'], ['Teak', '#7a4b2a']];
export const COMPOUND_FINISHES = [['plaster', 'Plaster'], ['stone', 'Stone'], ['brick', 'Brick']];
export const RAILINGS = [['glass', 'Glass'], ['metal', 'Metal bars'], ['wood', 'Wood']];

const box = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
const ends = (e) => { const a = ((e.angle || 0) * Math.PI) / 180; return { ax: e.left, ay: e.top, ux: Math.cos(a), uy: Math.sin(a) }; };

/** The side of the plan the front door is on ('N' | 'S' | 'E' | 'W') and the door's centre. */
export function frontOf(elements) {
  const ground = elements.filter(e => (e.floor || 1) === 1);
  const rooms = ground.filter(e => e.type === 'room');
  const inRoom = (x, y) => rooms.find(r => { const b = box(r); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; });
  let best = null;
  ground.filter(e => e.type === 'door').forEach(d => {
    const { ax, ay, ux, uy } = ends(d);
    const mx = ax + (ux * d.width) / 2, my = ay + (uy * d.width) / 2, nx = -uy, ny = ux;
    const r1 = inRoom(mx + nx * 15, my + ny * 15), r2 = inRoom(mx - nx * 15, my - ny * 15);
    if (!!r1 === !!r2) return;
    const [ox, oy] = r1 ? [-nx, -ny] : [nx, ny];
    const side = Math.abs(oy) > Math.abs(ox) ? (oy > 0 ? 'S' : 'N') : (ox > 0 ? 'E' : 'W');
    const w = ['living', 'lounge', 'hallway'].includes((r1 || r2).kind) ? 3 : 1;
    if (!best || w > best.w) best = { side, x: mx, y: my, w };
  });
  return best || { side: 'S', x: null, y: null };
}

/** The house with the facade's paint and accent on the outside of its walls. */
export function applyFacade(elements, facade) {
  const f = { ...DEFAULT_FACADE, ...facade };
  const front = frontOf(elements);
  const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return elements.map(w => {
    if (w.type !== 'wall') return w;
    const floorRooms = elements.filter(e => e.type === 'room' && (e.floor || 1) === (w.floor || 1));
    const len = w.width / U;
    const segs = roomsAlong(w, floorRooms);
    // drop the last facade's finishes, keep the rooms' own
    let next = { ...w, sides: undefined };
    ['A', 'B'].forEach(side => listOf(w.sides?.[side]).filter(x => !x.facade).forEach(x => { next = setSideRange(next, side, x); }));
    const { ux, uy } = ends(w);
    ['A', 'B'].forEach(side => {
      // stretches of this face with no room on them are outside
      const taken = segs.filter(s => s.side === side).map(s => [s.from, s.to]).sort((a, b) => a[0] - b[0]);
      let at = 0;
      const free = [];
      taken.forEach(([a, b]) => { if (a - at > 0.05) free.push([at, a]); at = Math.max(at, b); });
      if (len - at > 0.05) free.push([at, len]);
      if (!free.length) return;
      // which way this face looks: A looks along +n
      const nx = -uy * (side === 'A' ? 1 : -1), ny = ux * (side === 'A' ? 1 : -1);
      const faces = Math.abs(ny) > Math.abs(nx) ? (ny > 0 ? 'S' : 'N') : (nx > 0 ? 'E' : 'W');
      free.forEach(([a, b]) => {
        next = setSideRange(next, side, { material: f.paint, isColor: true, from: a, to: b, facade: true });
        const acc = f.accent;
        if (!acc?.material || acc.where === 'none' || faces !== front.side) return;
        let from = a, to = b;
        if (acc.where === 'entrance' && front.x != null) {
          // around the front door: 1.5 m either side of it, on the stretch that holds it
          const along = ((front.x - w.left) * ux + (front.y - w.top) * uy) / U;
          if (along < a - 0.5 || along > b + 0.5) return;
          from = Math.max(a, along - 1.6); to = Math.min(b, along + 1.6);
        }
        next = setSideRange(next, side, { material: acc.material, isColor: !!acc.isColor, from, to, facade: true });
      });
    });
    return next;
  });
}

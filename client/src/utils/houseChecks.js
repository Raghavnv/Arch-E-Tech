import { footprint, outline, slabPieces } from './roofShape';
import { frontOf } from './facade';
import { openingTypes } from './approvalDrawings';

/*
 * Two checks on the plan, each a list of { status: 'pass' | 'warn' | 'fail' | 'info', title, detail, fix? }.
 *
 * Accessibility (for elderly parents, a wheelchair, a pram; after the Harmonised Guidelines for
 * Universal Accessibility in India 2021 and NBC 2016 Part 3):
 *   step-free entry (a 1:12 ramp for the plinth), door widths (main 1.0 m, others 0.9 m clear),
 *   a bedroom and a bathroom on the ground floor, a bathroom big enough to turn a wheelchair (1.5 m),
 *   hallways at least 1.0 m wide, stairs at least 1.0 m wide with rails both sides.
 *
 * Earthquake and wind (after IS 1893: 2016, IS 4326 for masonry, IS 875 Part 3 for wind):
 *   the city's seismic zone and basic wind speed; plinth, lintel and roof bands in zones III to V;
 *   openings no more than about half of any outside wall, and kept off the corners; plan shape (deep
 *   L or U corners twist in an earthquake); upper floors overhanging the ground floor; an open ground
 *   floor (soft storey); column spacing; and what high winds ask for in cyclone-prone cities.
 */
const U = 20;
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const PLINTH = 0.45;

export const SEISMIC = {
  Bengaluru: ['II', 33], Chennai: ['III', 50], Hyderabad: ['II', 44], Mumbai: ['III', 44], Pune: ['III', 39], Ahmedabad: ['III', 39],
  Kolkata: ['III', 50], Delhi: ['IV', 47], Jaipur: ['II', 47], Kochi: ['III', 39], Chandigarh: ['IV', 47], Guwahati: ['V', 50],
};
const ZONE_FACTOR = { II: 0.10, III: 0.16, IV: 0.24, V: 0.36 };
const CYCLONE = new Set(['Chennai', 'Kolkata', 'Mumbai']);

const box = (r) => ({ x0: r.left / U, x1: (r.left + r.width) / U, y0: (r.top - r.height / 2) / U, y1: (r.top + r.height / 2) / U });
const rect = (r) => { const b = box(r); return { x: b.x0, z: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 }; };
const nameOf = (r) => `${r.name || r.kind}${(r.floor || 1) > 1 ? ` (floor ${r.floor})` : ''}`;
const list = (xs) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function accessibility(elements, site = null) {
  const out = [];
  const rooms = elements.filter(e => e.type === 'room');
  const ground = rooms.filter(r => (r.floor || 1) === 1);
  // entrance: a ramp for the plinth
  const ramp = PLINTH * 12;
  const front = site?.setbacks_m?.front;
  out.push({ status: front != null && front < ramp + 1.5 ? 'warn' : 'info', title: 'Step-free entrance',
    detail: `Needs a ${ramp.toFixed(1)} m ramp (1:12) for the plinth`
      + (front != null && front < ramp + 1.5 ? `; the ${front.toFixed(1)} m front setback is too short for a straight one.` : '.'),
    fix: front != null && front < ramp + 1.5 ? 'Run the ramp along the front wall.' : null });
  // doors
  const { types } = openingTypes(elements);
  const doors = types.filter(t => t.type === 'door');
  const main = doors.find(t => t.kind === 'Main entrance door');
  if (main) out.push({ status: main.w >= 1.0 ? 'pass' : 'fail', title: 'Main door width', detail: `${main.w.toFixed(2)} m (1.0 m needed).`, fix: main.w < 1 ? 'AI Edit: "make the main door 1 m wide"' : null });
  const narrow = doors.filter(t => t.kind !== 'Main entrance door' && t.w < 0.9);
  out.push({ status: narrow.length ? 'warn' : 'pass', title: 'Other doors',
    detail: narrow.length ? `${narrow.reduce((s, t) => s + t.ids.length, 0)} under 0.9 m: ${list([...new Set(narrow.flatMap(t => [...t.where.keys()]))].slice(0, 4))}.` : 'All at least 0.9 m.',
    fix: narrow.length ? 'AI Edit: "widen the bathroom doors to 0.9 m"' : null });
  // ground floor bedroom and bathroom
  const gBed = ground.filter(r => r.kind === 'bedroom' || r.kind === 'master_bedroom');
  const gBath = ground.filter(r => r.kind === 'bathroom');
  out.push({ status: gBed.length && gBath.length ? 'pass' : 'warn', title: 'Living on the ground floor',
    detail: gBed.length && gBath.length ? 'A bedroom and bathroom downstairs.'
      : `There is ${gBed.length ? '' : 'no bedroom'}${!gBed.length && !gBath.length ? ' and ' : ''}${gBath.length ? '' : 'no bathroom'} on the ground floor.`,
    fix: gBed.length ? null : 'AI Edit: "add a bedroom on the ground floor next to the living room"' });
  // a bathroom a wheelchair can turn in
  const turn = gBath.filter(r => Math.min(r.width, r.height) / U >= 1.5);
  out.push({ status: turn.length ? 'pass' : gBath.length ? 'warn' : 'info', title: 'Accessible bathroom',
    detail: turn.length ? `${list(turn.map(nameOf))} has 1.5 m to turn. Add grab bars.`
      : gBath.length ? `${list(gBath.map(r => `${nameOf(r)} is ${(r.width / U).toFixed(1)} × ${(r.height / U).toFixed(1)} m`))}; a wheelchair needs 1.5 m to turn.` : 'No ground-floor bathroom to check.',
    fix: !turn.length && gBath.length ? `AI Edit: "make ${gBath[0].name || 'the bathroom'} 1.6 m wide"` : null });
  // hallways
  const tight = rooms.filter(r => r.kind === 'hallway' && Math.min(r.width, r.height) / U < 1.0);
  out.push({ status: tight.length ? 'warn' : 'pass', title: 'Hallways',
    detail: tight.length ? `${list(tight.map(nameOf))} is under 1.0 m.` : 'All at least 1.0 m.' });
  // stairs
  const stairs = elements.filter(e => e.type === 'stairs' && !e.arrival);
  if (stairs.length) {
    const w = Math.min(...stairs.map(s => (s.height || 0) / U));
    out.push({ status: w >= 1.0 ? 'pass' : 'warn', title: 'Stairs', detail: `${w.toFixed(2)} m wide${w >= 1 ? '' : ' (1.0 m needed)'}. Rails on both sides.` });
  }
  return out;
}

export function quakeWind(elements, { city = 'Bengaluru', columns = null } = {}) {
  const out = [];
  const [zone, wind] = SEISMIC[city] || ['III', 44];
  const floors = [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b);
  const inside = (f) => elements.filter(e => e.type === 'room' && (e.floor || 1) === f && !OUTDOOR.has(e.kind));
  out.push({ status: 'info', title: `Seismic zone ${zone}`, detail: zone === 'II' ? 'Low risk.' : `Factor ${ZONE_FACTOR[zone]}: design for earthquakes (IS 13920).` });
  if (zone !== 'II') out.push({ status: 'warn', title: 'Bands and ties', detail: 'RCC bands at plinth, lintel and roof; bars at corners (IS 4326).' });

  // openings on each outside wall, per floor
  const big = [], corner = [];
  floors.forEach(f => {
    const rs = inside(f);
    if (!rs.length) return;
    const faces = outline(footprint(rs.map(rect), 0.115));
    const ops = elements.filter(e => (e.type === 'door' || e.type === 'window') && (e.floor || 1) === f).map(o => {
      const a = ((o.angle || 0) * Math.PI) / 180;
      return { x0: o.left / U, y0: o.top / U, x1: (o.left + Math.cos(a) * o.width) / U, y1: (o.top + Math.sin(a) * o.width) / U, w: o.width / U };
    });
    faces.forEach(({ a, b }) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1.5) return;
      const horiz = Math.abs(a[1] - b[1]) < 0.01;
      const on = ops.filter(o => (horiz ? Math.abs((o.y0 + o.y1) / 2 - a[1]) < 0.35 && Math.abs(o.y0 - o.y1) < 0.05 && Math.min(o.x0, o.x1) > Math.min(a[0], b[0]) - 0.1 && Math.max(o.x0, o.x1) < Math.max(a[0], b[0]) + 0.1
        : Math.abs((o.x0 + o.x1) / 2 - a[0]) < 0.35 && Math.abs(o.x0 - o.x1) < 0.05 && Math.min(o.y0, o.y1) > Math.min(a[1], b[1]) - 0.1 && Math.max(o.y0, o.y1) < Math.max(a[1], b[1]) + 0.1));
      const sum = on.reduce((s, o) => s + o.w, 0);
      if (sum / L > 0.5) big.push(`floor ${f}: ${Math.round((sum / L) * 100)} % of a ${L.toFixed(1)} m wall`);
      on.forEach(o => {
        const s0 = horiz ? Math.min(o.x0, o.x1) : Math.min(o.y0, o.y1), s1 = horiz ? Math.max(o.x0, o.x1) : Math.max(o.y0, o.y1);
        const e0 = horiz ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]), e1 = horiz ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
        if (s0 - e0 < 0.6 || e1 - s1 < 0.6) corner.push(`floor ${f}`);
      });
    });
  });
  out.push({ status: big.length ? 'warn' : 'pass', title: 'Openings in outside walls', detail: big.length ? `Over half openings: ${list(big.slice(0, 2))}.` : 'Under half on every wall.' });
  out.push({ status: corner.length ? 'warn' : 'pass', title: 'Openings near corners', detail: corner.length ? `${corner.length} within 0.6 m of a corner; move them in.` : 'All 0.6 m or more from corners.' });

  // plan shape: deep re-entrant corners
  const g = inside(1);
  if (g.length) {
    const fp = footprint(g.map(rect));
    const area = slabPieces(fp).reduce((s, p) => s + p.w * p.d, 0);
    const xs = g.flatMap(r => [box(r).x0, box(r).x1]), ys = g.flatMap(r => [box(r).y0, box(r).y1]);
    const W = Math.max(...xs) - Math.min(...xs), D = Math.max(...ys) - Math.min(...ys);
    const fill = area / (W * D);
    out.push({ status: fill < 0.75 ? 'warn' : 'pass', title: 'Plan shape', detail: fill < 0.75 ? 'Deep L or U corners twist in an earthquake; stiffen or separate the wings.' : 'Compact, no deep corners.' });
  }
  // overhangs and an open ground floor
  if (floors.length > 1) {
    const area = (f) => slabPieces(footprint(inside(f).map(rect))).reduce((s, p) => s + p.w * p.d, 0);
    const a1 = area(1), a2 = area(floors[1]);
    if (a1 && a2 > a1 * 1.15) out.push({ status: 'warn', title: 'Upper floor overhangs', detail: `Floor ${floors[1]} is ${Math.round((a2 / a1 - 1) * 100)} % bigger than the ground floor. Cantilevers over 1 m need special design; heavy overhangs pull on the columns in an earthquake.` });
    const open = elements.filter(e => e.type === 'room' && (e.floor || 1) === 1 && (OUTDOOR.has(e.kind) || /parking|porch|stilt|car/i.test(e.name || '')));
    if (a1 < a2 * 0.7 || open.some(r => /parking|stilt/i.test(r.name || ''))) out.push({ status: 'fail', title: 'Open ground floor (soft storey)', detail: 'The ground floor has far less wall than the floor above (parking or an open plan). Soft storeys collapse first in earthquakes; it needs a structural engineer\'s design (IS 1893 soft-storey rules).' });
  }
  // column spacing
  if (columns && g.length) {
    const area = slabPieces(footprint(g.map(rect))).reduce((s, p) => s + p.w * p.d, 0);
    const bay = Math.sqrt(area / Math.max(1, columns / 1.2));
    out.push({ status: bay > 4.5 ? 'warn' : 'pass', title: 'Column spacing', detail: `${columns} columns, ${bay.toFixed(1)} m apart${bay > 4.5 ? ': spans over 4.5 m need deeper beams' : ''}.` });
  }
  // wind
  out.push({ status: CYCLONE.has(city) ? 'warn' : 'info', title: `Wind: ${wind} m/s`, detail: CYCLONE.has(city) ? 'Cyclone coast: tie down parapets, tank and panels.' : wind >= 47 ? 'Anchor sheet roofs, panels and the tank.' : 'No special measures.' });
  return out;
}

import { PLAN_SCALE } from '../components/Canvas3D';
import { catalogItem } from './furnitureCatalog';

/*
 * Where to stand to photograph a room so that as much of it as possible is in the picture.
 *
 * Eight viewpoints are tried: the four corners looking diagonally across, and the middle of each wall
 * looking straight at the opposite one (the usual architectural shot for a kitchen run, a bed wall or a
 * long room). Each is scored by what actually falls inside the frame: a grid of points over the floor,
 * the furniture and fittings (counters, beds, wardrobes count most) and the windows. Standing in a
 * doorway or right where a door swings is avoided. The best-scoring view wins.
 */
const EYE = 1.5;                // camera height, m: a little under eye level shows more floor
const CLEAR = 0.38;             // m from the wall centre line: the 0.2 m half-wall plus a hand's width
export const ROOM_FOV = 72;     // vertical; about 88 degrees across at 4:3
const ASPECT = 4 / 3;

const line = (e) => {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return { x0: e.left, y0: e.top, x1: e.left + e.width * Math.cos(a), y1: e.top + e.width * Math.sin(a), len: e.width };
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Do the 2D segments p1-p2 and q1-q2 cross? */
function crosses([ax, az], [bx, bz], [cx, cz], [dx, dz]) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

/** Is the straight line from the camera to a point blocked by a wall or a tall piece of furniture?
 *  Crossings right at the point (a window on its own wall, a piece's own edges) do not count. */
function sightBlocked(pos, s, occluders) {
  const a = [pos[0], pos[2]], b = [s.p[0], s.p[2]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 0.4) return false;
  const k = (L - 0.3) / L;                         // stop 0.3 m short of the point
  const b2 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return occluders.some(o => o.owner !== s.owner && crosses(a, b2, o.a, o.b));
}

/** How much of the weighted sample points a camera at `pos` looking at `look` gets in frame. */
function coverage(pos, look, fovV, samples, occluders = []) {
  const f = norm(sub(look, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const ty = Math.tan(((fovV / 2) * Math.PI) / 180) * 0.97, tx = ty * ASPECT;
  let got = 0, all = 0;
  for (const s of samples) {
    all += s.w;
    const v = sub(s.p, pos);
    const z = dot(v, f);
    if (z < 0.25) continue;
    if (Math.abs(dot(v, r) / z) <= tx && Math.abs(dot(v, u) / z) <= ty && !sightBlocked(pos, s, occluders)) got += s.w;
  }
  return all ? got / all : 0;
}

const onCut = (sm, cut) => sm.p[1] > 1 && Math.abs((cut.axis === 'z' ? sm.p[2] : sm.p[0]) - cut.at) < 0.4;

/** Is this plan element (a wall, door or window) on the wall a cutaway leaves out? */
export function onCutWall(e, cut) {
  if (!cut || !['wall', 'door', 'window'].includes(e.type)) return false;
  const S = PLAN_SCALE, l = line(e);
  const [a0, b0, a1, b1] = cut.axis === 'z' ? [l.y0 * S, l.x0 * S, l.y1 * S, l.x1 * S] : [l.x0 * S, l.y0 * S, l.x1 * S, l.y1 * S];
  if (Math.abs(a0 - cut.at) > 0.15 || Math.abs(a1 - cut.at) > 0.15) return false;
  return Math.max(b0, b1) > cut.from + 0.1 && Math.min(b0, b1) < cut.to - 0.1;
}

/** Camera position and target (3D metres) that show the most of a room; `cut` names a wall to leave out. */
export function cameraForRoom(room, elements, { cutaway = true } = {}) {
  const S = PLAN_SCALE;
  const floor = room.floor || 1;
  const X0 = room.left * S, X1 = (room.left + room.width) * S;
  const Z0 = (room.top - room.height / 2) * S, Z1 = (room.top + room.height / 2) * S;
  const W = X1 - X0, D = Z1 - Z0, mx = (X0 + X1) / 2, mz = (Z0 + Z1) / 2;
  const here = elements.filter(e => (e.floor || 1) === floor);
  const inside = (x, z, pad = 0) => x > X0 - pad && x < X1 + pad && z > Z0 - pad && z < Z1 + pad;

  // what the picture should hold
  const samples = [];
  const step = Math.max(0.35, Math.min(W, D) / 8);
  for (let x = X0 + 0.3; x <= X1 - 0.3 + 1e-6; x += step) {
    for (let z = Z0 + 0.3; z <= Z1 - 0.3 + 1e-6; z += step) samples.push({ p: [x, 0.05, z], w: 1 });
  }
  const floorW = samples.length || 1;
  const furniture = here.filter(e => typeof e.type === 'string' && e.type.startsWith('furniture_')).map(e => {
    const a = ((e.angle || 0) * Math.PI) / 180;
    const cx = (e.left + (e.width / 2) * Math.cos(a)) * S;      // (left, top) is the middle of the piece's start edge
    const cz = (e.top + (e.width / 2) * Math.sin(a)) * S;
    return { cx, cz, big: e.width * e.height * S * S, type: e.type, w: e.width * S, d: e.height * S, a, h: catalogItem(e.type)?.h };
  }).filter(f => inside(f.cx, f.cz));
  furniture.forEach((f, i) => samples.push({ p: [f.cx, 0.6, f.cz], w: floorW * (0.12 + Math.min(0.25, f.big / 6)), owner: `f${i}` }));
  const openings = here.filter(e => e.type === 'window' || e.type === 'door').map(e => ({ ...line(e), type: e.type }))
    .map(o => ({ ...o, mx: ((o.x0 + o.x1) / 2) * S, mz: ((o.y0 + o.y1) / 2) * S, w: o.len * S }))
    .filter(o => inside(o.mx, o.mz, 0.3));
  openings.filter(o => o.type === 'window').forEach(o => samples.push({ p: [o.mx, 1.4, o.mz], w: floorW * 0.08 }));

  // what can stand in the way: every wall on this floor, and tall pieces (wardrobes, fridges, tall units)
  const wallSegs = here.filter(e => e.type === 'wall').map(e => {
    const l = line(e);
    return { a: [l.x0 * S, l.y0 * S], b: [l.x1 * S, l.y1 * S], el: e };
  });
  const tall = furniture.map((f, i) => ({ ...f, owner: `f${i}` })).filter(f => (f.h ?? 0) >= 1.4);
  const tallSegs = tall.flatMap(f => {
    const c = Math.cos(f.a), s = Math.sin(f.a), hw = f.w / 2, hd = f.d / 2;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [f.cx + x * c - z * s, f.cz + x * s + z * c]);
    return pts.map((p, k) => ({ a: p, b: pts[(k + 1) % 4], owner: f.owner }));
  });
  // a door stands ajar (the 3D model opens every leaf 0.55 rad from its start, towards -n): its leaf
  // blocks the view like a short wall
  const leafSegs = here.filter(e => e.type === 'door').map(e => {
    const l = line(e);
    const ax = l.x0 * S, az = l.y0 * S, bx = l.x1 * S, bz = l.y1 * S, len = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, c = Math.cos(0.55), s = Math.sin(0.55);
    return { a: [ax, az], b: [ax + (c * ux - s * nx) * len, az + (c * uz - s * nz) * len] };
  });
  const insideTall = (x, z) => tall.some(f => Math.hypot(f.cx - x, f.cz - z) < Math.max(f.w, f.d) / 2 + 0.3);

  const doors = openings.filter(o => o.type === 'door');
  const blocked = (x, z) => doors.some(d => Math.hypot(d.mx - x, d.mz - z) < d.w / 2 + 0.45);

  // the candidates
  const c = CLEAR;
  const views = [];
  [[X0 + c, Z0 + c], [X1 - c, Z0 + c], [X0 + c, Z1 - c], [X1 - c, Z1 - c]].forEach(([x, z]) => {
    const ox = x < mx ? X1 : X0, oz = z < mz ? Z1 : Z0;
    views.push({ pos: [x, EYE, z], look: [x + (ox - x) * 0.6, 1.05, z + (oz - z) * 0.6], straight: false });
  });
  const straight = (x, z, lx, lz) => views.push({ pos: [x, EYE, z], look: [lx, 1.0, lz], straight: true });
  // from the middle of each wall; if a door is there, slide along the wall away from it
  const slide = (x, z, alongX) => {
    if (!blocked(x, z)) return [x, z];
    for (const k of [0.25, -0.25, 0.4, -0.4]) {
      const nx = alongX ? mx + W * k : x, nz = alongX ? z : mz + D * k;
      if (!blocked(nx, nz)) return [nx, nz];
    }
    return [x, z];
  };
  { const [x, z] = slide(mx, Z0 + c, true); straight(x, z, x, Z1); }
  { const [x, z] = slide(mx, Z1 - c, true); straight(x, z, x, Z0); }
  { const [x, z] = slide(X0 + c, mz, false); straight(x, z, X1, z); }
  { const [x, z] = slide(X1 - c, mz, false); straight(x, z, X0, z); }

  // cutaways: step back behind one wall (left out of the picture) and look square at the room, far
  // enough back that its whole width is in frame. Not through a wall with furniture against it (we
  // would see its back) and the windows on the wall that goes are not counted.
  if (cutaway) {
    const tx = Math.tan(((ROOM_FOV / 2) * Math.PI) / 180) * ASPECT;
    const back = (span) => Math.max(0.6, Math.min(2.2, (span / 2) / tx + 0.2));
    const nearWall = (side) => furniture.some(f => (side === 'N' ? f.cz - Z0 : side === 'S' ? Z1 - f.cz : side === 'W' ? f.cx - X0 : X1 - f.cx) < 0.9);
    [['N', [mx, EYE, Z0 - back(W)], [mx, 0.95, Z1]], ['S', [mx, EYE, Z1 + back(W)], [mx, 0.95, Z0]],
      ['W', [X0 - back(D), EYE, mz], [X1, 0.95, mz]], ['E', [X1 + back(D), EYE, mz], [X0, 0.95, mz]]].forEach(([side, pos, look]) => {
      if (nearWall(side)) return;
      const cut = side === 'N' || side === 'S'
        ? { axis: 'z', at: side === 'N' ? Z0 : Z1, from: X0, to: X1 }
        : { axis: 'x', at: side === 'W' ? X0 : X1, from: Z0, to: Z1 };
      views.push({ pos, look, straight: true, cut });
    });
  }

  const scored = views.map(v => ({
    ...v,
    score: coverage(v.pos, v.look, ROOM_FOV, v.cut ? samples.filter(sm => !onCut(sm, v.cut)) : samples,
      [...(v.cut ? wallSegs.filter(w => !onCutWall(w.el, v.cut)) : wallSegs), ...tallSegs, ...leafSegs])
      - (!v.cut && blocked(v.pos[0], v.pos[2]) ? 0.25 : 0) + (v.straight ? 0.02 : 0)
      - (insideTall(v.pos[0], v.pos[2]) ? 0.6 : 0)
      - (v.cut ? 0.1 : 0),                       // a view from inside the room is preferred when it is nearly as good
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { position: best.pos, target: best.look, fov: ROOM_FOV, straight: best.straight, cut: best.cut || null, coverage: Math.round(best.score * 100) };
}

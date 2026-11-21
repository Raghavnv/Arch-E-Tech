import { PLAN_SCALE } from '../components/Canvas3D';

/*
 * Where to stand to photograph a room: at eye level in the corner that looks at the walls with the
 * most windows and doors (and not where a door swings), aimed across the room with a wide lens.
 */
const EYE = 1.6;                // camera height, m
const INSET = 0.5;              // m from the wall centre line (walls are 0.4 m thick)
export const ROOM_FOV = 68;     // vertical; about 84 degrees across at 4:3

function wallLine(e) {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return { x0: e.left, y0: e.top, x1: e.left + e.width * Math.cos(a), y1: e.top + e.width * Math.sin(a), len: e.width };
}

/** Camera position and target (3D metres) for the best corner view of a room. */
export function cameraForRoom(room, elements) {
  const S = PLAN_SCALE;
  const x0 = room.left, x1 = room.left + room.width, y0 = room.top - room.height / 2, y1 = room.top + room.height / 2;
  const floor = room.floor || 1;
  const openings = elements.filter(e => (e.type === 'window' || e.type === 'door') && (e.floor || 1) === floor).map(e => ({ ...wallLine(e), type: e.type }));
  const tol = 8;
  // how much window / door a wall holds; walls are 'N' (y0), 'S' (y1), 'W' (x0), 'E' (x1)
  const onWall = (side) => openings.reduce((sum, o) => {
    const mx = (o.x0 + o.x1) / 2, my = (o.y0 + o.y1) / 2;
    const hit = side === 'N' ? Math.abs(my - y0) < tol && mx > x0 - tol && mx < x1 + tol
      : side === 'S' ? Math.abs(my - y1) < tol && mx > x0 - tol && mx < x1 + tol
        : side === 'W' ? Math.abs(mx - x0) < tol && my > y0 - tol && my < y1 + tol
          : Math.abs(mx - x1) < tol && my > y0 - tol && my < y1 + tol;
    return hit ? sum + o.len * (o.type === 'window' ? 1 : 0.6) : sum;
  }, 0);
  const doorNear = (cx, cy) => openings.some(o => o.type === 'door'
    && Math.hypot((o.x0 + o.x1) / 2 - cx, (o.y0 + o.y1) / 2 - cy) < 22);
  const corners = [
    { cx: x0, cy: y0, far: ['S', 'E'] }, { cx: x1, cy: y0, far: ['S', 'W'] },
    { cx: x0, cy: y1, far: ['N', 'E'] }, { cx: x1, cy: y1, far: ['N', 'W'] },
  ];
  // look at the walls with the most windows and doors; avoid standing where a door opens
  const best = corners.map(c => ({ ...c, score: onWall(c.far[0]) + onWall(c.far[1]) - (doorNear(c.cx, c.cy) ? 40 : 0) }))
    .sort((a, b) => b.score - a.score)[0];
  const ins = INSET / S;
  const camX = best.cx === x0 ? x0 + ins : x1 - ins;
  const camY = best.cy === y0 ? y0 + ins : y1 - ins;
  const oppX = best.cx === x0 ? x1 : x0, oppY = best.cy === y0 ? y1 : y0;
  const tx = camX + (oppX - camX) * 0.62, ty = camY + (oppY - camY) * 0.62;
  return { position: [camX * S, EYE, camY * S], target: [tx * S, EYE - 0.25, ty * S], fov: ROOM_FOV };
}


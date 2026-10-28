// Find the enclosed spaces in a hand-drawn plan and turn them into labelled room elements.
// Walls are rasterised on a fine grid; every pocket of empty cells that can't reach the outside
// is a room. Openings drawn as doors/windows sit on top of walls, so they don't leak.

const RES = 5;              // raster cell, in canvas units (0.25 m)
const MIN_AREA_M2 = 2;

function guessKind(m2) {
  if (m2 < 7) return 'bathroom';
  if (m2 < 11) return 'study';
  if (m2 < 20) return 'bedroom';
  return 'living';
}

export function detectRooms(elements) {
  const walls = (elements || []).filter(el => el && el.type === 'wall' && el.width > 0);
  if (walls.length < 3) return [];

  // wall end points, to size the raster
  const segs = walls.map(w => {
    const a = ((w.angle || 0) * Math.PI) / 180;
    return { x0: w.left, y0: w.top, x1: w.left + w.width * Math.cos(a), y1: w.top + w.width * Math.sin(a),
             half: Math.max(4, (w.height || 8) / 2) + 1 };
  });
  const pad = 4 * RES;
  const minX = Math.min(...segs.flatMap(s => [s.x0, s.x1])) - pad;
  const minY = Math.min(...segs.flatMap(s => [s.y0, s.y1])) - pad;
  const maxX = Math.max(...segs.flatMap(s => [s.x0, s.x1])) + pad;
  const maxY = Math.max(...segs.flatMap(s => [s.y0, s.y1])) + pad;
  const W = Math.ceil((maxX - minX) / RES);
  const H = Math.ceil((maxY - minY) / RES);
  if (W * H > 4_000_000) return [];
  const grid = new Uint8Array(W * H);         // 0 empty, 1 wall, 2 outside, 3 claimed

  // a cell is wall if its centre is within the wall's half thickness of the wall's centre line
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const len2 = dx * dx + dy * dy || 1;
    const gx0 = Math.max(0, Math.floor((Math.min(s.x0, s.x1) - s.half - minX) / RES));
    const gx1 = Math.min(W - 1, Math.ceil((Math.max(s.x0, s.x1) + s.half - minX) / RES));
    const gy0 = Math.max(0, Math.floor((Math.min(s.y0, s.y1) - s.half - minY) / RES));
    const gy1 = Math.min(H - 1, Math.ceil((Math.max(s.y0, s.y1) + s.half - minY) / RES));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const px = minX + (gx + 0.5) * RES, py = minY + (gy + 0.5) * RES;
        const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / len2));
        const ex = s.x0 + t * dx - px, ey = s.y0 + t * dy - py;
        if (ex * ex + ey * ey <= s.half * s.half) grid[gy * W + gx] = 1;
      }
    }
  }

  const fill = (start, mark) => {
    const cells = [];
    const stack = [start];
    grid[start] = mark;
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      const x = i % W, y = (i / W) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const n of nb) {
        if (n >= 0 && grid[n] === 0) { grid[n] = mark; stack.push(n); }
      }
    }
    return cells;
  };
  fill(0, 2);     // the corner is always outside thanks to the padding

  const existing = (elements || []).filter(el => el && el.type === 'room');
  const rooms = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 0) continue;
    const cells = fill(i, 3);
    const m2 = (cells.length * RES * RES) / 400;
    if (m2 < MIN_AREA_M2) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cells) {
      const x = c % W, y = (c / W) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const left = minX + x0 * RES, top = minY + y0 * RES;
    const width = (x1 - x0 + 1) * RES, height = (y1 - y0 + 1) * RES;
    // a pocket that already holds a labelled room is left alone
    const labelled = existing.some(r => {
      const cx = r.left + r.width / 2, cy = r.top;
      return cx >= left && cx <= left + width && cy >= top && cy <= top + height;
    });
    if (labelled) continue;
    rooms.push({ left, top, width, height, m2 });
  }

  rooms.sort((a, b) => b.m2 - a.m2);
  const startN = existing.length;
  return rooms.map((r, k) => ({
    id: `room_${Math.random().toString(36).slice(2, 9)}`,
    type: 'room',
    kind: guessKind(r.m2),
    name: `Room ${startN + k + 1}`,
    area: Math.round(r.m2 * 10) / 10,
    left: r.left,
    top: r.top + r.height / 2,
    width: r.width,
    height: r.height,
    angle: 0,
  }));
}

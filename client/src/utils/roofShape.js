/*
 * The outline of a storey for its roof. Rooms are rectangles (metres, {x, z, w, d}); grown by half a wall
 * they cover the house out to the outer face of its walls. On a compressed grid of their edges we get:
 *   slabPieces  – non-overlapping rectangles covering exactly the footprint (for a flat roof slab)
 *   outline     – the outer edges of the footprint, merged (for a parapet that follows the walls)
 *   roofRects   – a few large, possibly overlapping rectangles covering the footprint, each of which
 *                 gets its own hipped roof; where they overlap the roofs meet in valleys, as an L- or
 *                 T-shaped house is roofed in real life.
 */
const q = (v) => Math.round(v * 20) / 20;      // 5 cm: edges this close are the same edge

export function footprint(rects, grow = 0) {
  const rs = rects.filter(r => r.w > 0.05 && r.d > 0.05)
    .map(r => ({ x0: q(r.x - grow), z0: q(r.z - grow), x1: q(r.x + r.w + grow), z1: q(r.z + r.d + grow) }));
  const xs = [...new Set(rs.flatMap(r => [r.x0, r.x1]))].sort((a, b) => a - b);
  const zs = [...new Set(rs.flatMap(r => [r.z0, r.z1]))].sort((a, b) => a - b);
  const nx = Math.max(0, xs.length - 1), nz = Math.max(0, zs.length - 1);
  const fill = Array.from({ length: nz }, (_, j) => Array.from({ length: nx }, (_, i) => {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    return rs.some(r => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1);
  }));
  return { xs, zs, nx, nz, fill };
}

export function slabPieces(fp) {
  const { xs, zs, nx, nz, fill } = fp;
  const out = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx;) {
      if (!fill[j][i]) { i++; continue; }
      let k = i;
      while (k < nx && fill[j][k]) k++;
      out.push({ x: xs[i], z: zs[j], w: xs[k] - xs[i], d: zs[j + 1] - zs[j] });
      i = k;
    }
  }
  return out;
}

/** Outer edges as segments [x0, z0, x1, z1] plus the side the outside is on (nx, nz). */
export function outline(fp) {
  const { xs, zs, nx, nz, fill } = fp;
  const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && fill[j][i];
  const segs = [];
  // horizontal edges (along x) at each z line
  for (let j = 0; j <= nz; j++) {
    for (const side of [-1, 1]) {               // -1: outside is towards -z (the cell above is empty)
      let start = null;
      for (let i = 0; i <= nx; i++) {
        const edge = i < nx && (side < 0 ? at(i, j) && !at(i, j - 1) : at(i, j - 1) && !at(i, j));
        if (edge && start === null) start = i;
        if (!edge && start !== null) { segs.push({ a: [xs[start], zs[j]], b: [xs[i], zs[j]], out: [0, side] }); start = null; }
      }
    }
  }
  for (let i = 0; i <= nx; i++) {
    for (const side of [-1, 1]) {
      let start = null;
      for (let j = 0; j <= nz; j++) {
        const edge = j < nz && (side < 0 ? at(i, j) && !at(i - 1, j) : at(i - 1, j) && !at(i, j));
        if (edge && start === null) start = j;
        if (!edge && start !== null) { segs.push({ a: [xs[i], zs[start]], b: [xs[i], zs[j]], out: [side, 0] }); start = null; }
      }
    }
  }
  return segs;
}

/** Greedy cover of the footprint by the largest all-filled rectangles, overlaps allowed. */
export function roofRects(fp, max = 8) {
  const { xs, zs, nx, nz, fill } = fp;
  if (!nx || !nz) return [];
  // prefix sums of empty cells, to test a rectangle in O(1)
  const P = Array.from({ length: nz + 1 }, () => new Array(nx + 1).fill(0));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) P[j + 1][i + 1] = P[j][i + 1] + P[j + 1][i] - P[j][i] + (fill[j][i] ? 0 : 1);
  const empty = (i0, j0, i1, j1) => P[j1][i1] - P[j0][i1] - P[j1][i0] + P[j0][i0];
  const cand = [];
  for (let j0 = 0; j0 < nz; j0++) for (let i0 = 0; i0 < nx; i0++) {
    if (!fill[j0][i0]) continue;
    for (let j1 = j0 + 1; j1 <= nz; j1++) {
      if (empty(i0, j0, i0 + 1, j1)) break;
      for (let i1 = i0 + 1; i1 <= nx; i1++) {
        if (empty(i0, j0, i1, j1)) break;
        // keep only maximal ones (can't grow in any direction)
        const grow = (i1 < nx && !empty(i1, j0, i1 + 1, j1)) || (j1 < nz && !empty(i0, j1, i1, j1 + 1))
          || (i0 > 0 && !empty(i0 - 1, j0, i0, j1)) || (j0 > 0 && !empty(i0, j0 - 1, i1, j0));
        if (!grow) cand.push([i0, j0, i1, j1]);
      }
    }
  }
  const covered = Array.from({ length: nz }, () => new Array(nx).fill(false));
  const cellArea = (i, j) => (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j]);
  let left = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (fill[j][i]) left += cellArea(i, j);
  const total = left;
  const out = [];
  while (out.length < max && left > total * 0.002) {
    let best = null, gain = 0;
    for (const c of cand) {
      let g = 0;
      for (let j = c[1]; j < c[3]; j++) for (let i = c[0]; i < c[2]; i++) if (!covered[j][i]) g += cellArea(i, j);
      if (g > gain) { gain = g; best = c; }
    }
    if (!best) break;
    for (let j = best[1]; j < best[3]; j++) for (let i = best[0]; i < best[2]; i++) {
      if (!covered[j][i]) { covered[j][i] = true; left -= cellArea(i, j); }
    }
    out.push({ x: xs[best[0]], z: zs[best[1]], w: xs[best[2]] - xs[best[0]], d: zs[best[3]] - zs[best[1]] });
  }
  return out;
}

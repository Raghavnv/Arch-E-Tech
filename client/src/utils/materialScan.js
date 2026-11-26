import { rgbToLab } from './photoPalette';
import { FLOOR_FINISHES, FLOOR_BY_ID } from './floorFinishes';
import { SCANNED_WALLS } from './textureLibrary';
import REFERENCE from './materialReference.json';

/*
 * Scan a material: a photo of a real sample (a wood plank, a marble slab, granite, a stone, brick, tile)
 * becomes a finish the house can use.
 *
 *   classifyMaterial(img)  what it looks like it is: its nearest neighbours among 483 labelled photos of real
 *                          materials (materialReference.json, measured the same way), blended with rules for
 *                          the tell-tale signs: grain that runs one way
 *                          (wood), thin dark veins on a pale quiet ground (marble), fine many-coloured
 *                          speckle (granite), chips on a pale ground (terrazzo), a grid of joints (tile,
 *                          brick), and so on. Ranked, so the owner can pick the runner-up.
 *   makeTile(img)          the middle of the photo, its uneven lighting flattened and its edges blended
 *                          into each other, so it repeats across a floor without visible seams
 *   registerMaterials(ms)  puts scanned materials into the floor and wall libraries, so every view (2D,
 *                          3D, walkthrough, costs) draws them like any built-in finish
 *
 * A scanned material is saved with the project: { id: 'scan_…', name, kind, color, image, tile_m, price }.
 */
export const MATERIAL_KINDS = {
  wood:       { label: 'Wood',          tile: 1.2, price: 70, rough: 0.5 },
  marble:     { label: 'Marble',        tile: 1.2, price: 90, rough: 0.12 },
  granite:    { label: 'Granite',       tile: 0.6, price: 65, rough: 0.2 },
  terrazzo:   { label: 'Terrazzo',      tile: 0.8, price: 70, rough: 0.25 },
  stone:      { label: 'Natural stone', tile: 0.9, price: 55, rough: 0.6 },
  brick:      { label: 'Brick',         tile: 0.9, price: 40, rough: 0.85 },
  terracotta: { label: 'Terracotta',    tile: 0.6, price: 32, rough: 0.6 },
  concrete:   { label: 'Concrete',      tile: 1.5, price: 45, rough: 0.35 },
  tile:       { label: 'Tile',          tile: 0.6, price: 35, rough: 0.2 },
  other:      { label: 'Other',         tile: 0.8, price: 50, rough: 0.6 },
};

// ---- reading the photo --------------------------------------------------------------------------
const S = 128;

/** The square in the middle of the photo (most of it), as a canvas of `size`. */
function middle(img, size, frac = 0.8) {
  const w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height;
  const side = Math.min(w, h) * frac;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return c;
}

const band = (x, lo, hi, soft) => (x < lo ? Math.max(0, 1 - (lo - x) / soft) : x > hi ? Math.max(0, 1 - (x - hi) / soft) : 1);
const hueOf = (a, b) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;

/** Colour and texture measurements of the sample. */
export function measure(img) {
  const d = middle(img, S).getContext('2d').getImageData(0, 0, S, S).data;
  const L = new Float32Array(S * S), A = new Float32Array(S * S), B = new Float32Array(S * S);
  let r = 0, gg = 0, bb = 0;
  for (let i = 0; i < S * S; i++) {
    const [l, a, b] = rgbToLab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    L[i] = l; A[i] = a; B[i] = b; r += d[i * 4]; gg += d[i * 4 + 1]; bb += d[i * 4 + 2];
  }
  const n = S * S, mean = (arr) => arr.reduce((s, v) => s + v, 0) / n;
  const mL = mean(L), mA = mean(A), mB = mean(B);
  const sd = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  const sdL = sd(L, mL), sdAB = Math.sqrt(sd(A, mA) ** 2 + sd(B, mB) ** 2);

  // gradients: how strong the texture is, and whether it runs one way (grain), two ways (joints) or every way (speckle)
  let jxx = 0, jyy = 0, jxy = 0, mag = 0;
  const hist = new Float64Array(12);
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const p = (yy, xx) => L[yy * S + xx];
      const gx = p(y - 1, x + 1) + 2 * p(y, x + 1) + p(y + 1, x + 1) - p(y - 1, x - 1) - 2 * p(y, x - 1) - p(y + 1, x - 1);
      const gy = p(y + 1, x - 1) + 2 * p(y + 1, x) + p(y + 1, x + 1) - p(y - 1, x - 1) - 2 * p(y - 1, x) - p(y - 1, x + 1);
      jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
      const m = Math.hypot(gx, gy);
      mag += m;
      hist[Math.floor((((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180) / 15) % 12] += m * m;
    }
  }
  const tot = hist.reduce((s, v) => s + v, 0) || 1;
  const peak = hist.indexOf(Math.max(...hist));
  const one = hist[peak] / tot, other = hist[(peak + 6) % 12] / tot;
  const coherence = Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / ((jxx + jyy) || 1);

  // fine detail (speckle) against coarse detail: L minus a 3 px and a 9 px blur
  const blur = (k) => {
    const out = new Float32Array(n);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - k); yy <= Math.min(S - 1, y + k); yy += Math.max(1, k >> 1)) {
        for (let xx = Math.max(0, x - k); xx <= Math.min(S - 1, x + k); xx += Math.max(1, k >> 1)) { s += L[yy * S + xx]; c++; }
      }
      out[y * S + x] = s / c;
    }
    return out;
  };
  const b1 = blur(1), b4 = blur(4);
  let fine = 0, coarse = 0, dark = 0, light = 0, chips = 0;
  for (let i = 0; i < n; i++) {
    fine += Math.abs(L[i] - b1[i]); coarse += Math.abs(b1[i] - b4[i]);
    if (L[i] < mL - 14) dark++;
    if (L[i] > mL + 14) light++;
    if (Math.hypot(A[i] - mA, B[i] - mB) > 12 || Math.abs(L[i] - mL) > 22) chips++;
  }
  // the shape of the texture, independent of how the photo was turned: edge directions from the strongest
  // one round, and how lightness spreads around its average
  const orient = Array.from({ length: 12 }, (_, i) => hist[(peak + i) % 12] / tot);
  const spread = new Array(8).fill(0);
  for (let i = 0; i < n; i++) spread[Math.max(0, Math.min(7, Math.floor(((L[i] - mL) / Math.max(sdL, 1)) * 1.5 + 4)))]++;
  return {
    orient, spread: spread.map(v => v / n), A: mA, B: mB,
    L: mL, chroma: Math.hypot(mA, mB), hue: hueOf(mA, mB), sdL, sdAB, coherence, one, other,
    grid: one + other, mag: mag / n, fine: fine / n, coarse: coarse / n, dark: dark / n, light: light / n, chips: chips / n,
    color: `#${[r, gg, bb].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`,
  };
}

// a sample as numbers to compare: colour counts double, then texture, edge directions and lightness spread
const VEC = (L, A, B, chroma, sdL, sdAB, coherence, one, other, fine, coarse, dark, light, chips, orient, spread) => [
  (L / 100) * 2, (A / 40) * 2, (B / 40) * 2, (chroma / 40) * 2, sdL / 25, sdAB / 15, coherence, one * 2, other * 2, fine / 3, coarse / 3,
  dark * 2, light * 2, chips, ...orient.map(v => v * 3), ...spread.map(v => v * 2)];
let REF = null;
const reference = () => REF || (REF = REFERENCE.rows.map(r => ({ kind: REFERENCE.kinds[r[0]], v: VEC(...r.slice(1, 15), r.slice(15, 27), r.slice(27, 35)) })));

/** Votes of the nearest labelled photos: { kind: share } (shares add up to 1). `skip` leaves one out, for testing. */
export function nearestKinds(f, k = 9, skip = -1) {
  const v = VEC(f.L, f.A, f.B, f.chroma, f.sdL, f.sdAB, f.coherence, f.one, f.other, f.fine, f.coarse, f.dark, f.light, f.chips, f.orient, f.spread);
  const near = reference().map((r, i) => [i === skip ? Infinity : Math.sqrt(r.v.reduce((s, x, q) => s + (x - v[q]) ** 2, 0)), r.kind])
    .sort((a, b) => a[0] - b[0]).slice(0, k);
  const votes = {};
  near.forEach(([d, kind]) => { votes[kind] = (votes[kind] || 0) + 1 / (d + 0.05); });
  const sum = Object.values(votes).reduce((s, x) => s + x, 0) || 1;
  return Object.fromEntries(Object.entries(votes).map(([kd, x]) => [kd, x / sum]));
}

/** What the sample most likely is: [{ kind, score }] best first, plus the measurements. */
export function classifyMaterial(img, { skip = -1, ruleWeight = 0.1 } = {}) {
  const f = measure(img);
  return rank(f, skip, ruleWeight);
}

/** The ranking from measurements: mostly the labelled photos' votes, a little of the rules. */
export function rank(f, skip = -1, ruleWeight = 0.1) {
  const brownish = band(f.hue, 30, 90, 20) * band(f.chroma, 8, 55, 8);
  const redOrange = band(f.hue, 15, 60, 10) * band(f.chroma, 24, 80, 6);
  const quiet = band(f.chroma, 0, 12, 8);
  const directional = band(f.coherence, 0.3, 1, 0.18) * band(f.one, 0.2, 1, 0.08);
  const isotropic = band(f.coherence, 0, 0.18, 0.15);
  // joints: strong edges two ways at right angles (tiles, bricks, parquet), not one (grain)
  const joints = band(f.grid, 0.42, 1, 0.12) * band(f.other / Math.max(f.one, 0.01), 0.35, 1, 0.25);
  const patterned = band(f.sdL, 16, 100, 6);                      // printed or inlaid patterns: high contrast
  const speckle = band(f.fine / Math.max(f.coarse, 0.05), 1.3, 100, 0.5);  // detail finer than it is broad
  const scores = {
    wood: brownish * band(f.L, 18, 78, 10) * band(f.sdL, 2, 100, 2) * Math.max(0.35 + 0.65 * directional, 0.9 * joints * (1 - patterned)),
    marble: band(f.L, 58, 100, 10) * quiet * band(f.dark, 0.02, 0.3, 0.04) * band(f.fine, 0, 2.2, 1) * (1 - 0.7 * joints)
      + band(f.L, 0, 32, 8) * quiet * band(f.light, 0.02, 0.3, 0.04) * band(f.fine, 0, 2, 0.8) * 0.9,
    granite: band(f.fine, 1.8, 100, 0.8) * isotropic * band(f.sdL, 4, 20, 8) * (0.5 + 0.5 * speckle) * (1 - joints),
    terrazzo: band(f.L, 50, 100, 10) * band(f.chroma, 0, 15, 6) * band(f.chips, 0.08, 0.6, 0.06) * isotropic * band(f.sdAB, 5, 100, 3) * band(f.fine, 0.8, 4, 1) * (1 - 0.7 * patterned),
    stone: band(f.L, 22, 75, 10) * band(f.chroma, 0, 24, 8) * band(f.coarse, 1.2, 100, 0.8) * isotropic * (1 - 0.6 * speckle) * (1 - joints) * 0.85,
    brick: redOrange * band(f.hue, 15, 44, 8) * (0.45 + 0.55 * joints) * band(f.L, 22, 62, 10) * (1 - directional),
    terracotta: redOrange * band(f.hue, 38, 64, 8) * band(f.sdL, 0, 14, 6) * band(f.L, 38, 72, 10) * (1 - directional),
    concrete: band(f.chroma, 0, 9, 5) * band(f.sdL, 0, 9, 5) * band(f.fine, 0, 1.4, 0.8) * band(f.L, 35, 85, 10) * (1 - directional) * (1 - 0.5 * joints),
    tile: joints * Math.max(band(f.fine, 0, 1.6, 1), patterned) * (1 - 0.6 * brownish * (1 - patterned)) * 0.9 + patterned * isotropic * band(f.chips, 0.3, 1, 0.1) * 0.8,
  };
  const near = nearestKinds(f, 9, skip);
  const ranked = Object.entries(scores).map(([kind, score]) => ({ kind, score: Math.round(((1 - ruleWeight) * (near[kind] || 0) + ruleWeight * Math.min(1, score)) * 100) / 100 }))
    .sort((a, b) => b.score - a.score);
  return { ranked, features: f };
}

// ---- naming ---------------------------------------------------------------------------------------
const shade = (L) => (L > 68 ? 'Light' : L > 50 ? 'Mid' : L > 34 ? 'Dark' : 'Deep');
function colourWord(f) {
  if (f.chroma < 7) return f.L > 78 ? 'White' : f.L > 55 ? 'Grey' : f.L > 30 ? 'Charcoal' : 'Black';
  const h = f.hue;
  if (h < 40) return f.L > 60 ? 'Rose' : 'Red';
  if (h < 75) return f.L > 70 ? 'Beige' : f.L > 45 ? 'Tan' : 'Brown';
  if (h < 105) return f.L > 65 ? 'Cream' : 'Olive';
  if (h < 200) return 'Green';
  if (h < 290) return 'Blue';
  return 'Purple';
}
/** A first name for the scan, which the owner can change. */
export function suggestName(kind, f) {
  if (kind === 'wood') return `${shade(f.L)} ${f.hue < 55 && f.chroma > 22 ? 'teak-toned' : f.L > 60 ? 'oak-toned' : f.L < 38 ? 'walnut-toned' : ''} wood`.replace(/\s+/g, ' ');
  if (kind === 'other') return `${colourWord(f)} material`;
  return `${colourWord(f)} ${MATERIAL_KINDS[kind].label.toLowerCase()}`;
}

// ---- the tile -------------------------------------------------------------------------------------
/** The sample as a 512 px seamless JPEG data URL. */
export function makeTile(img, frac = 0.8) {
  const N = 512;
  const src = middle(img, N, frac);
  const g = src.getContext('2d', { willReadFrequently: true });
  const px = g.getImageData(0, 0, N, N);
  // flatten the light: divide by a very blurred copy (8 x 8, smoothed back up), keep the average
  const lo = document.createElement('canvas'); lo.width = lo.height = 8;
  lo.getContext('2d').drawImage(src, 0, 0, 8, 8);
  const up = document.createElement('canvas'); up.width = up.height = N;
  const ug = up.getContext('2d', { willReadFrequently: true });
  ug.imageSmoothingQuality = 'high';
  ug.drawImage(lo, 0, 0, N, N);
  const bl = ug.getImageData(0, 0, N, N).data;
  const avg = [0, 1, 2].map(c => { let s = 0; for (let i = c; i < bl.length; i += 4) s += bl[i]; return s / (N * N); });
  const flat = new Uint8ClampedArray(px.data.length);
  for (let i = 0; i < flat.length; i += 4) {
    for (let c = 0; c < 3; c++) flat[i + c] = (px.data[i + c] * avg[c]) / Math.max(12, bl[i + c]);
    flat[i + 3] = 255;
  }
  // blend the edges into a copy shifted by half a tile: the copy wraps, so the edges then meet themselves
  const out = new ImageData(N, N);
  const H = N / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const e = Math.min(x, N - 1 - x, y, N - 1 - y) / N;          // 0 at the edge, 0.5 in the middle
      const t = Math.min(1, e / 0.22), w = t * t * (3 - 2 * t);       // smoothstep
      const i = (y * N + x) * 4, j = (((y + H) % N) * N + ((x + H) % N)) * 4;
      for (let c = 0; c < 3; c++) out.data[i + c] = flat[i + c] * w + flat[j + c] * (1 - w);
      out.data[i + 3] = 255;
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  c.getContext('2d').putImageData(out, 0, 0);
  return c.toDataURL('image/jpeg', 0.86);
}

// ---- the libraries -----------------------------------------------------------------------------------
const loaded = new Map();      // id -> HTMLImageElement

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Make these scanned materials usable everywhere. Resolves once their pictures have loaded. */
export async function registerMaterials(list) {
  for (const m of list || []) {
    if (!m?.id || !m.image) continue;
    // a material seen before keeps its picture; its name, size or price may have changed
    let img = loaded.get(m.id);
    if (!img || img.src !== m.image) {
      img = await loadImage(m.image);
      if (!img) continue;
      loaded.set(m.id, img);
    }
    const kind = MATERIAL_KINDS[m.kind] || MATERIAL_KINDS.other;
    const floor = {
      id: m.id, group: 'Your materials', name: m.name, color: m.color || '#999', price: m.price ?? kind.price,
      tile: m.tile_m || kind.tile, rough: kind.rough, scanned: true,
      draw: (g) => g.drawImage(img, 0, 0, g.canvas.width, g.canvas.height),
    };
    const at = FLOOR_FINISHES.findIndex(f => f.id === m.id);
    if (at >= 0) FLOOR_FINISHES[at] = floor; else FLOOR_FINISHES.push(floor);
    FLOOR_BY_ID[m.id] = floor;
    const wall = { id: m.id, name: m.name, color: m.color || '#999', url: m.image, tag: kind.label, scanned: true };
    const w = SCANNED_WALLS.findIndex(x => x.id === m.id);
    if (w >= 0) SCANNED_WALLS[w] = wall; else SCANNED_WALLS.push(wall);
  }
}

/** A short id for a new scan. */
export const newScanId = () => `scan_${Math.random().toString(36).slice(2, 10)}`;

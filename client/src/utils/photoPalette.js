import { PAINT_COLOURS, WOOD_FINISHES } from './textureLibrary';
import { FLOOR_FINISHES } from './floorFinishes';
import { DESIGN_STYLES } from './designStyles';

/*
 * Match finishes to a photo, all in the browser: the photo's colours are grouped (k-means in Lab, the
 * colour space where distance follows what the eye sees), then
 *   walls    the largest light, quiet colour in the upper part of the picture   -> the nearest paint
 *   floor    the main colour of the bottom quarter                             -> the nearest floor finish
 *   accent   the strongest colour that covers a real area                      -> a paint, or a wood finish if it is wood
 *   style    the design style whose palette sits closest to the photo's
 * Each pick comes with the next-closest alternatives, so the owner can nudge it.
 */

// ---- colour maths ----------------------------------------------------------------------------
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function rgbToLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function hexToLab(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const chroma = (l) => Math.hypot(l[1], l[2]);
const hue = (l) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
const toHex = (rgb) => `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// ---- the catalogue, in Lab -------------------------------------------------------------------
const PAINTS = PAINT_COLOURS.flatMap(g => g.colours.map(([name, hex]) => ({ id: hex, name, hex, lab: hexToLab(hex) })));
const WOODS = WOOD_FINISHES.map(f => ({ id: f.id, name: f.name, hex: f.color, lab: hexToLab(f.color) }));
const BOLD_FLOORS = new Set(['moroccan', 'checker', 'athangudi', 'mosaic']);
const WOOD_FLOOR = new Set(FLOOR_FINISHES.filter(f => f.group === 'Wood').map(f => f.id));
const FLOORS = FLOOR_FINISHES.filter(f => f.color.length >= 4).map(f => ({ id: f.id, name: f.name, hex: f.color, lab: hexToLab(f.color), bold: BOLD_FLOORS.has(f.id) }));

// photos are lit unevenly, so lightness counts for less than hue and strength (wl < 1)
const dEw = (a, b, wl) => Math.hypot(wl * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);
const nearest = (lab, list, n = 4, skip = () => false, wl = 1) =>
  list.filter(x => !skip(x)).map(x => ({ ...x, d: dEw(lab, x.lab, wl) + (x.bold ? 10 : 0) })).sort((a, b) => a.d - b.d).slice(0, n);
// the paint for a whole house is a light one; strong colours are for the accent wall
const LIGHT_PAINTS = PAINTS.filter(p => p.lab[0] >= 68);

// ---- k-means ---------------------------------------------------------------------------------
function kmeans(px, k, iters = 12) {
  if (px.length <= k) return px.map(p => ({ lab: p.lab, rgb: p.rgb, share: 1 / px.length, y: p.y }));
  // spread the starting centres: each next one is the pixel furthest from those chosen (on a sample)
  const step = Math.max(1, Math.floor(px.length / 600));
  const sample = px.filter((_, i) => i % step === 0);
  const centres = [sample[Math.floor(sample.length / 2)].lab.slice()];
  while (centres.length < k) {
    let far = null, fd = -1;
    for (const p of sample) {
      const d = Math.min(...centres.map(c => dE(p.lab, c)));
      if (d > fd) { fd = d; far = p; }
    }
    centres.push(far.lab.slice());
  }
  const owner = new Int32Array(px.length);
  for (let it = 0; it < iters; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let best = 0, bd = Infinity;
      centres.forEach((c, j) => { const d = dE(p.lab, c); if (d < bd) { bd = d; best = j; } });
      owner[i] = best;
      const s = sum[best]; s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; s[3]++;
    });
    sum.forEach((s, j) => { if (s[3]) centres[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const acc = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0, y: 0 }));
  px.forEach((p, i) => { const a = acc[owner[i]]; a.n++; a.r += p.rgb[0]; a.g += p.rgb[1]; a.b += p.rgb[2]; a.y += p.y; });
  return centres.map((lab, j) => ({ lab, share: acc[j].n / px.length, y: acc[j].n ? acc[j].y / acc[j].n : 0.5,
    rgb: acc[j].n ? [acc[j].r / acc[j].n, acc[j].g / acc[j].n, acc[j].b / acc[j].n] : [128, 128, 128] }))
    .filter(c => c.share > 0).sort((a, b) => b.share - a.share);
}

/** The photo (an <img> that has loaded) as Lab pixels with their height in the picture (0 top, 1 bottom). */
function pixelsOf(img) {
  const S = 160, k = Math.min(1, S / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 200) continue;
      const rgb = [d[i], d[i + 1], d[i + 2]];
      const lab = rgbToLab(...rgb);
      // blown-out windows and deep shadow say nothing about the finishes
      if ((lab[0] > 96 && chroma(lab) < 5) || lab[0] < 7) continue;
      out.push({ lab, rgb, y: y / h });
    }
  }
  return out;
}

// sky through a window: blue, bright, high in the picture
const isSky = (c) => c.lab[2] < -10 && c.lab[0] > 50 && c.y < 0.4;
const isWood = (lab) => { const h = hue(lab), C = chroma(lab); return h > 40 && h < 80 && C > 14 && C < 48 && lab[0] > 22 && lab[0] < 68; };

/** Everything the photo suggests. */
export function analysePhoto(img) {
  const px = pixelsOf(img);
  if (px.length < 50) throw new Error('That photo is mostly blank. Try one of a furnished room in daylight.');
  const palette = kmeans(px, 7).map(c => ({ ...c, hex: toHex(c.rgb) }));

  // walls: light and quiet, in the upper part of the picture, and big
  // (lighter counts for more: walls are the big pale surfaces; the sofa and the shadows are not)
  const wallScore = (c) => c.share * (1.3 - c.y) * (c.lab[0] / 60) ** 2;
  const wallish = palette.filter(c => c.lab[0] >= 55 && chroma(c.lab) <= 38 && c.y < 0.8 && !isSky(c));
  const pool = wallish.length ? wallish : palette.filter(c => !isSky(c)).length ? palette.filter(c => !isSky(c)) : palette;
  const wallC = pool.slice().sort((a, b) => wallScore(b) - wallScore(a))[0];
  const walls = nearest(wallC.lab, LIGHT_PAINTS, 4, undefined, 0.35);

  // floor: the main colour of the bottom quarter
  // floor: the bottom strip of the picture (below most rugs and furniture); wood wins when there is plenty of it
  const low = px.filter(p => p.y > 0.82);
  const lowC = kmeans(low.length > 30 ? low : px.filter(p => p.y > 0.7), 3);
  const floorC = lowC.find(c => isWood(c.lab) && c.share >= 0.2) || lowC[0];
  let floors = nearest(floorC.lab, FLOORS, 4, undefined, 0.6);
  // a rug often covers the floor: if there is wood lower down, offer the closest wood floor too
  const woodLow = kmeans(px.filter(p => p.y > 0.6), 4).find(c => isWood(c.lab) && c.share >= 0.12);
  if (woodLow && !floors.some(f => f.id === nearest(woodLow.lab, FLOORS, 1, f => !WOOD_FLOOR.has(f.id), 0.6)[0]?.id)) {
    floors = [...floors.slice(0, 3), nearest(woodLow.lab, FLOORS, 1, f => !WOOD_FLOOR.has(f.id), 0.6)[0]];
  }

  // accent: the strongest colour that covers a real area and isn't the walls
  const accents = palette.filter(c => c !== wallC && !isSky(c) && c.share > 0.025 && chroma(c.lab) > 18)
    .sort((a, b) => chroma(b.lab) * Math.sqrt(b.share) - chroma(a.lab) * Math.sqrt(a.share));
  const accentC = accents[0] || null;
  let accent = null;
  if (accentC) {
    const wood = isWood(accentC.lab);
    accent = {
      kind: wood ? 'wood' : 'paint', from: accentC.hex,
      choices: wood ? nearest(accentC.lab, WOODS, 3) : nearest(accentC.lab, PAINTS, 4, p => p.id === walls[0].id),
    };
  }

  // style: the palette closest to the photo's, both ways round
  const main = palette.slice(0, 5);
  const styles = DESIGN_STYLES.map(s => {
    const sw = s.swatch.map(hexToLab);
    const toStyle = main.reduce((t, c) => t + c.share * Math.min(...sw.map(x => dE(c.lab, x))), 0) / main.reduce((t, c) => t + c.share, 0);
    const toPhoto = sw.reduce((t, x) => t + Math.min(...main.map(c => dE(c.lab, x))), 0) / sw.length;
    return { id: s.id, name: s.name, swatch: s.swatch, d: toStyle * 0.6 + toPhoto * 0.4 };
  }).sort((a, b) => a.d - b.d);

  return { palette, walls, floors, accent, styles: styles.slice(0, 3), wallFrom: wallC.hex, floorFrom: toHex(floorC.rgb) };
}

const LIVED = new Set(['living', 'dining', 'lounge', 'master_bedroom', 'bedroom', 'study', 'guest', 'pooja', 'hallway', 'foyer', 'corridor', 'closet']);
const FLOORED = new Set(['living', 'dining', 'lounge', 'master_bedroom', 'bedroom', 'study', 'guest', 'hallway', 'foyer', 'corridor', 'closet']);
const FEATURE = new Set(['living', 'lounge', 'master_bedroom']);

/** The finish ops (see editOps.applyClientOps) that put the chosen picks on the house or on one room. */
export function opsFor(elements, picks, scope) {
  const rooms = elements.filter(e => e.type === 'room');
  const one = scope !== 'house' ? rooms.find(r => r.id === scope) : null;
  const ids = (set) => (one ? [one.id] : rooms.filter(r => set.has(r.kind)).map(r => r.id));
  const ops = [];
  if (!one && picks.style) ops.push({ do: 'apply_style', style: picks.style });
  if (picks.wall) ops.push({ do: 'paint_walls', rooms: ids(LIVED), material: picks.wall, isColor: true });
  if (picks.floor) ops.push({ do: 'set_floor', rooms: ids(FLOORED), finish: picks.floor });
  if (picks.accent) {
    const featureRooms = one ? [one.id] : rooms.filter(r => FEATURE.has(r.kind)).map(r => r.id);
    ops.push({ do: 'paint_walls', rooms: featureRooms, material: picks.accent.id, isColor: picks.accent.kind === 'paint', feature: true });
  }
  return ops;
}

export const roomsFor = (ops) => new Set(ops.flatMap(o => (Array.isArray(o.rooms) ? o.rooms : []))).size;

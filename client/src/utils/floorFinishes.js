import * as THREE from 'three';

/*
 * Floor finishes a room can have (`room.flooring = id`), each drawn procedurally on a canvas: no image
 * files, nothing to download. `tile` is how many metres one texture repeat covers in 3D; `price` is US
 * dollars per m2, supplied and laid (shown in the chosen currency).
 */
const rand = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const N = 512;

function planks(g, { tones, plankH = 64, plankL = 320, grain = 'rgba(60,35,15,0.18)', gap = 'rgba(0,0,0,0.35)', seed = 1 }) {
  const r = rand(seed);
  for (let y = 0; y < N; y += plankH) {
    let x = -Math.floor(r() * plankL);
    while (x < N) {
      const len = plankL * (0.6 + r() * 0.8);
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.fillRect(x, y, len, plankH);
      g.strokeStyle = grain; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const gy = y + 4 + r() * (plankH - 8);
        g.beginPath(); g.moveTo(x, gy);
        g.bezierCurveTo(x + len / 3, gy + (r() - 0.5) * 6, x + (2 * len) / 3, gy + (r() - 0.5) * 6, x + len, gy);
        g.stroke();
      }
      g.fillStyle = gap; g.fillRect(x + len - 1, y, 2, plankH);
      x += len;
    }
    g.fillStyle = gap; g.fillRect(0, y, N, 2);
  }
}

function herringbone(g, { tones, w = 32, l = 128, seed = 2, chevron = false }) {
  const r = rand(seed);
  g.fillStyle = tones[0]; g.fillRect(0, 0, N, N);
  for (let row = -2; row < N / w + 4; row++) {
    for (let col = -2; col < N / l + 4; col++) {
      for (const dir of [1, -1]) {
        g.save();
        const x = col * l + (dir < 0 ? l / 2 : 0), y = row * w * 2 + (dir < 0 ? w : 0);
        g.translate(x, y);
        g.rotate(dir * Math.PI / 4);
        g.fillStyle = tones[Math.floor(r() * tones.length)];
        g.fillRect(0, 0, chevron ? l * 0.72 : l * 0.7, w * 0.95);
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2;
        g.strokeRect(0, 0, chevron ? l * 0.72 : l * 0.7, w * 0.95);
        g.restore();
      }
    }
  }
}

function marble(g, { base, veins, seed = 3, count = 14, width = 1.6 }) {
  const r = rand(seed);
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 40; i++) {                    // soft clouds
    g.fillStyle = `rgba(${veins[1]},${0.03 + r() * 0.04})`;
    g.beginPath(); g.ellipse(r() * N, r() * N, 30 + r() * 90, 20 + r() * 60, r() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < count; i++) {                 // veins: wandering lines, wrapped so the tile repeats
    let x = r() * N, y = r() * N, a = r() * Math.PI * 2;
    g.strokeStyle = `rgba(${veins[0]},${0.25 + r() * 0.45})`;
    g.lineWidth = width * (0.4 + r());
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 40; k++) {
      a += (r() - 0.5) * 0.6; x += Math.cos(a) * 10; y += Math.sin(a) * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

function speckle(g, { base, dots, seed = 4, n = 2600, size = 3 }) {
  const r = rand(seed);
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    const s = size * (0.4 + r());
    g.beginPath(); g.ellipse(r() * N, r() * N, s, s * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill();
  }
}

function grid(g, { base, n, grout = 'rgba(0,0,0,0.25)', jitter = 0.04, seed = 5, gw = 2, brick = false }) {
  const r = rand(seed), s = N / n;
  for (let j = 0; j < n; j++) {
    for (let i = -1; i < n + 1; i++) {
      const x = i * s + (brick && j % 2 ? s / 2 : 0);
      const k = 1 + (r() - 0.5) * jitter * 2;
      g.fillStyle = shade(base, k);
      g.fillRect(x, j * s, s, s);
    }
  }
  g.fillStyle = grout;
  for (let j = 0; j <= n; j++) g.fillRect(0, j * s - gw / 2, N, gw);
  for (let j = 0; j < n; j++) for (let i = 0; i <= n + 1; i++) g.fillRect(i * s + (brick && j % 2 ? s / 2 : 0) - gw / 2, j * s, gw, s);
}

function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(x => Math.max(0, Math.min(255, Math.round(x * k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function moroccan(g, { a, b, n = 4 }) {
  const s = N / n;
  g.fillStyle = a; g.fillRect(0, 0, N, N);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = i * s + s / 2, cy = j * s + s / 2;
      g.fillStyle = b;
      g.beginPath();
      for (let k = 0; k < 8; k++) {                 // an eight-point star
        const ang = (k / 8) * Math.PI * 2, rr = k % 2 ? s * 0.22 : s * 0.42;
        g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      g.closePath(); g.fill();
      g.fillStyle = a;
      g.beginPath(); g.arc(cx, cy, s * 0.12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.strokeRect(i * s, j * s, s, s);
    }
  }
}

function hexagons(g, { base, grout = 'rgba(0,0,0,0.3)', r: R = 40, seed = 6 }) {
  const rr = rand(seed);
  g.fillStyle = grout; g.fillRect(0, 0, N, N);
  const h = Math.sqrt(3) * R;
  for (let row = -1; row < N / h + 2; row++) {
    for (let col = -1; col < N / (1.5 * R) + 2; col++) {
      const cx = col * 1.5 * R, cy = row * h + (col % 2 ? h / 2 : 0);
      g.fillStyle = shade(base, 0.95 + rr() * 0.1);
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(cx + (R - 2) * Math.cos((k * Math.PI) / 3), cy + (R - 2) * Math.sin((k * Math.PI) / 3));
      g.closePath(); g.fill();
    }
  }
}

function checker(g, { a, b, n = 8 }) {
  const s = N / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let k = 0; k <= n; k++) { g.fillRect(k * s - 1, 0, 2, N); g.fillRect(0, k * s - 1, N, 2); }
}

function athangudi(g, { a, b, c }) {
  const n = 4, s = N / n;
  g.fillStyle = a; g.fillRect(0, 0, N, N);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * s, y = j * s;
      g.fillStyle = b;
      g.beginPath(); g.arc(x, y, s * 0.42, 0, Math.PI / 2); g.lineTo(x, y); g.fill();
      g.beginPath(); g.arc(x + s, y, s * 0.42, Math.PI / 2, Math.PI); g.lineTo(x + s, y); g.fill();
      g.beginPath(); g.arc(x, y + s, s * 0.42, -Math.PI / 2, 0); g.lineTo(x, y + s); g.fill();
      g.beginPath(); g.arc(x + s, y + s, s * 0.42, Math.PI, Math.PI * 1.5); g.lineTo(x + s, y + s); g.fill();
      g.fillStyle = c;
      g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(x, y, s, s);
    }
  }
}

export const FLOOR_FINISHES = [
  // wood
  { id: 'oak', group: 'Wood', name: 'Natural oak planks', color: '#b98a5b', price: 55, tile: 2.2, rough: 0.55, draw: g => planks(g, { tones: ['#bb8c5d', '#b38455', '#c39566', '#ad7f52'], seed: 1 }) },
  { id: 'walnut', group: 'Wood', name: 'Walnut planks', color: '#5c3f2b', price: 75, tile: 2.2, rough: 0.5, draw: g => planks(g, { tones: ['#5e4130', '#674735', '#523828', '#6c4b36'], grain: 'rgba(20,10,5,0.25)', seed: 2 }) },
  { id: 'greyoak', group: 'Wood', name: 'Grey-washed oak', color: '#a59d92', price: 60, tile: 2.2, rough: 0.6, draw: g => planks(g, { tones: ['#a8a095', '#9d958a', '#b1aa9f', '#968e83'], grain: 'rgba(40,35,30,0.15)', seed: 3 }) },
  { id: 'teak', group: 'Wood', name: 'Teak planks', color: '#9a6232', price: 85, tile: 2.6, rough: 0.5, draw: g => planks(g, { tones: ['#a2683a', '#97602f', '#ab713f', '#8f5a2c'], plankH: 80, plankL: 420, seed: 4 }) },
  { id: 'herringbone', group: 'Wood', name: 'Herringbone oak', color: '#b5875a', price: 95, tile: 1.6, rough: 0.5, draw: g => herringbone(g, { tones: ['#bb8c5d', '#b08152', '#c49768', '#a97c4f'] }) },
  { id: 'chevron', group: 'Wood', name: 'Chevron walnut', color: '#6a4934', price: 105, tile: 1.6, rough: 0.5, draw: g => herringbone(g, { tones: ['#6a4934', '#5d4030', '#76533b', '#563b2b'], chevron: true, seed: 8 }) },
  { id: 'woodtile', group: 'Wood', name: 'Wood-look tile', color: '#a8794d', price: 30, tile: 2.4, rough: 0.35, draw: g => planks(g, { tones: ['#a97a4e', '#a37449', '#b08155'], plankH: 72, plankL: 512, seed: 9 }) },
  // stone
  { id: 'marble_white', group: 'Marble & stone', name: 'White marble', color: '#eeece8', price: 90, tile: 2.4, rough: 0.12, draw: g => marble(g, { base: '#efede9', veins: ['120,120,128', '160,160,170'] }) },
  { id: 'marble_black', group: 'Marble & stone', name: 'Black marble', color: '#1f1f22', price: 120, tile: 2.4, rough: 0.1, draw: g => marble(g, { base: '#1d1d20', veins: ['225,225,230', '80,80,90'], seed: 11, count: 10, width: 1.2 }) },
  { id: 'marble_beige', group: 'Marble & stone', name: 'Beige marble', color: '#dccbb0', price: 80, tile: 2.4, rough: 0.14, draw: g => marble(g, { base: '#ddcdb2', veins: ['170,140,100', '190,165,130'], seed: 13 }) },
  { id: 'granite', group: 'Marble & stone', name: 'Granite', color: '#4a4a4d', price: 65, tile: 1.2, rough: 0.2, draw: g => speckle(g, { base: '#4b4b4f', dots: ['#2a2a2d', '#76767c', '#9a8f86', '#1b1b1d'] }) },
  { id: 'kota', group: 'Marble & stone', name: 'Kota stone', color: '#6f7b78', price: 28, tile: 1.2, rough: 0.35, draw: g => grid(g, { base: '#6f7b78', n: 2, jitter: 0.06, grout: 'rgba(0,0,0,0.2)' }) },
  { id: 'terrazzo', group: 'Marble & stone', name: 'Terrazzo', color: '#e2ddd5', price: 70, tile: 1.4, rough: 0.2, draw: g => speckle(g, { base: '#e4dfd7', dots: ['#b9a68c', '#7d8a8a', '#c98f73', '#4f5658', '#f6f3ee'], n: 900, size: 6 }) },
  { id: 'concrete', group: 'Marble & stone', name: 'Polished concrete', color: '#9a9894', price: 45, tile: 3, rough: 0.3, draw: g => { speckle(g, { base: '#9b9995', dots: ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], n: 3000, size: 8 }); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, N / 2 - 1, N, 2); g.fillRect(N / 2 - 1, 0, 2, N); } },
  // tiles
  { id: 'vitrified', group: 'Tiles', name: 'Ivory vitrified, 60 cm', color: '#e6e0d4', price: 25, tile: 1.2, rough: 0.15, draw: g => grid(g, { base: '#e7e1d5', n: 2, jitter: 0.02, grout: 'rgba(0,0,0,0.12)' }) },
  { id: 'vitrified_grey', group: 'Tiles', name: 'Grey slab, 120 × 60', color: '#b7b5b1', price: 38, tile: 2.4, rough: 0.15, draw: g => grid(g, { base: '#b8b6b2', n: 2, jitter: 0.02, grout: 'rgba(0,0,0,0.12)', brick: true }) },
  { id: 'moroccan', group: 'Tiles', name: 'Moroccan pattern', color: '#2f5d74', price: 55, tile: 0.8, rough: 0.3, draw: g => moroccan(g, { a: '#efe8da', b: '#2f5d74' }) },
  { id: 'hexagon', group: 'Tiles', name: 'Hexagon, sage', color: '#a9b8a0', price: 48, tile: 0.8, rough: 0.3, draw: g => hexagons(g, { base: '#a9b8a0', grout: '#e8e6e0' }) },
  { id: 'checker', group: 'Tiles', name: 'Black & white check', color: '#888', price: 40, tile: 1.6, rough: 0.2, draw: g => checker(g, { a: '#1f1f22', b: '#efede8' }) },
  { id: 'terracotta', group: 'Tiles', name: 'Terracotta', color: '#b5653f', price: 32, tile: 1.2, rough: 0.6, draw: g => grid(g, { base: '#b5653f', n: 4, jitter: 0.08, grout: '#d9c7b3', gw: 4 }) },
  { id: 'mosaic', group: 'Tiles', name: 'Anti-skid mosaic', color: '#b9d3e0', price: 30, tile: 0.6, rough: 0.45, draw: g => grid(g, { base: '#b9d3e0', n: 8, jitter: 0.07, grout: '#eef3f6', gw: 3 }) },
  { id: 'athangudi', group: 'Tiles', name: 'Athangudi', color: '#9c3b2e', price: 60, tile: 1.0, rough: 0.35, draw: g => athangudi(g, { a: '#e9dcc3', b: '#9c3b2e', c: '#2f5d4a' }) },
];
export const FLOOR_BY_ID = Object.fromEntries(FLOOR_FINISHES.map(f => [f.id, f]));

const canvases = {};
function canvasFor(id) {
  if (!canvases[id]) {
    const f = FLOOR_BY_ID[id];
    const c = document.createElement('canvas');
    c.width = c.height = N;
    f.draw(c.getContext('2d'));
    canvases[id] = c;
  }
  return canvases[id];
}

/** A small picture of the finish for the panel. */
const swatches = {};
export function floorSwatch(id) {
  if (!swatches[id]) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    c.getContext('2d').drawImage(canvasFor(id), 0, 0, 96, 96);
    swatches[id] = c.toDataURL('image/png');
  }
  return swatches[id];
}

/** A repeating texture of the finish for a floor w × d metres. */
export function floorTexture3D(id, w, d) {
  const f = FLOOR_BY_ID[id];
  const tex = new THREE.CanvasTexture(canvasFor(id));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(w / f.tile, d / f.tile);
  return tex;
}

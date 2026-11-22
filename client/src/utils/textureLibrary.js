/**
 * Architectural Texture Library for Arch-E-Tech Studio
 * High-performance, seamless procedural SVG textures with verified Three.js compatibility.
 * Zero network dependencies, zero CORS issues, instant loading.
 */

const encodeSvg = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// 1. Red Clay Brick
const brickSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80">
  <rect width="160" height="80" fill="#782318"/>
  <rect x="2" y="2" width="76" height="36" fill="#9e2e20"/>
  <rect x="82" y="2" width="76" height="36" fill="#88271a"/>
  <rect x="2" y="42" width="36" height="36" fill="#88271a"/>
  <rect x="42" y="42" width="76" height="36" fill="#a83526"/>
  <rect x="122" y="42" width="36" height="36" fill="#9e2e20"/>
  <line x1="0" y1="40" x2="160" y2="40" stroke="#d4d4d8" stroke-width="4"/>
  <line x1="0" y1="0" x2="160" y2="0" stroke="#d4d4d8" stroke-width="4"/>
  <line x1="0" y1="80" x2="160" y2="80" stroke="#d4d4d8" stroke-width="4"/>
  <line x1="80" y1="0" x2="80" y2="40" stroke="#d4d4d8" stroke-width="4"/>
  <line x1="40" y1="40" x2="40" y2="80" stroke="#d4d4d8" stroke-width="4"/>
  <line x1="120" y1="40" x2="120" y2="80" stroke="#d4d4d8" stroke-width="4"/>
</svg>
`);

// 2. Warm Natural Oak Slats
const oakSlatsSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="160" viewBox="0 0 80 160">
  <rect width="80" height="160" fill="#181410"/>
  <rect x="4" y="0" width="16" height="160" fill="#b97a44"/>
  <rect x="24" y="0" width="16" height="160" fill="#c4864e"/>
  <rect x="44" y="0" width="16" height="160" fill="#ad713d"/>
  <rect x="64" y="0" width="16" height="160" fill="#ba7c47"/>
  <line x1="12" y1="0" x2="12" y2="160" stroke="#a46733" stroke-width="1" opacity="0.4"/>
  <line x1="32" y1="0" x2="32" y2="160" stroke="#af743c" stroke-width="1" opacity="0.4"/>
  <line x1="52" y1="0" x2="52" y2="160" stroke="#995f2d" stroke-width="1" opacity="0.4"/>
  <line x1="72" y1="0" x2="72" y2="160" stroke="#a76a35" stroke-width="1" opacity="0.4"/>
</svg>
`);

// 3. Raw Cast Architectural Concrete
const concreteSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="#9ca3af"/>
  <rect x="2" y="2" width="156" height="76" fill="#8e95a2" stroke="#6b7280" stroke-width="2"/>
  <rect x="2" y="82" width="156" height="76" fill="#949ba8" stroke="#6b7280" stroke-width="2"/>
  <circle cx="20" cy="20" r="4" fill="#4b5563"/>
  <circle cx="140" cy="20" r="4" fill="#4b5563"/>
  <circle cx="20" cy="60" r="4" fill="#4b5563"/>
  <circle cx="140" cy="60" r="4" fill="#4b5563"/>
  <circle cx="20" cy="100" r="4" fill="#4b5563"/>
  <circle cx="140" cy="100" r="4" fill="#4b5563"/>
  <circle cx="20" cy="140" r="4" fill="#4b5563"/>
  <circle cx="140" cy="140" r="4" fill="#4b5563"/>
</svg>
`);

// 4. White Venetian Plaster
const plasterSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#f4f4f5"/>
  <circle cx="30" cy="30" r="18" fill="#e4e4e7" opacity="0.6"/>
  <circle cx="90" cy="80" r="24" fill="#e4e4e7" opacity="0.5"/>
  <circle cx="70" cy="20" r="12" fill="#fafafa" opacity="0.8"/>
  <circle cx="30" cy="90" r="15" fill="#fafafa" opacity="0.7"/>
  <circle cx="60" cy="60" r="20" fill="#e4e4e7" opacity="0.4"/>
</svg>
`);

// 5. Dark Slate Masonry
const slateSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100">
  <rect width="160" height="100" fill="#18181b"/>
  <rect x="2" y="2" width="96" height="46" fill="#27272a" stroke="#09090b" stroke-width="3"/>
  <rect x="102" y="2" width="56" height="46" fill="#3f3f46" stroke="#09090b" stroke-width="3"/>
  <rect x="2" y="52" width="56" height="46" fill="#3f3f46" stroke="#09090b" stroke-width="3"/>
  <rect x="62" y="52" width="96" height="46" fill="#27272a" stroke="#09090b" stroke-width="3"/>
</svg>
`);

// 6. White Carrara Marble
const marbleSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#f8fafc"/>
  <path d="M-20,40 Q60,80 120,40 T220,100" fill="none" stroke="#cbd5e1" stroke-width="5" opacity="0.7"/>
  <path d="M10,140 Q80,110 140,160 T220,140" fill="none" stroke="#94a3b8" stroke-width="3" opacity="0.5"/>
  <path d="M40,-10 Q70,70 110,120 T150,220" fill="none" stroke="#e2e8f0" stroke-width="6" opacity="0.8"/>
  <path d="M-10,190 Q90,130 180,180" fill="none" stroke="#cbd5e1" stroke-width="2" opacity="0.6"/>
</svg>
`);

// 7. Ceramic Subway Tile
const subwayTileSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80">
  <rect width="160" height="80" fill="#cbd5e1"/>
  <rect x="2" y="2" width="76" height="36" fill="#ffffff" rx="1"/>
  <rect x="82" y="2" width="76" height="36" fill="#f8fafc" rx="1"/>
  <rect x="2" y="42" width="36" height="36" fill="#f8fafc" rx="1"/>
  <rect x="42" y="42" width="76" height="36" fill="#ffffff" rx="1"/>
  <rect x="122" y="42" width="36" height="36" fill="#ffffff" rx="1"/>
</svg>
`);

// 8. Smoked Fluted Wood Paneling
const flutedWoodSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="120" viewBox="0 0 60 120">
  <rect width="60" height="120" fill="#12100e"/>
  <rect x="2" y="0" width="8" height="120" fill="#3a2f26"/>
  <rect x="14" y="0" width="8" height="120" fill="#44372d"/>
  <rect x="26" y="0" width="8" height="120" fill="#362b23"/>
  <rect x="38" y="0" width="8" height="120" fill="#40342b"/>
  <rect x="50" y="0" width="8" height="120" fill="#332921"/>
</svg>
`);

// 9. Nordic Sage Green Plaster
const sagePlasterSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#4a5d4e"/>
  <circle cx="30" cy="30" r="16" fill="#556959" opacity="0.6"/>
  <circle cx="85" cy="85" r="22" fill="#3f4f42" opacity="0.5"/>
  <circle cx="70" cy="30" r="12" fill="#5c7261" opacity="0.6"/>
  <circle cx="25" cy="85" r="14" fill="#556959" opacity="0.5"/>
</svg>
`);

// 10. Warm Mediterranean Terracotta
const terracottaSvg = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
  <rect width="140" height="140" fill="#b45309"/>
  <rect x="2" y="2" width="66" height="66" fill="#c25e11" opacity="0.85"/>
  <rect x="72" y="2" width="66" height="66" fill="#a14906" opacity="0.9"/>
  <rect x="2" y="72" width="66" height="66" fill="#9a4304" opacity="0.9"/>
  <rect x="72" y="72" width="66" height="66" fill="#c96515" opacity="0.85"/>
  <line x1="0" y1="70" x2="140" y2="70" stroke="#78350f" stroke-width="3"/>
  <line x1="70" y1="0" x2="70" y2="140" stroke="#78350f" stroke-width="3"/>
</svg>
`);

export const ARCHITECTURAL_TEXTURES = [
  {
    id: 'mat_brick',
    name: 'Red Clay Brick',
    category: 'Masonry',
    url: brickSvg,
    color: '#8b2518',
    roughness: 0.85,
    tag: 'Classic Exterior'
  },
  {
    id: 'mat_oak_slats',
    name: 'Natural Oak Slats',
    category: 'Woodwork',
    url: oakSlatsSvg,
    color: '#b97a44',
    roughness: 0.6,
    tag: 'Japandi Interior'
  },
  {
    id: 'mat_concrete',
    name: 'Cast Raw Concrete',
    category: 'Industrial',
    url: concreteSvg,
    color: '#9ca3af',
    roughness: 0.7,
    tag: 'Brutalist'
  },
  {
    id: 'mat_plaster',
    name: 'White Venetian Plaster',
    category: 'Finish',
    url: plasterSvg,
    color: '#f4f4f5',
    roughness: 0.9,
    tag: 'Minimalist'
  },
  {
    id: 'mat_slate',
    name: 'Dark Slate Masonry',
    category: 'Stone',
    url: slateSvg,
    color: '#18181b',
    roughness: 0.8,
    tag: 'Modern Accent'
  },
  {
    id: 'mat_marble',
    name: 'Carrara White Marble',
    category: 'Luxury',
    url: marbleSvg,
    color: '#f8fafc',
    roughness: 0.2,
    tag: 'Luxury Bath / Foyer'
  },
  {
    id: 'mat_subway',
    name: 'Ceramic Subway Tile',
    category: 'Tile',
    url: subwayTileSvg,
    color: '#ffffff',
    roughness: 0.3,
    tag: 'Kitchen & Bath'
  },
  {
    id: 'mat_fluted_wood',
    name: 'Smoked Fluted Timber',
    category: 'Woodwork',
    url: flutedWoodSvg,
    color: '#2b231d',
    roughness: 0.65,
    tag: 'Acoustic Panel'
  },
  {
    id: 'mat_sage',
    name: 'Nordic Sage Green',
    category: 'Paint',
    url: sagePlasterSvg,
    color: '#4a5d4e',
    roughness: 0.85,
    tag: 'Scandinavian'
  },
  {
    id: 'mat_terracotta',
    name: 'Warm Terracotta Stucco',
    category: 'Stucco',
    url: terracottaSvg,
    color: '#b45309',
    roughness: 0.8,
    tag: 'Mediterranean'
  }
];

// -------------------------------------------------------------------------------------------
// Wood plank walls: drawn as SVG with staggered joints and grain, in several woods and directions
// -------------------------------------------------------------------------------------------
function woodPlanks({ tones, grain, joint, vertical = false, plank = 20, length = 160, seed = 1 }) {
  // a small deterministic random, so the same wood always looks the same
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const W = 320, H = 160;
  const parts = [];
  const rows = H / plank;
  for (let r = 0; r < rows; r++) {
    const y = r * plank;
    let x = -Math.floor(rnd() * length);
    while (x < W) {
      const len = length * (0.7 + rnd() * 0.6);
      const tone = tones[Math.floor(rnd() * tones.length)];
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${len.toFixed(1)}" height="${plank}" fill="${tone}"/>`);
      for (let g = 0; g < 3; g++) {             // grain: gentle curves along the plank
        const gy = y + 3 + rnd() * (plank - 6);
        const c1 = gy + (rnd() - 0.5) * 4, c2 = gy + (rnd() - 0.5) * 4;
        parts.push(`<path d="M${x.toFixed(1)} ${gy.toFixed(1)} C ${(x + len / 3).toFixed(1)} ${c1.toFixed(1)}, ${(x + 2 * len / 3).toFixed(1)} ${c2.toFixed(1)}, ${(x + len).toFixed(1)} ${gy.toFixed(1)}" stroke="${grain}" stroke-width="0.8" fill="none" opacity="0.45"/>`);
      }
      parts.push(`<line x1="${(x + len).toFixed(1)}" y1="${y}" x2="${(x + len).toFixed(1)}" y2="${y + plank}" stroke="${joint}" stroke-width="1.2"/>`);
      x += len;
    }
    parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${joint}" stroke-width="1.4"/>`);
  }
  const body = parts.join('');
  const svg = vertical
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${W}" viewBox="0 0 ${H} ${W}"><g transform="translate(${H} 0) rotate(90)">${body}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  return encodeSvg(svg);
}

export const WOOD_FINISHES = [
  { id: 'wood_oak_h', name: 'Light oak planks', color: '#c69c6d', tag: 'Horizontal',
    url: woodPlanks({ tones: ['#c99f70', '#c19566', '#d1a878', '#bb8f60'], grain: '#8a6136', joint: '#7a5530', seed: 3 }) },
  { id: 'wood_walnut_v', name: 'Walnut panels', color: '#5c3f2b', tag: 'Vertical',
    url: woodPlanks({ tones: ['#5d4030', '#664634', '#523827', '#6b4a35'], grain: '#2f1f15', joint: '#24170f', vertical: true, plank: 26, seed: 7 }) },
  { id: 'wood_teak_h', name: 'Teak panelling', color: '#9a6232', tag: 'Wide planks',
    url: woodPlanks({ tones: ['#a2683a', '#97602f', '#ab713f', '#8f5a2c'], grain: '#5e3816', joint: '#4f2f12', plank: 32, length: 220, seed: 11 }) },
  { id: 'wood_pine_white', name: 'Whitewashed pine', color: '#e3dccf', tag: 'Vertical',
    url: woodPlanks({ tones: ['#e6dfd2', '#ddd5c7', '#ebe5d9', '#d8cfbf'], grain: '#b9ad99', joint: '#a99c86', vertical: true, plank: 18, seed: 5 }) },
  { id: 'wood_reclaimed', name: 'Reclaimed timber', color: '#8b6a4c', tag: 'Mixed tones',
    url: woodPlanks({ tones: ['#8f6c4b', '#a07a55', '#6e523a', '#b08860', '#7b5c40'], grain: '#4a3524', joint: '#3a2919', plank: 18, length: 120, seed: 13 }) },
  { id: 'wood_ebony_v', name: 'Smoked oak, vertical', color: '#3a2d24', tag: 'Dark accent',
    url: woodPlanks({ tones: ['#3d3026', '#352a21', '#43352a', '#2f251d'], grain: '#1c150f', joint: '#130e0a', vertical: true, plank: 14, seed: 17 }) },
];

/** Paint colours, grouped the way paint shades are usually shown. */
export const PAINT_COLOURS = [
  { group: 'Whites & neutrals', colours: [['Chalk white', '#f6f4ef'], ['Ivory', '#f1ead8'], ['Linen', '#e9e1d2'], ['Greige', '#cfc6b8'], ['Warm grey', '#b5aea4'], ['Charcoal', '#3b3b3d']] },
  { group: 'Warm', colours: [['Sand', '#e2cfae'], ['Peach', '#f2c6a5'], ['Terracotta', '#c46a45'], ['Mustard', '#d3a23a'], ['Blush pink', '#e8c3c0'], ['Brick red', '#9c3b2e']] },
  { group: 'Cool', colours: [['Sky blue', '#bcd4e6'], ['Dusty blue', '#7f98b0'], ['Navy', '#2a3b57'], ['Teal', '#2f6f73'], ['Lavender', '#c9bfdc'], ['Slate', '#5f6b76']] },
  { group: 'Deep & bold', colours: [['Emerald', '#1f5a4a'], ['Burgundy', '#6b2131'], ['Midnight', '#1c2533'], ['Ochre', '#b8862b'], ['Plum', '#5a3550'], ['Rust', '#9a4a2a']] },
  { group: 'Greens', colours: [['Mint', '#cfe3d2'], ['Sage', '#a8b79c'], ['Olive', '#7d7f4f'], ['Forest', '#2f4a3a'], ['Pistachio', '#c4d39f'], ['Eucalyptus', '#7f9c8f']] },
];

export const PLAIN_WALL = { id: 'mat_plain', name: 'Plain', color: '#f4f4f5' };

// -------------------------------------------------------------------------------------------
// Wallpapers and stone cladding
// -------------------------------------------------------------------------------------------
const svg = (w, h, body, bg) => encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`);
const leaf = (x, y, r, c) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0 C 14 -10, 30 -6, 40 0 C 30 6, 14 10, 0 0 Z" fill="${c}"/><line x1="0" y1="0" x2="38" y2="0" stroke="rgba(0,0,0,0.15)" stroke-width="1"/></g>`;

export const WALLPAPERS = [
  { id: 'wp_botanical', name: 'Botanical leaves', color: '#dfe6da', tag: 'Wallpaper',
    url: svg(200, 200, [[20, 40, -30], [90, 20, 25], [150, 70, -60], [40, 130, 40], [120, 150, -20], [170, 180, 60], [70, 90, 10]].map(([x, y, r], i) => leaf(x, y, r, ['#6f8f6a', '#89a582', '#56755a'][i % 3])).join(''), '#e3e8dc') },
  { id: 'wp_diamond', name: 'Geometric diamonds', color: '#e8e2d6', tag: 'Wallpaper',
    url: svg(120, 120, '<path d="M60 0 L120 60 L60 120 L0 60 Z" fill="none" stroke="#b39a6b" stroke-width="2"/><path d="M60 20 L100 60 L60 100 L20 60 Z" fill="none" stroke="#c9b48b" stroke-width="1"/>', '#ece6da') },
  { id: 'wp_stripe', name: 'Pinstripe', color: '#d9dde3', tag: 'Wallpaper',
    url: svg(80, 80, '<rect x="0" width="2" height="80" fill="#9aa5b4"/><rect x="40" width="10" height="80" fill="#c7ced8"/>', '#dde2e8') },
  { id: 'wp_damask', name: 'Damask', color: '#5b2a36', tag: 'Wallpaper',
    url: svg(120, 160, '<g fill="#7c3b4b"><ellipse cx="60" cy="80" rx="22" ry="40"/><ellipse cx="60" cy="80" rx="9" ry="18" fill="#5b2a36"/><path d="M60 20 C 80 40, 100 50, 110 80 C 100 110, 80 120, 60 140 C 40 120, 20 110, 10 80 C 20 50, 40 40, 60 20 Z" fill="none" stroke="#8a4657" stroke-width="3"/></g>', '#5b2a36') },
  { id: 'wp_deco', name: 'Art deco fans', color: '#1f2d3a', tag: 'Wallpaper',
    url: svg(120, 60, [0, 60].map(x => `<g transform="translate(${x + 30} 60)">${[30, 22, 14].map(r => `<path d="M${-r} 0 A ${r} ${r} 0 0 1 ${r} 0" fill="none" stroke="#c8a96a" stroke-width="1.6"/>`).join('')}</g>`).join('') + '<g transform="translate(0 30)">' + [0, 60, 120].map(x => `<g transform="translate(${x} 30)">${[30, 22, 14].map(r => `<path d="M${-r} 0 A ${r} ${r} 0 0 1 ${r} 0" fill="none" stroke="#c8a96a" stroke-width="1.6"/>`).join('')}</g>`).join('') + '</g>', '#1f2d3a') },
  { id: 'wp_palm', name: 'Tropical palm', color: '#f1ece1', tag: 'Wallpaper',
    url: svg(220, 220, [[40, 60, 20], [150, 40, -40], [100, 140, 70], [190, 170, 10], [30, 190, -60]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})">${[-50, -25, 0, 25, 50].map(a => leaf(0, 0, a, '#2f6b4f')).join('')}</g>`).join(''), '#f1ece1') },
  { id: 'wp_grasscloth', name: 'Grasscloth', color: '#c9b894', tag: 'Wallpaper',
    url: svg(160, 160, Array.from({ length: 40 }, (_, i) => `<rect x="0" y="${i * 4}" width="160" height="2" fill="${['#bfae8a', '#d2c29f', '#b8a581'][i % 3]}" opacity="0.8"/>`).join(''), '#cbb995') },
];

export const CLADDING = [
  { id: 'clad_stacked', name: 'Stacked stone', color: '#8f8578', tag: 'Cladding',
    url: svg(200, 100, Array.from({ length: 10 }, (_, r) => { let x = -(r * 37) % 60; const out = []; while (x < 200) { const w = 30 + ((x * 7 + r * 13) % 50); out.push(`<rect x="${x}" y="${r * 10}" width="${w - 2}" height="8" rx="1" fill="${['#8c8275', '#a0968a', '#7a7166', '#b0a798'][(x + r) % 4 < 0 ? 0 : (x + r) % 4]}"/>`); x += w; } return out.join(''); }).join(''), '#5f584f') },
  { id: 'clad_whitebrick', name: 'Whitewashed brick', color: '#e9e5de', tag: 'Cladding',
    url: svg(160, 80, '<g fill="#efebe4" stroke="#cfc8bd" stroke-width="2"><rect x="2" y="2" width="76" height="36"/><rect x="82" y="2" width="76" height="36"/><rect x="-38" y="42" width="76" height="36"/><rect x="42" y="42" width="76" height="36"/><rect x="122" y="42" width="76" height="36"/></g>', '#d8d2c8') },
  { id: 'clad_marble_slab', name: 'Marble slab wall', color: '#ecebe8', tag: 'Cladding',
    url: svg(200, 200, '<path d="M0 40 C 60 60, 90 20, 200 70" stroke="#a9a9b2" stroke-width="1.5" fill="none"/><path d="M0 150 C 70 120, 120 170, 200 130" stroke="#bdbdc5" stroke-width="1" fill="none"/><path d="M40 0 C 60 80, 30 140, 70 200" stroke="#c4c4cc" stroke-width="0.8" fill="none"/><rect x="0" y="99" width="200" height="2" fill="#d8d8dc"/>', '#efeeeb') },
];

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

/*
 * The furniture catalogue: every piece the Room Designer (and the Studio) can place.
 *
 * Each item is described once, as data, and drawn from that everywhere: as a top-down symbol on
 * the 2D plan, as a 3D model in the house, walkthrough and room captures, and in the cost takeoff.
 *
 *   type     element type stored in the plan ('furniture_<key>'); the 7 original pieces keep their
 *            own hand-made drawings (builtin) and appear here so they can be chosen too
 *   w, d, h  width (along the back), depth, height in metres
 *   price    rough cost in US dollars (shown in the chosen currency)
 *   rooms    the room kinds it suits, so the designer can suggest it first
 *   parts    boxes ('b') and cylinders ('c'): centre x, z as fractions of w, d (-0.5..0.5, the back
 *            is -z), bottom y as a fraction of h, and size as fractions of w, d, h; plus a colour.
 *            glass: true makes a part see-through.
 */
const b = (x, z, y, w, d, h, c, extra = {}) => ({ s: 'b', x, z, y, w, d, h, c, ...extra });
const c = (x, z, y, w, d, h, c_, extra = {}) => ({ s: 'c', x, z, y, w, d, h, c: c_, ...extra });
const legs4 = (inset, h, color, r = 0.06) => [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  .map(([sx, sz]) => c(sx * (0.5 - inset), sz * (0.5 - inset), 0, r, r, h, color));

const OAK = '#c8a27a', WALNUT = '#5b3a29', WHITE = '#f4f4f2', GREY = '#9ca3af', DARK = '#27272a';
const FABRIC = '#5b6b94', FABRIC2 = '#7d8bb0', LINEN = '#d6cfc2', STEEL = '#cbd5e1', GLASS = '#bfdbfe', GREEN = '#4d7c4a';

export const CATEGORIES = [
  ['living', 'Living room'], ['dining', 'Dining'], ['bedroom', 'Bedroom'], ['kids', 'Kids'], ['study', 'Study'],
  ['kitchen', 'Kitchen'], ['bathroom', 'Bathroom'], ['utility', 'Utility & pooja'], ['outdoor', 'Balcony & outdoor'],
  ['decor', 'Decor & lighting'],
];

const sofaParts = (seatC = FABRIC, backC = FABRIC2) => [
  b(0, 0.05, 0, 1, 0.9, 0.48, seatC), b(0, -0.4, 0.48, 1, 0.2, 0.52, backC),
  b(-0.46, 0.05, 0.48, 0.08, 0.9, 0.2, backC), b(0.46, 0.05, 0.48, 0.08, 0.9, 0.2, backC),
  b(0, 0.1, 0.48, 0.82, 0.6, 0.1, '#6d7ca6'),
];
const bedParts = (frame = WALNUT, linen = WHITE, throwC = '#64748b') => [
  b(0, 0.02, 0, 1, 0.96, 0.3, frame), b(0, 0.03, 0.3, 0.96, 0.92, 0.25, linen),
  b(0, 0.25, 0.53, 0.98, 0.45, 0.05, throwC), b(0, -0.48, 0, 1, 0.04, 1, frame),
  b(-0.24, -0.36, 0.55, 0.4, 0.16, 0.12, '#e2e8f0'), b(0.24, -0.36, 0.55, 0.4, 0.16, 0.12, '#e2e8f0'),
];
const cabinet = (color, top = null) => [b(0, 0, 0, 1, 1, top ? 0.94 : 1, color), ...(top ? [b(0, 0, 0.94, 1.02, 1.04, 0.06, top)] : [])];

export const CATALOG = [
  // ---- living ------------------------------------------------------------------------------------
  { type: 'furniture_sofa', name: 'Sofa, 3-seater', cat: 'living', w: 2.2, d: 0.9, h: 0.85, price: 1200, rooms: ['living', 'lounge'], builtin: true },
  { type: 'furniture_sofa2', name: 'Sofa, 2-seater', cat: 'living', w: 1.6, d: 0.88, h: 0.85, price: 800, rooms: ['living', 'lounge', 'master_bedroom'], parts: sofaParts() },
  { type: 'furniture_sectional', name: 'L-shaped sofa', cat: 'living', w: 2.7, d: 1.7, h: 0.85, price: 1800, rooms: ['living', 'lounge'],
    parts: [b(0, -0.23, 0, 1, 0.54, 0.48, FABRIC), b(0, -0.46, 0.48, 1, 0.08, 0.52, FABRIC2), b(0.33, 0.24, 0, 0.34, 0.48, 0.48, FABRIC),
      b(0.47, 0.03, 0.48, 0.06, 0.94, 0.2, FABRIC2), b(-0.47, -0.23, 0.48, 0.06, 0.54, 0.2, FABRIC2), b(-0.05, -0.2, 0.48, 0.8, 0.4, 0.1, '#6d7ca6')] },
  { type: 'furniture_armchair', name: 'Armchair', cat: 'living', w: 0.8, d: 0.8, h: 0.85, price: 400, rooms: ['living', 'lounge', 'master_bedroom', 'study'], builtin: true },
  { type: 'furniture_recliner', name: 'Recliner', cat: 'living', w: 0.95, d: 1.0, h: 1.0, price: 650, rooms: ['living', 'lounge'],
    parts: [b(0, 0.05, 0, 1, 0.9, 0.45, '#7c4a2d'), b(0, -0.4, 0.45, 0.8, 0.2, 0.55, '#8b5636'), b(-0.43, 0.05, 0.45, 0.14, 0.9, 0.18, '#7c4a2d'), b(0.43, 0.05, 0.45, 0.14, 0.9, 0.18, '#7c4a2d')] },
  { type: 'furniture_diwan', name: 'Diwan / day bed', cat: 'living', w: 1.9, d: 0.8, h: 0.45, price: 450, rooms: ['living', 'lounge', 'study'],
    parts: [b(0, 0, 0, 1, 1, 0.7, OAK), b(0, 0.02, 0.7, 0.98, 0.96, 0.3, '#b45309'), b(-0.3, -0.38, 0.7, 0.22, 0.2, 0.55, '#d97706'), b(0.3, -0.38, 0.7, 0.22, 0.2, 0.55, '#d97706')] },
  { type: 'furniture_coffee_table', name: 'Coffee table', cat: 'living', w: 1.2, d: 0.6, h: 0.42, price: 250, rooms: ['living', 'lounge'],
    parts: [b(0, 0, 0.82, 1, 1, 0.18, OAK), ...legs4(0.08, 0.82, WALNUT, 0.07)] },
  { type: 'furniture_side_table', name: 'Side table', cat: 'living', w: 0.5, d: 0.5, h: 0.55, price: 90, rooms: ['living', 'lounge', 'master_bedroom', 'bedroom'],
    parts: [c(0, 0, 0.88, 1, 1, 0.12, OAK), c(0, 0, 0, 0.16, 0.16, 0.88, DARK), c(0, 0, 0, 0.6, 0.6, 0.06, DARK)] },
  { type: 'furniture_tv_unit', name: 'TV unit', cat: 'living', w: 1.8, d: 0.45, h: 0.5, price: 350, rooms: ['living', 'lounge', 'master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0.08, 1, 1, 0.92, WALNUT), ...legs4(0.05, 0.08, DARK, 0.05)] },
  { type: 'furniture_tv', name: 'TV, wall-mounted 55"', cat: 'living', w: 1.25, d: 0.08, h: 1.8, price: 700, rooms: ['living', 'lounge', 'master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0.6, 1, 1, 0.4, '#0b0b0c')] },
  { type: 'furniture_bookshelf', name: 'Bookshelf', cat: 'living', w: 1.0, d: 0.35, h: 2.0, price: 300, rooms: ['living', 'study', 'bedroom', 'lounge'],
    parts: [b(0, 0, 0, 1, 1, 1, OAK), b(0, 0.06, 0.05, 0.92, 0.9, 0.9, '#3f2d1f'), ...[0.25, 0.45, 0.65].map(y => b(0, 0.05, y, 0.92, 0.9, 0.025, OAK)),
      b(-0.2, 0.1, 0.27, 0.3, 0.7, 0.15, '#b91c1c'), b(0.18, 0.1, 0.47, 0.4, 0.7, 0.15, '#1d4ed8'), b(-0.1, 0.1, 0.67, 0.35, 0.7, 0.14, '#15803d')] },
  { type: 'furniture_console', name: 'Console table', cat: 'living', w: 1.2, d: 0.35, h: 0.8, price: 220, rooms: ['living', 'dining', 'lounge', 'hallway'],
    parts: [b(0, 0, 0.92, 1, 1, 0.08, WALNUT), ...legs4(0.05, 0.92, DARK, 0.06)] },
  { type: 'furniture_pouf', name: 'Pouf / ottoman', cat: 'living', w: 0.5, d: 0.5, h: 0.42, price: 80, rooms: ['living', 'lounge', 'bedroom', 'master_bedroom'],
    parts: [c(0, 0, 0, 1, 1, 1, '#a16207')] },

  // ---- dining ------------------------------------------------------------------------------------
  { type: 'furniture_dining4', name: 'Dining table, 4 seats', cat: 'dining', w: 1.2, d: 0.8, h: 0.75, price: 450, rooms: ['dining', 'kitchen', 'living'],
    parts: [b(0, 0, 0.93, 1, 1, 0.07, OAK), ...legs4(0.06, 0.93, WALNUT, 0.06)] },
  { type: 'furniture_table', name: 'Dining table, 6 seats', cat: 'dining', w: 1.6, d: 0.9, h: 0.75, price: 600, rooms: ['dining', 'living'], builtin: true },
  { type: 'furniture_dining8', name: 'Dining table, 8 seats', cat: 'dining', w: 2.2, d: 1.0, h: 0.75, price: 900, rooms: ['dining'],
    parts: [b(0, 0, 0.93, 1, 1, 0.07, WALNUT), ...legs4(0.05, 0.93, DARK, 0.04)] },
  { type: 'furniture_dining_round', name: 'Round dining table', cat: 'dining', w: 1.1, d: 1.1, h: 0.75, price: 500, rooms: ['dining', 'kitchen'],
    parts: [c(0, 0, 0.93, 1, 1, 0.07, OAK), c(0, 0, 0, 0.14, 0.14, 0.93, WALNUT), c(0, 0, 0, 0.5, 0.5, 0.05, WALNUT)] },
  { type: 'furniture_chair', name: 'Dining chair', cat: 'dining', w: 0.45, d: 0.5, h: 0.9, price: 90, rooms: ['dining', 'kitchen', 'study'],
    parts: [b(0, 0.05, 0.48, 1, 0.9, 0.06, OAK), b(0, -0.44, 0.54, 1, 0.1, 0.46, OAK), ...legs4(0.08, 0.48, WALNUT, 0.08)] },
  { type: 'furniture_sideboard', name: 'Sideboard / crockery unit', cat: 'dining', w: 1.6, d: 0.45, h: 0.85, price: 500, rooms: ['dining', 'living'],
    parts: [b(0, 0, 0.1, 1, 1, 0.9, WALNUT), ...legs4(0.04, 0.1, DARK, 0.05), b(0, 0.51, 0.3, 0.005, 0.02, 0.4, OAK)] },
  { type: 'furniture_crockery_tall', name: 'Crockery cabinet, tall', cat: 'dining', w: 1.0, d: 0.45, h: 1.9, price: 550, rooms: ['dining', 'kitchen'],
    parts: [b(0, 0, 0, 1, 1, 0.45, WALNUT), b(0, 0, 0.45, 1, 1, 0.55, '#a8c3d6', { glass: true }), b(0, 0, 0.98, 1, 1, 0.02, WALNUT)] },
  { type: 'furniture_bar_stool', name: 'Bar stool', cat: 'dining', w: 0.4, d: 0.4, h: 0.75, price: 70, rooms: ['kitchen', 'dining'],
    parts: [c(0, 0, 0.92, 1, 1, 0.08, DARK), c(0, 0, 0, 0.12, 0.12, 0.92, STEEL), c(0, 0, 0, 0.8, 0.8, 0.04, STEEL)] },

  // ---- bedroom -----------------------------------------------------------------------------------
  { type: 'furniture_bed', name: 'King bed', cat: 'bedroom', w: 1.8, d: 2.1, h: 0.6, price: 800, rooms: ['master_bedroom', 'bedroom'], builtin: true },
  { type: 'furniture_bed_queen', name: 'Queen bed', cat: 'bedroom', w: 1.6, d: 2.05, h: 1.0, price: 650, rooms: ['master_bedroom', 'bedroom'], parts: bedParts() },
  { type: 'furniture_bed_single', name: 'Single bed', cat: 'bedroom', w: 0.95, d: 2.0, h: 0.9, price: 350, rooms: ['bedroom', 'study'], parts: bedParts(OAK, WHITE, '#2563eb') },
  { type: 'furniture_bedside', name: 'Bedside table', cat: 'bedroom', w: 0.5, d: 0.4, h: 0.55, price: 120, rooms: ['master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0.12, 1, 1, 0.88, OAK), ...legs4(0.08, 0.12, WALNUT, 0.08), c(0.2, 0, 1, 0.35, 0.45, 0.45, '#fde68a')] },
  { type: 'furniture_wardrobe2', name: 'Wardrobe, 2 doors', cat: 'bedroom', w: 1.2, d: 0.6, h: 2.1, price: 600, rooms: ['master_bedroom', 'bedroom', 'kids'],
    parts: [b(0, 0, 0, 1, 1, 1, '#e7e2da'), b(0, 0.51, 0.4, 0.005, 0.02, 0.15, DARK)] },
  { type: 'furniture_wardrobe3', name: 'Wardrobe, 3 doors', cat: 'bedroom', w: 1.8, d: 0.6, h: 2.1, price: 850, rooms: ['master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0, 1, 1, 1, '#e7e2da'), b(-0.17, 0.51, 0.4, 0.005, 0.02, 0.15, DARK), b(0.17, 0.51, 0.4, 0.005, 0.02, 0.15, DARK)] },
  { type: 'furniture_wardrobe_sliding', name: 'Sliding wardrobe', cat: 'bedroom', w: 2.4, d: 0.65, h: 2.4, price: 1300, rooms: ['master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0, 1, 1, 1, WALNUT), b(0, 0.51, 0.02, 0.5, 0.02, 0.96, '#a8c3d6', { glass: true })] },
  { type: 'furniture_dresser', name: 'Dressing table', cat: 'bedroom', w: 1.0, d: 0.45, h: 1.6, price: 350, rooms: ['master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0, 1, 1, 0.47, OAK), b(0, -0.42, 0.47, 0.7, 0.08, 0.5, '#dbeafe', { glass: true }), b(0, -0.46, 0.47, 0.78, 0.06, 0.53, OAK)] },
  { type: 'furniture_drawers', name: 'Chest of drawers', cat: 'bedroom', w: 0.9, d: 0.45, h: 0.9, price: 300, rooms: ['master_bedroom', 'bedroom', 'kids'],
    parts: [b(0, 0, 0.06, 1, 1, 0.94, OAK), ...[0.3, 0.55, 0.8].map(y => b(0, 0.51, y, 0.3, 0.02, 0.03, DARK)), ...legs4(0.06, 0.06, DARK, 0.06)] },
  { type: 'furniture_bench', name: 'Bed-end bench', cat: 'bedroom', w: 1.2, d: 0.4, h: 0.45, price: 180, rooms: ['master_bedroom', 'bedroom'],
    parts: [b(0, 0, 0.75, 1, 1, 0.25, LINEN), ...legs4(0.05, 0.75, WALNUT, 0.07)] },

  // ---- kids --------------------------------------------------------------------------------------
  { type: 'furniture_bunk_bed', name: 'Bunk bed', cat: 'kids', w: 1.0, d: 2.0, h: 1.7, price: 600, rooms: ['bedroom', 'kids'],
    parts: [b(0, 0, 0.1, 1, 1, 0.12, OAK), b(0, 0, 0.22, 0.96, 0.96, 0.1, '#bfdbfe'), b(0, 0, 0.62, 1, 1, 0.08, OAK), b(0, 0, 0.7, 0.96, 0.96, 0.1, '#fecaca'),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => b(sx * 0.47, sz * 0.48, 0, 0.06, 0.04, 1, OAK))] },
  { type: 'furniture_crib', name: 'Crib', cat: 'kids', w: 1.3, d: 0.7, h: 0.95, price: 300, rooms: ['bedroom', 'master_bedroom', 'kids'],
    parts: [b(0, 0, 0.3, 1, 1, 0.12, WHITE), b(0, -0.48, 0, 1, 0.04, 1, WHITE), b(0, 0.48, 0, 1, 0.04, 1, WHITE), b(-0.48, 0, 0, 0.04, 1, 1, WHITE), b(0.48, 0, 0, 0.04, 1, 1, WHITE)] },
  { type: 'furniture_toy_storage', name: 'Toy storage', cat: 'kids', w: 0.9, d: 0.4, h: 0.8, price: 150, rooms: ['bedroom', 'kids', 'living'],
    parts: [b(0, 0, 0, 1, 1, 1, WHITE), b(-0.25, 0.3, 0.1, 0.4, 0.5, 0.35, '#f472b6'), b(0.25, 0.3, 0.55, 0.4, 0.5, 0.35, '#60a5fa')] },
  { type: 'furniture_kids_desk', name: 'Kids study table', cat: 'kids', w: 0.9, d: 0.55, h: 0.65, price: 150, rooms: ['bedroom', 'kids', 'study'],
    parts: [b(0, 0, 0.92, 1, 1, 0.08, '#fde68a'), ...legs4(0.06, 0.92, WHITE, 0.07)] },

  // ---- study -------------------------------------------------------------------------------------
  { type: 'furniture_desk', name: 'Study desk', cat: 'study', w: 1.2, d: 0.6, h: 0.75, price: 280, rooms: ['study', 'bedroom', 'master_bedroom'],
    parts: [b(0, 0, 0.93, 1, 1, 0.07, OAK), b(-0.4, 0, 0, 0.2, 0.95, 0.93, WHITE), ...[[1, -1], [1, 1]].map(([sx, sz]) => c(sx * 0.45, sz * 0.42, 0, 0.04, 0.07, 0.93, DARK))] },
  { type: 'furniture_office_chair', name: 'Office chair', cat: 'study', w: 0.6, d: 0.6, h: 1.05, price: 180, rooms: ['study', 'bedroom'],
    parts: [c(0, 0, 0, 0.9, 0.9, 0.05, DARK), c(0, 0, 0.05, 0.1, 0.1, 0.38, STEEL), b(0, 0.05, 0.43, 0.85, 0.8, 0.08, DARK), b(0, -0.4, 0.5, 0.75, 0.1, 0.5, DARK)] },
  { type: 'furniture_filing', name: 'Filing cabinet', cat: 'study', w: 0.45, d: 0.6, h: 1.0, price: 160, rooms: ['study'],
    parts: [b(0, 0, 0, 1, 1, 1, GREY), ...[0.3, 0.6, 0.85].map(y => b(0, 0.51, y, 0.4, 0.02, 0.03, DARK))] },

  // ---- kitchen -----------------------------------------------------------------------------------
  { type: 'furniture_kitchen', name: 'Counter with hob and sink', cat: 'kitchen', w: 2.8, d: 0.65, h: 0.9, price: 1800, rooms: ['kitchen'], builtin: true },
  { type: 'furniture_base_cabinet', name: 'Base cabinet, 60 cm', cat: 'kitchen', w: 0.6, d: 0.6, h: 0.9, price: 220, rooms: ['kitchen', 'utility'],
    parts: cabinet('#e7e2da', '#44403c') },
  { type: 'furniture_sink_unit', name: 'Sink unit', cat: 'kitchen', w: 0.9, d: 0.6, h: 0.9, price: 380, rooms: ['kitchen', 'utility'],
    parts: [...cabinet('#e7e2da', '#44403c'), b(0, 0.05, 0.97, 0.6, 0.6, 0.04, STEEL), c(0, -0.38, 1, 0.06, 0.08, 0.25, STEEL)] },
  { type: 'furniture_hob_unit', name: 'Hob unit', cat: 'kitchen', w: 0.9, d: 0.6, h: 0.9, price: 450, rooms: ['kitchen'],
    parts: [...cabinet('#e7e2da', '#44403c'), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => c(sx * 0.2, sz * 0.2, 1, 0.2, 0.28, 0.02, '#111'))] },
  { type: 'furniture_tall_unit', name: 'Tall pantry unit', cat: 'kitchen', w: 0.6, d: 0.6, h: 2.1, price: 500, rooms: ['kitchen', 'utility'],
    parts: [b(0, 0, 0, 1, 1, 1, '#e7e2da'), b(0, 0.51, 0.45, 0.05, 0.02, 0.15, DARK)] },
  { type: 'furniture_oven_tower', name: 'Oven and microwave tower', cat: 'kitchen', w: 0.6, d: 0.6, h: 2.1, price: 900, rooms: ['kitchen'],
    parts: [b(0, 0, 0, 1, 1, 1, '#e7e2da'), b(0, 0.51, 0.4, 0.85, 0.02, 0.15, '#111'), b(0, 0.51, 0.58, 0.85, 0.02, 0.12, '#111')] },
  { type: 'furniture_fridge', name: 'Refrigerator, double door', cat: 'kitchen', w: 0.9, d: 0.75, h: 1.8, price: 1100, rooms: ['kitchen', 'dining'],
    parts: [b(0, 0, 0, 1, 1, 1, '#d4d4d8'), b(0, 0.51, 0.05, 0.005, 0.02, 0.9, '#71717a')] },
  { type: 'furniture_fridge_single', name: 'Refrigerator, single door', cat: 'kitchen', w: 0.6, d: 0.65, h: 1.6, price: 600, rooms: ['kitchen', 'dining'],
    parts: [b(0, 0, 0, 1, 1, 1, '#d4d4d8'), b(0.38, 0.51, 0.45, 0.05, 0.02, 0.3, '#71717a')] },
  { type: 'furniture_island', name: 'Kitchen island', cat: 'kitchen', w: 1.8, d: 0.9, h: 0.9, price: 1100, rooms: ['kitchen'],
    parts: [b(0, -0.1, 0, 1, 0.8, 0.94, WALNUT), b(0, 0, 0.94, 1.02, 1.0, 0.06, '#e7e5e4')] },
  { type: 'furniture_dishwasher', name: 'Dishwasher', cat: 'kitchen', w: 0.6, d: 0.6, h: 0.85, price: 500, rooms: ['kitchen'],
    parts: [b(0, 0, 0, 1, 1, 1, STEEL), b(0, 0.51, 0.85, 0.8, 0.02, 0.05, DARK)] },
  { type: 'furniture_chimney', name: 'Chimney hood', cat: 'kitchen', w: 0.9, d: 0.5, h: 2.2, price: 300, rooms: ['kitchen'],
    parts: [b(0, 0, 0.72, 1, 1, 0.08, STEEL), b(0, -0.2, 0.8, 0.3, 0.5, 0.2, STEEL)] },

  // ---- bathroom ----------------------------------------------------------------------------------
  { type: 'furniture_wc', name: 'WC (toilet)', cat: 'bathroom', w: 0.4, d: 0.65, h: 0.75, price: 250, rooms: ['bathroom'],
    parts: [b(0, -0.38, 0.5, 1, 0.24, 0.5, WHITE), c(0, 0.08, 0, 0.9, 0.7, 0.55, WHITE), c(0, 0.08, 0.55, 0.95, 0.75, 0.04, '#e5e7eb')] },
  { type: 'furniture_vanity', name: 'Vanity with basin', cat: 'bathroom', w: 1.2, d: 0.55, h: 0.85, price: 700, rooms: ['bathroom'], builtin: true },
  { type: 'furniture_basin', name: 'Wash basin, pedestal', cat: 'bathroom', w: 0.55, d: 0.45, h: 0.85, price: 180, rooms: ['bathroom', 'dining', 'utility'],
    parts: [c(0, 0, 0, 0.3, 0.3, 0.9, WHITE), c(0, 0.05, 0.88, 1, 0.95, 0.12, WHITE)] },
  { type: 'furniture_shower', name: 'Shower enclosure', cat: 'bathroom', w: 0.9, d: 0.9, h: 2.0, price: 650, rooms: ['bathroom'],
    parts: [b(0, 0, 0, 1, 1, 0.04, '#e5e7eb'), b(0, 0.49, 0.04, 1, 0.02, 0.96, GLASS, { glass: true }), b(0.49, 0, 0.04, 0.02, 1, 0.96, GLASS, { glass: true }),
      c(-0.35, -0.42, 0.85, 0.15, 0.15, 0.03, STEEL)] },
  { type: 'furniture_bathtub', name: 'Bathtub', cat: 'bathroom', w: 1.7, d: 0.8, h: 0.55, price: 1100, rooms: ['bathroom'], builtin: true },
  { type: 'furniture_mirror_cabinet', name: 'Mirror cabinet', cat: 'bathroom', w: 0.6, d: 0.15, h: 1.9, price: 150, rooms: ['bathroom'],
    parts: [b(0, 0, 0.6, 1, 1, 0.4, '#dbeafe', { glass: true })] },

  // ---- utility & pooja ---------------------------------------------------------------------------
  { type: 'furniture_washing_machine', name: 'Washing machine', cat: 'utility', w: 0.6, d: 0.6, h: 0.85, price: 450, rooms: ['utility', 'bathroom', 'kitchen', 'balcony'],
    parts: [b(0, 0, 0, 1, 1, 1, WHITE), c(0, 0.51, 0.45, 0.6, 0.02, 0.5, '#93c5fd', { axis: 'z' })] },
  { type: 'furniture_pooja', name: 'Pooja unit (mandir)', cat: 'utility', w: 0.9, d: 0.45, h: 1.8, price: 400, rooms: ['living', 'dining', 'study', 'utility'],
    parts: [b(0, 0, 0, 1, 1, 0.4, '#a16207'), b(0, -0.1, 0.4, 0.9, 0.8, 0.45, '#fef3c7'), b(0, 0, 0.85, 1, 1, 0.15, '#a16207'), c(0, 0.1, 0.42, 0.15, 0.2, 0.08, '#f59e0b')] },
  { type: 'furniture_shoe_rack', name: 'Shoe rack', cat: 'utility', w: 0.9, d: 0.35, h: 1.0, price: 150, rooms: ['living', 'hallway', 'utility'],
    parts: [b(0, 0, 0, 1, 1, 1, OAK), b(0, 0.51, 0.5, 0.005, 0.02, 0.2, DARK)] },
  { type: 'furniture_storage_shelf', name: 'Storage shelf', cat: 'utility', w: 1.0, d: 0.4, h: 1.8, price: 140, rooms: ['utility', 'kitchen', 'study'],
    parts: [...[0, 0.33, 0.66, 0.97].map(y => b(0, 0, y, 1, 1, 0.03, GREY)), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => b(sx * 0.48, sz * 0.46, 0, 0.04, 0.08, 1, DARK))] },

  // ---- outdoor -----------------------------------------------------------------------------------
  { type: 'furniture_outdoor_chair', name: 'Outdoor chair', cat: 'outdoor', w: 0.65, d: 0.65, h: 0.8, price: 120, rooms: ['balcony', 'patio'],
    parts: [b(0, 0.05, 0.4, 1, 0.9, 0.08, '#a8a29e'), b(0, -0.44, 0.48, 1, 0.1, 0.52, '#78716c'), ...legs4(0.06, 0.4, DARK, 0.06)] },
  { type: 'furniture_outdoor_table', name: 'Outdoor side table', cat: 'outdoor', w: 0.6, d: 0.6, h: 0.5, price: 90, rooms: ['balcony', 'patio'],
    parts: [c(0, 0, 0.9, 1, 1, 0.1, '#a8a29e'), c(0, 0, 0, 0.12, 0.12, 0.9, DARK)] },
  { type: 'furniture_swing', name: 'Swing (jhula)', cat: 'outdoor', w: 1.4, d: 0.8, h: 2.0, price: 450, rooms: ['balcony', 'patio', 'living'],
    parts: [b(0, 0.05, 0.22, 0.9, 0.6, 0.05, '#a16207'), b(0, -0.25, 0.25, 0.9, 0.08, 0.22, '#a16207'), b(-0.5, 0, 0, 0.04, 1, 1, DARK), b(0.5, 0, 0, 0.04, 1, 1, DARK), b(0, 0, 0.97, 1.04, 0.06, 0.03, DARK)] },
  { type: 'furniture_planter', name: 'Planter box', cat: 'outdoor', w: 1.0, d: 0.35, h: 0.9, price: 70, rooms: ['balcony', 'patio', 'living'],
    parts: [b(0, 0, 0, 1, 1, 0.45, '#78716c'), b(0, 0, 0.45, 0.95, 0.85, 0.55, GREEN)] },

  // ---- decor & lighting --------------------------------------------------------------------------
  { type: 'furniture_rug', name: 'Rug', cat: 'decor', w: 2.0, d: 1.4, h: 0.02, price: 200, rooms: ['living', 'lounge', 'master_bedroom', 'bedroom', 'dining', 'study'],
    parts: [b(0, 0, 0, 1, 1, 1, '#b45309'), b(0, 0, 0, 0.85, 0.8, 1.05, '#d6a56f')] },
  { type: 'furniture_plant', name: 'Plant in a pot', cat: 'decor', w: 0.5, d: 0.5, h: 1.2, price: 60, rooms: ['living', 'lounge', 'dining', 'study', 'balcony', 'master_bedroom'],
    parts: [c(0, 0, 0, 0.6, 0.6, 0.3, '#d6d3d1'), c(0, 0, 0.3, 1, 1, 0.7, GREEN)] },
  { type: 'furniture_floor_lamp', name: 'Floor lamp', cat: 'decor', w: 0.4, d: 0.4, h: 1.6, price: 90, rooms: ['living', 'lounge', 'master_bedroom', 'bedroom', 'study'],
    parts: [c(0, 0, 0, 0.7, 0.7, 0.02, DARK), c(0, 0, 0.02, 0.08, 0.08, 0.8, DARK), c(0, 0, 0.8, 1, 1, 0.2, '#fef3c7')] },
  { type: 'furniture_wall_art', name: 'Wall art', cat: 'decor', w: 1.0, d: 0.04, h: 2.0, price: 120, rooms: ['living', 'lounge', 'dining', 'master_bedroom', 'bedroom', 'study', 'hallway'],
    parts: [b(0, 0, 0.62, 1, 1, 0.35, '#c2410c'), b(0, 0.3, 0.64, 0.9, 0.5, 0.31, '#fdba74')] },
  { type: 'furniture_curtains', name: 'Curtains', cat: 'decor', w: 2.0, d: 0.12, h: 2.6, price: 150, rooms: ['living', 'lounge', 'dining', 'master_bedroom', 'bedroom', 'study'],
    parts: [b(-0.33, 0, 0, 0.34, 1, 1, LINEN), b(0.33, 0, 0, 0.34, 1, 1, LINEN), b(0, 0, 0.98, 1.02, 0.4, 0.02, DARK)] },
  { type: 'furniture_mirror', name: 'Standing mirror', cat: 'decor', w: 0.6, d: 0.3, h: 1.7, price: 110, rooms: ['master_bedroom', 'bedroom', 'hallway'],
    parts: [b(0, 0, 0, 1, 0.2, 1, OAK), b(0, 0.12, 0.03, 0.85, 0.05, 0.94, '#dbeafe', { glass: true })] },
];

export const CATALOG_BY_TYPE = Object.fromEntries(CATALOG.map(it => [it.type, it]));

/** The catalogue item for an element type (null for non-furniture or unknown types). */
export const catalogItem = (type) => CATALOG_BY_TYPE[type] || null;

/** Parts with real sizes (metres) for drawing: box centre x, z; bottom y; size w, d, h. */
export function partsOf(item, w = item.w, d = item.d, h = item.h) {
  return (item.parts || []).map(p => ({
    ...p, cx: p.x * w, cz: p.z * d, y0: p.y * h, sw: p.w * w, sd: p.d * d, sh: p.h * h,
  }));
}

/** A colour mixed with white, for the 2D symbols. */
export function tint(hex, k = 0.35) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

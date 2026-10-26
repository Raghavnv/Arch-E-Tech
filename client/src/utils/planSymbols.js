/**
 * Architectural plan symbols for the 2D canvas.
 *
 * Every element is still a Fabric.Rect (so selecting, moving, scaling and saving behave as
 * before); installSymbol() replaces how that rect is *painted*:
 *
 *   door     wall gap + door leaf + swing arc
 *   window   wall gap + glazing lines
 *   stairs   treads with a direction arrow
 *   furniture_*  top-down icons (bed, sofa, table, armchair, bathtub, vanity, kitchen run)
 *
 * Drawing happens in the rect's local space: x along its length, y across it, origin at the
 * centre.  Furniture "backs" (headboard, sofa back) face -y, matching the layout generator.
 */

const SYMBOL_TYPES = new Set([
  'room', 'door', 'window', 'stairs',
  'furniture_bed', 'furniture_sofa', 'furniture_table', 'furniture_armchair',
  'furniture_bathtub', 'furniture_vanity', 'furniture_kitchen',
]);

const WALL_T = 8;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke, lw = 1) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function box(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  roundRect(ctx, x, y, w, h, r);
  fillStroke(ctx, fill, stroke, lw);
}

function line(ctx, x1, y1, x2, y2, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function circle(ctx, x, y, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, fill, stroke, lw);
}

// -------------------------------------------------------------------------------------------
// Room floors + labels
// -------------------------------------------------------------------------------------------
const FLOORS = {
  living:         { tint: 'rgba(176,138,98,0.22)', pattern: 'wood' },
  dining:         { tint: 'rgba(176,138,98,0.18)', pattern: 'wood' },
  lounge:         { tint: 'rgba(176,138,98,0.16)', pattern: 'wood' },
  master_bedroom: { tint: 'rgba(129,140,160,0.20)', pattern: 'wood' },
  bedroom:        { tint: 'rgba(129,140,160,0.16)', pattern: 'wood' },
  study:          { tint: 'rgba(160,140,110,0.16)', pattern: 'wood' },
  kitchen:        { tint: 'rgba(203,213,225,0.15)', pattern: 'tile' },
  utility:        { tint: 'rgba(203,213,225,0.12)', pattern: 'tile' },
  bathroom:       { tint: 'rgba(56,189,248,0.17)', pattern: 'tile' },
};

export function drawRoom(ctx, w, h, { kind, blueprint = false } = {}) {
  const f = FLOORS[kind] || FLOORS.living;
  const x = -w / 2, y = -h / 2;
  if (!blueprint) {
    ctx.fillStyle = f.tint;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 0.7;
    const step = f.pattern === 'wood' ? 6 : 9;
    ctx.beginPath();
    for (let gy = y + step; gy < y + h; gy += step) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
    if (f.pattern === 'tile') {
      for (let gx = x + step; gx < x + w; gx += step) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Room names are painted in a separate pass after everything else, so furniture never hides them.
 * `room` is the Fabric object (left / top is the middle of its left edge, no rotation).
 */
export function drawRoomLabel(ctx, room, blueprint = false) {
  const { name, area, left, top, width, height } = room;
  if (!name) return;
  const x = left + 8;
  const y = top - height / 2 + 14;
  const compact = width < 70 || height < 45;
  const title = compact ? name.replace(' Room', '').replace('Master Bedroom', 'Master').replace('Bedroom', 'Bed') : name;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = blueprint ? 'rgba(30,58,138,0.9)' : 'rgba(9,9,11,0.9)';
  ctx.lineWidth = 3;
  ctx.font = '600 8px Inter, system-ui, -apple-system, sans-serif';
  ctx.strokeText(title, x, y);
  ctx.fillStyle = blueprint ? '#dbeafe' : '#e4e4e7';
  ctx.fillText(title, x, y);
  if (area && !compact) {
    ctx.font = '500 7px Inter, system-ui, -apple-system, sans-serif';
    const txt = `${Math.round(area)} m\u00B2`;
    ctx.strokeText(txt, x, y + 9);
    ctx.fillStyle = blueprint ? 'rgba(191,219,254,0.85)' : '#a1a1aa';
    ctx.fillText(txt, x, y + 9);
  }
  ctx.restore();
}

// -------------------------------------------------------------------------------------------
// Openings
// -------------------------------------------------------------------------------------------
export function drawDoor(ctx, w, h, { swing = 1, hinge = 1, bg = '#09090b', blueprint = false } = {}) {
  const t = WALL_T + 1;
  const wall = blueprint ? '#ffffff' : '#e4e4e7';
  const accent = '#facc15';
  // clear the wall behind the opening
  ctx.fillStyle = bg;
  ctx.fillRect(-w / 2, -t / 2, w, t);
  // jambs
  ctx.fillStyle = wall;
  ctx.fillRect(-w / 2 - 1, -t / 2, 2.5, t);
  ctx.fillRect(w / 2 - 1.5, -t / 2, 2.5, t);
  // leaf swung open 90 degrees, with the swing arc
  const hx = hinge >= 0 ? -w / 2 + 1 : w / 2 - 1;
  const dir = hinge >= 0 ? 1 : -1;
  const leaf = w - 2;
  const a0 = swing >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const a1 = dir > 0 ? 0 : Math.PI;
  let delta = a1 - a0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  ctx.beginPath();
  ctx.moveTo(hx, 0);
  ctx.lineTo(hx, swing * leaf);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, 0, leaf, a0, a1, delta < 0);
  ctx.strokeStyle = 'rgba(250,204,21,0.55)';
  ctx.lineWidth = 0.9;
  ctx.setLineDash([2.5, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  circle(ctx, hx, 0, 1.4, accent);
  // threshold line across the opening
  line(ctx, -w / 2, 0, w / 2, 0, 'rgba(250,204,21,0.35)', 0.8);
}

export function drawWindow(ctx, w, h, { bg = '#09090b', blueprint = false } = {}) {
  const t = WALL_T + 1;
  const wall = blueprint ? '#ffffff' : '#e4e4e7';
  ctx.fillStyle = bg;
  ctx.fillRect(-w / 2, -t / 2, w, t);
  ctx.fillStyle = 'rgba(96,165,250,0.14)';
  ctx.fillRect(-w / 2, -WALL_T / 2 + 0.5, w, WALL_T - 1);
  // frame ends
  ctx.fillStyle = wall;
  ctx.fillRect(-w / 2 - 1, -t / 2, 2.5, t);
  ctx.fillRect(w / 2 - 1.5, -t / 2, 2.5, t);
  // sill outline and glazing lines
  const edge = '#94a3b8';
  line(ctx, -w / 2, -WALL_T / 2 + 0.5, w / 2, -WALL_T / 2 + 0.5, edge, 1);
  line(ctx, -w / 2, WALL_T / 2 - 0.5, w / 2, WALL_T / 2 - 0.5, edge, 1);
  line(ctx, -w / 2 + 1, -1.3, w / 2 - 1, -1.3, '#60a5fa', 1.1);
  line(ctx, -w / 2 + 1, 1.3, w / 2 - 1, 1.3, '#60a5fa', 1.1);
  // casement divisions on wide windows
  if (w > 40) line(ctx, 0, -WALL_T / 2 + 0.5, 0, WALL_T / 2 - 0.5, edge, 1);
}

export function drawStairs(ctx, w, h, { blueprint = false } = {}) {
  const stroke = '#c084fc';
  box(ctx, -w / 2, -h / 2, w, h, 1, blueprint ? null : 'rgba(192,132,252,0.12)', stroke, 1.2);
  const steps = Math.max(4, Math.round(w / 9));
  for (let i = 1; i < steps; i++) {
    const x = -w / 2 + (w * i) / steps;
    line(ctx, x, -h / 2, x, h / 2, 'rgba(192,132,252,0.75)', 0.9);
  }
  line(ctx, -w / 2 + 4, 0, w / 2 - 6, 0, stroke, 1);
  ctx.beginPath();
  ctx.moveTo(w / 2 - 4, 0);
  ctx.lineTo(w / 2 - 9, -3);
  ctx.lineTo(w / 2 - 9, 3);
  ctx.closePath();
  ctx.fillStyle = stroke;
  ctx.fill();
}

// -------------------------------------------------------------------------------------------
// Furniture (top-down).  Back of the item is at -y.
// -------------------------------------------------------------------------------------------
const OUT = 'rgba(0,0,0,0.55)';

function drawBed(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 2.5, '#4b4540', OUT, 1);                       // frame
  box(ctx, x, y, w, d * 0.07 + 1.5, 1.5, '#2f2a26', null);            // headboard
  box(ctx, x + 1.6, y + d * 0.07, w - 3.2, d * 0.93 - 1.6, 2, '#ebe7e0', '#b8b1a6', 0.8); // mattress
  box(ctx, x + 1.6, y + d * 0.42, w - 3.2, d * 0.58 - 1.6, 2, '#a9b4c2', '#8d99a8', 0.8);  // duvet
  line(ctx, x + 1.6, y + d * 0.42, x + w - 1.6, y + d * 0.42, '#f2efe9', 1.6);              // turned-down sheet
  const pw = w / 2 - 4.5, ph = Math.min(d * 0.16, 9);
  box(ctx, x + 3, y + d * 0.09, pw, ph, 2.5, '#fbfaf7', '#b8b1a6', 0.8);                    // pillows
  box(ctx, x + w / 2 + 1.5, y + d * 0.09, pw, ph, 2.5, '#fbfaf7', '#b8b1a6', 0.8);
}

function drawSofa(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  const body = '#5b6b8c', cushion = '#7685a6', dark = '#46547a';
  box(ctx, x, y, w, d, 3, body, OUT, 1);
  box(ctx, x + 1, y + 1, w - 2, d * 0.28, 2.5, dark, null);                     // back rest
  const arm = Math.min(w * 0.09, 6);
  box(ctx, x + 1, y + d * 0.2, arm, d * 0.78, 2.5, dark, null);                 // arms
  box(ctx, x + w - arm - 1, y + d * 0.2, arm, d * 0.78, 2.5, dark, null);
  const n = w > 110 ? 3 : 2;
  const sw = (w - 2 * arm - 4) / n;
  for (let i = 0; i < n; i++) {
    box(ctx, x + arm + 2 + i * sw + 0.6, y + d * 0.3, sw - 1.2, d * 0.66, 2.5, cushion, '#5a6890', 0.8);
  }
}

function drawTable(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 2, '#a97c50', OUT, 1);
  box(ctx, x + 1.5, y + 1.5, w - 3, d - 3, 1.5, null, 'rgba(255,255,255,0.25)', 0.8);
  for (let i = 1; i < 4; i++) {
    line(ctx, x + 3, y + (d * i) / 4, x + w - 3, y + (d * i) / 4, 'rgba(60,35,15,0.25)', 0.6);
  }
}

function drawArmchair(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 3, '#3f7f8f', OUT, 1);
  box(ctx, x + 1, y + 1, w - 2, d * 0.3, 2.5, '#2f6574', null);
  box(ctx, x + 1, y + d * 0.2, w * 0.16, d * 0.78, 2, '#2f6574', null);
  box(ctx, x + w - w * 0.16 - 1, y + d * 0.2, w * 0.16, d * 0.78, 2, '#2f6574', null);
  box(ctx, x + w * 0.2, y + d * 0.34, w * 0.6, d * 0.6, 2.5, '#5497a8', null);
}

function drawBathtub(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 4, '#f4f4f5', '#a1a1aa', 1.1);
  box(ctx, x + 2.5, y + 2.5, w - 5, d - 5, Math.min(d / 2 - 2.5, 7), '#dbeafe', '#93c5fd', 0.9);
  circle(ctx, x + w * 0.9, y + d / 2, 1.6, '#71717a');                    // drain
  circle(ctx, x + 4, y + d / 2 - 2.5, 1.1, '#71717a');                    // taps
  circle(ctx, x + 4, y + d / 2 + 2.5, 1.1, '#71717a');
}

function drawVanity(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 1.5, '#7c7370', OUT, 1);
  box(ctx, x + 1, y + 1, w - 2, d - 2, 1, '#cfc9c4', null);
  ctx.beginPath();
  ctx.ellipse(0, d * 0.08, Math.min(w * 0.3, 7), Math.min(d * 0.3, 4.2), 0, 0, Math.PI * 2);
  fillStroke(ctx, '#f4f4f5', '#8d8782', 0.9);                              // basin
  circle(ctx, 0, -d * 0.28, 1, '#52525b');                                 // tap
}

function drawKitchen(ctx, w, d) {
  const x = -w / 2, y = -d / 2;
  box(ctx, x, y, w, d, 1, '#6b625c', OUT, 1);
  box(ctx, x + 1, y + 1, w - 2, d - 2, 1, '#bdb6af', null);                // worktop
  const long = w >= d;
  const len = long ? w : d;
  const sinkAt = long ? -w * 0.22 : -d * 0.22;
  const hobAt = long ? w * 0.22 : d * 0.22;
  const at = (a) => (long ? [a, 0] : [0, a]);
  const [sx, sy] = at(sinkAt);
  const sw = long ? Math.min(len * 0.26, 18) : d - 5;
  const sh = long ? d - 5 : Math.min(len * 0.26, 18);
  box(ctx, sx - sw / 2, sy - sh / 2, sw, sh, 1.5, '#e5e7eb', '#8b9099', 0.9);   // sink
  circle(ctx, sx, sy, 1, '#6b7280');
  const [hx, hy] = at(hobAt);
  const off = Math.min(Math.min(w, d) * 0.22, 3.4);
  [[-off, -off], [off, -off], [-off, off], [off, off]].forEach(([ox, oy]) => {
    circle(ctx, hx + ox, hy + oy, Math.min(off * 0.8, 2.4), '#27272a', '#71717a', 0.6);
  });
}

const FURNITURE = {
  furniture_bed: drawBed,
  furniture_sofa: drawSofa,
  furniture_table: drawTable,
  furniture_armchair: drawArmchair,
  furniture_bathtub: drawBathtub,
  furniture_vanity: drawVanity,
  furniture_kitchen: drawKitchen,
};

export function drawSymbol(type, ctx, w, h, opts = {}) {
  ctx.save();
  ctx.lineJoin = 'round';
  if (type === 'room') drawRoom(ctx, w, h, opts);
  else if (type === 'door') drawDoor(ctx, w, h, opts);
  else if (type === 'window') drawWindow(ctx, w, h, opts);
  else if (type === 'stairs') drawStairs(ctx, w, h, opts);
  else if (FURNITURE[type]) FURNITURE[type](ctx, w, h);
  ctx.restore();
}

export function hasSymbol(type) {
  return SYMBOL_TYPES.has(type);
}

/**
 * Make a Fabric.Rect paint itself as an architectural symbol. Safe to call more than once.
 * `rect.swing` / `rect.hinge` (+1 / -1) steer doors; everything else is derived from the size.
 */
export function installSymbol(rect) {
  if (!rect || !hasSymbol(rect.type) || rect.__symbol) return rect;
  rect.__symbol = true;
  rect.objectCaching = false;      // symbols draw outside their box (door swing), so no bitmap cache
  rect.strokeWidth = 0;
  rect._render = function renderSymbol(ctx) {
    const sx = this.scaleX || 1;
    const sy = this.scaleY || 1;
    ctx.save();
    ctx.scale(1 / sx, 1 / sy);      // draw in true units so scaling a door never squashes its arc
    const canvas = this.canvas;
    drawSymbol(this.type, ctx, this.width * sx, this.height * sy, {
      swing: this.swing ?? 1,
      hinge: this.hinge ?? 1,
      kind: this.kind,
      name: this.name,
      area: this.area,
      bg: (canvas && canvas.backgroundColor) || '#09090b',
      blueprint: !!(canvas && canvas.__blueprint),
    });
    ctx.restore();
  };
  return rect;
}

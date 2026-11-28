import { jsPDF } from 'jspdf';
import { computeCosts } from './costs';
import { formatArea, formatMoney, currencyRate, CURRENCY } from './units';
import { FLOOR_BY_ID } from './floorFinishes';
import { roomWalls } from './finishSchedule';
import { CEILING_STYLES } from '../components/Ceilings';
import { emiForCost, loanSettings, lakh, rupees } from './loan';
import { plan as solarPlan } from './solar';
import { assessComfort } from './comfort';

/*
 * The client brochure: one A4 PDF the family keeps, made from what the project already knows.
 *   cover       a photo render (or the first room render), the name, and the house in numbers
 *   plans       every floor, drawn to fit, rooms named with their sizes
 *   rooms       the photo renders, two to a page, with what each room is finished in
 *   finishes    room by room: wall paint or finish, floor, ceiling, with colour swatches
 *   money       the estimate, the loan EMI, the solar saving; the build time
 *   approval    the building rules verdict, the Vastu score, daylight & comfort, and the options voted on
 * Data the server provides (renders, rules, Vastu, options, quantities) is fetched by buildBrochure's caller
 * and passed in; anything missing is left out rather than guessed.
 */
const W = 210, H = 297, M = 16;
const U = 20;
const INK = [28, 26, 24], SOFT = [110, 105, 98], LINE = [220, 214, 205], ACCENT = [200, 121, 74];
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const ROOM_FILL = { living: [246, 238, 226], dining: [246, 238, 226], lounge: [246, 238, 226], kitchen: [248, 230, 218], master_bedroom: [232, 238, 246],
  bedroom: [232, 238, 246], bathroom: [226, 240, 242], study: [238, 236, 246], patio: [234, 240, 228], balcony: [234, 240, 228], terrace: [234, 240, 228] };
const hexRgb = (hex) => { const v = parseInt(String(hex || '#999999').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const inr = (usd) => (usd / currencyRate()) * CURRENCY.INR.rate;

function header(pdf, title, project, page) {
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(...INK);
  pdf.text(title, M, 26);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...SOFT);
  pdf.text(`${project}  ·  ${page}`, W - M, 26, { align: 'right' });
  pdf.setDrawColor(...LINE); pdf.setLineWidth(0.3); pdf.line(M, 30, W - M, 30);
  pdf.setTextColor(...INK);
}
function footer(pdf) {
  pdf.setFontSize(7); pdf.setTextColor(...SOFT);
  pdf.text('Prepared with Arch-E-Tech. Estimates use typical rates; confirm with your architect, engineer and contractor.', W / 2, H - 9, { align: 'center' });
  pdf.setTextColor(...INK);
}
const kv = (pdf, x, y, label, value, w = 40) => {
  pdf.setFontSize(7.5); pdf.setTextColor(...SOFT); pdf.text(label.toUpperCase(), x, y);
  pdf.setFontSize(12); pdf.setTextColor(...INK); pdf.setFont('helvetica', 'bold'); pdf.text(String(value), x, y + 6, { maxWidth: w });
  pdf.setFont('helvetica', 'normal');
};
function image(pdf, data, x, y, w, h) {
  try {
    const props = pdf.getImageProperties(data);
    const r = Math.min(w / props.width, h / props.height);
    const iw = props.width * r, ih = props.height * r;
    pdf.addImage(data, props.fileType || 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    return true;
  } catch { return false; }
}

/** A floor plan drawn into a box: rooms tinted and named, walls dark, doors and windows marked. */
function drawPlan(pdf, els, bx, by, bw, bh) {
  const rooms = els.filter(e => e.type === 'room');
  if (!rooms.length) return;
  const x0 = Math.min(...rooms.map(r => r.left)), x1 = Math.max(...rooms.map(r => r.left + r.width));
  const y0 = Math.min(...rooms.map(r => r.top - r.height / 2)), y1 = Math.max(...rooms.map(r => r.top + r.height / 2));
  const k = Math.min(bw / (x1 - x0), bh / (y1 - y0));
  const ox = bx + (bw - (x1 - x0) * k) / 2, oy = by + (bh - (y1 - y0) * k) / 2;
  const X = (x) => ox + (x - x0) * k, Y = (y) => oy + (y - y0) * k;
  rooms.forEach(r => { pdf.setFillColor(...(ROOM_FILL[r.kind] || [244, 242, 238])); pdf.rect(X(r.left), Y(r.top - r.height / 2), r.width * k, r.height * k, 'F'); });
  const seg = (e, color, lw) => {
    const a = ((e.angle || 0) * Math.PI) / 180;
    pdf.setDrawColor(...color); pdf.setLineWidth(lw);
    pdf.line(X(e.left), Y(e.top), X(e.left + Math.cos(a) * e.width), Y(e.top + Math.sin(a) * e.width));
  };
  els.filter(e => e.type === 'wall').forEach(w => seg(w, INK, Math.max(0.6, 7 * k * 0.12)));
  els.filter(e => e.type === 'window').forEach(w => seg(w, [110, 160, 210], Math.max(0.8, 7 * k * 0.14)));
  els.filter(e => e.type === 'door').forEach(d => seg(d, [255, 255, 255], Math.max(0.8, 7 * k * 0.14)));
  els.filter(e => e.type === 'railing').forEach(w => seg(w, ACCENT, 0.4));
  rooms.filter(r => r.kind !== 'hallway').forEach(r => {
    const fs = Math.max(5, Math.min(9, Math.min(r.width, r.height) * k * 0.2));
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fs); pdf.setTextColor(...INK);
    pdf.text((r.name || r.kind).toUpperCase(), X(r.left + r.width / 2), Y(r.top) - fs * 0.1, { align: 'center', maxWidth: r.width * k - 2 });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fs * 0.8); pdf.setTextColor(...SOFT);
    pdf.text(formatArea((r.width / U) * (r.height / U)), X(r.left + r.width / 2), Y(r.top) + fs * 0.45, { align: 'center' });
  });
  pdf.setTextColor(...INK);
}

/**
 * The brochure as a jsPDF document.
 * data: { project, elements, site, facade, north, renders: [{ room_name, furnished_image, empty_image }],
 *         rules: { verdict, fails, warnings, city, fixes }, vastu: { score }, options: { items: [{ name, votes }] },
 *         quantities: { total_days }, cover: data URL }
 */
export function buildBrochure(data) {
  const { project = 'Our home', elements, site, facade, north = 'up' } = data;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  // the PDF's built-in fonts have no rupee sign: write "Rs" instead
  const plainText = pdf.text.bind(pdf);
  const rs = (t) => (Array.isArray(t) ? t.map(rs) : typeof t === 'string' ? t.replace(/₹\s?/g, 'Rs ') : t);
  pdf.text = (t, ...rest) => plainText(rs(t), ...rest);
  const rooms = elements.filter(e => e.type === 'room');
  const floors = [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b);
  const inside = rooms.filter(r => !OUTDOOR.has(r.kind));
  const builtUp = inside.reduce((s, r) => s + (r.width / U) * (r.height / U), 0);
  const beds = rooms.filter(r => r.kind === 'bedroom' || r.kind === 'master_bedroom').length;
  const baths = rooms.filter(r => r.kind === 'bathroom' || r.kind === 'powder').length;
  const cost = computeCosts(elements).total;
  const costInr = inr(cost);
  const emi = emiForCost(costInr, loanSettings(data.projectId));
  const renders = (data.renders || []).filter(r => r.furnished_image || r.empty_image);
  let page = 1;

  // ---- cover ----
  pdf.setFillColor(28, 26, 24); pdf.rect(0, 0, W, H, 'F');
  const cover = data.cover || renders[0]?.furnished_image || renders[0]?.empty_image;
  if (!cover || !image(pdf, cover, 0, 0, W, 175)) {
    // no photo yet: the ground floor plan, drawn light on the dark cover
    pdf.setFillColor(40, 38, 35); pdf.rect(0, 0, W, 175, 'F');
    drawPlan(pdf, elements.filter(e => (e.floor || 1) === floors[0]), 24, 22, W - 48, 140);
  }
  pdf.setTextColor(200, 121, 74); pdf.setFontSize(9); pdf.text('A HOME DESIGNED WITH ARCH-E-TECH', M, 196);
  pdf.setTextColor(245, 242, 236); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(30);
  pdf.text(project, M, 212, { maxWidth: W - 2 * M });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(190, 184, 176);
  pdf.text(`${beds} bedroom${beds === 1 ? '' : 's'} · ${baths} bathroom${baths === 1 ? '' : 's'} · ${floors.length} floor${floors.length > 1 ? 's' : ''}${site?.city ? ` · ${site.city}` : ''}`, M, 222);
  const stats = [['Built-up', formatArea(builtUp)], ['Estimate', formatMoney(cost / currencyRate())], ['EMI from', `${rupees(emi)}/mo`], ['Build time', data.quantities?.total_days ? `${Math.round(data.quantities.total_days / 30)} months` : '—']];
  stats.forEach(([l, v], i) => {
    const x = M + i * ((W - 2 * M) / 4);
    pdf.setFontSize(7.5); pdf.setTextColor(150, 144, 136); pdf.text(l.toUpperCase(), x, 246);
    pdf.setFontSize(13); pdf.setTextColor(245, 242, 236); pdf.setFont('helvetica', 'bold'); pdf.text(v, x, 253); pdf.setFont('helvetica', 'normal');
  });
  pdf.setFontSize(7); pdf.setTextColor(150, 144, 136);
  pdf.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 14);

  // ---- plans ----
  floors.forEach(f => {
    pdf.addPage(); page += 1;
    header(pdf, f === 1 ? 'Ground floor' : `Floor ${f}`, project, page);
    const els = elements.filter(e => (e.floor || 1) === f);
    drawPlan(pdf, els, M, 38, W - 2 * M, 170);
    const list = els.filter(e => e.type === 'room' && e.kind !== 'hallway');
    let y = 220;
    pdf.setFontSize(8);
    list.forEach((r, i) => {
      const col = i % 2, x = M + col * ((W - 2 * M) / 2);
      if (col === 0 && i) y += 6;
      if (y > H - 20) return;
      pdf.setTextColor(...INK); pdf.text(r.name || r.kind, x, y);
      pdf.setTextColor(...SOFT); pdf.text(`${(r.width / U).toFixed(1)} × ${(r.height / U).toFixed(1)} m · ${formatArea((r.width / U) * (r.height / U))}`, x + (W - 2 * M) / 2 - 6, y, { align: 'right' });
    });
    // north arrow
    const turn = { up: 0, right: 90, down: 180, left: 270 }[north] || 0, a = (turn * Math.PI) / 180, cx = W - M - 6, cy = 44;
    pdf.setDrawColor(...INK); pdf.setFillColor(...INK); pdf.circle(cx, cy, 4, 'S');
    pdf.triangle(cx + Math.sin(a) * 3.5, cy - Math.cos(a) * 3.5, cx - Math.cos(a) * 1.6, cy - Math.sin(a) * 1.6, cx + Math.cos(a) * 1.6, cy + Math.sin(a) * 1.6, 'F');
    pdf.setFontSize(6); pdf.text('N', cx + Math.sin(a) * 6.5, cy - Math.cos(a) * 6.5 + 1, { align: 'center' });
    footer(pdf);
  });

  // ---- rooms: renders, two a page ----
  for (let i = 0; i < renders.length; i += 2) {
    pdf.addPage(); page += 1;
    header(pdf, i ? 'The rooms (continued)' : 'The rooms', project, page);
    renders.slice(i, i + 2).forEach((r, j) => {
      const y = 38 + j * 122;
      image(pdf, r.furnished_image || r.empty_image, M, y, W - 2 * M, 106);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text(r.room_name || 'Room', M, y + 113);
      pdf.setFont('helvetica', 'normal');
    });
    footer(pdf);
  }

  // ---- finishes ----
  pdf.addPage(); page += 1;
  header(pdf, 'Finishes', project, page);
  let y = 40;
  inside.filter(r => r.kind !== 'hallway').sort((a, b) => (a.floor || 1) - (b.floor || 1)).forEach(r => {
    if (y > H - 30) { footer(pdf); pdf.addPage(); page += 1; header(pdf, 'Finishes (continued)', project, page); y = 40; }
    const walls = roomWalls(r, elements).filter(w => !w.band).sort((a, b) => b.m2 - a.m2);
    const floor = FLOOR_BY_ID[r.flooring];
    const ceiling = CEILING_STYLES.find(c => c.id === r.ceiling?.style);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(`${r.name || r.kind}${(r.floor || 1) > 1 ? `  (floor ${r.floor})` : ''}`, M, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    let x = M;
    const sw = (rgb, label) => {
      pdf.setFillColor(...rgb); pdf.setDrawColor(...LINE); pdf.rect(x, y + 3, 6, 6, 'FD');
      pdf.setTextColor(...SOFT); pdf.text(label, x + 8, y + 7.3, { maxWidth: 52 });
      pdf.setTextColor(...INK); x += 60;
    };
    walls.slice(0, 1).forEach(w => sw(w.swatch ? hexRgb(w.swatch) : [190, 175, 155], `Walls: ${w.name}`));
    if (walls[1]) sw(walls[1].swatch ? hexRgb(walls[1].swatch) : [160, 120, 90], `Feature: ${walls[1].name}`);
    if (floor) sw(hexRgb(floor.color), `Floor: ${floor.name}`);
    if (!walls.length && !floor) { pdf.setTextColor(...SOFT); pdf.text('Standard finishes', M, y + 7); pdf.setTextColor(...INK); }
    if (ceiling && ceiling.id !== 'plain') { pdf.setTextColor(...SOFT); pdf.text(`Ceiling: ${ceiling.name}`, M, y + 14); pdf.setTextColor(...INK); y += 5; }
    y += 17;
  });
  footer(pdf);

  // ---- money ----
  pdf.addPage(); page += 1;
  header(pdf, 'Cost, loan and savings', project, page);
  const ls = loanSettings(data.projectId);
  kv(pdf, M, 42, 'Estimated cost', lakh(costInr), 60);
  kv(pdf, M + 62, 42, 'Monthly EMI', rupees(emi), 60);
  kv(pdf, M + 124, 42, 'Build time', data.quantities?.total_days ? `about ${Math.round(data.quantities.total_days / 30)} months` : '—', 60);
  pdf.setFontSize(8); pdf.setTextColor(...SOFT);
  pdf.text(`EMI at ${ls.rate || 8.5} % over ${ls.years || 20} years with ${ls.savings != null ? lakh(Number(ls.savings)) : '25 %'} down${ls.land ? ` and ${lakh(Number(ls.land))} for the land` : ''}.`, M, 58);
  pdf.setTextColor(...INK);
  y = 70;
  const costs = computeCosts(elements).breakdown.filter(b => b.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 12);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Where the money goes', M, y); pdf.setFont('helvetica', 'normal'); y += 6;
  const max = Math.max(...costs.map(c => c.cost), 1);
  costs.forEach(c => {
    pdf.setFontSize(8); pdf.text(c.label, M, y + 3);
    pdf.setFillColor(...ACCENT); pdf.rect(M + 52, y, Math.max(0.5, (c.cost / max) * 90), 3.6, 'F');
    pdf.setTextColor(...SOFT); pdf.text(formatMoney(c.cost / currencyRate()), W - M, y + 3, { align: 'right' }); pdf.setTextColor(...INK);
    y += 6.5;
  });
  if (facade?.solar?.kw) {
    const sp = solarPlan(elements, { city: facade.solar.city || site?.city || 'Bengaluru', kw: facade.solar.kw });
    y += 6;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Solar and rainwater', M, y); pdf.setFont('helvetica', 'normal'); y += 8;
    kv(pdf, M, y, 'Rooftop solar', `${sp.size} kWp`, 40);
    kv(pdf, M + 45, y, 'Saves', `${rupees(sp.saveMonth)}/mo`, 40);
    kv(pdf, M + 90, y, 'After subsidy', lakh(sp.net), 40);
    kv(pdf, M + 135, y, 'Rain tank', `${Number(facade.solar.tank_l).toLocaleString('en-IN')} L`, 40);
  }
  footer(pdf);

  // ---- approval, comfort, options ----
  pdf.addPage(); page += 1;
  header(pdf, 'Approval, comfort and choices', project, page);
  y = 42;
  if (data.rules) {
    const ok = !data.rules.fails;
    pdf.setFillColor(...(ok ? [228, 244, 234] : [250, 232, 226])); pdf.roundedRect(M, y - 6, W - 2 * M, 22, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(data.rules.verdict || '', M + 4, y + 1);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...SOFT);
    pdf.text(`Building rules of ${data.rules.city || 'the National Building Code'}: ${data.rules.fails || 0} to fix, ${data.rules.warnings || 0} to check.`, M + 4, y + 8);
    pdf.setTextColor(...INK);
    y += 24;
    (data.rules.fixes || []).slice(0, 4).forEach(f => { const ls2 = pdf.splitTextToSize(`• ${f}`, W - 2 * M); pdf.text(ls2, M, y); y += ls2.length * 4 + 1; });
    y += 4;
  }
  let comfort = null;
  try { comfort = assessComfort(elements, { north, city: site?.city || 'Bengaluru' }).house; } catch { /* no lived-in rooms */ }
  kv(pdf, M, y, 'Daylight & comfort', comfort != null ? `${comfort} / 100` : '—', 55);
  kv(pdf, M + 62, y, 'Vastu', data.vastu?.score != null ? `${data.vastu.score} / 100` : '—', 55);
  kv(pdf, M + 124, y, 'Plot', site?.plot_m ? `${site.plot_m[0]} × ${site.plot_m[1]} m${site.facing ? `, ${({ N: 'north', E: 'east', S: 'south', W: 'west' })[site.facing]} facing` : ''}` : '—', 60);
  y += 20;
  const opts = (data.options?.items || []).filter(o => o.name);
  if (opts.length > 1) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('The options you compared', M, y); pdf.setFont('helvetica', 'normal'); y += 6;
    const most = Math.max(...opts.map(o => o.votes || 0));
    opts.forEach(o => {
      pdf.setFontSize(8.5); pdf.text(o.name, M, y);
      pdf.setTextColor(...(o.votes && o.votes === most ? ACCENT : SOFT));
      pdf.text(`${o.votes || 0} vote${o.votes === 1 ? '' : 's'}${o.votes && o.votes === most ? ' · the favourite' : ''}`, W - M, y, { align: 'right' });
      pdf.setTextColor(...INK); y += 6;
    });
  }
  footer(pdf);
  return pdf;
}

import { footprint, slabPieces } from './roofShape';

/*
 * Rooftop solar and rainwater for a house, in rupees.
 *   Solar: the flat roof over the top floor (and open terraces, if wanted) holds about 1 kWp per 6 m² once
 *   access paths and shade from the parapet and water tank are allowed for. Each kWp makes the city's
 *   yearly yield (kWh per kWp: sunshine, heat and dust, typical values). The system is sized to the
 *   family's use or to the roof, whichever is smaller; 550 W panels. Cost per kWp is an installed on-grid
 *   price (editable); the PM Surya Ghar subsidy is Rs 30,000 per kW for the first 2 kW and Rs 18,000 for
 *   the third, at most Rs 78,000. Savings: what the panels make, at the tariff, up to the bill; any extra
 *   exported under net metering at about Rs 3 a unit.
 *   Rainwater: every roof the rain falls on (the house's widest outline) times the city's yearly rainfall,
 *   at 85 % runoff from an RCC roof. The tank follows the Bengaluru rule of 20 litres per m² of roof,
 *   rounded up to a stock size; one recharge pit (1.2 m across, 1.5 m deep) per 100 m² of roof.
 */
const U = 20;
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
export const M2_PER_KWP = 6;
export const PANEL_W = 550;
export const PANEL_SIZE = [2.28, 1.13];                     // metres

// yield (kWh per kWp a year) and rainfall (mm a year): typical values
export const CLIMATE = {
  Bengaluru: [1450, 970], Chennai: [1450, 1400], Hyderabad: [1500, 830], Mumbai: [1350, 2200], Pune: [1500, 720],
  Ahmedabad: [1600, 800], Kolkata: [1250, 1580], Delhi: [1450, 790], Jaipur: [1650, 650], Kochi: [1300, 3000],
  Chandigarh: [1450, 1100], Guwahati: [1200, 1700],
};
const TANKS = [1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000];

const rectOf = (r) => ({ x: r.left / U, z: (r.top - r.height / 2) / U, w: r.width / U, d: r.height / U });
const areaOf = (fp) => slabPieces(fp).reduce((s, p) => s + p.w * p.d, 0);

/** Roof areas (m²): the top floor's roof, open terraces, and every roof the rain falls on. */
export function roofAreas(elements) {
  const floors = [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b);
  const top = floors[floors.length - 1] || 1;
  const rooms = elements.filter(e => e.type === 'room');
  const topRooms = rooms.filter(r => (r.floor || 1) === top && !OUTDOOR.has(r.kind));
  const terraces = rooms.filter(r => r.kind === 'terrace');
  const all = rooms.filter(r => !OUTDOOR.has(r.kind) || r.kind === 'terrace' || r.kind === 'balcony');
  return {
    roof: areaOf(footprint(topRooms.map(rectOf))),
    terrace: terraces.reduce((s, r) => s + (r.width / U) * (r.height / U), 0),
    catchment: areaOf(footprint(all.map(rectOf))),
    bedrooms: rooms.filter(r => r.kind === 'bedroom' || r.kind === 'master_bedroom').length,
  };
}

/** A rough monthly electricity use for the house (units), if the owner doesn't know theirs. */
export const typicalUse = (bedrooms) => Math.round((150 + Math.max(1, bedrooms) * 90) / 10) * 10;

export function subsidy(kw) {
  return Math.min(78000, Math.min(kw, 2) * 30000 + Math.max(0, Math.min(kw, 3) - 2) * 18000);
}

/** Everything the panel shows, from the plan and the owner's numbers. */
export function plan(elements, { city = 'Bengaluru', units, tariff = 8, ratePerKw = 55000, kw = null, useTerrace = false } = {}) {
  const a = roofAreas(elements);
  const [yieldKwh, rainMm] = CLIMATE[city] || CLIMATE.Bengaluru;
  const use = units ?? typicalUse(a.bedrooms);
  const usable = (a.roof + (useTerrace ? a.terrace : 0)) * 0.7;
  const maxKw = Math.max(0, Math.floor((usable / M2_PER_KWP) * 2) / 2);
  const needKw = Math.max(1, Math.round(((use * 12) / yieldKwh) * 2) / 2);
  const recommended = Math.min(maxKw, needKw);
  const size = kw ?? recommended;
  const panels = Math.ceil((size * 1000) / PANEL_W);
  const genYear = size * yieldKwh;
  const genMonth = genYear / 12;
  const saveMonth = Math.min(genMonth, use) * tariff + Math.max(0, genMonth - use) * 3;
  const cost = size * ratePerKw;
  const sub = subsidy(size);
  const net = Math.max(0, cost - sub);
  const payback = saveMonth > 0 ? net / (saveMonth * 12) : null;

  const harvest = a.catchment * (rainMm / 1000) * 0.85 * 1000;               // litres a year
  const needTank = a.catchment * 20;
  const tank = TANKS.find(t => t >= needTank) || Math.ceil(needTank / 1000) * 1000;
  const pits = Math.max(1, Math.ceil(a.catchment / 100));
  const rwhCost = tank * 8 + pits * 15000 + 6000;                              // tank, pits, first-flush filter and pipes

  return {
    areas: a, city, yieldKwh, rainMm, use, usable, maxKw, needKw, recommended, size, panels, genYear, genMonth, saveMonth,
    cost, subsidy: sub, net, payback, roofUsed: size * M2_PER_KWP,
    rain: { harvest, tank, pits, cost: rwhCost, catchment: a.catchment },
  };
}

/**
 * Panel positions on the flat roof over the top floor, in metres in the plan's frame: rows facing south
 * (north = which way is up on the plan), kept 0.6 m in from the edges. [{ x, z, along: 'x' | 'z' }]
 */
export function panelLayout(rooms, count, north = 'up') {
  if (!count || !rooms.length) return [];
  const pieces = slabPieces(footprint(rooms.map(r => ({ x: r.x, z: r.z, w: r.w, d: r.d })), 0.2)).sort((p, q) => q.w * q.d - p.w * p.d);
  const southAlongZ = north === 'up' || north === 'down';        // rows run east-west
  const [pl, pw] = PANEL_SIZE;
  const rowGap = pw + 0.7;                                       // panel depth plus spacing so rows don't shade each other
  const out = [];
  for (const p of pieces) {
    const L = southAlongZ ? p.w : p.d, D = southAlongZ ? p.d : p.w;
    const across = Math.floor((L - 1.2) / (pl + 0.05)), rows = Math.floor((D - 1.2 + 0.7) / rowGap);
    for (let i = 0; i < rows && out.length < count; i++) {
      for (let j = 0; j < across && out.length < count; j++) {
        const a = 0.6 + j * (pl + 0.05) + pl / 2, b = 0.6 + i * rowGap + pw / 2;
        out.push(southAlongZ ? { x: p.x + a, z: p.z + b, along: 'x' } : { x: p.x + b, z: p.z + a, along: 'z' });
      }
    }
    if (out.length >= count) break;
  }
  return out;
}

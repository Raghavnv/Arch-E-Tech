import { currencyRate, measurement } from './units';

// rough build-cost rates in US dollars (converted to the chosen currency): walls and railings per
// metre of length, everything else per item
const RATES = {
  wall: 120, railing: 60, door: 350, window: 250, stairs: 2500,
  furniture_bed: 800, furniture_sofa: 1200, furniture_table: 600, furniture_armchair: 400,
  furniture_bathtub: 1100, furniture_vanity: 700, furniture_kitchen: 1800,
};
const BY_LENGTH = new Set(['wall', 'railing']);
const LABEL = {
  wall: 'Walls', railing: 'Railings', door: 'Doors', window: 'Windows', stairs: 'Stairs',
  furniture_bed: 'Beds', furniture_sofa: 'Sofas', furniture_table: 'Tables', furniture_armchair: 'Armchairs',
  furniture_bathtub: 'Bathtubs', furniture_vanity: 'Vanities', furniture_kitchen: 'Kitchen counters',
};

/** Cost takeoff for a plan: { total, breakdown: [{ key, type, label, qty, cost }] } in the chosen currency. */
export function computeCosts(elements) {
  const k = currencyRate();
  const imperial = measurement() !== 'metric';
  const counts = {};
  let total = 0;
  (elements || []).forEach(el => {
    if (!el || el.isGrid || el.type === 'room' || el.arrival) return;   // an arrival only marks where stairs land
    const type = el.type || 'unknown';
    const c = counts[type] || (counts[type] = { count: 0, length: 0, cost: 0 });
    let cost;
    if (BY_LENGTH.has(type)) {
      const m = (el.width || 0) * 0.05;
      c.length += m;
      cost = m * RATES[type] * k;
    } else {
      c.count += 1;
      cost = (RATES[type] || 300) * k;
    }
    c.cost += cost;
    total += cost;
  });
  const breakdown = Object.entries(counts).map(([key, c]) => ({
    key,
    type: key.replace('furniture_', '').toUpperCase(),
    label: LABEL[key] || key,
    qty: BY_LENGTH.has(key)
      ? `${(imperial ? c.length * 3.28084 : c.length).toFixed(1)}${imperial ? 'ft' : 'm'}`
      : c.count,
    cost: Math.round(c.cost),
  })).sort((a, b) => b.cost - a.cost);
  return { total: Math.round(total), breakdown };
}

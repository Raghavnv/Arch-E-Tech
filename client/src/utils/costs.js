import { currencyRate, measurement } from './units';
import { catalogItem } from './furnitureCatalog';
import { CEILING_STYLES, LIGHT_TYPES } from '../components/Ceilings';
import { FLOOR_BY_ID } from './floorFinishes';

const TREATMENT_PRICE = { curtains: ['Curtains', 160], sheer: ['Sheer curtains', 110], blinds: ['Venetian blinds', 90], roman: ['Roman blinds', 120], roller: ['Roller blinds', 70] };

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
  const extra = {};          // ceiling designs (per m2) and light fittings, by kind
  (elements || []).forEach(el => {
    if (el?.type === 'window' && TREATMENT_PRICE[el.treatment]) {
      const [label, price] = TREATMENT_PRICE[el.treatment];
      const c = extra[`window_${el.treatment}`] || (extra[`window_${el.treatment}`] = { label, area: 0, count: 0, cost: 0 });
      c.count += 1; c.cost += price * k;
      return;
    }
    if (el?.type !== 'room') return;
    const fl = el.flooring && FLOOR_BY_ID[el.flooring];
    if (fl) {
      const m2f = (el.width / 20) * (el.height / 20);
      const c = extra[`floor_${fl.id}`] || (extra[`floor_${fl.id}`] = { label: `Flooring: ${fl.name}`, area: 0, count: 0, cost: 0 });
      c.area += m2f; c.cost += m2f * fl.price * k;
    }
    if (!el.ceiling) return;
    const style = CEILING_STYLES.find(st => st.id === el.ceiling.style);
    const light = LIGHT_TYPES.find(l => l.id === el.ceiling.light);
    const m2 = (el.width / 20) * (el.height / 20);
    if (style?.rate) {
      const c = extra[`ceiling_${style.id}`] || (extra[`ceiling_${style.id}`] = { label: style.name, area: 0, count: 0, cost: 0 });
      c.area += m2; c.cost += m2 * style.rate * k;
    }
    if (light?.price) {
      const c = extra[`light_${light.id}`] || (extra[`light_${light.id}`] = { label: light.name, area: 0, count: 0, cost: 0 });
      c.count += 1; c.cost += light.price * k;
    }
  });
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
      cost = (RATES[type] || catalogItem(type)?.price || 300) * k;
    }
    c.cost += cost;
    total += cost;
  });
  const breakdown = Object.entries(counts).map(([key, c]) => ({
    key,
    type: key.replace('furniture_', '').toUpperCase(),
    label: LABEL[key] || catalogItem(key)?.name || key,
    qty: BY_LENGTH.has(key)
      ? `${(imperial ? c.length * 3.28084 : c.length).toFixed(1)}${imperial ? 'ft' : 'm'}`
      : c.count,
    cost: Math.round(c.cost),
  }));
  Object.entries(extra).forEach(([key, c]) => {
    total += c.cost;
    breakdown.push({
      key, type: key.startsWith('ceiling_') ? 'CEILING' : key.startsWith('floor_') ? 'FLOOR' : key.startsWith('window_') ? 'WINDOW' : 'LIGHT', label: c.label,
      qty: c.area ? (imperial ? `${Math.round(c.area * 10.764)}ft²` : `${c.area.toFixed(1)}m²`) : c.count,
      cost: Math.round(c.cost),
    });
  });
  breakdown.sort((a, b) => b.cost - a.cost);
  return { total: Math.round(total), breakdown };
}

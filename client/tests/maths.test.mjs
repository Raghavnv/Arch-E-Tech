// The app's own maths: loan, solar and rainwater, the plot from the map, accessibility and earthquake checks,
// colour. Run from client/:  npm test   (node --test with tests/resolve.mjs). The demo house is the fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emiOf, loanFor, ltvCap, emiForCost, lakh } from '../src/utils/loan.js';
import { subsidy, plan as solarPlan, roofAreas, panelLayout } from '../src/utils/solar.js';
import { plotFromCorners } from '../src/utils/plotGeometry.js';
import { accessibility, quakeWind } from '../src/utils/houseChecks.js';
import { rgbToLab } from '../src/utils/photoPalette.js';

const DEMO = JSON.parse(readFileSync(new URL('../../backend/demo_house.json', import.meta.url)));
const els = () => structuredClone(DEMO.elements);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} is not within ${tol} of ${b}`);

test('EMI matches the standard formula', () => {
  // Rs 43.14 L at 8.5 % over 20 years: about Rs 37,438 a month (checked by hand)
  near(emiOf(4314000, 8.5, 20), 37438, 5);
  assert.equal(emiOf(0, 8.5, 20), 0);
  near(emiOf(120000, 0, 1), 10000, 0.01, 'no interest');
  // what an EMI buys back is the loan
  near(loanFor(emiOf(3000000, 9, 15), 9, 15), 3000000, 1);
});

test('RBI loan-to-value limits', () => {
  assert.equal(ltvCap(2500000), 0.9);
  assert.equal(ltvCap(5000000), 0.8);
  assert.equal(ltvCap(9000000), 0.75);
  assert.ok(emiForCost(5000000, { savings: 5000000 }) === 0, 'no loan when savings cover it');
  assert.equal(lakh(4314000), '₹43.14 L');
});

test('PM Surya Ghar subsidy', () => {
  assert.equal(subsidy(1), 30000);
  assert.equal(subsidy(2), 60000);
  assert.equal(subsidy(3), 78000);
  assert.equal(subsidy(10), 78000);
  assert.equal(subsidy(2.5), 69000);
});

test('solar and rainwater for the demo house', () => {
  const p = solarPlan(els(), { city: 'Bengaluru', units: 420, tariff: 8 });
  assert.ok(p.size > 0 && p.size <= p.maxKw, 'fits the roof');
  assert.equal(p.panels, Math.ceil((p.size * 1000) / 550));
  near(p.genMonth, (p.size * 1450) / 12, 0.01);
  assert.equal(p.net, Math.max(0, p.cost - p.subsidy));
  assert.ok([1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000].includes(p.rain.tank), 'a stock tank size');
  assert.ok(p.rain.tank >= p.rain.catchment * 20, 'at least 20 L per m² of roof');
  const a = roofAreas(els());
  assert.ok(a.catchment >= a.roof, 'rain falls on every roof, not only the top one');
});

test('solar panels stay on the roof', () => {
  const rooms = els().filter(e => e.type === 'room' && (e.floor || 1) === 2 && !['balcony', 'terrace'].includes(e.kind))
    .map(r => ({ x: r.left / 20, z: (r.top - r.height / 2) / 20, w: r.width / 20, d: r.height / 20 }));
  const spots = panelLayout(rooms, 7, 'up');
  assert.equal(spots.length, 7);
  const x0 = Math.min(...rooms.map(r => r.x)), x1 = Math.max(...rooms.map(r => r.x + r.w));
  spots.forEach(s => assert.ok(s.x > x0 && s.x < x1));
});

test('plot from the map: a 12 × 18 m plot', () => {
  const lat0 = 12.9, lng0 = 77.6, dLat = 18 / 110540, dLng = 12 / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const c = [[lat0 + dLat, lng0], [lat0 + dLat, lng0 + dLng], [lat0, lng0 + dLng], [lat0, lng0]];   // NW, NE, SE, SW
  const south = plotFromCorners(c, 2, 'S');                    // road on the south side
  assert.deepEqual(south.plot_m, [12, 18]);
  assert.equal(south.facing, 'S');
  assert.equal(south.north, 'up');
  near(south.plot_area_m2, 216, 1);
  const east = plotFromCorners(c, 1, 'S');                     // road on the east side
  assert.deepEqual(east.plot_m, [18, 12]);
  assert.equal(east.facing, 'E');
  assert.equal(east.north, 'right');
  assert.equal(plotFromCorners(c, 0, 'S').facing, 'N');
});

test('accessibility of the demo house', () => {
  const items = accessibility(els(), { setbacks_m: { front: 1.5 } });
  const by = Object.fromEntries(items.map(i => [i.title, i.status]));
  assert.equal(by['Main door width'], 'pass');
  assert.equal(by['Step-free entrance'], 'warn', 'a 5.4 m ramp does not fit a 1.5 m setback');
  // narrow a bathroom door and it is caught
  const narrow = els();
  const door = narrow.find(e => e.type === 'door' && e.width > 15);
  door.width = 14;
  assert.equal(Object.fromEntries(accessibility(narrow).map(i => [i.title, i.status]))['Other doors'], 'warn');
});

test('earthquake and wind by city', () => {
  const blr = quakeWind(els(), { city: 'Bengaluru' });
  assert.ok(blr.some(i => i.title === 'Seismic zone II'));
  assert.ok(!blr.some(i => i.title === 'Bands and ties'), 'bands are advised from zone III');
  const guw = quakeWind(els(), { city: 'Guwahati' });
  assert.ok(guw.some(i => i.title === 'Seismic zone V'));
  assert.ok(guw.some(i => i.title === 'Bands and ties'));
  assert.ok(quakeWind(els(), { city: 'Chennai' }).some(i => i.title.startsWith('Wind') && i.status === 'warn'), 'cyclone coast');
});

test('colour: white, black and a known red in Lab', () => {
  near(rgbToLab(255, 255, 255)[0], 100, 0.5);
  near(rgbToLab(0, 0, 0)[0], 0, 0.5);
  const red = rgbToLab(255, 0, 0);
  near(red[0], 53.2, 0.5); near(red[1], 80.1, 1); near(red[2], 67.2, 1);
});

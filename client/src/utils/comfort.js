import * as SunCalc from 'suncalc';

/*
 * Daylight and comfort, room by room, from the plan alone.
 *   daylight      window area against floor area (NBC asks for at least a tenth; a sixth feels bright)
 *   depth         daylight reaches about 2.5 x the window head height (2.1 m) into a room
 *   sun           hours of direct sun through the windows in summer and winter, from the sun's path at
 *                 the chosen city and each window's real compass direction (north is set on the plan)
 *   heat          west and south-west glass takes the harsh afternoon sun; worse without shading
 *   ventilation   windows on two different walls let air cross the room
 * Each room gets a 0-100 score and plain suggestions; the house's score is weighted by floor area.
 */
const U = 20;
const WIN_H = 1.2, HEAD = 2.1;
export const CITIES = [
  ['Bengaluru', 12.97, 77.59], ['Chennai', 13.08, 80.27], ['Hyderabad', 17.39, 78.49], ['Mumbai', 19.08, 72.88],
  ['Pune', 18.52, 73.86], ['Ahmedabad', 23.02, 72.57], ['Kolkata', 22.57, 88.36], ['Delhi', 28.61, 77.21],
  ['Jaipur', 26.91, 75.79], ['Kochi', 9.93, 76.27], ['Chandigarh', 30.73, 76.78], ['Guwahati', 26.14, 91.74],
];
const LIVED = ['living', 'lounge', 'dining', 'kitchen', 'master_bedroom', 'bedroom', 'study'];
const NORTH = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassName = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const box = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
const mid = (o) => { const a = ((o.angle || 0) * Math.PI) / 180; return [o.left + (o.width / 2) * Math.cos(a), o.top + (o.width / 2) * Math.sin(a)]; };

/** Compass bearing (0 = north, 90 = east) of a direction on the plan, given where north points. */
function bearing([dx, dy], north) {
  const n = NORTH[north] || NORTH.up;
  const e = [-n[1], n[0]];                 // east is north turned a quarter clockwise (plan y points down)
  return ((Math.atan2(dx * e[0] + dy * e[1], dx * n[0] + dy * n[1]) * 180) / Math.PI + 360) % 360;
}

/** Hours of direct sun through a window facing `deg`, on a given day, at latitude / longitude. */
function sunHours(deg, date, lat, lng) {
  let h = 0;
  for (let t = 5; t <= 19; t += 0.25) {
    const d = new Date(date); d.setHours(Math.floor(t), (t % 1) * 60, 0, 0);
    const p = SunCalc.getPosition(d, lat, lng);
    if (p.altitude < (6 * Math.PI) / 180) continue;
    const sunDeg = ((p.azimuth * 180) / Math.PI + 180 + 360) % 360;
    let diff = Math.abs(sunDeg - deg); if (diff > 180) diff = 360 - diff;
    if (diff < 75) h += 0.25;
  }
  return h;
}

/** Afternoon (after 1 pm) sun hours on a window, in summer: the heat it lets in. */
function afternoonHours(deg, lat, lng) {
  const day = new Date(new Date().getFullYear(), 4, 15);       // mid-May, the hottest stretch in most of India
  let h = 0;
  for (let t = 13; t <= 18.5; t += 0.25) {
    const d = new Date(day); d.setHours(Math.floor(t), (t % 1) * 60, 0, 0);
    const p = SunCalc.getPosition(d, lat, lng);
    if (p.altitude < (6 * Math.PI) / 180) continue;
    const sunDeg = ((p.azimuth * 180) / Math.PI + 180 + 360) % 360;
    let diff = Math.abs(sunDeg - deg); if (diff > 180) diff = 360 - diff;
    if (diff < 70) h += 0.25;
  }
  return h;
}

export function assessComfort(elements, { north = 'up', city = 'Bengaluru' } = {}) {
  const [, lat, lng] = CITIES.find(c => c[0] === city) || CITIES[0];
  const year = new Date().getFullYear();
  const summer = new Date(year, 5, 21), winter = new Date(year, 11, 21);
  const rooms = elements.filter(e => e.type === 'room' && LIVED.includes(e.kind));
  const all = elements.filter(e => e.type === 'room');
  const results = rooms.map(r => {
    const f = r.floor || 1;
    const b = box(r);
    const m2 = (r.width / U) * (r.height / U);
    const inRoom = (x, y, rr) => { const q = box(rr); return x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1; };
    // windows on this room's walls, with the direction they look out
    const wins = elements.filter(e => e.type === 'window' && (e.floor || 1) === f).map(w => {
      const [mx, my] = mid(w);
      const onN = Math.abs(my - b.y0) < 8 && mx > b.x0 && mx < b.x1, onS = Math.abs(my - b.y1) < 8 && mx > b.x0 && mx < b.x1;
      const onW = Math.abs(mx - b.x0) < 8 && my > b.y0 && my < b.y1, onE = Math.abs(mx - b.x1) < 8 && my > b.y0 && my < b.y1;
      const side = onN ? 'N' : onS ? 'S' : onW ? 'W' : onE ? 'E' : null;
      if (!side) return null;
      const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
      // the window must look outside, not into another room
      const px = mx + out[0] * 12, py = my + out[1] * 12;
      if (all.some(o => o !== r && (o.floor || 1) === f && inRoom(px, py, o))) return null;
      const deg = bearing(out, north);
      return { el: w, side, deg, area: (w.width / U) * WIN_H, shaded: ['curtains', 'sheer', 'blinds', 'roman', 'roller'].includes(w.treatment) };
    }).filter(Boolean);

    const glass = wins.reduce((s, w) => s + w.area, 0);
    const wfr = glass / m2;
    const sides = new Set(wins.map(w => w.side));
    // depth: the farthest point of the floor from the nearest window wall
    const span = { N: b.y1 - b.y0, S: b.y1 - b.y0, W: b.x1 - b.x0, E: b.x1 - b.x0 };
    // windows on opposite walls light the room from both ends, so light only has to reach halfway
    const opposite = [...sides].some(s => sides.has({ N: 'S', S: 'N', E: 'W', W: 'E' }[s]));
    const depth = sides.size ? Math.min(...[...sides].map(s => span[s])) / U / (opposite ? 2 : 1) : 99;
    const sumSun = wins.length ? Math.max(...wins.map(w => sunHours(w.deg, summer, lat, lng))) : 0;
    const winSun = wins.length ? Math.max(...wins.map(w => sunHours(w.deg, winter, lat, lng))) : 0;
    const heat = wins.reduce((s, w) => s + afternoonHours(w.deg, lat, lng) * w.area * (w.shaded ? 0.6 : 1), 0) / Math.max(m2, 1);

    // scores
    const sDay = wins.length ? Math.min(1, wfr / (1 / 6)) : 0;
    const sDepth = depth <= 2.5 * HEAD ? 1 : Math.max(0, 1 - (depth - 2.5 * HEAD) / 3);
    const sVent = sides.size >= 2 ? 1 : sides.size === 1 ? 0.45 : 0;
    const sHeat = Math.max(0, 1 - heat / 1.2);
    const score = Math.round(100 * (0.35 * sDay + 0.15 * sDepth + 0.25 * sVent + 0.25 * sHeat));

    const tips = [];
    if (!wins.length) tips.push('No outside window: this room has no daylight or fresh air of its own. Add a window on an outside wall, or a skylight on the top floor.');
    else if (wfr < 0.1) tips.push(`Windows are ${Math.round(wfr * 100)}% of the floor area, under the building code's 10%. Make them wider or add one (about ${(m2 / 6 - glass).toFixed(1)} m² more glass for a bright room).`);
    else if (wfr < 1 / 6) tips.push(`Windows are ${Math.round(wfr * 100)}% of the floor area: enough, but a little more glass (to about 17%) would make it bright.`);
    if (wins.length && depth > 2.5 * HEAD) tips.push(`Daylight reaches about ${(2.5 * HEAD).toFixed(1)} m in; this room is ${depth.toFixed(1)} m deep, so the far end will be dim. A window on another wall or taller windows would help.`);
    if (wins.length && sides.size === 1) {
      const free = ['N', 'S', 'E', 'W'].filter(s => !sides.has(s));
      tips.push(`All windows are on one wall, so air can't cross the room. A window on the ${compassName(bearing({ N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[free.find(s => s === { N: 'S', S: 'N', E: 'W', W: 'E' }[[...sides][0]]) || free[0]], north))} side would ventilate it.`);
    }
    const hot = wins.filter(w => afternoonHours(w.deg, lat, lng) >= 2.5);
    if (hot.length) {
      const dir = compassName(hot[0].deg);
      tips.push(`The ${dir}-facing window takes ${afternoonHours(hot[0].deg, lat, lng).toFixed(1)} h of hot afternoon sun in summer. A 0.6 m sunshade (chajja) above it${hot.some(w => !w.shaded) ? ', blinds or curtains,' : ''} or solar-control glass will keep the room cooler.`);
    }
    if (['master_bedroom', 'bedroom'].includes(r.kind) && wins.length && !wins.some(w => w.deg > 45 && w.deg < 135)) tips.push('No east window: bedrooms facing east get gentle morning light, the best wake-up light and the coolest evenings.');
    if (r.kind === 'kitchen' && sides.size < 2) tips.push('Kitchens need through-air for cooking heat and smells: an exhaust fan or a second window opposite the first.');
    if (!tips.length) tips.push('Well lit and well aired. Nothing to change.');

    return {
      room: r, score, m2, wins, wfr, depth, sides: [...sides], summerSun: sumSun, winterSun: winSun, heat,
      parts: { daylight: Math.round(sDay * 100), depth: Math.round(sDepth * 100), ventilation: Math.round(sVent * 100), heat: Math.round(sHeat * 100) },
      facing: [...new Set(wins.map(w => compassName(w.deg)))], tips,
    };
  });
  const total = results.reduce((s, r) => s + r.m2, 0) || 1;
  const house = Math.round(results.reduce((s, r) => s + r.score * r.m2, 0) / total);
  return { house, rooms: results.sort((a, b) => a.score - b.score), city, lat };
}

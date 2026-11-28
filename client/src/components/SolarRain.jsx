import { useMemo, useState } from 'react';
import { Sun, Droplets, Check, Loader2 } from 'lucide-react';
import { Panel } from './StudioTools';
import { plan, CLIMATE, typicalUse, roofAreas } from '../utils/solar';
import { lakh, rupees } from '../utils/loan';
import { formatArea } from '../utils/units';

/*
 * Solar & rainwater: how much rooftop solar the roof holds and the family needs, its cost after the PM
 * Surya Ghar subsidy, the monthly saving and payback; and the rainwater the roof collects, with the tank
 * and recharge pits to store and soak it. "Put it on the house" keeps it with the project (on the front
 * elevation settings): panels show on the 3D roof, the tank and pit on the site plan, and the building
 * rules check counts the rainwater harvesting as planned.
 */
const field = (label, value, set, { suffix, step = 1, min = 0 } = {}) => (
  <label className="block text-[11px] text-zinc-400">{label}
    <span className="mt-1 flex items-center rounded-lg border border-zinc-800 bg-zinc-900 focus-within:border-indigo-500">
      <input type="number" min={min} step={step} value={value} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
        className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white focus:outline-none" />
      {suffix && <span className="pr-2.5 text-[10px] text-zinc-500">{suffix}</span>}
    </span>
  </label>
);
const Stat = ({ label, value, sub, strong }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
    <p className="text-[10px] text-zinc-500">{label}</p>
    <p className={`text-sm font-semibold ${strong ? 'text-indigo-300' : 'text-zinc-100'}`}>{value}</p>
    {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
  </div>
);

export default function SolarRain({ elements, projectId, facade, north = 'up', onSave, onClose }) {
  const key = `solar_${projectId || 'draft'}`;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })();
  const areas = useMemo(() => roofAreas(elements), [elements]);
  const [f, setF] = useState(() => ({
    city: facade?.solar?.city || saved.city || 'Bengaluru', units: saved.units ?? typicalUse(areas.bedrooms), tariff: saved.tariff ?? 8,
    rate: saved.rate ?? 55000, kw: facade?.solar?.kw ?? null, terrace: !!saved.terrace,
  }));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const set = (k, v) => setF(x => { const n = { ...x, [k]: v }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* private */ } return n; });
  const num = (v, d) => (v === '' || v == null || Number.isNaN(Number(v)) ? d : Number(v));

  const p = useMemo(() => plan(elements, {
    city: f.city, units: num(f.units, typicalUse(areas.bedrooms)), tariff: num(f.tariff, 8), ratePerKw: num(f.rate, 55000),
    kw: f.kw == null ? null : Math.min(num(f.kw, 0), Infinity), useTerrace: f.terrace,
  }), [elements, f, areas.bedrooms]); // eslint-disable-line react-hooks/exhaustive-deps
  const tooBig = p.size > p.maxKw + 0.01;
  const planned = facade?.solar;

  const save = async (remove = false) => {
    setBusy(true); setDone('');
    try {
      await onSave(remove ? { solar: null } : {
        solar: { kw: p.size, panels: p.panels, north, city: f.city, tank_l: p.rain.tank, pit: p.rain.pits > 1 ? `${p.rain.pits} × 1.2 m` : '1.2 m', pits: p.rain.pits },
      });
      setDone(remove ? 'Taken off the house.' : `On the house: ${p.panels} panels on the 3D roof (flat roof view), the tank and pit on the site plan, and rainwater harvesting counted in Building rules.`);
    } finally { setBusy(false); }
  };

  return (
    <Panel icon={Sun} title="Solar & rainwater" onClose={onClose} wide>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block text-[11px] text-zinc-400">City
          <select value={f.city} onChange={(e) => set('city', e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
            {Object.keys(CLIMATE).map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        {field('Electricity use', f.units, v => set('units', v), { suffix: 'units/month', step: 10 })}
        {field('Tariff', f.tariff, v => set('tariff', v), { suffix: '₹/unit', step: 0.5 })}
        {field('Installed cost', f.rate, v => set('rate', v), { suffix: '₹/kWp', step: 1000 })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="label-caps flex items-center gap-1.5"><Sun className="h-3 w-3" /> Rooftop solar</p>
        {areas.terrace > 0 && (
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <input type="checkbox" checked={f.terrace} onChange={(e) => set('terrace', e.target.checked)} className="accent-indigo-500" /> Use the open terrace too
          </label>
        )}
      </div>
      <label className="mt-2 block text-[11px] text-zinc-400">
        <span className="flex justify-between"><span>System size</span><span className="text-zinc-200">{p.size} kWp · {p.panels} panels of {550} W</span></span>
        <input type="range" min={0.5} max={Math.max(1, p.maxKw, p.size)} step={0.5} value={p.size} onChange={(e) => set('kw', Number(e.target.value))} className="mt-1 w-full accent-indigo-500" />
        <span className="text-[10px] text-zinc-500">
          The roof ({formatArea(p.areas.roof)}{f.terrace ? ` + ${formatArea(p.areas.terrace)} terrace` : ''}) holds up to {p.maxKw} kWp; your use needs about {p.needKw} kWp.
          {f.kw != null && f.kw !== p.recommended && <button onClick={() => set('kw', null)} className="ml-1 text-indigo-300 hover:text-indigo-200">Back to {p.recommended} kWp</button>}
        </span>
      </label>
      {tooBig && <p className="mt-1 text-[11px] text-amber-300/90">That's more than fits on the roof.</p>}
      {p.maxKw < 1 && <p className="mt-1 text-[11px] text-amber-300/90">The roof is too small or not flat enough for a useful system.</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Makes" value={`${Math.round(p.genMonth)} units/month`} sub={`${Math.round(p.genYear).toLocaleString('en-IN')} a year in ${f.city}`} />
        <Stat label="Saves" value={`${rupees(p.saveMonth)}/month`} sub={`${Math.min(100, Math.round((p.genMonth / Math.max(1, p.use)) * 100))} % of your bill`} strong />
        <Stat label="Cost after subsidy" value={lakh(p.net)} sub={`${lakh(p.cost)} less ${rupees(p.subsidy)} PM Surya Ghar`} />
        <Stat label="Pays for itself in" value={p.payback ? `${p.payback.toFixed(1)} years` : '—'} sub="panels last 25 years" />
      </div>

      <p className="mt-5 label-caps flex items-center gap-1.5"><Droplets className="h-3 w-3" /> Rainwater</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Roof catching rain" value={formatArea(p.rain.catchment)} sub={`${p.rainMm} mm a year in ${f.city}`} />
        <Stat label="Collects" value={`${Math.round(p.rain.harvest / 1000).toLocaleString('en-IN')} kL a year`} sub={`about ${Math.round(p.rain.harvest / 365).toLocaleString('en-IN')} litres a day, averaged`} strong />
        <Stat label="Storage tank" value={`${p.rain.tank.toLocaleString('en-IN')} L`} sub="20 litres per m² of roof" />
        <Stat label="Recharge" value={`${p.rain.pits} pit${p.rain.pits > 1 ? 's' : ''}`} sub={`1.2 m wide, 1.5 m deep · ${lakh(p.rain.cost)} with tank`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => save(false)} disabled={busy || p.size <= 0} className="btn-primary px-4 py-1.5 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {planned ? 'Update the house' : 'Put it on the house'}
        </button>
        {planned && <button onClick={() => save(true)} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">Remove</button>}
        {planned && !done && <span className="flex items-center gap-1 text-[11px] text-zinc-400"><Check className="h-3 w-3 text-emerald-400" /> Planned: {planned.kw} kWp, {Number(planned.tank_l).toLocaleString('en-IN')} L tank</span>}
      </div>
      {done && <p className="mt-2 text-[11px] text-emerald-300">{done}</p>}
      <p className="mt-3 text-[10px] leading-snug text-zinc-600">
        Typical yields, rainfall and prices; get a site survey and quote before buying. Subsidy as per PM Surya Ghar for homes
        (Rs 30,000/kW up to 2 kW, Rs 18,000 for the 3rd kW, at most Rs 78,000), paid after installation by an empanelled vendor with net metering.
      </p>
    </Panel>
  );
}

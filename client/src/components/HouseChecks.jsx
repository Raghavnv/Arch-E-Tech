import { useEffect, useMemo, useState } from 'react';
import { Layers, Accessibility, Activity, Loader2, Check, AlertTriangle, Info, X as XIcon } from 'lucide-react';
import { Panel } from './StudioTools';
import { accessibility, quakeWind, SEISMIC } from '../utils/houseChecks';
import { lakh } from '../utils/loan';

/*
 * Three checks on the house: ready for a future floor (the server prices it), accessibility, and
 * earthquake and wind (worked out here from the plan).
 */
const ICON = { pass: [Check, 'text-emerald-300'], warn: [AlertTriangle, 'text-amber-300'], fail: [XIcon, 'text-rose-300'], info: [Info, 'text-sky-300'] };

function Items({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => {
        const [I, c] = ICON[it.status] || ICON.info;
        return (
          <li key={i} className="flex gap-2.5 rounded-lg border border-zinc-800 px-3 py-2">
            <I className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-100">{it.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{it.detail}</p>
              {it.fix && <p className="mt-1 text-[11px] text-indigo-300">{it.fix}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const Summary = ({ items }) => {
  const n = (s) => items.filter(i => i.status === s).length;
  return (
    <p className="mb-3 text-xs text-zinc-400">
      <span className="text-emerald-300">{n('pass')} fine</span> · <span className="text-amber-300">{n('warn')} to look at</span>{n('fail') ? <> · <span className="text-rose-300">{n('fail')} to fix</span></> : null}
    </p>
  );
};

export function AccessPanel({ elements, site, onClose }) {
  const items = useMemo(() => accessibility(elements, site), [elements, site]);
  return (
    <Panel icon={Accessibility} title="Accessibility" onClose={onClose}>
      <p className="mb-2 text-[11px] leading-snug text-zinc-500">For elderly parents, a wheelchair or a pram, after India's Harmonised Guidelines for Universal Accessibility (2021) and NBC 2016.</p>
      <Summary items={items} />
      <Items items={items} />
    </Panel>
  );
}

export function QuakePanel({ elements, site, apiUrl, onClose }) {
  const [city, setCity] = useState(site?.city || 'Bengaluru');
  const [columns, setColumns] = useState(null);
  useEffect(() => {
    fetch(`${apiUrl}/api/ai/quantities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements }) })
      .then(r => (r.ok ? r.json() : null)).then(d => setColumns(d?.summary?.columns || null)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => quakeWind(elements, { city, columns }), [elements, city, columns]);
  return (
    <Panel icon={Activity} title="Earthquake & wind" onClose={onClose}>
      <label className="mb-2 block text-[11px] text-zinc-400">City
        <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
          {Object.keys(SEISMIC).map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <Summary items={items} />
      <Items items={items} />
      <p className="mt-3 text-[10px] leading-snug text-zinc-600">Screening only, from the plan's shape. The structure must be designed by a structural engineer to IS 1893, IS 13920 and IS 875.</p>
    </Panel>
  );
}

export function FutureFloorPanel({ elements, site, apiUrl, onClose }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${apiUrl}/api/ai/future-floor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements, site, city: site?.city || null }) })
      .then(async res => { const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.detail || `The server answered ${res.status}.`); setR(d); })
      .catch(e => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel icon={Layers} title="Ready for a future floor" onClose={onClose}>
      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {!r && !error && <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Pricing the house with one more floor…</p>}
      {r && (
        <>
          <p className="text-[11px] leading-snug text-zinc-500">Build {r.floors_now} floor{r.floors_now > 1 ? 's' : ''} now, ready for floor {r.floors_later} later.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['Ready now', lakh(r.upgrade_now), 'stronger footings and columns', true], ['The floor later', lakh(r.new_floor_cost), 'at today\'s rates'], ['If not ready', lakh(r.retrofit_later), 'strengthening, roughly']].map(([l, v, s, strong]) => (
              <div key={l} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                <p className="text-[10px] text-zinc-500">{l}</p>
                <p className={`text-sm font-semibold ${strong ? 'text-indigo-300' : 'text-zinc-100'}`}>{v}</p>
                <p className="text-[10px] text-zinc-500">{s}</p>
              </div>
            ))}
          </div>
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${r.allowed ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-100'}`}>
            {r.allowed ? 'Allowed: ' : 'Check first: '}{r.why.join(' ')}
          </p>
          <p className="label-caps mt-4 mb-1.5">What to do now</p>
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-zinc-300">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="mt-3 text-[10px] leading-snug text-zinc-600">Making a house ready costs a few per cent now; strengthening an occupied house later typically costs about three times as much, and weeks of disruption. A structural engineer sizes the members.</p>
        </>
      )}
    </Panel>
  );
}

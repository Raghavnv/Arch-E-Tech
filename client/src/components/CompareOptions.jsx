import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Plus, Sparkles, Trash2, Check, Columns3, ThumbsUp, Pencil } from 'lucide-react';
import { PlanDrawing } from './Overview';
import { computeCosts } from '../utils/costs';
import { assessComfort } from '../utils/comfort';
import { formatArea, currencyRate, CURRENCY } from '../utils/units';
import { lakh, rupees, emiForCost, loanSettings } from '../utils/loan';

/*
 * Compare options: two or more versions of the house side by side (the plan on screen and the options
 * saved with the project), with what each costs, its EMI, build time, daylight and Vastu scores, how
 * its rooms differ, and the client's votes from the share link. Any option can become the plan.
 */
const U = 20;
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
const KIND_WORD = {
  master_bedroom: 'master bedroom', bedroom: 'bedroom', bathroom: 'bathroom', study: 'study', utility: 'utility', closet: 'closet',
  living: 'living room', dining: 'dining room', kitchen: 'kitchen', lounge: 'lounge', pooja: 'pooja room', store: 'store',
  patio: 'patio', balcony: 'balcony', terrace: 'terrace', deck: 'deck', powder: 'powder room', guest: 'guest room',
};
const SKIP_KINDS = new Set(['hallway', 'corridor', 'stairs', 'foyer']);

const clean = (els) => (els || []).filter(e => e && typeof e.type === 'string');
const roomsOf = (els) => els.filter(e => e.type === 'room');
const m2 = (r) => (r.width / U) * (r.height / U);

/** A fingerprint of the plan's shape, so the plan on screen can be recognised among the saved options. */
export function planPrint(els) {
  return clean(els).filter(e => ['room', 'wall', 'door', 'window', 'stairs', 'railing'].includes(e.type))
    .map(e => [e.type, e.kind || '', Math.round(e.left), Math.round(e.top), Math.round(e.width || 0), Math.round(e.height || 0), Math.round(e.angle || 0), e.floor || 1].join(':'))
    .sort().join('|');
}

/** The numbers each option is compared on (the ones that need the server come later). */
function statsOf(els, projectId) {
  const rooms = roomsOf(els);
  const inside = rooms.filter(r => !OUTDOOR.has(r.kind));
  const counts = {};
  rooms.forEach(r => { if (!SKIP_KINDS.has(r.kind)) counts[r.kind] = (counts[r.kind] || 0) + 1; });
  const costInr = (computeCosts(els).total / currencyRate()) * CURRENCY.INR.rate;
  let comfort = null;
  try { comfort = assessComfort(els).house; } catch { /* a plan with no lived-in rooms */ }
  return {
    builtUp: inside.reduce((s, r) => s + m2(r), 0),
    outdoor: rooms.filter(r => OUTDOOR.has(r.kind)).reduce((s, r) => s + m2(r), 0),
    floors: new Set(els.map(e => e.floor || 1)).size,
    bedrooms: (counts.master_bedroom || 0) + (counts.bedroom || 0),
    bathrooms: (counts.bathroom || 0) + (counts.powder || 0),
    counts, costInr, emi: emiForCost(costInr, loanSettings(projectId)), comfort: Number.isFinite(comfort) ? comfort : null,
  };
}

/** "+1 bedroom, + patio, − study": how an option's rooms differ from the first column. */
function differences(counts, base) {
  const out = [];
  new Set([...Object.keys(counts), ...Object.keys(base)]).forEach(k => {
    const d = (counts[k] || 0) - (base[k] || 0);
    if (!d) return;
    const word = KIND_WORD[k] || k.replace(/_/g, ' ');
    out.push(`${d > 0 ? '+' : '−'}${Math.abs(d) > 1 ? ` ${Math.abs(d)}` : ''} ${word}${Math.abs(d) > 1 ? 's' : ''}`);
  });
  return out;
}

/** A prompt that asks the generator for another house with the same brief as this one. */
function briefOf(els, site) {
  const s = statsOf(els);
  const parts = [`${Math.max(1, s.bedrooms)} bedroom house with ${Math.max(1, s.bathrooms)} bathrooms`];
  if (s.floors > 1) parts.push(`on ${s.floors} floors`); else parts.push('single floor');
  ['study', 'pooja', 'utility', 'lounge'].forEach(k => { if (s.counts[k]) parts.push(`a ${KIND_WORD[k]}`); });
  const out = ['patio', 'balcony', 'terrace'].filter(k => s.counts[k]);
  if (out.length) parts.push(`with a ${out.join(' and a ')}`);
  if (s.counts.kitchen && s.counts.dining === undefined) parts.push('open kitchen');
  const body = { prompt: parts.join(', '), outdoor: Object.fromEntries(out.map(k => [k, true])) };
  if (site?.plot_m?.length === 2) Object.assign(body, { plot_width_m: site.plot_m[0], plot_depth_m: site.plot_m[1] });
  if (site?.facing) body.facing = site.facing;
  if (site?.vastu) body.vastu = true;
  return body;
}

// rows of the comparison; `better` marks the best column ('low' or 'high'), when there is a best
const ROWS = [
  ['builtUp', 'Built-up area', (s) => formatArea(s.builtUp)],
  ['rooms', 'Bedrooms · baths', (s) => `${s.bedrooms} bed · ${s.bathrooms} bath`],
  ['outdoor', 'Outdoor space', (s) => (s.outdoor ? formatArea(s.outdoor) : 'None')],
  ['floors', 'Floors', (s) => String(s.floors)],
  ['costInr', 'Estimated cost', (s) => lakh(s.costInr), 'low'],
  ['emi', 'Monthly EMI', (s) => rupees(s.emi), 'low'],
  ['days', 'Build time', (s) => (s.days ? `${Math.round(s.days / 30 * 10) / 10} months` : '…'), 'low'],
  ['comfort', 'Daylight & comfort', (s) => (s.comfort == null ? '—' : `${s.comfort} / 100`), 'high'],
  ['vastu', 'Vastu score', (s) => (s.vastu == null ? '…' : `${s.vastu} / 100`), 'high'],
  ['votes', 'Client votes', (s) => String(s.votes ?? 0), 'high'],
];

export default function CompareOptions({ projectId, apiUrl, elements, site, onUse, onClose }) {
  const [data, setData] = useState(null);           // { items, votes }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [floor, setFloor] = useState(1);
  const [extra, setExtra] = useState({});           // id -> { vastu, days } from the server
  const [renaming, setRenaming] = useState(null);

  const call = async (path, opts = {}) => {
    const res = await fetch(`${apiUrl}${path}`, { ...opts, headers: authHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `The server answered ${res.status}.`);
    return body;
  };
  const load = () => call(`/api/projects/${projectId}/options`).then(setData).catch(e => setError(e.message));
  useEffect(() => { if (projectId) load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => clean(elements), [elements]);
  const currentPrint = useMemo(() => planPrint(current), [current]);

  // the columns: the plan on screen first (unless it is one of the saved options), then every option
  const columns = useMemo(() => {
    const items = data?.items || [];
    const cols = items.map(o => ({ id: o.id, name: o.name, elements: clean(o.elements), votes: o.votes, saved: true, isCurrent: planPrint(o.elements) === currentPrint }));
    if (!cols.some(c => c.isCurrent)) cols.unshift({ id: 'current', name: 'Plan on screen', elements: current, votes: 0, saved: false, isCurrent: true });
    return cols.map(c => ({ ...c, stats: statsOf(c.elements, projectId) }));
  }, [data, current, currentPrint, projectId]);

  // Vastu and build time come from the server, once per plan
  useEffect(() => {
    let off = false;
    columns.forEach(c => {
      const key = `${c.id}:${c.elements.length}`;
      if (extra[key]) return;
      setExtra(x => ({ ...x, [key]: {} }));
      const post = (path, body) => fetch(`${apiUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => (r.ok ? r.json() : null)).catch(() => null);
      Promise.all([post('/api/ai/vastu-check', { elements: c.elements, north: site?.north || 'up' }), post('/api/ai/quantities', { elements: c.elements })])
        .then(([v, q]) => { if (!off) setExtra(x => ({ ...x, [key]: { vastu: v?.score ?? null, days: q?.total_days ?? null } })); });
    });
    return () => { off = true; };
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = columns.map(c => ({ ...c, stats: { ...c.stats, ...(extra[`${c.id}:${c.elements.length}`] || {}), votes: c.votes } }));
  const best = Object.fromEntries(ROWS.filter(r => r[3]).map(([key, , , better]) => {
    const vals = full.map(c => c.stats[key]).filter(v => v != null && Number.isFinite(v));
    if (vals.length < 2 || new Set(vals.map(v => Math.round(v))).size < 2) return [key, null];
    return [key, better === 'low' ? Math.min(...vals) : Math.max(...vals)];
  }));
  const floors = [...new Set(full.flatMap(c => c.elements.map(e => e.floor || 1)))].sort((a, b) => a - b);
  const leader = full.filter(c => c.votes > 0).sort((a, b) => b.votes - a.votes)[0];
  const nextName = () => `Option ${String.fromCharCode(65 + (data?.items?.length || 0))}`;

  const run = async (kind, fn) => {
    setBusy(kind); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const saveCurrent = () => run('save', async () => {
    await call(`/api/projects/${projectId}/options`, { method: 'POST', body: JSON.stringify({ name: nextName(), elements: current }) });
    await load();
  });
  const generate = () => run('generate', async () => {
    const res = await fetch(`${apiUrl}/api/ai/generate-plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(briefOf(current, site)) });
    const plan = await res.json().catch(() => ({}));
    if (!res.ok || !plan.elements?.length) throw new Error(plan.detail || "Couldn't draw another layout. Try again.");
    // keep the plan on screen too, so the new one has something to be compared with
    if (!columns.some(c => c.saved && c.isCurrent)) {
      await call(`/api/projects/${projectId}/options`, { method: 'POST', body: JSON.stringify({ name: nextName(), elements: current }) });
      const d = await call(`/api/projects/${projectId}/options`);
      await call(`/api/projects/${projectId}/options`, { method: 'POST', body: JSON.stringify({ name: `Option ${String.fromCharCode(65 + d.items.length)}`, elements: plan.elements }) });
    } else {
      await call(`/api/projects/${projectId}/options`, { method: 'POST', body: JSON.stringify({ name: nextName(), elements: plan.elements }) });
    }
    await load();
  });
  const remove = (c) => run(`del${c.id}`, async () => {
    if (!window.confirm(`Delete ${c.name}? Its votes go with it.`)) return;
    await call(`/api/projects/${projectId}/options/${c.id}`, { method: 'DELETE' });
    await load();
  });
  const rename = (c, name) => run(`ren${c.id}`, async () => {
    setRenaming(null);
    if (!name.trim() || name.trim() === c.name) return;
    await call(`/api/projects/${projectId}/options/${c.id}`, { method: 'PUT', body: JSON.stringify({ name: name.trim().slice(0, 60) }) });
    await load();
  });
  const use = (c) => run(`use${c.id}`, async () => {
    // nothing is lost: the plan on screen is kept as an option first, or its option gets the latest finishes
    const mine = columns.find(x => x.saved && x.isCurrent);
    if (!mine) {
      await call(`/api/projects/${projectId}/options`, { method: 'POST', body: JSON.stringify({ name: 'Previous plan', elements: current }) });
    } else if (JSON.stringify(data.items.find(o => o.id === mine.id)?.elements) !== JSON.stringify(current)) {
      await call(`/api/projects/${projectId}/options/${mine.id}`, { method: 'PUT', body: JSON.stringify({ elements: current }) });
    }
    onUse(c.elements);
    await load();
  });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950/97 backdrop-blur-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Columns3 className="h-4 w-4 text-zinc-400" /> Compare options</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Versions of this house side by side. Clients vote for one on the share link{leader ? <>, and <span className="text-indigo-300">{leader.name}</span> leads with {leader.votes} vote{leader.votes > 1 ? 's' : ''}</> : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {floors.length > 1 && floors.map(f => (
            <button key={f} onClick={() => setFloor(f)} className={floor === f ? 'chip-on' : 'chip'}>{f === 1 ? 'Ground' : `Floor ${f}`}</button>
          ))}
          <button onClick={saveCurrent} disabled={!projectId || !!busy || columns.some(c => c.saved && c.isCurrent)} className="btn-secondary px-3 py-1.5 text-xs"
            title="Keep the plan on screen as an option, then change it and compare">
            {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save plan as option
          </button>
          <button onClick={generate} disabled={!projectId || !!busy} className="btn-primary px-3 py-1.5 text-xs"
            title="Draw a different layout with the same rooms, plot and outdoor spaces">
            {busy === 'generate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate another option
          </button>
          <button onClick={onClose} className="ml-1 rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      </header>
      {error && <p className="mx-6 mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {!projectId && <p className="p-6 text-sm text-zinc-400">Save the project first to keep options.</p>}
      {projectId && !data && !error && <div className="flex flex-1 items-center justify-center text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}

      {projectId && data && (
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {full.length < 2 && (
            <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
              Only one version so far. <span className="text-zinc-200">Generate another option</span> to draw a different layout with the same brief,
              or <span className="text-zinc-200">save this plan as an option</span>, change it, and compare the two.
            </p>
          )}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${full.length}, minmax(280px, 1fr))` }}>
            {full.map(c => {
              const diff = c === full[0] ? [] : differences(c.stats.counts, full[0].stats.counts);
              const onFloor = c.elements.filter(e => (e.floor || 1) === floor);
              return (
                <section key={c.id} className={`flex flex-col rounded-2xl border bg-zinc-900/40 ${leader?.id === c.id ? 'border-indigo-400/50' : 'border-zinc-800'}`}>
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
                    {renaming === c.id ? (
                      <input autoFocus defaultValue={c.name} maxLength={60} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') rename(c, e.currentTarget.value); if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={(e) => rename(c, e.target.value)} className="min-w-0 flex-1 rounded bg-zinc-950 px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    ) : (
                      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
                        <span className="truncate">{c.name}</span>
                        {c.saved && <button onClick={() => setRenaming(c.id)} className="text-zinc-600 hover:text-zinc-300" aria-label="Rename"><Pencil className="h-3 w-3" /></button>}
                      </h3>
                    )}
                    <span className="flex shrink-0 items-center gap-1.5">
                      {c.isCurrent && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">On screen</span>}
                      {c.votes > 0 && <span className="flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200"><ThumbsUp className="h-3 w-3" /> {c.votes}</span>}
                    </span>
                  </div>
                  <div className="aspect-[4/3] p-3">
                    {onFloor.some(e => e.type === 'room')
                      ? <PlanDrawing elements={onFloor} animate={false} />
                      : <p className="flex h-full items-center justify-center text-xs text-zinc-600">No rooms on this floor</p>}
                  </div>
                  <dl className="border-t border-zinc-800 px-4 py-2 text-xs">
                    {ROWS.map(([key, label, show, better]) => {
                      const v = c.stats[key];
                      const top = better && best[key] != null && v != null && Math.round(v) === Math.round(best[key]);
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 border-b border-zinc-800/60 py-1.5 last:border-0">
                          <dt className="text-zinc-500">{label}</dt>
                          <dd className={`flex items-center gap-1 font-medium ${top ? 'text-indigo-300' : 'text-zinc-200'}`}>
                            {top && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" title="Best of the options" />}
                            {show(c.stats)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {c !== full[0] && (
                    <p className="px-4 pb-2 text-[11px] leading-snug text-zinc-400">
                      <span className="label-caps mr-1">vs {full[0].name}</span> {diff.length ? diff.join(', ') : 'same rooms, laid out differently'}
                    </p>
                  )}
                  {data.votes.filter(v => v.option_id === c.id && v.note).slice(0, 3).map((v, i) => (
                    <p key={i} className="mx-4 mb-2 rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-300"><span className="text-zinc-500">{v.author}:</span> {v.note}</p>
                  ))}
                  <div className="mt-auto flex items-center gap-2 border-t border-zinc-800 px-4 py-3">
                    {c.isCurrent
                      ? <span className="flex flex-1 items-center gap-1.5 text-xs text-zinc-500"><Check className="h-3.5 w-3.5" /> The plan you are editing</span>
                      : (
                        <button onClick={() => use(c)} disabled={!!busy} className="btn-primary flex-1 py-1.5 text-xs">
                          {busy === `use${c.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Use this option
                        </button>
                      )}
                    {c.saved && (
                      <button onClick={() => remove(c)} disabled={!!busy} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-300" aria-label={`Delete ${c.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-zinc-600">
            EMI uses your settings from the Home loan planner. Using an option keeps the plan on screen as an option first, so nothing is lost; Undo also works.
          </p>
        </div>
      )}
    </div>
  );
}

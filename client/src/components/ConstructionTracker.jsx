import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, CircleDot, Circle, Loader2, Trash2, X } from 'lucide-react';
import { CURRENCY, formatMoney } from '../utils/units';

/*
 * Construction tracker: the build schedule from the materials estimate turned into a live project.
 * Set the start date, then mark each phase not started / under way / done, log what was actually
 * spent, keep notes and site photos. The page shows how far along the build is, spend against the
 * estimate, and when it will finish at the current pace. Saved with the project (projects.progress);
 * clients see it through the project's share link.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DAY = 86400000;
const inr = (v) => formatMoney((Number(v) || 0) / CURRENCY.INR.rate);
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const nice = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Shrink a photo to at most 1280 px and JPEG it, so a phase can hold a dozen without bloating the project. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => reject(new Error("That file isn't an image this browser can read."));
    img.src = URL.createObjectURL(file);
  });
}

const STATUS = {
  todo: { label: 'Not started', icon: Circle, cls: 'text-zinc-400 border-zinc-700' },
  doing: { label: 'Under way', icon: CircleDot, cls: 'text-amber-300 border-amber-500/50 bg-amber-500/10' },
  done: { label: 'Done', icon: Check, cls: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10' },
};

export default function ConstructionTracker() {
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [plan, setPlan] = useState(null);           // the estimate: phases, costs, days
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [save, setSave] = useState('saved');
  const [open, setOpen] = useState(null);
  const [viewer, setViewer] = useState(null);
  const timer = useRef(null);
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!projectId) return;
    const h = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/projects/${projectId}`, { headers: h });
        if (r.status === 401) { navigate('/auth'); return; }
        if (!r.ok) throw new Error("This project couldn't be loaded.");
        const p = await r.json();
        setProject(p);
        const q = await fetch(`${API_URL}/api/ai/quantities`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ elements: p.elements_data || [] }) });
        const est = await q.json();
        if (!q.ok) throw new Error(est.detail || 'The schedule could not be worked out from this plan.');
        setPlan(est);
        setProgress({ startDate: iso(Date.now()), phases: {}, ...(p.progress || {}),
          // phase names and order go with the progress, so a client's share link can show them
          names: est.phases.map(ph => [ph.key, ph.name]) });
      } catch (e) { setError(e.message); }
    })();
  }, [projectId, navigate]);

  const update = (fn) => {
    setProgress(prev => {
      const next = fn(prev);
      setSave('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSave('saving');
        try {
          const r = await fetch(`${API_URL}/api/projects/${projectId}/progress`, { method: 'PUT', headers, body: JSON.stringify({ progress: next }) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(b.detail || `The server answered ${r.status}.`);
          setSave('saved');
        } catch (e) { setSave('error'); setError(`Couldn't save: ${e.message}`); }
      }, 700);
      return next;
    });
  };
  const setPhase = (key, patch) => update(p => ({ ...p, phases: { ...p.phases, [key]: { ...(p.phases[key] || {}), ...patch } } }));
  const addPhotos = async (key, files) => {
    try {
      const shots = await Promise.all([...files].slice(0, 8).map(async f => ({ id: Math.random().toString(36).slice(2, 9), data: await shrink(f), date: iso(Date.now()), caption: '' })));
      update(p => ({ ...p, phases: { ...p.phases, [key]: { ...(p.phases[key] || {}), photos: [...(p.phases[key]?.photos || []), ...shots] } } }));
    } catch (e) { setError(e.message); }
  };

  const stats = useMemo(() => {
    if (!plan || !progress) return null;
    const ph = plan.phases;
    const totalDays = ph.reduce((s, p) => s + p.days, 0);
    const doneDays = ph.reduce((s, p) => s + (progress.phases[p.key]?.status === 'done' ? p.days : progress.phases[p.key]?.status === 'doing' ? p.days * 0.5 : 0), 0);
    const pct = Math.round((doneDays / totalDays) * 100);
    const spent = ph.reduce((s, p) => s + (Number(progress.phases[p.key]?.spent) || 0), 0);
    const budgetSoFar = ph.reduce((s, p) => s + (progress.phases[p.key]?.status === 'done' ? p.cost : progress.phases[p.key]?.status === 'doing' ? p.cost * 0.5 : 0), 0);
    const start = new Date(progress.startDate).getTime();
    const plannedEnd = start + plan.total_days * DAY;
    const elapsed = Math.max(0, (Date.now() - start) / DAY);
    const plannedPct = Math.min(100, Math.round((elapsed / plan.total_days) * 100));
    // at the pace so far, when will it finish?
    const projectedEnd = pct > 3 && elapsed > 3 ? start + (elapsed / (pct / 100)) * DAY : plannedEnd;
    return { pct, spent, budgetSoFar, plannedEnd, projectedEnd, plannedPct, elapsed, start };
  }, [plan, progress]);

  if (!projectId) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-300">Open the tracker from a project.</div>;
  if (error && !plan) return <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300"><p>{error}</p><Link to="/dashboard" className="text-sm underline">Your projects</Link></div>;
  if (!plan || !progress || !stats) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const late = stats.projectedEnd - stats.plannedEnd > 7 * DAY;
  const over = stats.spent > stats.budgetSoFar * 1.08 && stats.spent > 0;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-5 py-3 backdrop-blur">
        <Link to={`/studio?projectId=${projectId}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <p className="label-caps">CONSTRUCTION TRACKER</p>
          <p className="text-sm font-semibold">{project.name}</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400">Work started
          <input type="date" value={progress.startDate} onChange={(e) => update(p => ({ ...p, startDate: e.target.value }))}
            className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white focus:outline-none" />
        </label>
        <span className={`text-[11px] ${save === 'error' ? 'text-rose-300' : 'text-zinc-500'}`}>{{ saved: 'Saved', dirty: 'Unsaved', saving: 'Saving…', error: 'Not saved' }[save]}</span>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-5">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
        <section className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-[11px] text-zinc-500">Built so far</p>
            <p className="mt-1 text-2xl font-semibold">{stats.pct}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${stats.pct}%` }} /></div>
            <p className="mt-1.5 text-[10px] text-zinc-500">The plan says {stats.plannedPct}% by today</p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-[11px] text-zinc-500">Spent</p>
            <p className={`mt-1 text-2xl font-semibold ${over ? 'text-rose-300' : ''}`}>{inr(stats.spent)}</p>
            <p className="mt-1.5 text-[10px] text-zinc-500">Estimate for the work done: {inr(stats.budgetSoFar)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-[11px] text-zinc-500">Whole build estimate</p>
            <p className="mt-1 text-2xl font-semibold">{inr(plan.total_cost)}</p>
            <p className="mt-1.5 text-[10px] text-zinc-500">{Math.round(plan.total_days / 7)} weeks of work</p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-[11px] text-zinc-500">Finish</p>
            <p className={`mt-1 text-lg font-semibold ${late ? 'text-amber-300' : ''}`}>{nice(stats.projectedEnd)}</p>
            <p className="mt-1.5 text-[10px] text-zinc-500">{late ? `${Math.round((stats.projectedEnd - stats.plannedEnd) / DAY / 7)} weeks behind the plan (${nice(stats.plannedEnd)})` : `On plan: ${nice(stats.plannedEnd)}`}</p>
          </div>
        </section>

        {/* the timeline: planned bars, coloured by status, with today */}
        <section className="rounded-xl border border-zinc-800 p-4">
          <p className="mb-3 label-caps">TIMELINE</p>
          <div className="relative space-y-1">
            {stats.elapsed > 0 && stats.elapsed < plan.total_days && (
              <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-400" style={{ left: `calc(35% + ${(stats.elapsed / plan.total_days) * 65}%)` }}>
                <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-rose-300">today</span>
              </div>
            )}
            {plan.phases.map(p => {
              const st = progress.phases[p.key]?.status || 'todo';
              return (
                <div key={p.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-[35%] shrink-0 truncate text-zinc-300">{p.name}</span>
                  <span className="relative h-3.5 flex-1 rounded bg-zinc-900">
                    <span className={`absolute inset-y-0.5 rounded-sm ${st === 'done' ? 'bg-emerald-500/80' : st === 'doing' ? 'bg-amber-500/80' : 'bg-zinc-600/70'}`}
                      style={{ left: `${(p.start_day / plan.total_days) * 100}%`, width: `${Math.max(1, (p.days / plan.total_days) * 100)}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* the phases */}
        <section className="space-y-2">
          {plan.phases.map(p => {
            const s = progress.phases[p.key] || {};
            const st = s.status || 'todo';
            const isOpen = open === p.key;
            const from = new Date(stats.start + p.start_day * DAY), to = new Date(stats.start + (p.start_day + p.days) * DAY);
            return (
              <div key={p.key} className="rounded-xl border border-zinc-800">
                <button onClick={() => setOpen(isOpen ? null : p.key)} className="flex w-full flex-wrap items-center gap-3 p-3 text-left">
                  {(() => { const I = STATUS[st].icon; return <I className={`h-4 w-4 ${STATUS[st].cls.split(' ')[0]}`} />; })()}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-100">{p.name}</span>
                    <span className="text-[11px] text-zinc-500">{nice(from)} – {nice(to)} · {p.days} days · estimate {inr(p.cost)}</span>
                  </span>
                  {s.spent ? <span className={`text-xs ${Number(s.spent) > p.cost * 1.1 ? 'text-rose-300' : 'text-zinc-300'}`}>{inr(s.spent)} spent</span> : null}
                  {s.photos?.length ? <span className="flex items-center gap-1 text-[11px] text-zinc-400"><Camera className="h-3.5 w-3.5" /> {s.photos.length}</span> : null}
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-zinc-800 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(STATUS).map(([k, v]) => (
                        <button key={k} onClick={() => setPhase(p.key, { status: k, ...(k === 'done' ? { done_on: iso(Date.now()) } : {}) })}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${st === k ? v.cls : 'border-zinc-800 text-zinc-400'}`}>
                          <v.icon className="h-3.5 w-3.5" /> {v.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] text-zinc-400">Spent on this phase (₹)
                        <input type="number" min="0" value={s.spent ?? ''} onChange={(e) => setPhase(p.key, { spent: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="mt-1 w-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </label>
                      <label className="text-[11px] text-zinc-400">Notes
                        <textarea rows={2} value={s.notes || ''} onChange={(e) => setPhase(p.key, { notes: e.target.value })} placeholder="Contractor, delays, what was used…"
                          className="mt-1 w-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </label>
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {(s.photos || []).map(ph => (
                          <div key={ph.id} className="group relative">
                            <button onClick={() => setViewer(ph)}><img src={ph.data} alt="" className="h-20 w-28 rounded-lg object-cover" /></button>
                            <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[9px] text-white">{nice(ph.date)}</span>
                            <button onClick={() => setPhase(p.key, { photos: s.photos.filter(x => x.id !== ph.id) })} title="Remove"
                              className="absolute right-1 top-1 hidden rounded bg-black/70 p-0.5 text-white group-hover:block"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 text-[11px] text-zinc-400 hover:border-zinc-500">
                          <Camera className="h-4 w-4" /> Add site photos
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(p.key, e.target.files); e.target.value = ''; }} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <p className="text-[11px] text-zinc-600">Anyone you have shared the project with sees this progress and the photos through their link.</p>
      </main>

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={() => setViewer(null)}>
          <img src={viewer.data} alt="" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute right-5 top-5 rounded-full bg-black/60 p-2 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}

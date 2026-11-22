import { useEffect, useMemo, useState } from 'react';
import { ChevronsLeft, PanelRightClose, Search, Sparkles, X } from 'lucide-react';
import InfoTip from './InfoTip';

/*
 * The Studio's feature dock: the bigger tools (views, AI features, reports) on the right edge.
 *   Open:      a "Start here" grid of the headline features as coloured tiles, a search box, then every
 *              feature by group, each group in its own colour.
 *   Collapsed: an icon rail that keeps the headline features one click away, never just a thin tab.
 * The first time someone opens the Studio, a callout points at the dock so they know it is there.
 */
const FEATURED = ['style', 'walk', 'render', 'designer', 'video', 'ar', 'immersive', 'materials'];
const TONE = {
  VIEW: { dot: 'bg-sky-400', text: 'text-sky-300', tile: 'from-sky-500/25 to-sky-500/5 border-sky-400/30', icon: 'bg-sky-500/20 text-sky-200 border-sky-400/30' },
  AI: { dot: 'bg-violet-400', text: 'text-violet-300', tile: 'from-violet-500/25 to-violet-500/5 border-violet-400/30', icon: 'bg-violet-500/20 text-violet-200 border-violet-400/30' },
  REPORTS: { dot: 'bg-amber-400', text: 'text-amber-300', tile: 'from-amber-500/25 to-amber-500/5 border-amber-400/30', icon: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
};
const toneOf = (g) => TONE[g] || TONE.VIEW;
const SEEN = 'studio_dock_intro_seen';

function Row({ item, run }) {
  return (
    <li className="relative">
      <button onClick={() => run(item)} disabled={item.disabled}
        className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 pr-8 text-left transition-colors disabled:opacity-40 ${item.active ? 'bg-white/10' : 'hover:bg-zinc-900'}`}>
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${toneOf(item.group).icon}`}>
          <item.icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-zinc-100">{item.label}</span>
          <span className="block text-[11px] leading-snug text-zinc-500">{item.desc}</span>
        </span>
      </button>
      {item.info && <InfoTip id={item.info} align="right" className="absolute right-2 top-2.5" />}
    </li>
    );
}

export default function FeatureDock({ open, setOpen, groups }) {
  const [query, setQuery] = useState('');
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem(SEEN); } catch { return false; } });
  const dismiss = () => { setIntro(false); try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ } };
  useEffect(() => {
    if (!intro) return undefined;
    const t = setTimeout(dismiss, 14000);
    return () => clearTimeout(t);
  }, [intro]);

  const all = useMemo(() => groups.flatMap(g => g.items.map(it => ({ ...it, group: g.title }))), [groups]);
  const featured = FEATURED.map(id => all.find(it => it.id === id)).filter(Boolean);
  const q = query.trim().toLowerCase();
  const hits = q ? all.filter(it => `${it.label} ${it.desc || ''}`.toLowerCase().includes(q)) : null;
  const run = (item) => { if (!item.disabled) { dismiss(); item.onClick(); } };

  const callout = intro && (
    <div className="absolute right-[calc(100%+0.75rem)] top-6 z-40 w-64 rounded-xl border border-orange-400/40 bg-zinc-950/95 p-3 text-xs text-zinc-200 shadow-2xl backdrop-blur-xl">
      <span className="absolute -right-1.5 top-5 h-3 w-3 rotate-45 border-r border-t border-orange-400/40 bg-zinc-950" />
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
        <p className="flex-1 leading-snug">
          <b className="text-white">Everything else lives here.</b> Walk through the house, turn rooms into photos, furnish them, make a video, see it in AR, get materials and a build schedule.
        </p>
        <button onClick={dismiss} className="rounded p-0.5 text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );

  if (!open) {
    return (
      <aside className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-2xl border border-r-0 border-orange-400/30 bg-zinc-950/95 px-1.5 py-2.5 shadow-[0_0_32px_-8px_rgba(234,128,64,0.55)] backdrop-blur-xl">
        {callout}
        <button onClick={() => { dismiss(); setOpen(true); }} title="Show all features"
          className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg hover:brightness-110">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        {featured.map(it => (
          <button key={it.id} onClick={() => run(it)} disabled={it.disabled} title={`${it.label}: ${it.desc || ''}`}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-35 ${toneOf(it.group).icon} hover:scale-105`}>
            <it.icon className="h-4 w-4" />
            <span className="pointer-events-none absolute right-[calc(100%+0.5rem)] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 opacity-0 shadow-lg transition group-hover:opacity-100">{it.label}</span>
          </button>
        ))}
        <span className="mt-1 font-mono text-[9px] tracking-[0.2em] text-orange-300/80 [writing-mode:vertical-rl]">{all.length} FEATURES</span>
      </aside>
    );
  }

  return (
    <aside className="absolute right-4 top-24 bottom-28 z-30 flex w-[18rem] flex-col rounded-2xl border border-orange-400/25 bg-zinc-950/95 shadow-[0_0_40px_-12px_rgba(234,128,64,0.5)] backdrop-blur-xl">
      {callout}
      <div className="rounded-t-2xl bg-gradient-to-r from-orange-500/15 via-rose-500/10 to-violet-500/15 px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Features</p>
          <button onClick={() => setOpen(false)} title="Shrink to icons" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-400">{all.length} tools to see, render, share and build your house</p>
        <label className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a feature" className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none" />
        </label>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3 custom-scrollbar">
        {hits ? (
          <ul className="space-y-1">
            {hits.map(it => <Row key={it.id} item={it} run={run} />)}
            {!hits.length && <li className="px-2 py-3 text-xs text-zinc-500">Nothing matches “{query}”.</li>}
          </ul>
        ) : (
          <>
            <div>
              <p className="mb-2 px-1 font-mono text-[10px] tracking-[0.2em] text-orange-300/90">START HERE</p>
              <div className="grid grid-cols-2 gap-2">
                {featured.map(it => (
                  <button key={it.id} onClick={() => run(it)} disabled={it.disabled}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border bg-gradient-to-br p-2.5 text-left transition hover:-translate-y-0.5 hover:brightness-125 disabled:opacity-40 ${toneOf(it.group).tile} ${it.active ? 'ring-1 ring-white/60' : ''}`}>
                    <it.icon className={`h-5 w-5 ${toneOf(it.group).text}`} />
                    <span className="text-[12px] font-medium leading-tight text-white">{it.label}</span>
                    <span className="line-clamp-2 text-[10px] leading-snug text-zinc-400">{it.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {groups.map(g => (
              <div key={g.title}>
                <p className={`mb-1.5 flex items-center gap-2 px-1 font-mono text-[10px] tracking-[0.2em] ${toneOf(g.title).text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${toneOf(g.title).dot}`} /> {g.title}
                </p>
                <ul className="space-y-1">
                  {g.items.map(it => <Row key={it.id} item={{ ...it, group: g.title }} run={run} />)}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

import { useMemo, useState } from 'react';
import { PanelRightClose, PanelRightOpen, Search, X } from 'lucide-react';
import InfoTip from './InfoTip';

/*
 * The Studio's right sidebar: every bigger tool (views, design features, reports), laid out like the
 * left Tools panel so the two sides read as one interface. Open, it shows every feature at once as
 * a grid of icons under plain section headings, with a search box. Closed, it is a slim rail of icons.
 */
const GROUP_NAMES = { VIEW: 'View & present', AI: 'Design', REPORTS: 'Reports & export' };

function Tile({ item, run, i }) {
  return (
    <div className="relative">
      <button onClick={() => run(item)} disabled={item.disabled} title={item.desc} aria-pressed={!!item.active}
        className={`flex h-full w-full flex-col items-center justify-start rounded px-1.5 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${item.active ? 'bg-indigo-500/15 text-indigo-200' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>
        <item.icon className="mb-1.5 h-4 w-4 shrink-0" />
        <span className="text-center text-[10px] font-medium leading-tight">{item.label}</span>
      </button>
      {item.info && <InfoTip id={item.info} align={i % 3 === 2 ? 'right' : i % 3 === 1 ? 'center' : 'left'} className="absolute right-1 top-1" />}
    </div>
  );
}

function Row({ item, run }) {
  return (
    <button onClick={() => run(item)} disabled={item.disabled}
      className={`flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors disabled:opacity-35 ${item.active ? 'bg-indigo-500/15' : 'hover:bg-zinc-900'}`}>
      <item.icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="min-w-0">
        <span className="block truncate text-xs text-zinc-200">{item.label}</span>
        <span className="block truncate text-[10px] text-zinc-500">{item.desc}</span>
      </span>
    </button>
  );
}

export default function FeatureDock({ open, setOpen, groups }) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const q = query.trim().toLowerCase();
  const hits = q ? all.filter(it => `${it.label} ${it.desc || ''}`.toLowerCase().includes(q)) : null;
  const run = (item) => { if (!item.disabled) item.onClick(); };

  if (!open) {
    return (
      <aside className="z-10 flex w-12 shrink-0 flex-col items-center border-l border-zinc-800 bg-zinc-950">
        <div className="flex h-16 w-full shrink-0 items-center justify-center border-b border-zinc-800 bg-black/50">
          <button onClick={() => setOpen(true)} title="Show all features" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <PanelRightOpen className="h-4 w-4" />
          </button>
        </div>
        <div className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto py-2 custom-scrollbar">
          {groups.map((g, gi) => (
            <div key={g.title} className="flex w-full flex-col items-center gap-0.5">
              {gi > 0 && <span className="my-1.5 h-px w-6 bg-zinc-800" />}
              {g.items.map(it => (
                <button key={it.id} onClick={() => run(it)} disabled={it.disabled} title={`${it.label}${it.desc ? `: ${it.desc}` : ''}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-30 ${it.active ? 'bg-indigo-500/15 text-indigo-200' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}>
                  <it.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="z-10 flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-black/50 px-4 backdrop-blur-sm">
        <label className="flex flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 focus-within:border-zinc-600">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${all.length} features`}
            className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none" />
          {query && <button onClick={() => setQuery('')} className="text-zinc-500 hover:text-white"><X className="h-3 w-3" /></button>}
        </label>
        <button onClick={() => setOpen(false)} title="Hide this panel" className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {hits ? (
          <div className="space-y-0.5 p-3">
            {hits.map(it => <Row key={it.id} item={it} run={run} />)}
            {!hits.length && <p className="px-2 py-3 text-xs text-zinc-500">Nothing matches “{query}”.</p>}
          </div>
        ) : groups.map((g, gi) => (
          <section key={g.title} className={`px-3 pb-2.5 pt-3.5 ${gi > 0 ? 'border-t border-zinc-800/70' : ''}`}>
            <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{GROUP_NAMES[g.title] || g.title}</h3>
            <div className="grid grid-cols-3 gap-1">
              {g.items.map((it, i) => <Tile key={it.id} item={it} run={run} i={i} />)}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

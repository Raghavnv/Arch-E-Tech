import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import InfoTip from './InfoTip';

/*
 * The Studio's feature dock: the bigger tools (views, AI features, reports) in one panel that slides
 * in from the right edge, so the toolbar keeps to drawing. Collapsed, it is a slim tab on the edge.
 */
export default function FeatureDock({ open, setOpen, groups }) {
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Show features"
        className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 rounded-l-xl border border-r-0 border-zinc-800 bg-zinc-950/90 px-2 py-4 text-zinc-400 shadow-[0_0_24px_-10px_rgba(200,121,74,0.6)] backdrop-blur-xl transition-colors hover:text-white"
      >
        <PanelRightOpen className="h-4 w-4" />
        <span className="font-mono text-[10px] tracking-[0.25em] [writing-mode:vertical-rl]">FEATURES</span>
      </button>
    );
  }
  return (
    <aside className="absolute right-4 top-24 bottom-28 z-30 flex w-[17rem] flex-col rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-400">FEATURES</p>
        <button onClick={() => setOpen(false)} title="Hide features" className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3 custom-scrollbar">
        {groups.map(g => (
          <div key={g.title}>
            <p className="mb-1.5 px-1 font-mono text-[10px] tracking-[0.2em] text-zinc-600">{g.title}</p>
            <ul className="space-y-1">
              {g.items.map(item => (
                <li key={item.id} className="relative">
                  <button
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 pr-8 text-left transition-colors disabled:opacity-40 ${item.active ? 'bg-indigo-500/15' : 'hover:bg-zinc-900'}`}
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${item.accent ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300' : 'border-zinc-800 bg-zinc-900 text-zinc-300'}`}>
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-100">{item.label}</span>
                      <span className="block text-[11px] leading-snug text-zinc-500">{item.desc}</span>
                    </span>
                  </button>
                  {item.info && <InfoTip id={item.info} align="right" className="absolute right-2 top-2.5" />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

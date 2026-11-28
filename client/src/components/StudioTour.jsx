import { useState } from 'react';
import { X, ArrowRight, Box, Wand2, Calculator, Share2, LayoutGrid } from 'lucide-react';

/*
 * The first run in the Studio: five short steps, each with a button that does it, so a new owner sees
 * the plan, the house in 3D, a change made by asking, what it costs, and how to show the family. Shown
 * the first time anyone opens the Studio (and when the demo house opens); skipping or finishing it is
 * remembered on this device.
 */
const DONE_KEY = 'archetech_tour_done';
export const tourDone = () => { try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return true; } };

export default function StudioTour({ demo = false, actions, onClose }) {
  const [i, setI] = useState(0);
  const steps = [
    { icon: LayoutGrid, title: demo ? 'This is the demo house' : 'This is your plan',
      text: 'Drawn to scale: every wall, door and window is real and can be dragged. Rooms show their names and sizes.', cta: null },
    { icon: Box, title: 'See it in 3D', text: 'The plan rises into a model you can turn around, paint and walk through.', cta: ['Show me in 3D', actions.show3D] },
    { icon: Wand2, title: 'Change anything by asking', text: 'Type a change, like "make the kitchen bigger and add a patio", and the plan redraws itself. Undo always works.', cta: ['Open AI Edit', actions.edit] },
    { icon: Calculator, title: 'Know what it costs', text: 'A live estimate, your monthly EMI, and a check of any contractor\'s quote against it.', cta: ['See the cost', actions.cost] },
    { icon: Share2, title: 'Show the family', text: 'Send a link they can comment on and vote on, in English, Hindi, Kannada or Tamil, or make a brochure PDF.', cta: ['Share it', actions.share] },
  ];
  const s = steps[i], last = i === steps.length - 1, Icon = s.icon;
  const close = () => { try { localStorage.setItem(DONE_KEY, '1'); } catch { /* private mode */ } onClose(); };
  return (
    <div className="absolute bottom-24 left-6 z-40 w-[min(340px,calc(100%-3rem))] rounded-2xl border border-indigo-400/30 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-xl" role="dialog" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300"><Icon className="h-4 w-4" /></span>
          <p className="text-sm font-semibold text-white">{s.title}</p>
        </div>
        <button onClick={close} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Skip the tour"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{s.text}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">{steps.map((_, j) => <span key={j} className={`h-1.5 rounded-full ${j === i ? 'w-4 bg-indigo-400' : 'w-1.5 bg-zinc-700'}`} />)}</div>
        <div className="flex gap-2">
          {s.cta && <button onClick={s.cta[1]} className="btn-secondary px-3 py-1.5 text-[11px]">{s.cta[0]}</button>}
          <button onClick={() => (last ? close() : setI(i + 1))} className="btn-primary px-3 py-1.5 text-[11px]">
            {last ? 'Start exploring' : 'Next'} {!last && <ArrowRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {last && <p className="mt-2 text-[10px] text-zinc-500">Everything else, from solar to the drawing set, is in the panel on the right; search it by name.</p>}
    </div>
  );
}

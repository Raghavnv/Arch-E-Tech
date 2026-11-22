import { useState } from 'react';
import { Check, Paintbrush, Sparkles, X } from 'lucide-react';
import { DESIGN_STYLES, applyDesignStyle } from '../utils/designStyles';
import { FLOOR_BY_ID } from '../utils/floorFinishes';
import { CEILING_STYLES, LIGHT_TYPES } from './Ceilings';

/*
 * "Design my house": pick an interior style and what it should change (walls, floors, ceilings and
 * lights, decor), and the whole house is done in one go. Undo takes it back; every room can still be
 * changed by hand afterwards in the finishes panel or the Room Designer.
 */
export default function DesignStyleModal({ elements, onApply, onClose, onSee }) {
  const [styleId, setStyleId] = useState('modern');
  const [parts, setParts] = useState({ walls: true, floors: true, ceilings: true, decor: true });
  const [done, setDone] = useState(null);
  const style = DESIGN_STYLES.find(s => s.id === styleId);
  const living = (k) => (style.ceilings[k] || style.ceilings.default);
  const apply = () => {
    const { elements: next, summary } = applyDesignStyle(elements, style, parts);
    onApply(next);
    setDone({ ...summary, name: style.name });
  };
  const toggle = (k) => setParts(p => ({ ...p, [k]: !p[k] }));
  const nameOf = (list, id) => list.find(x => x.id === id)?.name || id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-[min(940px,100%)] flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Design my house</h3>
            <p className="text-[11px] text-zinc-500">One style for every room: wall colours and a feature wall, floors, ceilings and lights, and decor. Undo (Ctrl/Cmd+Z) takes it back.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[1fr_17rem]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DESIGN_STYLES.map(s => (
              <button key={s.id} onClick={() => { setStyleId(s.id); setDone(null); }}
                className={`overflow-hidden rounded-xl border text-left transition ${styleId === s.id ? 'border-orange-400/70 ring-2 ring-orange-400/30' : 'border-zinc-800 hover:border-zinc-600'}`}>
                <div className="flex h-14">
                  {s.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white">{s.name}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 p-3 text-[11px]">
              <p className="font-mono text-[10px] tracking-[0.15em] text-zinc-500">{style.name.toUpperCase()}</p>
              <dl className="mt-2 space-y-1.5 text-zinc-300">
                <div><dt className="text-zinc-500">Living room</dt><dd>{FLOOR_BY_ID[style.floors.living || style.floors.default]?.name} floor · {nameOf(CEILING_STYLES, living('living')[0])} · {nameOf(LIGHT_TYPES, living('living')[1])}</dd></div>
                <div><dt className="text-zinc-500">Master bedroom</dt><dd>{FLOOR_BY_ID[style.floors.master_bedroom || style.floors.default]?.name} floor · {nameOf(CEILING_STYLES, living('master_bedroom')[0])} · {nameOf(LIGHT_TYPES, living('master_bedroom')[1])}</dd></div>
                <div><dt className="text-zinc-500">Bathrooms</dt><dd>{FLOOR_BY_ID[style.floors.bathroom || style.floors.default]?.name} floor</dd></div>
                <div><dt className="text-zinc-500">Walls</dt><dd className="flex items-center gap-1">{['default', 'bedroom', 'master_bedroom'].map(k => <span key={k} className="h-3.5 w-3.5 rounded-full border border-zinc-700" style={{ background: style.walls[k] || style.walls.default }} />)} <span className="ml-1">+ a feature wall in the main rooms</span></dd></div>
              </dl>
            </div>
            <div className="space-y-1.5">
              {[['walls', 'Walls: colours and a feature wall'], ['floors', 'Floors'], ['ceilings', 'Ceilings and lights'], ['decor', 'Decor: rugs, plants, lamps, wall art']].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={parts[k]} onChange={() => toggle(k)} className="accent-orange-500" /> {label}
                </label>
              ))}
            </div>
            <button onClick={apply} disabled={!Object.values(parts).some(Boolean)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-rose-500 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">
              <Paintbrush className="h-4 w-4" /> Design the house in {style.name}
            </button>
            {done && (
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200">
                <p className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {done.name}: {done.rooms} rooms and {done.walls} walls finished{done.decor ? `, ${done.decor} decor pieces placed` : ''}.</p>
                <button onClick={onSee} className="mt-2 w-full rounded-md bg-emerald-500/20 py-1.5 text-emerald-100 hover:bg-emerald-500/30">See it in 3D</button>
              </div>
            )}
            <p className="text-[10px] leading-snug text-zinc-600">Applying another style replaces this one's finishes and decor. Your own furniture stays.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

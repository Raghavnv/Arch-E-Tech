import { useEffect, useState } from 'react';
import { Check, Paintbrush, Save, Sparkles, Trash2, X } from 'lucide-react';
import { DESIGN_STYLES, applyDesignStyle, styleFromHouse } from '../utils/designStyles';
import { FLOOR_BY_ID } from '../utils/floorFinishes';
import { CEILING_STYLES, LIGHT_TYPES } from './Ceilings';

/*
 * "Design my house": pick an interior style and what it should change (walls, floors, ceilings and
 * lights, decor), and the whole house is done in one go. Undo takes it back; every room can still be
 * changed by hand afterwards in the finishes panel or the Room Designer.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

export default function DesignStyleModal({ elements, onApply, onClose, onSee }) {
  const [mine, setMine] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  useEffect(() => {
    fetch(`${API_URL}/api/styles`, { headers: auth() }).then(r => (r.ok ? r.json() : [])).then(list => setMine(list.map(s => ({ ...s.data, id: `saved_${s.id}`, dbId: s.id, name: s.name }))))
      .catch(() => {});
  }, []);
  const saveStyle = async () => {
    const name = saveName.trim() || 'My style';
    const data = styleFromHouse(elements, name);
    const res = await fetch(`${API_URL}/api/styles`, { method: 'POST', headers: auth(), body: JSON.stringify({ name, data }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setSaveMsg(body.detail || `Couldn't save (${res.status}).`); return; }
    setMine(m => [{ ...body.data, id: `saved_${body.id}`, dbId: body.id, name: body.name }, ...m]);
    setSaveMsg(`Saved "${name}". It is in Your styles, for any of your houses.`);
    setSaveName('');
  };
  const removeStyle = async (s) => {
    await fetch(`${API_URL}/api/styles/${s.dbId}`, { method: 'DELETE', headers: auth() }).catch(() => {});
    setMine(m => m.filter(x => x.id !== s.id));
  };
  const [styleId, setStyleId] = useState('modern');
  const [parts, setParts] = useState({ walls: true, floors: true, ceilings: true, decor: true });
  const [done, setDone] = useState(null);
  const style = [...mine, ...DESIGN_STYLES].find(s => s.id === styleId) || DESIGN_STYLES[0];
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-indigo-400" /> Design my house</h3>
            <p className="text-[11px] text-zinc-500">One look for every room. Undo takes it back.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[1fr_17rem]">
          <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
            {mine.length > 0 && <p className="col-span-full label-caps">YOUR STYLES</p>}
            {mine.map(s => (
              <div key={s.id} className={`relative overflow-hidden rounded-xl border text-left ${styleId === s.id ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-zinc-800'}`}>
                <button onClick={() => { setStyleId(s.id); setDone(null); }} className="block w-full text-left">
                  <div className="flex h-10">{(s.swatch || []).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
                  <div className="p-2.5"><p className="text-xs font-semibold text-white">{s.name}</p><p className="text-[10px] text-zinc-500">Saved from a house</p></div>
                </button>
                <button onClick={() => removeStyle(s)} title="Delete this style" className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-zinc-300 hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {mine.length > 0 && <p className="col-span-full mt-1 label-caps">BUILT IN</p>}
            {DESIGN_STYLES.map(s => (
              <button key={s.id} onClick={() => { setStyleId(s.id); setDone(null); }}
                className={`overflow-hidden rounded-xl border text-left transition ${styleId === s.id ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-zinc-800 hover:border-zinc-600'}`}>
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
              <p className="label-caps">{style.name.toUpperCase()}</p>
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
                  <input type="checkbox" checked={parts[k]} onChange={() => toggle(k)} className="accent-indigo-500" /> {label}
                </label>
              ))}
            </div>
            <button onClick={apply} disabled={!Object.values(parts).some(Boolean)}
              className="btn-primary w-full">
              <Paintbrush className="h-4 w-4" /> Apply {style.name}
            </button>
            {done && (
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200">
                <p className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {done.name}: {done.rooms} rooms and {done.walls} walls finished{done.decor ? `, ${done.decor} decor pieces placed` : ''}.</p>
                <button onClick={onSee} className="mt-2 w-full rounded-md bg-emerald-500/20 py-1.5 text-emerald-100 hover:bg-emerald-500/30">See it in 3D</button>
              </div>
            )}
            <p className="text-[10px] leading-snug text-zinc-600">Your own furniture stays.</p>
            <div className="rounded-xl border border-zinc-800 p-3">
              <p className="text-[11px] font-semibold text-zinc-200">Save this house's look</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">Save this look to use on your other houses.</p>
              <div className="mt-2 flex gap-1.5">
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name it" maxLength={80}
                  className="min-w-0 flex-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none" />
                <button onClick={saveStyle} className="btn-secondary gap-1 px-2.5 text-xs"><Save className="h-3.5 w-3.5" /> Save</button>
              </div>
              {saveMsg && <p className="mt-1.5 text-[10px] text-emerald-300">{saveMsg}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

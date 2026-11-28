import { useMemo, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, Check, Upload } from 'lucide-react';
import { analysePhoto, opsFor, roomsFor } from '../utils/photoPalette';
import { applyClientOps } from '../utils/editOps';
import { floorSwatch } from '../utils/floorFinishes';
import { WOOD_FINISHES } from '../utils/textureLibrary';

/*
 * Match a photo: the owner drops in a room they love (Pinterest, a magazine, a friend's house) and the
 * house gets the closest paint, floor, accent wall and style from the app's own library. Every pick
 * shows the colour it came from and the next-closest alternatives; nothing changes until Apply, and
 * Undo takes it back.
 */
const WOOD_URL = Object.fromEntries(WOOD_FINISHES.map(f => [f.id, f.url]));
const MAX_MB = 15;

function Swatch({ item, kind, on, onClick, title }) {
  const style = kind === 'floor' ? { backgroundImage: `url(${floorSwatch(item.id)})`, backgroundSize: 'cover' }
    : kind === 'wood' ? { backgroundImage: `url(${WOOD_URL[item.id]})`, backgroundSize: 'cover' }
      : { background: item.hex };
  return (
    <button type="button" onClick={onClick} title={title || item.name} aria-pressed={on}
      className={`h-8 w-8 shrink-0 rounded-md border ${on ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-zinc-700 hover:border-zinc-500'}`} style={style} />
  );
}

function Row({ label, from, list, kind, value, setValue, enabled, setEnabled, note }) {
  const picked = list.find(x => x.id === value) || list[0];
  return (
    <div className={`rounded-xl border border-zinc-800 p-3 ${enabled ? '' : 'opacity-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-200">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-indigo-500" /> {label}
        </label>
        {from && <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">from the photo <span className="h-3 w-3 rounded-sm border border-zinc-700" style={{ background: from }} /></span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {list.map(x => <Swatch key={x.id} item={x} kind={kind} on={x.id === picked.id} onClick={() => { setValue(x.id); setEnabled(true); }} />)}
        <span className="ml-1 min-w-0 truncate text-xs text-zinc-300">{picked.name}</span>
      </div>
      {note && <p className="mt-1.5 text-[10px] text-zinc-500">{note}</p>}
    </div>
  );
}

export default function PhotoMatch({ elements, setElements, onClose }) {
  const [photo, setPhoto] = useState(null);       // data URL
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [scope, setScope] = useState('house');
  const [pick, setPick] = useState({});
  const [on, setOn] = useState({ wall: true, floor: true, accent: true, style: true });
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const rooms = useMemo(() => elements.filter(e => e.type === 'room' && !['patio', 'balcony', 'terrace', 'deck', 'hallway'].includes(e.kind))
    .sort((a, b) => (a.floor || 1) - (b.floor || 1) || (a.name || '').localeCompare(b.name || '')), [elements]);

  const read = (file) => {
    setError(''); setDone('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) { setError('Use a JPEG, PNG or WebP photo.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`That photo is over ${MAX_MB} MB.`); return; }
    setBusy(true);
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const r = analysePhoto(img);
          setResult(r);
          setPhoto(fr.result);
          setPick({ wall: r.walls[0].id, floor: r.floors[0].id, accent: r.accent?.choices[0]?.id, style: r.styles[0].id });
          setOn({ wall: true, floor: true, accent: !!r.accent, style: true });
        } catch (e) { setError(e.message); }
        setBusy(false);
      };
      img.onerror = () => { setError("That file couldn't be read as a picture."); setBusy(false); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  const picks = result ? {
    wall: on.wall ? pick.wall : null,
    floor: on.floor ? pick.floor : null,
    accent: on.accent && result.accent ? { id: pick.accent, kind: result.accent.kind } : null,
    style: on.style && scope === 'house' ? pick.style : null,
  } : {};
  const ops = result ? opsFor(elements, picks, scope) : [];
  const nothing = !ops.length;

  const apply = () => {
    const { elements: next } = applyClientOps(elements, ops);
    setElements(next);
    const where = scope === 'house' ? `${roomsFor(ops)} rooms` : (rooms.find(r => r.id === scope)?.name || 'the room');
    const what = [picks.style && `the ${result.styles.find(s => s.id === picks.style)?.name} style`, picks.wall && 'paint', picks.floor && 'floor', picks.accent && 'an accent wall'].filter(Boolean);
    setDone(`Applied ${what.join(', ').replace(/, ([^,]*)$/, ' and $1')} to ${where}. Undo takes it back.`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ImagePlus className="h-4 w-4 text-zinc-400" /> Match a photo</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Use a photo of a room you love.</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 custom-scrollbar md:grid-cols-[1fr_22rem]">
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files?.[0]); }}
              className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border ${drag ? 'border-indigo-400 bg-indigo-500/5' : photo ? 'border-zinc-800' : 'border-dashed border-zinc-700 hover:border-zinc-500'}`}>
              {photo ? <img src={photo} alt="Your inspiration" className="h-full w-full object-cover" /> : (
                <span className="flex flex-col items-center gap-2 text-zinc-400">
                  {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-zinc-500" />}
                  <span className="text-sm text-zinc-300">Drop a photo here, or click to choose one</span>
                  <span className="text-[11px] text-zinc-500">JPEG, PNG or WebP. It stays on your computer.</span>
                </span>
              )}
              {photo && <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-zinc-200">Choose another photo</span>}
            </button>
            {result && (
              <>
                <p className="label-caps mt-3 mb-1.5">Colours in the photo</p>
                <div className="flex h-7 overflow-hidden rounded-md border border-zinc-800">
                  {result.palette.map((c, i) => <span key={i} title={c.hex} style={{ background: c.hex, flexGrow: c.share }} />)}
                </div>
              </>
            )}
            {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
          </div>

          <div className="space-y-2.5">
            {!result && <p className="rounded-xl border border-zinc-800 p-4 text-xs leading-relaxed text-zinc-400">Add a photo to see the matching paint, floor, accent and style.</p>}
            {result && (
              <>
                <label className="block text-xs text-zinc-400">Apply to
                  <select value={scope} onChange={(e) => setScope(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
                    <option value="house">The whole house</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{(r.floor || 1) > 1 ? ` (floor ${r.floor})` : ''}</option>)}
                  </select>
                </label>
                {scope === 'house' && (
                  <Row label="Style" list={result.styles.map(s => ({ ...s, hex: s.swatch[1] }))} kind="paint" value={pick.style}
                    setValue={(v) => setPick(p => ({ ...p, style: v }))} enabled={on.style} setEnabled={(v) => setOn(o => ({ ...o, style: v }))}
                    note="Ceilings, lights, curtains and window frames from the style. The picks below go on top." />
                )}
                <Row label="Wall paint" from={result.wallFrom} list={result.walls} kind="paint" value={pick.wall}
                  setValue={(v) => setPick(p => ({ ...p, wall: v }))} enabled={on.wall} setEnabled={(v) => setOn(o => ({ ...o, wall: v }))}
                  note={scope === 'house' ? 'Living rooms, bedrooms, study and halls. Kitchen and bathrooms keep theirs.' : null} />
                <Row label="Floor" from={result.floorFrom} list={result.floors} kind="floor" value={pick.floor}
                  setValue={(v) => setPick(p => ({ ...p, floor: v }))} enabled={on.floor} setEnabled={(v) => setOn(o => ({ ...o, floor: v }))}
                  note={scope === 'house' ? 'Living, dining, bedrooms and halls.' : null} />
                {result.accent && (
                  <Row label={result.accent.kind === 'wood' ? 'Accent wall, wood' : 'Accent wall'} from={result.accent.from} list={result.accent.choices}
                    kind={result.accent.kind} value={pick.accent} setValue={(v) => setPick(p => ({ ...p, accent: v }))}
                    enabled={on.accent} setEnabled={(v) => setOn(o => ({ ...o, accent: v }))}
                    note={scope === 'house' ? 'One wall in the living room and the master bedroom.' : 'The longest wall of the room.'} />
                )}
              </>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
          <p className={`text-xs ${done ? 'flex items-center gap-1.5 text-emerald-300' : 'text-zinc-500'}`}>
            {done ? <><Check className="h-3.5 w-3.5" /> {done}</> : 'Matched from the colours in the photo. The closest of each is picked first.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">{done ? 'Done' : 'Cancel'}</button>
            <button onClick={apply} disabled={!result || nothing} className="btn-primary px-4 py-1.5 text-xs">
              {scope === 'house' ? 'Apply to the house' : 'Apply to the room'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

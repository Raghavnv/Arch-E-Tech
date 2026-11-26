import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera, Upload, Loader2, Check, ScanLine, Sparkles, RotateCcw } from 'lucide-react';
import { MATERIAL_KINDS, classifyMaterial, makeTile, registerMaterials, suggestName, newScanId } from '../utils/materialScan';
import { applyClientOps } from '../utils/editOps';
import { formatMoney } from '../utils/units';
import { recognise, MODEL_MB } from '../utils/materialAI';

/*
 * Scan a material: photograph (or upload) a real sample, such as a plank, a marble offcut, a granite
 * slab, a stone from the site, a brick or a tile, and put it on the house. The app says what it looks
 * like it is (the server's AI model when one is set up; otherwise an image model that runs in the browser;
 * failing that, its own colour-and-texture reading), turns the
 * photo into a seamless tile, and lays it on floors or walls. Scans are kept with the project and appear
 * under "Your materials" in Walls & floors.
 */
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const LIVING = new Set(['living', 'dining', 'lounge', 'hallway', 'foyer', 'corridor']);
const BEDROOMS = new Set(['master_bedroom', 'bedroom', 'guest', 'study', 'closet']);
const WET = new Set(['kitchen', 'bathroom', 'utility', 'powder']);
const MAX_MB = 15;

// which rooms a material suits first
function defaultRooms(kind, rooms) {
  const pick = (set) => rooms.filter(r => set.has(r.kind)).map(r => r.id);
  if (['wood'].includes(kind)) return pick(new Set([...LIVING, ...BEDROOMS]));
  if (['marble', 'granite', 'terrazzo', 'concrete'].includes(kind)) return pick(LIVING);
  if (['stone', 'terracotta', 'brick'].includes(kind)) return pick(OUTDOOR).length ? pick(OUTDOOR) : pick(LIVING);
  if (kind === 'tile') return pick(WET);
  return pick(LIVING);
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("That file couldn't be read as a picture."));
  img.src = src;
});

/** The middle of an image as a small JPEG, for the AI model. */
function smallJpeg(img, size = 384) {
  const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h) * 0.8;
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.8);
}

function Camera_({ onShot, onCancel }) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream = null, off = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(s => { if (off) { s.getTracks().forEach(t => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } })
      .catch(() => setErr("The camera isn't available here. Allow camera access in the browser, or upload a photo instead."));
    if (!navigator.mediaDevices?.getUserMedia) setErr("This browser can't use the camera. Upload a photo instead.");
    return () => { off = true; stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    onShot(c.toDataURL('image/jpeg', 0.92));
  };
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
      {err ? <p className="flex h-full items-center justify-center p-6 text-center text-xs text-zinc-400">{err}</p> : (
        <>
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          {/* the part that becomes the tile */}
          <div className="pointer-events-none absolute inset-[10%] rounded-lg border-2 border-dashed border-white/70" />
          <p className="absolute inset-x-0 top-2 text-center text-[11px] text-white/90 drop-shadow">Fill the square with the material, flat on, in even light</p>
        </>
      )}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
        {!err && <button type="button" onClick={snap} className="btn-primary px-4 py-1.5 text-xs"><Camera className="h-3.5 w-3.5" /> Take the photo</button>}
      </div>
    </div>
  );
}

export default function MaterialScan({ projectId, apiUrl, elements, setElements, materials, setMaterials, onClose }) {
  const [stage, setStage] = useState('pick');      // pick | camera | review
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [scan, setScan] = useState(null);          // { id, image, color, ranked, ai, features, existing }
  const [kind, setKind] = useState('other');
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);       // the owner typed a name: stop suggesting one
  const [sizeCm, setSizeCm] = useState(80);
  const [target, setTarget] = useState('floor');   // floor | wall | save
  const [picked, setPicked] = useState([]);
  const [wallRoom, setWallRoom] = useState('');
  const [wallMode, setWallMode] = useState('feature');
  const [model, setModel] = useState(null);         // the in-browser model: { loading: 0..1 } | { failed } | null
  const fileRef = useRef(null), captureRef = useRef(null);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const rooms = useMemo(() => elements.filter(e => e.type === 'room')
    .sort((a, b) => (a.floor || 1) - (b.floor || 1) || (a.name || '').localeCompare(b.name || '')), [elements]);
  const insideRooms = rooms.filter(r => !OUTDOOR.has(r.kind));

  const chooseKind = (k, f = scan?.features) => {
    setKind(k);
    setSizeCm(Math.round(MATERIAL_KINDS[k].tile * 100));
    if (!named && f) setName(scan?.ai?.kind === k && scan.ai.name ? scan.ai.name : suggestName(k, f));
    setPicked(defaultRooms(k, rooms));
    if (k === 'brick' || k === 'stone') setTarget(t => (t === 'floor' && !rooms.some(r => OUTDOOR.has(r.kind)) ? 'wall' : t));
  };

  // a photo in: read it, ask the AI model if there is one, make the tile
  const take = async (dataUrl) => {
    setError(''); setDone(''); setBusy('reading'); setStage('review');
    try {
      const img = await loadImage(dataUrl);
      const { ranked, features } = classifyMaterial(img);
      const image = makeTile(img);
      const small = smallJpeg(img);
      // the server's vision model (when it has a key) and the in-browser image model look at the photo together
      const server = fetch(`${apiUrl}/api/ai/identify-material`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: small }) })
        .then(r => r.json()).then(d => (d.source === 'ai' && MATERIAL_KINDS[d.kind] ? d : null)).catch(() => null);
      const local = recognise(small, (p) => setModel({ loading: p }))
        .then(r => { setModel(null); return r; })
        .catch(() => { setModel({ failed: true }); return null; });
      const [ai, seen] = await Promise.all([server, local]);
      const order = ai ? [ai.kind, ...(ai.alternatives || [])] : [];
      if (seen) order.push(...seen.map(x => x.kind));
      order.push(...ranked.map(x => x.kind));
      const kinds = [...new Set(order)].filter(k => MATERIAL_KINDS[k]);
      const how = ai ? 'ai' : seen ? 'model' : 'guess';
      const s = { id: newScanId(), image, color: features.color, ranked, ai, features, kinds, how,
        sure: ai ? ai.confidence : seen ? seen[0].score : ranked[0].score };
      setScan(s);
      setNamed(false);
      const k = kinds[0];
      setKind(k);
      setSizeCm(Math.round(MATERIAL_KINDS[k].tile * 100));
      setName(ai?.name || suggestName(k, features));
      setPicked(defaultRooms(k, rooms));
      setTarget(k === 'brick' && !rooms.some(r => OUTDOOR.has(r.kind)) ? 'wall' : 'floor');
    } catch (e) {
      setError(e.message); setStage('pick');
    } finally { setBusy(''); }
  };

  const readFile = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError('Use a JPEG, PNG or WebP photo.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`That photo is over ${MAX_MB} MB.`); return; }
    const fr = new FileReader();
    fr.onload = () => take(fr.result);
    fr.readAsDataURL(file);
  };

  const reuse = (m) => {
    setError(''); setDone('');
    setScan({ id: m.id, image: m.image, color: m.color, existing: true, kinds: [m.kind], features: null, sure: null });
    setKind(m.kind); setName(m.name); setNamed(true); setSizeCm(Math.round((m.tile_m || 0.8) * 100));
    setPicked(defaultRooms(m.kind, rooms));
    setStage('review');
  };

  const save = async () => {
    if (!scan) return;
    setBusy('saving'); setError('');
    try {
      const k = MATERIAL_KINDS[kind];
      const m = { id: scan.id, name: name.trim().slice(0, 60) || suggestName(kind, scan.features || {}), kind, color: scan.color, image: scan.image,
        tile_m: Math.max(0.1, Math.min(5, sizeCm / 100)), price: k.price };
      const next = [...(materials || []).filter(x => x.id !== m.id), m].slice(-30);
      if (projectId) {
        const res = await fetch(`${apiUrl}/api/projects/${projectId}/materials`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ materials: next }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof d.detail === 'string' ? d.detail : `Couldn't save the material (${res.status}).`);
      }
      await registerMaterials([m]);
      setMaterials(next);
      let ops = [];
      if (target === 'floor' && picked.length) ops = [{ do: 'set_floor', rooms: picked, finish: m.id }];
      if (target === 'wall' && wallRoom) ops = [{ do: 'paint_walls', rooms: wallRoom === 'all' ? insideRooms.map(r => r.id) : [wallRoom], material: m.id, isColor: false, feature: wallMode === 'feature' }];
      if (ops.length) setElements(applyClientOps(elements, ops).elements);
      const where = target === 'floor' && picked.length ? `the floor of ${picked.length} room${picked.length > 1 ? 's' : ''}`
        : target === 'wall' && wallRoom ? (wallRoom === 'all' ? 'every wall' : `${wallMode === 'feature' ? 'an accent wall' : 'the walls'} of the ${rooms.find(r => r.id === wallRoom)?.name || 'room'}`) : null;
      setDone(where ? `${m.name} is on ${where}. Undo takes it back; it's also under Your materials in Walls & floors.` : `${m.name} is saved under Your materials in Walls & floors.`);
      setScan(s => ({ ...s, existing: true }));
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const sure = scan?.sure;
  // on the labelled photos, a top score over 0.7 was right 97 % of the time, 0.5 to 0.7 about 3 in 4
  const confidence = sure == null ? null : sure > 0.7 ? 'fairly sure' : sure > 0.5 ? 'likely' : 'not sure';
  const pickSet = (set) => setPicked(rooms.filter(r => set.has(r.kind)).map(r => r.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ScanLine className="h-4 w-4 text-zinc-400" /> Scan a material</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Photograph a real sample, like wood, marble, granite, stone, brick or tile, and lay it on your house.</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 custom-scrollbar md:grid-cols-[1fr_22rem]">
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            {stage === 'pick' && (
              <div className="grid aspect-square w-full grid-rows-2 gap-3">
                <button type="button" onClick={() => (touch ? captureRef.current?.click() : setStage('camera'))}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600">
                  <Camera className="h-6 w-6 text-zinc-400" />
                  <span className="text-sm text-zinc-100">Take a photo</span>
                  <span className="text-[11px] text-zinc-500">Flat on, filling the frame, in daylight</span>
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-zinc-300 hover:border-zinc-500">
                  <Upload className="h-6 w-6 text-zinc-500" />
                  <span className="text-sm text-zinc-100">Upload a photo</span>
                  <span className="text-[11px] text-zinc-500">Or drop one here: a showroom sample, a supplier's picture</span>
                </button>
              </div>
            )}
            {stage === 'camera' && <Camera_ onShot={take} onCancel={() => setStage('pick')} />}
            {stage === 'review' && (
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  {scan?.image
                    ? <div className="h-full w-full" style={{ backgroundImage: `url(${scan.image})`, backgroundSize: `${100 / 3}% ${100 / 3}%` }} />
                    : <div className="flex h-full items-center justify-center text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                  {scan?.image && <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-zinc-200">How it repeats: 3 × 3 tiles</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setScan(null); setStage('pick'); setDone(''); }} className="btn-secondary px-3 py-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Scan another</button>
                </div>
              </div>
            )}
            {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

            {materials?.length > 0 && (
              <div className="mt-4">
                <p className="label-caps mb-1.5">Your materials</p>
                <div className="flex flex-wrap gap-2">
                  {materials.map(m => (
                    <button key={m.id} type="button" onClick={() => reuse(m)} title={`${m.name}: use it again`}
                      className={`w-16 overflow-hidden rounded-md border text-left ${scan?.id === m.id ? 'border-indigo-400' : 'border-zinc-800 hover:border-zinc-600'}`}>
                      <img src={m.image} alt="" className="aspect-square w-full object-cover" />
                      <span className="block truncate px-1 py-0.5 text-[9px] text-zinc-300">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {stage !== 'review' && (
              <div className="rounded-xl border border-zinc-800 p-4 text-xs leading-relaxed text-zinc-400">
                <p className="text-zinc-200">How it works</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>Photograph the sample straight on, close enough that it fills the frame.</li>
                  <li>We work out what it is, like wood, marble or granite, and you can correct it.</li>
                  <li>It becomes a seamless tile: lay it on floors or walls, in 2D and 3D.</li>
                </ol>
              </div>
            )}
            {stage === 'review' && busy === 'reading' && (
              <div className="text-xs text-zinc-400">
                <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {model?.loading != null && model.loading < 1 ? `Getting the material recogniser ready (${MODEL_MB} MB, first time only)…` : 'Looking at the sample…'}</p>
                {model?.loading != null && model.loading < 1 && (
                  <div className="mt-2 h-1 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(model.loading * 100)}%` }} /></div>
                )}
              </div>
            )}
            {stage === 'review' && scan && busy !== 'reading' && (
              <>
                <div className="rounded-xl border border-zinc-800 p-3">
                  <p className="label-caps">{scan.existing && !scan.ranked ? 'Material' : scan.how === 'guess' ? 'Best guess' : 'It looks like'}</p>
                  <p className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
                    {MATERIAL_KINDS[kind].label}
                    {(scan.how === 'ai' || scan.how === 'model') && <span className="flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-normal text-indigo-200"><Sparkles className="h-3 w-3" /> AI</span>}
                    {confidence && <span className="text-[11px] font-normal text-zinc-500">{confidence}</span>}
                  </p>
                  <p className="mt-2 text-[10px] text-zinc-500">{scan.how === 'guess' ? "From its colour and texture only (the image model couldn't load), so check it: the next likeliest come first." : 'Not right? Pick what it is:'}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {[...new Set([...(scan.kinds || []).slice(0, 3), ...Object.keys(MATERIAL_KINDS)])].map(k => (
                      <button key={k} type="button" onClick={() => chooseKind(k)} className={`${k === kind ? 'chip-on' : 'chip'} px-2 py-0.5 text-[11px]`}>{MATERIAL_KINDS[k].label}</button>
                    ))}
                  </div>
                </div>
                <label className="block text-xs text-zinc-400">Name
                  <input value={name} onChange={(e) => { setName(e.target.value); setNamed(true); }} maxLength={60}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
                </label>
                <label className="block text-xs text-zinc-400">
                  <span className="flex justify-between"><span>The photo shows about</span><span className="text-zinc-200">{sizeCm} cm across</span></span>
                  <input type="range" min={15} max={250} step={5} value={sizeCm} onChange={(e) => setSizeCm(Number(e.target.value))} className="mt-1 w-full accent-indigo-500" />
                  <span className="text-[10px] text-zinc-500">Sets how big the pattern is on the house. Priced at about {formatMoney(MATERIAL_KINDS[kind].price)}/m².</span>
                </label>

                <div className="rounded-xl border border-zinc-800 p-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[['floor', 'Floors'], ['wall', 'Walls'], ['save', 'Just save']].map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setTarget(k)} className={`${target === k ? 'chip-on' : 'chip'} text-center`}>{label}</button>
                    ))}
                  </div>
                  {target === 'floor' && (
                    <div className="mt-2.5">
                      <div className="mb-1.5 flex flex-wrap gap-1.5 text-[10px]">
                        <button type="button" onClick={() => pickSet(LIVING)} className="text-indigo-300 hover:text-indigo-200">Living areas</button>·
                        <button type="button" onClick={() => pickSet(BEDROOMS)} className="text-indigo-300 hover:text-indigo-200">Bedrooms</button>·
                        <button type="button" onClick={() => pickSet(OUTDOOR)} className="text-indigo-300 hover:text-indigo-200">Outdoor</button>·
                        <button type="button" onClick={() => setPicked(insideRooms.map(r => r.id))} className="text-indigo-300 hover:text-indigo-200">All inside</button>·
                        <button type="button" onClick={() => setPicked([])} className="text-zinc-500 hover:text-zinc-300">None</button>
                      </div>
                      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto custom-scrollbar">
                        {rooms.map(r => (
                          <button key={r.id} type="button" onClick={() => setPicked(p => (p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id]))}
                            className={`rounded-full px-2 py-0.5 text-[10px] ${picked.includes(r.id) ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                            {r.name || r.kind}{(r.floor || 1) > 1 ? ` · F${r.floor}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {target === 'wall' && (
                    <div className="mt-2.5 space-y-2">
                      <select value={wallRoom} onChange={(e) => setWallRoom(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
                        <option value="">Choose a room…</option>
                        <option value="all">Every room</option>
                        {insideRooms.map(r => <option key={r.id} value={r.id}>{r.name}{(r.floor || 1) > 1 ? ` (floor ${r.floor})` : ''}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[['feature', 'One accent wall'], ['all', 'All its walls']].map(([k, label]) => (
                          <button key={k} type="button" onClick={() => setWallMode(k)} className={`${wallMode === k ? 'chip-on' : 'chip'} text-center text-[11px]`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {target === 'save' && <p className="mt-2.5 text-[11px] text-zinc-500">Keep it under Your materials in Walls & floors to use later.</p>}
                </div>
                {!projectId && <p className="text-[11px] text-amber-300/90">Save the project first to keep scanned materials with it.</p>}
              </>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
          <p className={`text-xs ${done ? 'flex items-center gap-1.5 text-emerald-300' : 'text-zinc-500'}`}>
            {done ? <><Check className="h-3.5 w-3.5 shrink-0" /> {done}</> : 'Kept with this project and shown in 2D, 3D, walkthroughs and the cost takeoff.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">{done ? 'Done' : 'Cancel'}</button>
            <button onClick={save} disabled={!scan || !!busy || !projectId || (target === 'floor' && !picked.length) || (target === 'wall' && !wallRoom)} className="btn-primary px-4 py-1.5 text-xs">
              {busy === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {target === 'save' ? 'Save material' : 'Save and apply'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChefHat, Shirt, X } from 'lucide-react';
import { drawSymbol } from '../utils/planSymbols';
import {
  BACKSPLASHES, CABINET_FINISHES, COUNTERTOPS, KITCHEN_LAYOUTS, WARDROBE_FINISHES, WARDROBE_STYLES, layoutKitchen, layoutWardrobe,
} from '../utils/fittedFurniture';
import { formatMoney } from '../utils/units';
import { catalogItem } from '../utils/furnitureCatalog';

/*
 * Kitchen & wardrobes: lay out a modular kitchen (straight, L, parallel, U, island) with cabinet colour,
 * countertop and backsplash, or a run of wardrobes (hinged, sliding, mirrored) in a bedroom. A plan
 * preview shows the result before it goes into the house.
 */
function Preview({ elements, room }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !room) return;
    const W = 300, H = 220, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0f0e0d'; g.fillRect(0, 0, W, H);
    const pad = 24, x0 = room.left - pad, y0 = room.top - room.height / 2 - pad;
    const k = Math.min(W / (room.width + 2 * pad), H / (room.height + 2 * pad));
    const ox = (W - (room.width + 2 * pad) * k) / 2, oy = (H - (room.height + 2 * pad) * k) / 2;
    g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox - x0 * k), dpr * (oy - y0 * k));
    g.fillStyle = '#1d1b19'; g.fillRect(room.left, room.top - room.height / 2, room.width, room.height);
    const f = room.floor || 1;
    const here = elements.filter(e => (e.floor || 1) === f);
    g.strokeStyle = '#e4e4e7'; g.lineCap = 'square';
    for (const w of here.filter(e => e.type === 'wall')) {
      const a = ((w.angle || 0) * Math.PI) / 180;
      g.lineWidth = 8; g.beginPath(); g.moveTo(w.left, w.top); g.lineTo(w.left + w.width * Math.cos(a), w.top + w.width * Math.sin(a)); g.stroke();
    }
    const near = (e) => { const a = ((e.angle || 0) * Math.PI) / 180, mx = e.left + (e.width / 2) * Math.cos(a), my = e.top + (e.width / 2) * Math.sin(a); return mx > room.left - 10 && mx < room.left + room.width + 10 && my > room.top - room.height / 2 - 10 && my < room.top + room.height / 2 + 10; };
    for (const o of here.filter(e => (e.type === 'door' || e.type === 'window' || e.type.startsWith('furniture_')) && near(e))) {
      if (o.type === 'furniture_wall_cabinet' || o.type === 'furniture_chimney') continue;   // they hang above the counter
      const a = ((o.angle || 0) * Math.PI) / 180;
      g.save(); g.translate(o.left + (o.width / 2) * Math.cos(a), o.top + (o.width / 2) * Math.sin(a)); g.rotate(a);
      drawSymbol(o.type, g, o.width, o.height || 5, { swing: o.swing ?? 1, hinge: o.hinge ?? 1, bg: '#1d1b19' });
      g.restore();
    }
  }, [elements, room]);
  return <canvas ref={ref} style={{ width: 300, height: 220 }} className="rounded-lg" />;
}

const Chip = ({ on, onClick, children, title }) => (
  <button title={title} onClick={onClick} className={`${on ? 'chip-on' : 'chip'}`}>{children}</button>
);
const Dots = ({ list, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {list.map(([name, hex]) => <button key={name} title={name} onClick={() => onChange(hex)} style={{ background: hex || 'repeating-linear-gradient(45deg,#3f3f46 0 3px,#27272a 3px 6px)' }}
      className={`h-6 w-6 rounded-full border-2 ${value === hex ? 'border-indigo-400' : 'border-zinc-700'}`} />)}
  </div>
);

export default function FittedModal({ elements, onApply, onClose }) {
  const kitchens = elements.filter(e => e.type === 'room' && (e.kind === 'kitchen' || e.kind === 'utility'));
  const bedrooms = elements.filter(e => e.type === 'room' && ['master_bedroom', 'bedroom', 'closet', 'study'].includes(e.kind));
  const [tab, setTab] = useState(kitchens.length ? 'kitchen' : 'wardrobe');
  const [roomId, setRoomId] = useState((kitchens[0] || bedrooms[0])?.id);
  const [k, setK] = useState({ layout: 'L', cabinet: '#eeebe5', counter: '#202022', backsplash: 'mat_subway', fridge: true, tower: false, dishwasher: false });
  const [wd, setWd] = useState({ style: 'sliding', finish: '#5c3f2b', width: 'full', wall: 'auto' });
  const [done, setDone] = useState('');
  const list = tab === 'kitchen' ? kitchens : bedrooms;
  const room = list.find(r => r.id === roomId) || list[0];
  const result = useMemo(() => (room ? (tab === 'kitchen' ? layoutKitchen(elements, room, k) : layoutWardrobe(elements, room, wd)) : null), [elements, room, tab, k, wd]);
  const cost = result ? result.elements.filter(e => e.fitted && e.floor === (room.floor || 1) && !elements.includes(e)).reduce((s, e) => s + (catalogItem(e.type)?.price || 0), 0) : 0;
  const apply = () => {
    if (!result) return;
    onApply(result.elements);
    setDone(`${result.count} ${tab === 'kitchen' ? 'kitchen modules' : 'wardrobe sections'} in ${room.name}.`);
  };
  const setTabTo = (t) => { setTab(t); setRoomId((t === 'kitchen' ? kitchens[0] : bedrooms[0])?.id); setDone(''); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-[min(860px,100%)] flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex gap-1">
            <button onClick={() => setTabTo('kitchen')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${tab === 'kitchen' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400'}`}><ChefHat className="h-3.5 w-3.5" /> Kitchen</button>
            <button onClick={() => setTabTo('wardrobe')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${tab === 'wardrobe' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400'}`}><Shirt className="h-3.5 w-3.5" /> Wardrobes</button>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 label-caps">ROOM</p>
              <div className="flex flex-wrap gap-1">
                {list.map(r => <Chip key={r.id} on={room?.id === r.id} onClick={() => { setRoomId(r.id); setDone(''); }}>{r.name}</Chip>)}
                {!list.length && <p className="text-xs text-zinc-500">This plan has no {tab === 'kitchen' ? 'kitchen' : 'bedroom'} yet.</p>}
              </div>
            </div>
            {tab === 'kitchen' ? (
              <>
                <div>
                  <p className="mb-1.5 label-caps">LAYOUT</p>
                  <div className="grid grid-cols-3 gap-1.5">{KITCHEN_LAYOUTS.map(l => <Chip key={l.id} title={l.desc} on={k.layout === l.id} onClick={() => setK({ ...k, layout: l.id })}>{l.name}</Chip>)}</div>
                </div>
                <div><p className="mb-1.5 label-caps">CABINETS</p><Dots list={CABINET_FINISHES} value={k.cabinet} onChange={v => setK({ ...k, cabinet: v })} /></div>
                <div><p className="mb-1.5 label-caps">COUNTERTOP</p><Dots list={COUNTERTOPS} value={k.counter} onChange={v => setK({ ...k, counter: v })} /></div>
                <div>
                  <p className="mb-1.5 label-caps">BACKSPLASH</p>
                  <div className="grid grid-cols-4 gap-1.5">{BACKSPLASHES.map(([n, v]) => <Chip key={n} on={k.backsplash === v} onClick={() => setK({ ...k, backsplash: v })}>{n}</Chip>)}</div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
                  {[['fridge', 'Fridge'], ['tower', 'Oven & microwave tower'], ['dishwasher', 'Dishwasher']].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5"><input type="checkbox" className="accent-indigo-500" checked={k[key]} onChange={() => setK({ ...k, [key]: !k[key] })} /> {label}</label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div><p className="mb-1.5 label-caps">DOORS</p><div className="grid grid-cols-3 gap-1.5">{WARDROBE_STYLES.map(s => <Chip key={s.id} on={wd.style === s.id} onClick={() => setWd({ ...wd, style: s.id })}>{s.name}</Chip>)}</div></div>
                <div><p className="mb-1.5 label-caps">FINISH</p><Dots list={WARDROBE_FINISHES} value={wd.finish} onChange={v => setWd({ ...wd, finish: v })} /></div>
                <div>
                  <p className="mb-1.5 label-caps">WIDTH</p>
                  <div className="grid grid-cols-4 gap-1.5">{[['full', 'Whole wall'], ['1.8', '1.8 m'], ['2.4', '2.4 m'], ['3', '3 m']].map(([v, n]) => <Chip key={v} on={wd.width === v} onClick={() => setWd({ ...wd, width: v })}>{n}</Chip>)}</div>
                </div>
                <div>
                  <p className="mb-1.5 label-caps">WALL</p>
                  <div className="grid grid-cols-5 gap-1.5">{[['auto', 'Best'], ['N', 'Top'], ['S', 'Bottom'], ['W', 'Left'], ['E', 'Right']].map(([v, n]) => <Chip key={v} on={wd.wall === v} onClick={() => setWd({ ...wd, wall: v })}>{n}</Chip>)}</div>
                </div>
              </>
            )}
          </div>
          <div className="space-y-2">
            {room && <Preview elements={result?.elements || elements} room={room} />}
            {result?.why && <p className="text-[11px] text-amber-200">{result.why}</p>}
            <p className="text-[11px] text-zinc-400">{result?.count || 0} {tab === 'kitchen' ? 'modules' : 'sections'} · about {formatMoney(cost)}</p>
            <button onClick={apply} disabled={!result?.count} className="btn-primary w-full">
              Put it in {room?.name || 'the room'}
            </button>
            {done && <p className="flex items-start gap-1.5 text-[11px] text-emerald-300"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {done}</p>}
            <p className="text-[10px] leading-snug text-zinc-600">Laying out again replaces the earlier kitchen or wardrobes in that room. Wall cabinets and the chimney hang above the counter (not drawn in the preview).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

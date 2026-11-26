import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import SafeEnvironment from './SafeEnvironment';
import { Check, Home, X } from 'lucide-react';
import { Site, useSite, TIMES } from './ImmersiveView';
import {
  COMPOUND_FINISHES, DEFAULT_FACADE, EXTERIOR_PAINTS, FACADE_ACCENTS, GATES, GATE_COLOURS, RAILINGS, ROOF_COLOURS, applyFacade,
} from '../utils/facade';

/*
 * Front elevation: exterior paint, a cladding or colour round the entrance or across the front, roof tiles,
 * balcony railings, the gate, the compound wall and outdoor lights, previewed on the house's own street.
 */
const Chip = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`${on ? 'chip-on' : 'chip'}`}>{children}</button>
);
const Dots = ({ list, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {list.map(([name, hex]) => <button key={name} title={name} onClick={() => onChange(hex)} style={{ background: hex }} className={`h-6 w-6 rounded-full border-2 ${value === hex ? 'border-indigo-400' : 'border-zinc-700'}`} />)}
  </div>
);
const Label = ({ children }) => <p className="mb-1.5 label-caps">{children}</p>;

export default function FacadeModal({ elements, facade: start, onSave, onClose }) {
  const [f, setF] = useState(() => ({ ...DEFAULT_FACADE, ...(start || {}) }));
  const [time, setTime] = useState('evening');
  const [done, setDone] = useState(false);
  const set = (patch) => { setF(v => ({ ...v, ...patch })); setDone(false); };
  const preview = useMemo(() => applyFacade(elements, f), [elements, f]);
  const site = useSite(preview);
  const t = TIMES[time];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-[min(1100px,100%)] flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Home className="h-4 w-4 text-indigo-400" /> Front elevation</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_300px]">
          <div className="relative min-h-[360px] overflow-hidden rounded-xl bg-zinc-900">
            {site && (
              <Canvas shadows camera={{ position: [Math.max(6, site.W * 0.5), 4 + site.W * 0.06, site.D / 2 + 10 + Math.max(site.W, site.D) * 0.4], fov: 50, near: 0.3, far: 500 }}>
                <color attach="background" args={[t.fog]} />
                {t.day && <Sky sunPosition={t.sun} turbidity={6} rayleigh={time === 'evening' ? 2.4 : 1.2} mieCoefficient={0.006} mieDirectionalG={0.85} distance={450000} />}
                <hemisphereLight args={[t.day ? '#dfe9f2' : '#30406a', t.day ? '#5d6b45' : '#0d0f14', t.hemi]} />
                <directionalLight position={t.sun} intensity={t.light} color={t.sunColor} castShadow shadow-mapSize={[2048, 2048]}
                  shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={240} />
                <SafeEnvironment preset={t.day ? 'city' : 'night'} environmentIntensity={t.day ? 0.45 : 0.25} />
                <Site site={site} setting="street" time={time} elements={preview} roofStyle={f.roofStyle || 'pitched'} camX={999} facade={f} />
                <OrbitControls makeDefault target={[0, 2.5, 0]} maxPolarAngle={Math.PI / 2 - 0.06} minDistance={5} maxDistance={70} />
              </Canvas>
            )}
            <div className="absolute bottom-3 left-3 flex gap-1 rounded-lg bg-black/60 p-1 backdrop-blur">
              {['morning', 'noon', 'evening', 'night'].map(k => (
                <button key={k} onClick={() => setTime(k)} className={`rounded-md px-2 py-1 text-[11px] capitalize ${time === k ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300'}`}>{k}</button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div><Label>EXTERIOR PAINT</Label><Dots list={EXTERIOR_PAINTS} value={f.paint} onChange={v => set({ paint: v })} /></div>
            <div>
              <Label>FRONT ACCENT</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {FACADE_ACCENTS.map(([n, m, c]) => <Chip key={n} on={(f.accent?.material || null) === m} onClick={() => set({ accent: { ...f.accent, material: m, isColor: c, where: m ? (f.accent?.where === 'none' ? 'entrance' : f.accent?.where || 'entrance') : 'none' } })}>{n}</Chip>)}
              </div>
              {f.accent?.material && (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Chip on={f.accent.where === 'entrance'} onClick={() => set({ accent: { ...f.accent, where: 'entrance' } })}>Round the entrance</Chip>
                  <Chip on={f.accent.where === 'front'} onClick={() => set({ accent: { ...f.accent, where: 'front' } })}>The whole front</Chip>
                </div>
              )}
            </div>
            <div>
              <Label>ROOF</Label>
              <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                <Chip on={(f.roofStyle || 'pitched') === 'pitched'} onClick={() => set({ roofStyle: 'pitched' })}>Pitched, tiled</Chip>
                <Chip on={f.roofStyle === 'flat'} onClick={() => set({ roofStyle: 'flat' })}>Flat, with parapet</Chip>
              </div>
              {(f.roofStyle || 'pitched') === 'pitched'
                ? <Dots list={ROOF_COLOURS} value={f.roof} onChange={v => set({ roof: v })} />
                : <Dots list={EXTERIOR_PAINTS} value={f.parapet} onChange={v => set({ parapet: v })} />}
            </div>
            <div><Label>BALCONY RAILINGS</Label><div className="grid grid-cols-3 gap-1.5">{RAILINGS.map(([id, n]) => <Chip key={id} on={f.railing === id} onClick={() => set({ railing: id })}>{n}</Chip>)}</div></div>
            <div>
              <Label>GATE</Label>
              <div className="mb-1.5 grid grid-cols-2 gap-1.5">{GATES.map(([id, n]) => <Chip key={id} on={f.gate === id} onClick={() => set({ gate: id })}>{n}</Chip>)}</div>
              <Dots list={GATE_COLOURS} value={f.gateColor} onChange={v => set({ gateColor: v })} />
            </div>
            <div>
              <Label>COMPOUND WALL</Label>
              <div className="mb-1.5 grid grid-cols-3 gap-1.5">{COMPOUND_FINISHES.map(([id, n]) => <Chip key={id} on={f.compound.finish === id} onClick={() => set({ compound: { ...f.compound, finish: id } })}>{n}</Chip>)}</div>
              <div className="mb-1.5 grid grid-cols-3 gap-1.5">{[[1.2, '1.2 m'], [1.5, '1.5 m'], [1.8, '1.8 m']].map(([h, n]) => <Chip key={h} on={f.compound.height === h} onClick={() => set({ compound: { ...f.compound, height: h } })}>{n}</Chip>)}</div>
              {f.compound.finish === 'plaster' && <Dots list={EXTERIOR_PAINTS} value={f.compound.color} onChange={v => set({ compound: { ...f.compound, color: v } })} />}
            </div>
            <div>
              <Label>OUTDOOR LIGHTS</Label>
              <div className="space-y-1 text-xs text-zinc-300">
                {[['sconces', 'Wall lights by the door'], ['bollards', 'Bollards along the path'], ['uplights', 'Uplights on the front']].map(([k, n]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-indigo-500" checked={!!f.lights?.[k]} onChange={() => set({ lights: { ...f.lights, [k]: !f.lights?.[k] } })} /> {n}</label>
                ))}
              </div>
            </div>
            <button onClick={() => { onSave(f); setDone(true); }} className="btn-primary w-full">Use this front</button>
            {done && <p className="flex items-center gap-1.5 text-[11px] text-emerald-300"><Check className="h-3 w-3" /> Saved. It shows in 3D, the Immersive View, photos, the video and AR.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

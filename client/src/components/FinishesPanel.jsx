import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Check, Eye, Paintbrush, Lamp, Pipette, Grid3x3, AppWindow } from 'lucide-react';
import { WINDOW_FRAMES, WINDOW_TREATMENTS } from './Canvas3D';
import InfoTip from './InfoTip';
import { ARCHITECTURAL_TEXTURES, WOOD_FINISHES, PAINT_COLOURS, PLAIN_WALL, WALLPAPERS, CLADDING } from '../utils/textureLibrary';
import { FLOOR_FINISHES, floorSwatch } from '../utils/floorFinishes';
import { formatMoney } from '../utils/units';
import { CEILING_STYLES, LIGHT_TYPES, CEILING_COLOURS, RoomCeiling, RoomLight } from './Ceilings';

/*
 * The 3D view's finishes panel.
 *   Walls     paint colours (or any colour), wood plank finishes, stone, tile and plaster; click walls to
 *             apply, or apply to every wall, or to the walls of one room (an accent room)
 *   Ceilings  per room: a ceiling design, a light fitting and a ceiling colour, with a live preview
 */
const KIND_NAME = { living: 'Living', dining: 'Dining', kitchen: 'Kitchen', master_bedroom: 'Master', bedroom: 'Bedroom', bathroom: 'Bath', study: 'Study', lounge: 'Lounge', closet: 'Closet', utility: 'Utility', hallway: 'Hallway' };

/** A small room seen from below, lit, to preview a ceiling and its light. */
function CeilingPreview({ style, light, color }) {
  const rect = { x: -2, z: -1.6, w: 4, d: 3.2 };
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.9, 2.6], fov: 62, near: 0.05, far: 50 }} onCreated={({ camera }) => camera.lookAt(0, 2.6, -0.6)}>
      <color attach="background" args={['#14110f']} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#fff', '#6b5a48', 0.25]} />
      {/* walls and floor of the little room */}
      <mesh position={[0, 1.5, -1.6]}><boxGeometry args={[4, 3, 0.05]} /><meshStandardMaterial color="#e9e4db" /></mesh>
      <mesh position={[-2, 1.5, 0]}><boxGeometry args={[0.05, 3, 3.2]} /><meshStandardMaterial color="#e4dfd6" /></mesh>
      <mesh position={[2, 1.5, 0]}><boxGeometry args={[0.05, 3, 3.2]} /><meshStandardMaterial color="#e4dfd6" /></mesh>
      <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[4, 3.2]} /><meshStandardMaterial color="#b98a5b" /></mesh>
      <RoomCeiling rect={rect} style={style} color={color} top={3} day={false} />
      <RoomLight rect={rect} light={light} style={style} top={3} day={false} />
    </Canvas>
  );
}

function Swatch({ active, onClick, title, children, style }) {
  return (
    <button type="button" title={title} onClick={onClick} style={style}
      className={`relative overflow-hidden rounded-lg border-2 transition-all ${active ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-zinc-800 hover:border-zinc-500'}`}>
      {children}
    </button>
  );
}

const FABRICS = [['Linen', '#e9e2d4'], ['Ivory', '#f3eee2'], ['Sand', '#d8c4a2'], ['Grey', '#9ea0a3'], ['Charcoal', '#3f3f42'], ['Sage', '#a8b79c'], ['Navy', '#2a3b57'], ['Rust', '#9a4a2a'], ['Mustard', '#c9962e'], ['Blush', '#e3bdb8']];

function WindowsTab({ rooms, onSetWindows }) {
  const [picked, setPicked] = useState([]);
  const [frame, setFrame] = useState('black');
  const [treatment, setTreatment] = useState('curtains');
  const [fabric, setFabric] = useState('#e9e2d4');
  const [done, setDone] = useState('');
  const apply = () => {
    if (!picked.length) { setDone('Pick the rooms first.'); return; }
    const n = onSetWindows(picked, { frame, treatment, fabric });
    setDone(`${n} window${n === 1 ? '' : 's'} updated.`);
  };
  return (
    <div className="custom-scrollbar space-y-3 overflow-y-auto p-3">
      <div>
        <p className="mb-1.5 flex items-center justify-between label-caps">
          ROOMS <button onClick={() => setPicked(picked.length === rooms.length ? [] : rooms.map(r => r.id))} className="font-sans text-[10px] normal-case tracking-normal text-indigo-300">{picked.length === rooms.length ? 'None' : 'All'}</button>
        </p>
        <div className="flex flex-wrap gap-1">
          {rooms.map(r => (
            <button key={r.id} onClick={() => setPicked(p => (p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id]))}
              className={`rounded-full px-2 py-0.5 text-[10px] ${picked.includes(r.id) ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>{r.name || r.kind}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 label-caps">FRAMES</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(WINDOW_FRAMES).map(([id, f]) => (
            <button key={id} onClick={() => setFrame(id)} className={`flex items-center gap-2 ${frame === id ? 'chip-on' : 'chip'}`}>
              <span className="h-3.5 w-3.5 rounded-sm border border-zinc-600" style={{ background: f.color }} /> {f.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 label-caps">CURTAINS & BLINDS</p>
        <div className="grid grid-cols-2 gap-1.5">
          {WINDOW_TREATMENTS.map(t => (
            <button key={t.id} onClick={() => setTreatment(t.id)} className={`${treatment === t.id ? 'chip-on' : 'chip'}`}>{t.name}</button>
          ))}
        </div>
      </div>
      {treatment !== 'none' && (
        <div>
          <p className="mb-1.5 label-caps">FABRIC</p>
          <div className="flex flex-wrap gap-1.5">
            {FABRICS.map(([name, hex]) => (
              <button key={hex} title={name} onClick={() => setFabric(hex)} style={{ background: hex }} className={`h-6 w-6 rounded-full border-2 ${fabric === hex ? 'border-indigo-400' : 'border-zinc-700'}`} />
            ))}
          </div>
        </div>
      )}
      <button onClick={apply} className="btn-primary w-full py-2 text-xs">Apply to the windows of {picked.length || 'the picked'} room{picked.length === 1 ? '' : 's'}</button>
      {done && <p className="flex items-start gap-1.5 text-[11px] text-emerald-300"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {done}</p>}
    </div>
  );
}

function FloorsTab({ rooms, onSetFlooring }) {
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState('');
  const groups = [...new Set(FLOOR_FINISHES.map(f => f.group))];
  const apply = (f) => {
    const ids = picked.length ? picked : [];
    if (!ids.length) { setDone('Pick the rooms first.'); return; }
    onSetFlooring(ids, f ? f.id : null);
    setDone(`${f ? f.name : 'The standard floor'} in ${ids.length} room${ids.length > 1 ? 's' : ''}.`);
  };
  return (
    <div className="custom-scrollbar space-y-3 overflow-y-auto p-3">
      <div>
        <p className="mb-1.5 flex items-center justify-between label-caps">
          ROOMS <button onClick={() => setPicked(picked.length === rooms.length ? [] : rooms.map(r => r.id))} className="font-sans text-[10px] normal-case tracking-normal text-indigo-300">{picked.length === rooms.length ? 'None' : 'All'}</button>
        </p>
        <div className="flex flex-wrap gap-1">
          {rooms.map(r => (
            <button key={r.id} onClick={() => setPicked(p => (p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id]))}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${picked.includes(r.id) ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
              {r.flooring && <img src={floorSwatch(r.flooring)} alt="" className="h-2.5 w-2.5 rounded-full" />}
              {r.name || r.kind}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-500">{picked.length ? 'Now click a floor to lay it.' : 'Pick rooms, then click a floor.'}</p>
      </div>
      {done && <p className="flex items-start gap-1.5 text-[11px] text-emerald-300"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {done}</p>}
      {groups.map(g => (
        <div key={g}>
          <p className="mb-1.5 label-caps">{g.toUpperCase()}</p>
          <div className="grid grid-cols-3 gap-2">
            {FLOOR_FINISHES.filter(f => f.group === g).map(f => (
              <Swatch key={f.id} title={`${f.name} · ${formatMoney(f.price)}/m²`} onClick={() => apply(f)} style={{ background: f.color }}>
                <img src={floorSwatch(f.id)} alt="" className="pointer-events-none aspect-square w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-center text-[9px] text-white">{f.name}</span>
              </Swatch>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => apply(null)} className="btn-secondary w-full py-1.5 text-[11px]">Back to the standard floor</button>
    </div>
  );
}

export default function FinishesPanel({ elements, floor, brush, setBrush, onPaintAll, onPaintRoom, onSetCeiling, onSetFlooring, onSetWindows, onWalk, roofOff }) {
  const [tab, setTab] = useState('walls');
  const [custom, setCustom] = useState('#8fa3b8');
  const rooms = useMemo(() => elements.filter(e => e.type === 'room' && (e.floor || 1) === floor && !['balcony', 'patio', 'terrace', 'deck'].includes(e.kind)), [elements, floor]);
  const [picked, setPicked] = useState([]);
  const chosen = rooms.filter(r => picked.includes(r.id));
  const first = chosen[0];
  const [style, setStyle] = useState('cove');
  const [light, setLight] = useState('chandelier');
  const [color, setColor] = useState('#f3f1ed');
  const [applied, setApplied] = useState('');
  const [accentRoom, setAccentRoom] = useState('');

  const pickRoom = (r) => {
    setPicked(p => (p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id]));
    if (r.ceiling && !picked.length) { setStyle(r.ceiling.style || 'plain'); setLight(r.ceiling.light || 'flush'); setColor(r.ceiling.color || '#f3f1ed'); }
  };
  const apply = () => {
    if (!chosen.length) return;
    onSetCeiling(chosen.map(r => r.id), { style, light, color });
    setApplied(`${CEILING_STYLES.find(s => s.id === style)?.name} with ${LIGHT_TYPES.find(l => l.id === light)?.name.toLowerCase()} on ${chosen.length} room${chosen.length > 1 ? 's' : ''}`);
  };
  const brushName = brush ? brush.name : null;

  return (
    <div className="absolute top-24 right-[var(--dock)] z-20 flex max-h-[calc(100%-8rem)] w-80 flex-col rounded-2xl border border-zinc-800 bg-zinc-950/92 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-1 border-b border-zinc-800 p-2">
        <button onClick={() => setTab('walls')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs ${tab === 'walls' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
          <Paintbrush className="h-3.5 w-3.5" /> Walls
        </button>
        <button onClick={() => { setTab('floors'); setBrush(null); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs ${tab === 'floors' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
          <Grid3x3 className="h-3.5 w-3.5" /> Floors
        </button>
        <button onClick={() => { setTab('windows'); setBrush(null); }} title="Windows: frames, curtains and blinds" className={`flex items-center justify-center rounded-lg px-2 py-1.5 text-xs ${tab === 'windows' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
          <AppWindow className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setTab('ceilings'); setBrush(null); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs ${tab === 'ceilings' ? 'bg-zinc-100 font-semibold text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
          <Lamp className="h-3.5 w-3.5" /> Ceilings
        </button>
        <InfoTip id="painter" align="right" />
      </div>

      {tab === 'windows' ? <WindowsTab rooms={rooms} onSetWindows={onSetWindows} /> : tab === 'floors' ? <FloorsTab rooms={rooms} onSetFlooring={onSetFlooring} /> : tab === 'walls' ? (
        <>
          <div className="border-b border-zinc-800 p-3">
            <p className="text-[11px] text-zinc-400">
              {brushName ? <>Painting with <span className="text-white">{brushName}</span>. Click walls in the model to apply.</> : 'Pick a paint or finish, then click walls to apply it.'}
            </p>
            {brush && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1.5">
                  <button onClick={onPaintAll} className="btn-primary flex-1 py-1.5 text-[11px]">Every wall</button>
                  <button onClick={() => setBrush(null)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-700">Done</button>
                </div>
                <div className="flex gap-1.5">
                  <select value={accentRoom} onChange={(e) => setAccentRoom(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none">
                    <option value="">Walls of one room…</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button disabled={!accentRoom} onClick={() => onPaintRoom(accentRoom)} className="btn-secondary px-3 py-1.5 text-[11px]">Apply</button>
                </div>
              </div>
            )}
          </div>
          <div className="custom-scrollbar space-y-4 overflow-y-auto p-3">
            {PAINT_COLOURS.map(g => (
              <div key={g.group}>
                <p className="mb-1.5 label-caps">{g.group.toUpperCase()}</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {g.colours.map(([name, hex]) => (
                    <Swatch key={hex} title={name} active={brush?.id === `paint_${hex}`} onClick={() => setBrush(brush?.id === `paint_${hex}` ? null : { id: `paint_${hex}`, name, color: hex })}
                      style={{ background: hex }}>
                      <span className="block aspect-square" />
                    </Swatch>
                  ))}
                </div>
              </div>
            ))}
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-300">
              <Pipette className="h-3.5 w-3.5 text-zinc-500" /> Any colour
              <input type="color" value={custom} onChange={(e) => { setCustom(e.target.value); setBrush({ id: 'paint_custom', name: e.target.value, color: e.target.value }); }}
                className="ml-auto h-6 w-10 cursor-pointer rounded border-0 bg-transparent" />
            </label>

            <div>
              <p className="mb-1.5 label-caps">WOOD PANELLING</p>
              <div className="grid grid-cols-3 gap-2">
                {WOOD_FINISHES.map(m => (
                  <Swatch key={m.id} title={`${m.name} · ${m.tag}`} active={brush?.id === m.id} onClick={() => setBrush(brush?.id === m.id ? null : m)} style={{ background: m.color }}>
                    <img src={m.url} alt="" className="pointer-events-none aspect-square w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-center text-[9px] text-white">{m.name}</span>
                  </Swatch>
                ))}
              </div>
            </div>

            {[['WALLPAPER', WALLPAPERS], ['STONE CLADDING', CLADDING]].map(([title, list]) => (
              <div key={title}>
                <p className="mb-1.5 label-caps">{title}</p>
                <div className="grid grid-cols-3 gap-2">
                  {list.map(m => (
                    <Swatch key={m.id} title={m.name} active={brush?.id === m.id} onClick={() => setBrush(brush?.id === m.id ? null : m)} style={{ background: m.color }}>
                      <img src={m.url} alt="" className="pointer-events-none aspect-square w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-center text-[9px] text-white">{m.name}</span>
                    </Swatch>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="mb-1.5 label-caps">STONE, TILE & PLASTER</p>
              <div className="grid grid-cols-3 gap-2">
                {[PLAIN_WALL, ...ARCHITECTURAL_TEXTURES].map(m => (
                  <Swatch key={m.id} title={m.name} active={brush?.id === m.id} onClick={() => setBrush(brush?.id === m.id ? null : m)} style={{ background: m.color || '#333' }}>
                    {m.url ? <img src={m.url} alt="" className="pointer-events-none aspect-square w-full object-cover" /> : <span className="block aspect-square" />}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-center text-[9px] text-white">{m.name}</span>
                  </Swatch>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="custom-scrollbar space-y-3 overflow-y-auto p-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-zinc-800">
            <CeilingPreview style={style} light={light} color={color} />
          </div>

          <div>
            <p className="mb-1.5 flex items-center justify-between label-caps">
              ROOMS <button onClick={() => setPicked(picked.length === rooms.length ? [] : rooms.map(r => r.id))} className="font-sans text-[10px] normal-case tracking-normal text-indigo-300 hover:text-indigo-200">{picked.length === rooms.length ? 'None' : 'All'}</button>
            </p>
            <div className="flex flex-wrap gap-1">
              {rooms.map(r => (
                <button key={r.id} onClick={() => pickRoom(r)} title={r.ceiling ? `${CEILING_STYLES.find(s => s.id === r.ceiling.style)?.name}, ${LIGHT_TYPES.find(l => l.id === r.ceiling.light)?.name}` : 'Plain ceiling, flush light'}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${picked.includes(r.id) ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                  {r.ceiling && r.ceiling.style !== 'plain' && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  {r.name || KIND_NAME[r.kind] || r.kind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 label-caps">CEILING</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CEILING_STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)} title={s.desc}
                  className={`${style === s.id ? 'chip-on' : 'chip'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 label-caps">LIGHT</p>
            <div className="grid grid-cols-2 gap-1.5">
              {LIGHT_TYPES.map(l => (
                <button key={l.id} onClick={() => setLight(l.id)} title={l.desc}
                  className={`${light === l.id ? 'chip-on' : 'chip'}`}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 label-caps">CEILING COLOUR</p>
            <div className="flex gap-1.5">
              {CEILING_COLOURS.map(([name, hex]) => (
                <button key={hex} title={name} onClick={() => setColor(hex)} style={{ background: hex }}
                  className={`h-6 w-6 rounded-full border-2 ${color === hex ? 'border-indigo-400' : 'border-zinc-700'}`} />
              ))}
            </div>
          </div>

          <button onClick={apply} disabled={!chosen.length}
            className="btn-primary w-full py-2 text-xs">
            {chosen.length ? `Apply to ${chosen.length === 1 ? first.name : `${chosen.length} rooms`}` : 'Pick rooms above to apply'}
          </button>
          {applied && <p className="flex items-start gap-1.5 text-[11px] text-emerald-300"><Check className="mt-0.5 h-3 w-3 shrink-0" /> {applied}.</p>}
          <button onClick={onWalk} className="btn-secondary w-full gap-1.5 py-1.5 text-[11px]">
            <Eye className="h-3.5 w-3.5" /> {roofOff ? 'Put the roof on and walk through' : 'Walk through to see it'}
          </button>
          <p className="text-[10px] leading-snug text-zinc-600">Ceilings show from inside: in the walkthrough, in Photo Render captures and the video tour. Costs are added to the takeoff.</p>
        </div>
      )}
    </div>
  );
}

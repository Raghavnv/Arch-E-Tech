import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { X, Play, Pause, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Canvas3D from './Canvas3D';
import Mark from './Mark';
import { formatArea, formatSize, currencySymbol, currencyCode, CURRENCY } from '../utils/units';
import { computeCosts } from '../utils/costs';

/*
 * Overview: a full-screen presentation of a finished house that plays on its own: the title card,
 * every floor plan drawn in, the 3D model turning, a tour of the rooms, the photo renders and the
 * cost takeoff. Arrow keys / space / Esc work; the bar at the top shows where you are.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PX = 20;   // canvas units per metre
const KIND_LABEL = {
  living: 'Living room', lounge: 'Lounge', dining: 'Dining room', kitchen: 'Kitchen', master_bedroom: 'Master bedroom',
  bedroom: 'Bedroom', bathroom: 'Bathroom', study: 'Study', utility: 'Utility', balcony: 'Balcony', patio: 'Patio',
};
const OPEN = new Set(['living', 'dining', 'lounge']);
const floorName = (f) => (f === 1 ? 'Ground floor' : `Floor ${f}`);
const money = (v) => `${currencySymbol()}${Math.round(v).toLocaleString(CURRENCY[currencyCode()].locale)}`;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------------------------------------
// A floor plan drawn as linework, walls drawing themselves in
// ---------------------------------------------------------------------------------------------
function lineOf(e) {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return [e.left, e.top, e.left + e.width * Math.cos(a), e.top + e.width * Math.sin(a)];
}

function PlanDrawing({ elements, highlight = null, animate = true, labels = true }) {
  const rooms = elements.filter(e => e.type === 'room');
  if (!rooms.length) return null;
  const x0 = Math.min(...rooms.map(r => r.left)), y0 = Math.min(...rooms.map(r => r.top - r.height / 2));
  const x1 = Math.max(...rooms.map(r => r.left + r.width)), y1 = Math.max(...rooms.map(r => r.top + r.height / 2));
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const walls = elements.filter(e => e.type === 'wall');
  const sw = Math.max(x1 - x0, y1 - y0) / 150;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {rooms.map((r, i) => (
        <rect key={`r${i}`} x={r.left} y={r.top - r.height / 2} width={r.width} height={r.height}
          fill={highlight === r.id ? 'rgba(200,121,74,0.32)' : OPEN.has(r.kind) ? 'rgba(200,121,74,0.08)' : 'rgba(231,226,217,0.035)'}
          style={{ transition: 'fill .6s ease' }} />
      ))}
      {walls.map((w, i) => {
        const [ax, ay, bx, by] = lineOf(w);
        return <line key={`w${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#e7e2d9" strokeWidth={sw * 1.6} strokeLinecap="square"
          pathLength="1" className={animate ? 'draw-in' : ''} style={animate ? { animationDelay: `${(i % 24) * 0.05}s` } : undefined} />;
      })}
      {elements.filter(e => e.type === 'door' || e.type === 'window').map((o, i) => {
        const [ax, ay, bx, by] = lineOf(o);
        return <line key={`o${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={o.type === 'door' ? '#c8794a' : '#9fb7c4'} strokeWidth={sw * 1.9} />;
      })}
      {elements.filter(e => e.type === 'railing').map((o, i) => {
        const [ax, ay, bx, by] = lineOf(o);
        return <line key={`g${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#c8794a" strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 1.5}`} />;
      })}
      {elements.filter(e => e.type === 'stairs').map((st, i) => {
        const [ax, ay, bx, by] = lineOf(st);
        const vertical = Math.abs(ax - bx) < 1;
        const w = st.height;
        const box = vertical ? [ax - w / 2, ay, w, by - ay] : [ax, ay - w / 2, bx - ax, w];
        return (
          <g key={`s${i}`}>
            <rect x={box[0]} y={box[1]} width={Math.abs(box[2])} height={Math.abs(box[3])} fill="none" stroke="#a8a29a" strokeWidth={sw * 0.8} />
            {Array.from({ length: 8 }).map((_, k) => vertical
              ? <line key={k} x1={box[0]} x2={box[0] + w} y1={ay + (k + 1) * (by - ay) / 9} y2={ay + (k + 1) * (by - ay) / 9} stroke="#7b746b" strokeWidth={sw * 0.5} />
              : <line key={k} y1={box[1]} y2={box[1] + w} x1={ax + (k + 1) * (bx - ax) / 9} x2={ax + (k + 1) * (bx - ax) / 9} stroke="#7b746b" strokeWidth={sw * 0.5} />)}
          </g>
        );
      })}
      {labels && rooms.map((r, i) => {
        // each label fits its own room: long names in small rooms get smaller type
        const fs = Math.min(sw * 6, (r.width * 0.86) / Math.max(4, (r.name || '').length * 0.56), r.height * 0.22);
        return (
          <g key={`t${i}`} className="rise-in" style={{ animationDelay: animate ? '1.3s' : '0s' }} textAnchor="middle">
            <text x={r.left + r.width / 2} y={r.top - fs * 0.25} fontSize={fs} fill="#f3f1ed" fontFamily="Inter, sans-serif" fontWeight="500">{r.name}</text>
            <text x={r.left + r.width / 2} y={r.top + fs * 1.05} fontSize={fs * 0.78} fill="#a8a29a" fontFamily="'JetBrains Mono', monospace">{formatArea(r.area, { short: true })}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------------------------
function SheetLabel({ sheet, title }) {
  return (
    <div className="rise-in">
      <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-500">{sheet}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-zinc-100 sm:text-4xl">{title}</h2>
    </div>
  );
}

function IntroSlide({ project, stats }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="rise-in"><Mark className="h-12 w-12" /></div>
      <p className="rise-in mt-8 font-mono text-[11px] tracking-[0.3em] text-zinc-500" style={{ animationDelay: '.1s' }}>PROJECT OVERVIEW</p>
      <h1 className="rise-in mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-zinc-100 sm:text-7xl" style={{ animationDelay: '.2s' }}>{project.name || 'Untitled home'}</h1>
      <dl className="rise-in mt-12 grid grid-cols-2 border border-zinc-800 sm:grid-cols-4" style={{ animationDelay: '.45s' }}>
        {stats.map(([k, v], i) => (
          <div key={k} className={`px-6 py-4 text-left ${i ? 'border-l' : ''} ${i === 2 ? 'border-l-0 border-t sm:border-l sm:border-t-0' : ''} ${i === 3 ? 'border-t sm:border-t-0' : ''} border-zinc-800`}>
            <dt className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">{k}</dt>
            <dd className="mt-1 text-lg text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PlanSlide({ floor, elements, floors }) {
  const rooms = elements.filter(e => e.type === 'room');
  const area = rooms.reduce((s, r) => s + (r.area || 0), 0);
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      <div className="flex items-end justify-between">
        <SheetLabel sheet={`A-10${floor} · FLOOR PLAN`} title={floors > 1 ? floorName(floor) : 'Floor plan'} />
        <p className="rise-in font-mono text-xs text-zinc-400" style={{ animationDelay: '.3s' }}>{rooms.length} rooms · {formatArea(area)}</p>
      </div>
      <div className="min-h-0 border border-zinc-800 bg-[#121110] p-6"><PlanDrawing elements={elements} /></div>
    </div>
  );
}

function ModelSlide({ elements, t }) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      <div className="flex items-end justify-between">
        <SheetLabel sheet="A-201 · 3D MODEL" title="The house in three dimensions" />
        <p className="rise-in font-mono text-xs text-zinc-400" style={{ animationDelay: '.3s' }}>{t < 0.5 ? 'Without the roof' : 'With the roof on'}</p>
      </div>
      <div className="relative min-h-0 overflow-hidden border border-zinc-800">
        <Canvas3D elements={elements} timeOfDay={t < 0.5 ? 15 : 18.5} roofStyle={t < 0.5 ? 'none' : 'pitched'} autoRotate />
      </div>
    </div>
  );
}

function RoomsSlide({ elements, rooms, renders, t }) {
  const i = Math.min(rooms.length - 1, Math.floor(t * rooms.length));
  const room = rooms[i];
  const floorEls = elements.filter(e => (e.floor || 1) === (room.floor || 1));
  const shot = renders[room.id];
  const windows = elements.filter(e => e.type === 'window' && (e.floor || 1) === (room.floor || 1)
    && e.left >= room.left - 8 && e.left <= room.left + room.width + 8 && e.top >= room.top - room.height / 2 - 8 && e.top <= room.top + room.height / 2 + 8).length;
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      <div className="flex items-end justify-between">
        <SheetLabel sheet="A-300 · ROOMS" title="Room by room" />
        <p className="font-mono text-xs text-zinc-400">{String(i + 1).padStart(2, '0')} / {String(rooms.length).padStart(2, '0')}</p>
      </div>
      <div className="grid min-h-0 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-h-0 border border-zinc-800 bg-[#121110] p-6"><PlanDrawing elements={floorEls} highlight={room.id} animate={false} /></div>
        <div key={room.id} className="flex min-h-0 flex-col justify-center gap-5">
          <div className="rise-in">
            <p className="font-mono text-[11px] tracking-[0.25em] text-indigo-300">{(KIND_LABEL[room.kind] || room.kind).toUpperCase()} · {floorName(room.floor || 1).toUpperCase()}</p>
            <h3 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-zinc-100">{room.name}</h3>
          </div>
          <dl className="rise-in grid grid-cols-3 border border-zinc-800" style={{ animationDelay: '.1s' }}>
            {[['AREA', formatArea(room.area)], ['SIZE', formatSize(room.width / PX, room.height / PX)], ['WINDOWS', String(windows)]].map(([k, v], j) => (
              <div key={k} className={`px-4 py-3 ${j ? 'border-l border-zinc-800' : ''}`}>
                <dt className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">{k}</dt>
                <dd className="mt-1 text-sm text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
          {(shot?.furnished_image || shot?.empty_image) && (
            <img src={shot.furnished_image || shot.empty_image} alt={room.name} className="rise-in aspect-[4/3] w-full border border-zinc-800 object-cover" style={{ animationDelay: '.2s' }} />
          )}
        </div>
      </div>
    </div>
  );
}

function RendersSlide({ shots, t }) {
  const i = Math.min(shots.length - 1, Math.floor(t * shots.length));
  const shot = shots[i];
  const local = (t * shots.length) % 1;                      // within this room: empty, then furnished
  const showFurnished = shot.furnished_image && (!shot.empty_image || local > 0.45);
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      <div className="flex items-end justify-between">
        <SheetLabel sheet="A-301 · PHOTO RENDER" title={shot.room_name || 'Renders'} />
        <p className="font-mono text-xs text-zinc-400">{showFurnished ? 'FURNISHED' : 'EMPTY ROOM'} · {String(i + 1).padStart(2, '0')} / {String(shots.length).padStart(2, '0')}</p>
      </div>
      <div className="relative min-h-0 overflow-hidden border border-zinc-800 bg-[#121110]">
        {shot.empty_image && <img src={shot.empty_image} alt="" className="absolute inset-0 h-full w-full object-contain" />}
        {shot.furnished_image && (
          <img src={shot.furnished_image} alt={shot.room_name} className="absolute inset-0 h-full w-full object-contain transition-opacity duration-[1400ms] ease-in-out" style={{ opacity: showFurnished ? 1 : 0 }} />
        )}
      </div>
    </div>
  );
}

function CostSlide({ costs, area, t }) {
  const k = ease(Math.min(1, t * 1.6));
  const max = Math.max(1, ...costs.breakdown.map(b => b.cost));
  const sqft = area * 10.7639;
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      <SheetLabel sheet="A-401 · COST TAKEOFF" title="What it could cost to build" />
      <div className="grid min-h-0 gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col justify-center">
          <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-500">ESTIMATED TOTAL</p>
          <p className="mt-3 text-5xl font-semibold tabular-nums tracking-[-0.03em] text-zinc-100 sm:text-6xl [text-shadow:0_0_40px_rgba(200,121,74,0.25)]">{money(costs.total * k)}</p>
          {sqft > 0 && <p className="mt-3 font-mono text-sm text-zinc-400">≈ {money(costs.total / sqft)} per sq ft over {formatArea(area)}</p>}
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-zinc-500">A first estimate from wall lengths, openings and fittings in the plan; local rates and finishes will move it.</p>
        </div>
        <ul className="flex min-h-0 flex-col justify-center gap-3 overflow-hidden">
          {costs.breakdown.map((b, i) => (
            <li key={b.key} className="grid grid-cols-[140px_1fr_110px] items-center gap-4 text-sm">
              <span className="truncate text-zinc-300">{b.label} <span className="font-mono text-[11px] text-zinc-500">{b.qty}</span></span>
              <span className="h-2 overflow-hidden rounded-full bg-zinc-900">
                <span className="block h-full rounded-full bg-indigo-500/80 shadow-[0_0_12px_rgba(200,121,74,0.45)]"
                  style={{ width: `${(b.cost / max) * 100 * ease(Math.min(1, Math.max(0, t * 1.8 - i * 0.06)))}%` }} />
              </span>
              <span className="text-right font-mono tabular-nums text-zinc-200">{money(b.cost * k)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OutroSlide({ project, projectId }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="rise-in font-mono text-[11px] tracking-[0.3em] text-zinc-500">END OF OVERVIEW</p>
      <h2 className="rise-in mt-4 text-4xl font-semibold tracking-[-0.03em] text-zinc-100 sm:text-6xl" style={{ animationDelay: '.1s' }}>{project.name || 'Your home'}</h2>
      <div className="rise-in mt-10 flex flex-wrap justify-center gap-3" style={{ animationDelay: '.25s' }}>
        <Link to={`/studio?projectId=${projectId}`} className="rounded-sm bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-white">Back to the Studio</Link>
        <Link to={`/render-studio?projectId=${projectId}`} className="rounded-sm border border-zinc-700 px-5 py-3 text-sm text-zinc-200 hover:bg-zinc-900">Open Photo Render</Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export default function Overview() {
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [renders, setRenders] = useState([]);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      fetch(`${API_URL}/api/projects/${projectId}`, { headers }).then(r => {
        if (r.status === 401) { navigate('/auth'); throw new Error('Please sign in again.'); }
        if (!r.ok) throw new Error("This project couldn't be loaded.");
        return r.json();
      }),
      fetch(`${API_URL}/api/projects/${projectId}/renders`, { headers }).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([p, list]) => { setProject(p); setRenders(list); }).catch(e => setError(e.message));
  }, [projectId, navigate]);

  const elements = useMemo(() => (project?.elements_data || []).filter(e => e && typeof e === 'object' && typeof e.type === 'string'), [project]);
  const floors = useMemo(() => [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b), [elements]);
  const rooms = useMemo(() => elements.filter(e => e.type === 'room')
    .sort((a, b) => (a.floor || 1) - (b.floor || 1) || (OPEN.has(b.kind) - OPEN.has(a.kind))), [elements]);
  const renderByRoom = useMemo(() => Object.fromEntries(renders.map(r => [r.room_key, r])), [renders]);
  const shots = useMemo(() => {
    const names = Object.fromEntries(rooms.map(r => [r.id, r.name]));
    return renders.filter(r => !r.room_key.startsWith('__') && (r.furnished_image || r.empty_image))
      .map(r => ({ ...r, room_name: names[r.room_key] || r.room_name }));
  }, [renders, rooms]);
  const costs = useMemo(() => computeCosts(elements), [elements]);
  const area = rooms.reduce((s, r) => s + (r.area || 0), 0);

  // the running order, with how long each slide stays up
  const slides = useMemo(() => {
    if (!project) return [];
    const list = [{ id: 'intro', ms: 5000 }];
    floors.forEach(f => list.push({ id: `plan-${f}`, floor: f, ms: 6500 }));
    list.push({ id: 'model', ms: 14000 });
    if (rooms.length) list.push({ id: 'rooms', ms: Math.min(30000, Math.max(7000, rooms.length * 2600)) });
    if (shots.length) list.push({ id: 'renders', ms: Math.min(40000, Math.max(7000, shots.length * 5000)) });
    list.push({ id: 'costs', ms: 10000 });
    list.push({ id: 'outro', ms: 0 });
    return list;
  }, [project, floors, rooms.length, shots.length]);

  const go = useCallback((n) => {
    setIndex(i => Math.max(0, Math.min(slides.length - 1, typeof n === 'function' ? n(i) : n)));
    tRef.current = 0;
    setT(0);
  }, [slides.length]);

  // the clock: advances the current slide and moves on when it ends
  useEffect(() => {
    if (!slides.length) return;
    let raf, last = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last; last = now;
      const slide = slides[index];
      if (!playing || !slide?.ms) return;
      tRef.current = Math.min(1, tRef.current + dt / slide.ms);
      setT(tRef.current);
      if (tRef.current >= 1 && index < slides.length - 1) go(index + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slides, index, playing, go]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowRight') go(i => i + 1);
      else if (e.key === 'ArrowLeft') go(i => i - 1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'Escape') navigate(`/studio?projectId=${projectId}`);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, navigate, projectId]);

  if (error) {
    return <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300"><p>{error}</p><Link to="/dashboard" className="text-sm underline">Back to your projects</Link></div>;
  }
  if (!project) {
    return <div className="flex h-screen items-center justify-center gap-2 bg-zinc-950 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the overview…</div>;
  }

  const slide = slides[index];
  const stats = [
    ['FLOOR AREA', formatArea(area)],
    ['FLOORS', String(floors.length)],
    ['ROOMS', String(rooms.length)],
    ['EST. COST', money(costs.total)],
  ];

  let body = null;
  if (slide.id === 'intro') body = <IntroSlide project={project} stats={stats} />;
  else if (slide.id.startsWith('plan-')) body = <PlanSlide floor={slide.floor} floors={floors.length} elements={elements.filter(e => (e.floor || 1) === slide.floor)} />;
  else if (slide.id === 'model') body = <ModelSlide elements={elements} t={t} />;
  else if (slide.id === 'rooms') body = <RoomsSlide elements={elements} rooms={rooms} renders={renderByRoom} t={t} />;
  else if (slide.id === 'renders') body = <RendersSlide shots={shots} t={t} />;
  else if (slide.id === 'costs') body = <CostSlide costs={costs} area={area} t={t} />;
  else body = <OutroSlide project={project} projectId={projectId} />;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-300">
      {/* a faint warm glow behind the sheet */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-500/[0.06] blur-[120px]" />

      {/* progress: one segment per slide, filling as it plays */}
      <div className="relative z-10 flex gap-1.5 px-6 pt-5">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => go(i)} className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800" aria-label={`Go to slide ${i + 1}`}>
            <span className="block h-full bg-zinc-200" style={{ width: i < index ? '100%' : i === index ? `${(s.ms ? t : 1) * 100}%` : '0%' }} />
          </button>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Mark className="h-6 w-6" />
          <span className="text-sm font-medium text-zinc-200">{project.name}</span>
          <span className="font-mono text-[11px] text-zinc-500">OVERVIEW</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(i => i - 1)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setPlaying(p => !p)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => go(i => i + 1)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => navigate(`/studio?projectId=${projectId}`)} className="ml-2 rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label="Close overview"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <main key={slide.id} className="relative z-10 min-h-0 flex-1 px-6 pb-8 sm:px-12">{body}</main>
    </div>
  );
}

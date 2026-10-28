import { useEffect, useRef, useState } from 'react';
import { MessageSquare, ListChecks, LayoutGrid, Ruler, Box, ShieldCheck, Check } from 'lucide-react';

/*
 * "How the engine works": one scroll-driven drawing. As the section scrolls past, a sentence is
 * typed, read into a room program, grown into a plan room by room (each room attached to the one it
 * opens into, as the generator does), detailed, tilted up into 3D and finally measured and checked.
 * Everything is a pure function of a single progress value, so scrolling back plays it in reverse.
 */

const STEPS = [
  { icon: MessageSquare, title: 'Describe', desc: 'Write what you need in plain words.', from: 0 },
  { icon: ListChecks, title: 'Understand', desc: 'The brief becomes a room program: rooms, sizes, relationships.', from: 0.13 },
  { icon: LayoutGrid, title: 'Lay out', desc: 'Rooms are placed one by one, each attached to the room it opens into.', from: 0.24 },
  { icon: Ruler, title: 'Detail', desc: 'Doors, room sizes and overall dimensions are added to scale.', from: 0.55 },
  { icon: Box, title: 'Model', desc: 'The same plan becomes a 3D model you can walk through.', from: 0.66 },
  { icon: ShieldCheck, title: 'Check', desc: 'Area, cost estimate and basic layout checks, before you edit.', from: 0.84 },
];

const PROMPT = 'A 3 bedroom single-storey home with an open kitchen and a master suite.';
const PROGRAM = ['3 bedrooms', '2 bathrooms', 'Open kitchen + dining', '~1,260 sq ft'];

// plan in feet; `parent` is the room each one opens into (growth order matters)
const ROOMS = [
  { id: 'living', name: 'Living', x: 14, y: 12, w: 16, h: 18 },
  { id: 'dining', name: 'Dining', x: 30, y: 12, w: 14, h: 8, parent: 'living' },
  { id: 'kitchen', name: 'Kitchen', x: 30, y: 20, w: 14, h: 10, parent: 'dining' },
  { id: 'master', name: 'Master', x: 0, y: 12, w: 14, h: 18, parent: 'living' },
  { id: 'mbath', name: 'Bath', x: 0, y: 4, w: 14, h: 8, parent: 'master' },
  { id: 'bed2', name: 'Bedroom 2', x: 14, y: 0, w: 14, h: 12, parent: 'living' },
  { id: 'bath', name: 'Bath', x: 28, y: 0, w: 6, h: 12, parent: 'bed2' },
  { id: 'bed3', name: 'Bedroom 3', x: 34, y: 0, w: 10, h: 12, parent: 'dining' },
];
const BY_ID = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const PLAN_W = 44, PLAN_D = 30, WALL_H = 9;
const TOTAL_AREA = ROOMS.reduce((s, r) => s + r.w * r.h, 0);
const CHECKS = ['Every room reachable', 'Bedrooms on exterior walls', 'Minimum room sizes met'];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// which side of its parent a room sits on, and the shared wall segment (for growth origin and the door)
function attachment(room) {
  const p = BY_ID[room.parent];
  if (!p) return null;
  const ox0 = Math.max(room.x, p.x), ox1 = Math.min(room.x + room.w, p.x + p.w);
  const oy0 = Math.max(room.y, p.y), oy1 = Math.min(room.y + room.h, p.y + p.h);
  if (room.x + room.w === p.x) return { side: 'right', a: [p.x, oy0], b: [p.x, oy1] };
  if (room.x === p.x + p.w) return { side: 'left', a: [room.x, oy0], b: [room.x, oy1] };
  if (room.y + room.h === p.y) return { side: 'bottom', a: [ox0, p.y], b: [ox1, p.y] };
  return { side: 'top', a: [ox0, room.y], b: [ox1, room.y] };
}
const ATTACH = Object.fromEntries(ROOMS.map(r => [r.id, attachment(r)]));

// a room's rectangle while it grows out of the wall it shares with its parent
function grownRect(room, g) {
  const at = ATTACH[room.id];
  if (!at) {
    const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
    return { x: cx - (room.w * g) / 2, y: cy - (room.h * g) / 2, w: room.w * g, h: room.h * g };
  }
  const { x, y, w, h } = room;
  switch (at.side) {
    case 'right': return { x: x + w * (1 - g), y, w: w * g, h };
    case 'left': return { x, y, w: w * g, h };
    case 'bottom': return { x, y: y + h * (1 - g), w, h: h * g };
    default: return { x, y, w, h: h * g };
  }
}

function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setP(1); return; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      setP(travel > 0 ? clamp(-r.top / travel) : 1);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return p;
}

function Drawing({ p }) {
  const grow = seg(p, 0.24, 0.55);
  const detail = ease(seg(p, 0.55, 0.64));
  const t = ease(seg(p, 0.66, 0.84));          // plan → 3D
  const rise = ease(seg(p, 0.72, 0.86));        // walls going up
  const graph = grow > 0 ? 1 - detail : 0;

  // projection: rotate about the plan centre, squash depth and lift by height as t goes 0 → 1
  const VB_W = 600, VB_H = 420;
  const s = lerp(10.2, 8.4, t);
  const th = (-38 * Math.PI / 180) * t, cos = Math.cos(th), sin = Math.sin(th);
  const squash = lerp(1, 0.56, t);
  const ox = VB_W / 2 + lerp(8, 0, t), oy = VB_H / 2 + lerp(8, 34, t);
  const P = (x, y, z = 0) => {
    const dx = x - PLAN_W / 2, dy = y - PLAN_D / 2;
    const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
    return { X: ox + rx * s, Y: oy + ry * s * squash - z * s * 0.95, depth: ry };
  };
  const pts = arr => arr.map(q => `${q.X.toFixed(1)},${q.Y.toFixed(1)}`).join(' ');

  // each room appears in turn across the growth stage
  const n = ROOMS.length;
  const rooms = ROOMS.map((room, i) => {
    const g = ease(clamp(grow * n - i));
    return { room, g, r: grownRect(room, g), growing: g > 0 && g < 1 };
  }).filter(o => o.g > 0);

  const z = rise * WALL_H;
  const walls = [];
  rooms.forEach(({ room, r }) => {
    const c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    for (let k = 0; k < 4; k++) {
      const [a, b] = [c[k], c[(k + 1) % 4]];
      const mid = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      walls.push({ key: `${room.id}-${k}`, a, b, depth: mid.depth, horizontal: a[1] === b[1] });
    }
  });
  walls.sort((u, v) => u.depth - v.depth);

  const centre = room => P(room.x + room.w / 2, room.y + room.h / 2);
  // names stay readable in plan view; the 3D model reads better without them
  const labelOpacity = detail * (1 - seg(t, 0, 0.5));

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full" role="img" aria-label="A floor plan being generated room by room, then turned into a 3D model">
      <defs>
        <pattern id="ts-grid" width="23" height="23" patternUnits="userSpaceOnUse">
          <path d="M23 0H0V23" fill="none" stroke="rgba(255,255,255,0.04)" />
        </pattern>
      </defs>
      <rect width={VB_W} height={VB_H} fill="url(#ts-grid)" opacity={1 - t} />

      {/* floors */}
      {rooms.map(({ room, r, growing }) => (
        <polygon
          key={`f-${room.id}`}
          points={pts([P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)])}
          fill={growing ? 'rgba(129,140,248,0.22)' : 'rgba(255,255,255,0.045)'}
        />
      ))}

      {/* walls: a line in plan view, an extruded face once they rise */}
      {walls.map(w => {
        const a0 = P(w.a[0], w.a[1]), b0 = P(w.b[0], w.b[1]);
        const a1 = P(w.a[0], w.a[1], z), b1 = P(w.b[0], w.b[1], z);
        return (
          <g key={w.key}>
            {z > 0.05 && (
              <polygon points={pts([a0, b0, b1, a1])} fill={w.horizontal ? '#3f3f46' : '#27272a'} stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
            )}
            <line x1={a1.X} y1={a1.Y} x2={b1.X} y2={b1.Y} stroke="#e4e4e7" strokeWidth={lerp(2.6, 1.4, t)} strokeLinecap="square" />
          </g>
        );
      })}

      {/* doors: a gap and a swing on each shared wall, plan view only */}
      {detail > 0 && t < 1 && ROOMS.filter(r => ATTACH[r.id]).map(room => {
        const { a, b, side } = ATTACH[room.id];
        const vertical = side === 'left' || side === 'right';
        const mid = vertical ? (a[1] + b[1]) / 2 : (a[0] + b[0]) / 2;
        const d0 = vertical ? P(a[0], mid - 1.5) : P(mid - 1.5, a[1]);
        const d1 = vertical ? P(a[0], mid + 1.5) : P(mid + 1.5, a[1]);
        const leaf = vertical ? P(a[0] + (side === 'left' ? 3 : -3), mid - 1.5) : P(mid - 1.5, a[1] + (side === 'top' ? 3 : -3));
        const op = detail * (1 - seg(t, 0, 0.3));
        return (
          <g key={`d-${room.id}`} opacity={op}>
            <line x1={d0.X} y1={d0.Y} x2={d1.X} y2={d1.Y} stroke="#0c0c0e" strokeWidth="4" />
            <line x1={d0.X} y1={d0.Y} x2={leaf.X} y2={leaf.Y} stroke="#a1a1aa" strokeWidth="1" />
            <path d={`M${leaf.X} ${leaf.Y} A ${3 * s} ${3 * s} 0 0 ${side === 'left' || side === 'bottom' ? 1 : 0} ${d1.X} ${d1.Y}`} fill="none" stroke="#52525b" strokeWidth="0.8" strokeDasharray="2 2" />
          </g>
        );
      })}

      {/* adjacency graph shown while the plan grows */}
      {graph > 0 && rooms.map(({ room, g }) => {
        const c = centre(room);
        const parent = room.parent && BY_ID[room.parent];
        const pc = parent && centre(parent);
        return (
          <g key={`g-${room.id}`} opacity={graph * Math.min(1, g * 2)}>
            {pc && <line x1={pc.X} y1={pc.Y} x2={lerp(pc.X, c.X, g)} y2={lerp(pc.Y, c.Y, g)} stroke="#818cf8" strokeWidth="1.2" strokeDasharray="3 3" />}
            <circle cx={c.X} cy={c.Y} r="3.5" fill="#818cf8" />
          </g>
        );
      })}

      {/* room names and sizes */}
      {labelOpacity > 0 && rooms.map(({ room }) => {
        const c = P(room.x + room.w / 2, room.y + room.h / 2, z * 0.02);
        return (
          <g key={`l-${room.id}`} opacity={labelOpacity} textAnchor="middle" fontFamily="Inter, sans-serif">
            <text x={c.X} y={c.Y - 2} fontSize="11" fontWeight="500" fill="#f4f4f5">{room.name}</text>
            <text x={c.X} y={c.Y + 11} fontSize="9" fill="#a1a1aa" fontFamily="JetBrains Mono, monospace">{room.w}′×{room.h}′</text>
          </g>
        );
      })}

      {/* overall dimensions */}
      {detail > 0 && (() => {
        const op = detail * (1 - seg(t, 0, 0.3));
        const top0 = P(0, -3), top1 = P(PLAN_W, -3), left0 = P(-3, 0), left1 = P(-3, PLAN_D);
        return (
          <g opacity={op} stroke="#71717a" strokeWidth="0.8" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#a1a1aa">
            <line x1={top0.X} y1={top0.Y} x2={top1.X} y2={top1.Y} />
            <line x1={top0.X} y1={top0.Y - 4} x2={top0.X} y2={top0.Y + 4} />
            <line x1={top1.X} y1={top1.Y - 4} x2={top1.X} y2={top1.Y + 4} />
            <text x={(top0.X + top1.X) / 2} y={top0.Y - 6} textAnchor="middle" stroke="none">{PLAN_W}′-0″</text>
            <line x1={left0.X} y1={left0.Y} x2={left1.X} y2={left1.Y} />
            <line x1={left0.X - 4} y1={left0.Y} x2={left0.X + 4} y2={left0.Y} />
            <line x1={left1.X - 4} y1={left1.Y} x2={left1.X + 4} y2={left1.Y} />
            <text x={left0.X - 8} y={(left0.Y + left1.Y) / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${left0.X - 8} ${(left0.Y + left1.Y) / 2})`}>{PLAN_D}′-0″</text>
          </g>
        );
      })()}
    </svg>
  );
}

export default function TechStory() {
  const root = useRef(null);
  const p = useScrollProgress(root);
  const active = STEPS.reduce((i, st, k) => (p >= st.from ? k : i), 0);

  const typed = Math.round(PROMPT.length * seg(p, 0.02, 0.13));
  const chips = seg(p, 0.14, 0.23) * PROGRAM.length;
  const audit = ease(seg(p, 0.86, 0.95));
  const roomsShown = Math.min(ROOMS.length, Math.floor(seg(p, 0.24, 0.55) * ROOMS.length + 0.999));

  return (
    <section ref={root} id="technology" className="relative h-[420vh] border-y border-white/5 bg-zinc-950">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden pt-14 lg:pt-0">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[300px_1fr] lg:gap-14">

          {/* steps */}
          <div className="flex flex-col justify-center">
            <p className="mb-2 text-xs font-medium uppercase lg:mb-3 tracking-[0.18em] text-zinc-500">How it works</p>
            <h2 className="mb-4 text-2xl sm:text-3xl lg:mb-6 font-semibold tracking-tight text-white md:text-4xl">From a description to a buildable plan</h2>

            <ol className="hidden space-y-1 lg:block">
              {STEPS.map((st, i) => {
                const Icon = st.icon;
                const done = i < active, on = i === active;
                return (
                  <li key={st.title} className={`flex gap-3 rounded-lg px-3 py-2.5 transition-colors ${on ? 'bg-white/[0.04]' : ''}`}>
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] transition-colors ${
                      on ? 'border-indigo-400/60 text-indigo-300' : done ? 'border-zinc-700 text-zinc-400' : 'border-zinc-800 text-zinc-600'
                    }`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <div>
                      <div className={`text-sm font-medium transition-colors ${on ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>{st.title}</div>
                      <div className={`overflow-hidden text-[13px] leading-snug text-zinc-400 transition-all duration-300 ${on ? 'mt-0.5 max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}>{st.desc}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* phones: one caption for the current step */}
            <div className="lg:hidden">
              <div className="mb-2 flex gap-1">
                {STEPS.map((st, i) => <span key={st.title} className={`h-0.5 flex-1 rounded ${i <= active ? 'bg-indigo-400' : 'bg-zinc-800'}`} />)}
              </div>
              <p className="text-sm text-zinc-300"><span className="font-medium text-white">{STEPS[active].title}.</span> {STEPS[active].desc}</p>
            </div>
          </div>

          {/* the workspace */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-2xl shadow-black/40">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px]">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="truncate text-zinc-200">
                  {typed ? PROMPT.slice(0, typed) : <span className="text-zinc-600">Describe your home…</span>}
                  {p < 0.14 && <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-zinc-300" />}
                </span>
              </div>
              <div className="mt-2 flex min-h-[26px] flex-wrap gap-1.5">
                {PROGRAM.map((c, i) => (
                  <span
                    key={c}
                    style={{ opacity: clamp(chips - i), transform: `translateY(${(1 - clamp(chips - i)) * 4}px)` }}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400"
                  >{c}</span>
                ))}
              </div>
            </div>

            <div className="relative aspect-[600/420] max-h-[52vh] w-full">
              <Drawing p={p} />
              <span className="absolute right-3 top-3 rounded border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                {p < 0.66 ? 'PLAN' : '3D'}{p >= 0.24 && p < 0.55 ? ` · ${roomsShown}/${ROOMS.length} rooms` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 border-t border-zinc-800 sm:grid-cols-4">
              {[
                ['Built-up area', audit ? `${Math.round(TOTAL_AREA * audit).toLocaleString()} sq ft` : '—'],
                ['Rooms', audit ? String(Math.round(ROOMS.length * audit)) : '—'],
                ['Est. cost', audit ? `₹${(TOTAL_AREA * 2000 * audit / 1e5).toFixed(1)} L` : '—'],
                ['Checks', audit ? `${Math.round(CHECKS.length * audit)}/${CHECKS.length} passed` : '—'],
              ].map(([k, v], i) => (
                <div key={k} className={`px-4 py-3 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-zinc-800`}>
                  <div className="text-[11px] text-zinc-500">{k}</div>
                  <div className={`mt-0.5 font-mono text-sm tabular-nums ${audit ? 'text-white' : 'text-zinc-700'}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 px-4 py-2.5" style={{ opacity: audit }}>
              {CHECKS.map((c, i) => (
                <span key={c} className="flex items-center gap-1.5 text-[11px] text-zinc-400" style={{ opacity: clamp(audit * CHECKS.length - i) }}>
                  <Check className="h-3 w-3 text-emerald-400" /> {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

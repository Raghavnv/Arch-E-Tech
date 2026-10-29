import { useEffect, useRef, useState } from 'react';

/*
 * "How the engine works": one continuous drawing on a loop. A brief is typed, the rooms grow out of
 * one another into a plan, the plan is detailed, rises into a model that slowly turns, gets measured,
 * then eases back to a blank sheet and starts again. Everything is a function of one phase value p
 * (0..1 over CYCLE ms), so it is smooth at any frame rate and pauses when off screen.
 */

const CYCLE = 18000;
const BONE = '#e7e2d9';
const ACCENT = '#c8794a';

export const STEPS = [
  { title: 'Brief', desc: 'Describe the home in plain words.', from: 0 },
  { title: 'Program', desc: 'The brief becomes a list of rooms and sizes.', from: 0.1 },
  { title: 'Layout', desc: 'Rooms are placed one by one, each opening into the next.', from: 0.18 },
  { title: 'Detail', desc: 'Doors, room sizes and overall dimensions, to scale.', from: 0.45 },
  { title: 'Model', desc: 'The same plan rises into a 3D model.', from: 0.54 },
  { title: 'Measure', desc: 'Area, cost and layout checks, before you edit.', from: 0.78 },
];

const PROMPT = 'A 3 bedroom single-storey home with an open kitchen and a master suite.';
const PROGRAM = ['3 bedrooms', '2 bathrooms', 'Open kitchen', '~1,260 sq ft'];

// plan in feet; `parent` is the room each opens into (growth order matters)
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
const CHECKS = ['Every room reachable', 'Bedrooms on outside walls', 'Minimum sizes met'];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// which side of its parent a room sits on, and the wall they share (for the growth origin and the door)
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

function grownRect(room, g) {
  const at = ATTACH[room.id];
  const { x, y, w, h } = room;
  if (!at) return { x: x + (w * (1 - g)) / 2, y: y + (h * (1 - g)) / 2, w: w * g, h: h * g };
  switch (at.side) {
    case 'right': return { x: x + w * (1 - g), y, w: w * g, h };
    case 'left': return { x, y, w: w * g, h };
    case 'bottom': return { x, y: y + h * (1 - g), w, h: h * g };
    default: return { x, y, w, h: h * g };
  }
}

/** The phase of the loop, 0..1; frozen on the finished model for reduced motion; paused off screen. */
function useLoop(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setP(0.8); return; }
    let raf = 0, visible = true, last = performance.now(), phase = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;
      if (!visible || document.hidden) return;
      phase = (phase + dt / CYCLE) % 1;
      setP(phase);
    };
    raf = requestAnimationFrame(tick);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 });
    if (ref.current) io.observe(ref.current);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [ref]);
  return p;
}

function Drawing({ p }) {
  const grow = seg(p, 0.18, 0.45);
  const detail = ease(seg(p, 0.45, 0.53));
  const t = ease(seg(p, 0.54, 0.68));            // plan -> 3D
  const rise = ease(seg(p, 0.58, 0.7));           // walls going up
  const orbit = ease(seg(p, 0.6, 0.96));          // slow turn while in 3D
  const fade = 1 - ease(seg(p, 0.94, 1));         // back to a blank sheet
  const graph = grow > 0 ? 1 - detail : 0;

  const VB_W = 600, VB_H = 420;
  const s = lerp(10.2, 8.2, t);
  const th = ((-34 - 26 * orbit) * Math.PI / 180) * t, cos = Math.cos(th), sin = Math.sin(th);
  const squash = lerp(1, 0.55, t);
  const ox = VB_W / 2 + lerp(8, 0, t), oy = VB_H / 2 + lerp(8, 36, t);
  const P = (x, y, z = 0) => {
    const dx = x - PLAN_W / 2, dy = y - PLAN_D / 2;
    const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
    return { X: ox + rx * s, Y: oy + ry * s * squash - z * s * 0.95, depth: ry };
  };
  const pts = arr => arr.map(q => `${q.X.toFixed(1)},${q.Y.toFixed(1)}`).join(' ');

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
      walls.push({ key: `${room.id}-${k}`, a, b, depth: P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).depth, horizontal: a[1] === b[1] });
    }
  });
  walls.sort((u, v) => u.depth - v.depth);

  const centre = room => P(room.x + room.w / 2, room.y + room.h / 2);
  const labelOpacity = detail * (1 - seg(t, 0, 0.5));
  const dimOpacity = detail * (1 - seg(t, 0, 0.3));

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full" role="img" aria-label="A floor plan growing room by room and rising into a 3D model" style={{ opacity: fade }}>
      {/* floors */}
      {rooms.map(({ room, r, growing }) => (
        <polygon key={`f-${room.id}`}
          points={pts([P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)])}
          fill={growing ? 'rgba(200,121,74,0.20)' : `rgba(231,226,217,${lerp(0.035, 0.07, t)})`} />
      ))}

      {/* walls: a line in plan, an extruded face once they rise */}
      {walls.map(w => {
        const a0 = P(w.a[0], w.a[1]), b0 = P(w.b[0], w.b[1]);
        const a1 = P(w.a[0], w.a[1], z), b1 = P(w.b[0], w.b[1], z);
        return (
          <g key={w.key}>
            {z > 0.05 && <polygon points={pts([a0, b0, b1, a1])} fill={w.horizontal ? '#3b3834' : '#2b2926'} stroke="rgba(231,226,217,0.06)" strokeWidth="0.6" />}
            <line x1={a1.X} y1={a1.Y} x2={b1.X} y2={b1.Y} stroke={BONE} strokeWidth={lerp(2.4, 1.3, t)} strokeLinecap="square" />
          </g>
        );
      })}

      {/* doors: a gap and a swing on each shared wall */}
      {dimOpacity > 0 && ROOMS.filter(r => ATTACH[r.id]).map(room => {
        const { a, b, side } = ATTACH[room.id];
        const vertical = side === 'left' || side === 'right';
        const mid = vertical ? (a[1] + b[1]) / 2 : (a[0] + b[0]) / 2;
        const d0 = vertical ? P(a[0], mid - 1.5) : P(mid - 1.5, a[1]);
        const d1 = vertical ? P(a[0], mid + 1.5) : P(mid + 1.5, a[1]);
        const leaf = vertical ? P(a[0] + (side === 'left' ? 3 : -3), mid - 1.5) : P(mid - 1.5, a[1] + (side === 'top' ? 3 : -3));
        return (
          <g key={`d-${room.id}`} opacity={dimOpacity}>
            <line x1={d0.X} y1={d0.Y} x2={d1.X} y2={d1.Y} stroke="#111110" strokeWidth="4" />
            <line x1={d0.X} y1={d0.Y} x2={leaf.X} y2={leaf.Y} stroke="#a8a29e" strokeWidth="1" />
            <path d={`M${leaf.X} ${leaf.Y} A ${3 * s} ${3 * s} 0 0 ${side === 'left' || side === 'bottom' ? 1 : 0} ${d1.X} ${d1.Y}`} fill="none" stroke="#57534e" strokeWidth="0.8" strokeDasharray="2 2" />
          </g>
        );
      })}

      {/* how the rooms connect, shown while they grow */}
      {graph > 0 && rooms.map(({ room, g }) => {
        const c = centre(room);
        const pc = room.parent && centre(BY_ID[room.parent]);
        return (
          <g key={`g-${room.id}`} opacity={graph * Math.min(1, g * 2)}>
            {pc && <line x1={pc.X} y1={pc.Y} x2={lerp(pc.X, c.X, g)} y2={lerp(pc.Y, c.Y, g)} stroke={ACCENT} strokeWidth="1.1" strokeDasharray="3 3" />}
            <circle cx={c.X} cy={c.Y} r="3" fill={ACCENT} />
          </g>
        );
      })}

      {labelOpacity > 0 && rooms.map(({ room }) => {
        const c = centre(room);
        return (
          <g key={`l-${room.id}`} opacity={labelOpacity} textAnchor="middle">
            <text x={c.X} y={c.Y - 2} fontSize="11" fontWeight="500" fill="#f5f5f4" fontFamily="Inter, sans-serif">{room.name}</text>
            <text x={c.X} y={c.Y + 11} fontSize="9" fill="#a8a29e" fontFamily="'JetBrains Mono', monospace">{room.w}′×{room.h}′</text>
          </g>
        );
      })}

      {dimOpacity > 0 && (() => {
        const t0 = P(0, -3), t1 = P(PLAN_W, -3), l0 = P(-3, 0), l1 = P(-3, PLAN_D);
        return (
          <g opacity={dimOpacity} stroke="#78716c" strokeWidth="0.8" fontSize="10" fill="#a8a29e" fontFamily="'JetBrains Mono', monospace">
            <line x1={t0.X} y1={t0.Y} x2={t1.X} y2={t1.Y} />
            <line x1={t0.X} y1={t0.Y - 4} x2={t0.X} y2={t0.Y + 4} />
            <line x1={t1.X} y1={t1.Y - 4} x2={t1.X} y2={t1.Y + 4} />
            <text x={(t0.X + t1.X) / 2} y={t0.Y - 6} textAnchor="middle" stroke="none">{PLAN_W}′-0″</text>
            <line x1={l0.X} y1={l0.Y} x2={l1.X} y2={l1.Y} />
            <line x1={l0.X - 4} y1={l0.Y} x2={l0.X + 4} y2={l0.Y} />
            <line x1={l1.X - 4} y1={l1.Y} x2={l1.X + 4} y2={l1.Y} />
            <text x={l0.X - 8} y={(l0.Y + l1.Y) / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${l0.X - 8} ${(l0.Y + l1.Y) / 2})`}>{PLAN_D}′-0″</text>
          </g>
        );
      })()}
    </svg>
  );
}

export default function EngineLoop() {
  const root = useRef(null);
  const p = useLoop(root);
  const active = STEPS.reduce((i, st, k) => (p >= st.from ? k : i), 0);

  const typed = Math.round(PROMPT.length * seg(p, 0.01, 0.09));
  const chips = seg(p, 0.1, 0.17) * PROGRAM.length;
  const audit = ease(seg(p, 0.78, 0.88));
  const out = 1 - ease(seg(p, 0.94, 1));          // the whole sheet clears together at the end of a loop

  return (
    <div ref={root} className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
      {/* the steps, lit in turn along one rail; they follow the drawing, they are not tabs */}
      <ol className="relative hidden lg:block">
        <span className="absolute left-[7px] top-2 bottom-2 w-px bg-stone-800" />
        <span className="absolute left-[7px] top-2 w-px bg-[#c8794a] transition-[height] duration-200 ease-linear" style={{ height: `calc((100% - 1rem) * ${p})` }} />
        {STEPS.map((st, i) => {
          const on = i === active;
          return (
            <li key={st.title} className="relative pl-8 pb-7 last:pb-0">
              <span className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border transition-colors duration-500 ${i <= active ? 'border-[#c8794a] bg-[#1a1714]' : 'border-stone-700 bg-[#121110]'}`}>
                <span className={`absolute inset-[4px] rounded-full bg-[#c8794a] transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-0'}`} />
              </span>
              <p className="font-mono text-[10px] tracking-[0.2em] text-stone-500">0{i + 1}</p>
              <p className={`text-sm font-medium transition-colors duration-500 ${on ? 'text-stone-100' : 'text-stone-500'}`}>{st.title}</p>
              <p className={`text-[13px] leading-snug text-stone-400 transition-all duration-500 ${on ? 'mt-0.5 max-h-12 opacity-100' : 'max-h-0 overflow-hidden opacity-0'}`}>{st.desc}</p>
            </li>
          );
        })}
      </ol>

      <div className="overflow-hidden rounded-sm border border-stone-800 bg-[#121110]">
        {/* the brief */}
        <div className="border-b border-stone-800 px-4 py-3" style={{ opacity: out }}>
          <div className="flex items-center gap-3 font-mono text-[12px]">
            <span className="text-stone-500">BRIEF</span>
            <span className="truncate text-stone-200">
              {typed ? PROMPT.slice(0, typed) : <span className="text-stone-600">Describe your home…</span>}
              {p < 0.1 && <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-stone-300" />}
            </span>
          </div>
          <div className="mt-2 flex min-h-[24px] flex-wrap gap-1.5">
            {PROGRAM.map((c, i) => (
              <span key={c} style={{ opacity: clamp(chips - i), transform: `translateY(${(1 - clamp(chips - i)) * 4}px)` }}
                className="rounded-sm border border-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-400">{c}</span>
            ))}
          </div>
        </div>

        {/* capped so the brief, the drawing and the numbers fit on one screen */}
        <div className="relative aspect-[600/420] max-h-[52vh] w-full">
          <Drawing p={p} />
          {/* drawing-sheet furniture: north arrow and scale bar */}
          <svg className="absolute bottom-3 left-3 h-10 w-24 text-stone-600" viewBox="0 0 96 40" aria-hidden="true">
            <path d="M12 4 L18 20 L12 16 L6 20 Z" fill="currentColor" />
            <text x="12" y="32" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="'JetBrains Mono', monospace">N</text>
            <g stroke="currentColor" strokeWidth="1"><line x1="34" y1="26" x2="90" y2="26" /><line x1="34" y1="22" x2="34" y2="30" /><line x1="62" y1="23" x2="62" y2="29" /><line x1="90" y1="22" x2="90" y2="30" /></g>
            <text x="62" y="18" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="'JetBrains Mono', monospace">10 ft</text>
          </svg>
          <span className="absolute right-3 top-3 font-mono text-[10px] tracking-[0.2em] text-stone-600">{p < 0.54 ? 'PLAN' : 'MODEL'}</span>
        </div>

        {/* measured */}
        <div className="grid grid-cols-2 border-t border-stone-800 sm:grid-cols-4">
          {[
            ['Built-up area', `${Math.round(TOTAL_AREA * audit).toLocaleString()} sq ft`],
            ['Rooms', String(Math.round(ROOMS.length * audit))],
            ['Est. cost', `₹${((TOTAL_AREA * 2000 * audit) / 1e5).toFixed(1)} L`],
            ['Checks', `${Math.round(CHECKS.length * audit)}/${CHECKS.length}`],
          ].map(([k, v], i) => (
            <div key={k} className={`px-4 py-3 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-stone-800`}>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">{k}</div>
              <div className="mt-1 font-mono text-sm tabular-nums transition-colors duration-500" style={{ color: audit > 0 ? '#e7e2d9' : '#44403c', opacity: audit > 0 ? out : 1 }}>
                {audit > 0 ? v : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* phones: the current step under the drawing */}
      <p className="text-sm text-stone-400 lg:hidden"><span className="text-stone-100">{STEPS[active].title}.</span> {STEPS[active].desc}</p>
    </div>
  );
}

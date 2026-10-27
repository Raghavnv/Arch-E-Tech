import { useRef, useState } from 'react';
import { MessageSquare, PenTool, Box, ShieldCheck, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { icon: MessageSquare, title: 'Describe it', tag: 'Generative NLP', desc: 'Plain English becomes a structured spatial brief.' },
  { icon: PenTool, title: 'Draft it', tag: 'Vector CAD', desc: 'Walls, doors and rooms are drawn to scale for you.' },
  { icon: Box, title: 'Build it', tag: 'Procedural BIM', desc: 'The plan rises into a live 3D model, instantly.' },
  { icon: ShieldCheck, title: 'Check it', tag: 'Code audit', desc: 'IBC / NBC compliance and cost, scanned in seconds.' },
  { icon: Sparkles, title: 'Render it', tag: 'Neural render', desc: 'Photoreal 8K imagery of the finished home.' },
];

const PROMPT = 'A modern 3-bedroom villa with a master suite and an open living lounge.';
const LAYERS = 10;
const RENDER_IMG = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80';

// One floor plan, drawn once per extrusion layer. pathLength=1 lets a single CSS var (--d) draw every wall.
function PlanLayer({ index }) {
  const top = index === LAYERS - 1;
  const stroke = top ? '#e0e7ff' : '#6366f1';
  const wall = { fill: 'none', stroke, strokeWidth: top ? 5 : 4, strokeLinecap: 'square', pathLength: 1, style: { strokeDasharray: 1, strokeDashoffset: 'var(--d, 0)' } };
  return (
    <svg
      viewBox="0 0 420 280"
      className="absolute inset-0 w-full h-full overflow-visible"
      style={{ transform: `translateZ(calc(var(--h, 0) * ${index * 7}px))`, opacity: top ? 1 : 0.55 }}
    >
      {index === 0 && (
        <g className="plan-floor" style={{ opacity: 'var(--floor, 1)' }}>
          <rect x="20" y="20" width="380" height="240" fill="rgba(99,102,241,0.10)" />
          <rect x="20" y="140" width="180" height="120" fill="rgba(34,211,238,0.06)" />
        </g>
      )}
      <path d="M20 20 H400 V260 H20 Z" {...wall} />
      <path d="M20 140 H200 V20" {...wall} />
      <path d="M20 80 H130 V20" {...wall} />
      <path d="M200 200 V260" {...wall} />
      {top && (
        <g className="plan-labels" style={{ opacity: 'var(--labels, 1)' }} fontFamily="JetBrains Mono, monospace" fill="#a5b4fc">
          <text x="34" y="115" fontSize="11">MASTER SUITE</text>
          <text x="30" y="55" fontSize="9" fill="#71717a">ENSUITE</text>
          <text x="240" y="150" fontSize="11">LIVING PAVILION</text>
          <text x="34" y="205" fontSize="11">BEDROOM 2</text>
          <text x="240" y="230" fontSize="9" fill="#71717a">KITCHEN</text>
        </g>
      )}
    </svg>
  );
}

export default function TechStory() {
  const root = useRef(null);
  const [active, setActive] = useState(0);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(root);
      const typed = q('.typed')[0];
      const counter = { n: 0 };
      let last = -1;

      gsap.set(root.current, { '--d': 1, '--h': 0, '--floor': 0, '--labels': 0 });
      gsap.set(q('.scene'), { rotateX: 0, rotateZ: 0, scale: 1.05, opacity: 1 });
      gsap.set(q('.prompt, .json-line, .badge, .scan'), { opacity: 0 });
      gsap.set(q('.photo'), { clipPath: 'circle(0% at 50% 50%)', opacity: 1 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: '+=450%',
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          onUpdate: (self) => {
            const t = self.progress * 10;
            const idx = t < 2 ? 0 : t < 3.5 ? 1 : t < 5.5 ? 2 : t < 7.5 ? 3 : 4;
            if (idx !== last) { last = idx; setActive(idx); }
          },
        },
      });

      // 1 · describe: prompt types itself, then the parsed brief appears
      tl.to(q('.prompt'), { opacity: 1, duration: 0.3 }, 0)
        .to(counter, { n: PROMPT.length, duration: 1.4, onUpdate: () => { typed.textContent = PROMPT.slice(0, Math.round(counter.n)); } }, 0.1)
        .to(q('.json-line'), { opacity: 1, stagger: 0.12, duration: 0.2 }, 1.2)
        // 2 · draft: the prompt steps aside and the plan draws itself
        .to(q('.prompt'), { opacity: 0, y: -30, scale: 0.94, duration: 0.7 }, 2)
        .to(root.current, { '--floor': 1, duration: 0.8 }, 2.4)
        .to(root.current, { '--d': 0, duration: 1.4 }, 2.2)
        .to(root.current, { '--labels': 1, duration: 0.5 }, 3.2)
        // 3 · build: tilt into isometric and extrude the walls
        .to(q('.scene'), { rotateX: 58, rotateZ: -38, scale: 0.95, duration: 1.8 }, 3.5)
        .to(root.current, { '--h': 1, duration: 1.8 }, 3.7)
        // 4 · check: scan plane sweeps the model, results pop in
        .to(q('.scan'), { opacity: 1, duration: 0.2 }, 5.5)
        .fromTo(q('.scan'), { yPercent: -60 }, { yPercent: 60, duration: 1.8 }, 5.5)
        .fromTo(q('.badge'), { opacity: 0, y: 14, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, stagger: 0.35, duration: 0.4, ease: 'back.out(1.6)' }, 6)
        .to(q('.scan'), { opacity: 0, duration: 0.2 }, 7.2)
        // 5 · render: the model dissolves into a photograph
        .to(q('.photo'), { clipPath: 'circle(78% at 50% 50%)', duration: 2, ease: 'power2.inOut' }, 7.5)
        .to(q('.scene, .badge'), { opacity: 0, duration: 1, ease: 'power1.in' }, 8.4)
        .to({}, { duration: 0.5 }, 9.5);

      gsap.to(q('.rail-fill'), { scaleY: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: '+=450%', scrub: true } });

      return () => { if (typed) typed.textContent = ''; };
    });
  }, { scope: root });

  return (
    <section
      id="technology"
      ref={root}
      className="relative h-screen min-h-[680px] overflow-hidden border-y border-white/5 bg-[#09090b]/60"
    >
      {/* ambient glow behind the stage */}
      <div className="pointer-events-none absolute right-[-10%] top-1/2 h-[700px] w-[700px] -translate-y-1/2 rounded-full bg-indigo-600/15 blur-[140px]" />

      <div className="relative mx-auto grid h-full max-w-7xl grid-cols-1 gap-6 px-6 pt-24 pb-8 lg:grid-cols-[340px_1fr] lg:gap-14">
        {/* Left: title + step rail */}
        <div className="flex flex-col justify-center">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-indigo-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" /> The engine
          </span>
          <h2 className="mb-2 font-serif text-4xl leading-tight text-white md:text-5xl">
            From a sentence<br /><span className="italic text-zinc-400">to a home.</span>
          </h2>
          <p className="mb-6 hidden text-sm font-light leading-relaxed text-zinc-400 lg:block">Keep scrolling. Watch one idea travel the whole pipeline.</p>

          <div className="relative hidden lg:block">
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-zinc-800">
              <div className="rail-fill h-full w-full origin-top scale-y-0 bg-gradient-to-b from-indigo-400 to-cyan-300" />
            </div>
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const on = i === active;
                const done = i < active;
                return (
                  <li key={s.title} className={`relative flex gap-4 rounded-xl p-2 pr-3 transition-all duration-500 ${on ? 'bg-white/[0.04]' : ''}`}>
                    <div className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                      on ? 'border-indigo-400 bg-indigo-500 text-white shadow-[0_0_24px_rgba(99,102,241,0.6)]'
                        : done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-600'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-semibold transition-colors ${on ? 'text-white' : 'text-zinc-500'}`}>{s.title}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">{s.tag}</span>
                      </div>
                      <p className={`overflow-hidden text-xs leading-relaxed text-zinc-400 transition-all duration-500 ${on ? 'mt-1 max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}>{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* compact indicator for small screens */}
          <div className="flex items-center gap-2 lg:hidden">
            {STEPS.map((s, i) => (
              <span key={s.title} className={`h-1 flex-1 rounded-full transition-colors ${i <= active ? 'bg-indigo-400' : 'bg-zinc-800'}`} />
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-indigo-300 lg:hidden">{STEPS[active].title} · {STEPS[active].tag}</p>
        </div>

        {/* Right: the stage */}
        <div className="relative min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_0_80px_rgba(99,102,241,0.12)]" style={{ perspective: '1400px' }}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:36px_36px]" />
          <div className="absolute left-4 top-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> live pipeline · v3.2
          </div>

          {/* prompt + parsed brief */}
          <div className="prompt opacity-0 absolute inset-x-6 top-1/2 mx-auto flex max-w-md -translate-y-1/2 flex-col items-stretch gap-3 sm:inset-x-10">
            <div className="rounded-2xl border border-indigo-400/30 bg-zinc-900/80 p-4 shadow-[0_0_40px_rgba(99,102,241,0.25)] backdrop-blur">
              <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-indigo-300">Your prompt</span>
              <p className="min-h-[3.2rem] text-sm leading-relaxed text-zinc-100">
                “<span className="typed" />
                <span className="animate-blink ml-px inline-block h-4 w-[2px] translate-y-0.5 bg-indigo-300" />”
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
              <div className="json-line text-zinc-500">// parsed → spatial brief</div>
              <div className="json-line">{'{'} "bedrooms": 3,</div>
              <div className="json-line">&nbsp;&nbsp;"style": "modern",</div>
              <div className="json-line">&nbsp;&nbsp;"master_suite": true,</div>
              <div className="json-line">&nbsp;&nbsp;"layout": "open-plan" {'}'}</div>
            </div>
          </div>

          {/* the model */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="scene relative w-[min(78%,560px)] aspect-[3/2]" style={{ transformStyle: 'preserve-3d' }}>
              {Array.from({ length: LAYERS }, (_, i) => <PlanLayer key={i} index={i} />)}
              <div className="scan opacity-0 pointer-events-none absolute inset-x-[-6%] top-1/2 h-[3px] bg-amber-300 shadow-[0_0_28px_6px_rgba(252,211,77,0.7)]" style={{ transform: 'translateZ(90px)' }} />
            </div>
          </div>

          {/* audit results */}
          <div className="pointer-events-none absolute bottom-5 left-5 flex flex-col gap-2">
            <div className="badge opacity-0 flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300 backdrop-blur"><ShieldCheck className="h-3.5 w-3.5" /> IBC compliance · 100% pass</div>
            <div className="badge opacity-0 flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 font-mono text-[11px] text-amber-200 backdrop-blur">≈ $48,500 estimated takeoff</div>
          </div>

          {/* final render */}
          <div className="photo absolute inset-0" style={{ clipPath: 'circle(0% at 50% 50%)' }}>
            <img src={RENDER_IMG} alt="Photorealistic render of the finished home" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            <span className="absolute bottom-5 right-5 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest text-white backdrop-blur">8K NEURAL RENDER</span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown, Plus, Minus } from 'lucide-react';
import EngineLoop from './EngineLoop';

/*
 * The front page, designed like a set of architectural drawings: a charcoal drafting sheet, bone
 * linework, hairline grids, dimension lines, sheet numbers and a title block. One warm accent.
 */

const HERO_PHOTO = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80';
const RENDER_PHOTO = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80';

const INDEX = [
  { sheet: 'A-101', title: 'AI Layout', text: 'Describe the home and get a complete floor plan, with bedrooms spread around the house the way architects plan them.' },
  { sheet: 'A-102', title: 'AI Edit', text: 'Change the plan in a sentence: narrow a door, extend a wall, add a window. Every edit can be undone.' },
  { sheet: 'A-103', title: 'Drafting tools', text: 'Smart Snap closes corners and seats doors on walls; Auto Detect turns enclosed spaces into named rooms.' },
  { sheet: 'A-201', title: '3D model & walkthrough', text: 'The plan rises into a 3D model you can orbit, paint with real materials and walk through at eye level.' },
  { sheet: 'A-301', title: 'Photo Render', text: 'Every room as a photograph, first empty and then furnished as you describe, all in one house style.' },
  { sheet: 'A-302', title: 'Concept views', text: 'A furnished 3D cutaway of the whole house, or the finished exterior, rendered from your own plan.' },
  { sheet: 'A-401', title: 'Cost & checks', text: 'Area, an estimated build cost and layout checks update as you draw, and export to a PDF report.' },
];

const FAQ = [
  { q: 'Do I need CAD experience?', a: 'No. Describe the home in plain words and a full plan is drawn for you. Editing works by dragging, or by typing the change you want.' },
  { q: 'How accurate are the plans?', a: 'Plans are drawn to scale in metres with real wall thicknesses and door widths, and rooms are sized to usual residential minimums. Treat them as a strong first design to refine with your architect.' },
  { q: 'What does Photo Render actually produce?', a: 'For each room of your plan it makes a photograph of the empty room in your chosen house style, then the same room furnished the way you describe. Save the ones you like to your gallery.' },
  { q: 'Can I walk through the house?', a: 'Yes. Switch to the 3D view and start the walkthrough to move through the rooms at eye level.' },
  { q: 'Is my work saved?', a: 'Projects, renders and saved photos are stored with your account and kept in sync as you work.' },
];

// a dimension line with end ticks and a centred label; draws itself in on load
function Dim({ x1, y1, x2, y2, label, vertical = false, delay = 0 }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g className="text-stone-500" style={{ animationDelay: `${delay}s` }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" pathLength="1" className="draw-in" style={{ animationDelay: `${delay}s` }} />
      {vertical ? (
        <>
          <line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} stroke="currentColor" />
          <line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} stroke="currentColor" />
          <text x={mx - 8} y={my} fill="currentColor" fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" transform={`rotate(-90 ${mx - 8} ${my})`}>{label}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} stroke="currentColor" />
          <line x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} stroke="currentColor" />
          <text x={mx} y={my - 7} fill="currentColor" fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{label}</text>
        </>
      )}
    </g>
  );
}

// small key plan drawn over the hero photo
function KeyPlan() {
  const rooms = [[0, 0, 52, 40], [52, 0, 40, 26], [52, 26, 40, 34], [0, 40, 30, 20], [30, 40, 22, 20]];
  return (
    <svg viewBox="-6 -6 104 76" className="h-24 w-32" aria-hidden="true">
      {rooms.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="rgba(15,14,13,0.55)" stroke="#e7e2d9" strokeWidth="1.4" pathLength="1" className="draw-in" style={{ animationDelay: `${0.8 + i * 0.15}s` }} />
      ))}
      <circle cx="26" cy="20" r="2.2" fill="#c8794a" />
    </svg>
  );
}

function Hero() {
  return (
    <header className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 pt-36 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-44">
      <div>
        <p className="rise-in font-mono text-[11px] tracking-[0.25em] text-stone-500">SHEET A-000 · HOME DESIGN STUDIO</p>
        <h1 className="rise-in mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-stone-100 sm:text-6xl xl:text-7xl" style={{ animationDelay: '.08s' }}>
          Design the home<br /><span className="text-stone-500">before you build it.</span>
        </h1>
        <p className="rise-in mt-7 max-w-md text-[17px] leading-relaxed text-stone-400" style={{ animationDelay: '.16s' }}>
          Describe a house in a sentence. Arch-E-Tech draws the plan to scale, raises it into 3D, prices it, and photographs every room.
        </p>
        <div className="rise-in mt-9 flex flex-wrap items-center gap-5" style={{ animationDelay: '.24s' }}>
          <Link to="/auth" className="group inline-flex items-center gap-2 rounded-sm bg-[#e7e2d9] px-6 py-3.5 text-sm font-semibold text-[#141312] transition-colors hover:bg-white">
            Start designing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#engine" className="inline-flex items-center gap-2 text-sm text-stone-400 transition-colors hover:text-stone-100">
            See how it works <ArrowDown className="h-4 w-4" />
          </a>
        </div>
        <dl className="rise-in mt-14 grid max-w-md grid-cols-3 border-t border-stone-800 pt-5" style={{ animationDelay: '.32s' }}>
          {[['Plan', '~10 s'], ['Scale', 'Metric'], ['Views', '2D · 3D · Photo']].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[10px] tracking-[0.2em] text-stone-600 uppercase">{k}</dt>
              <dd className="mt-1 text-sm text-stone-300">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* the drafting sheet */}
      <div className="rise-in relative" style={{ animationDelay: '.2s' }}>
        <svg className="pointer-events-none absolute -top-10 left-0 h-8 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 30" aria-hidden="true">
          <Dim x1={0} y1={20} x2={600} y2={20} label="14.60 m" delay={0.5} />
        </svg>
        <svg className="pointer-events-none absolute -left-10 top-0 hidden h-full w-8 overflow-visible sm:block" preserveAspectRatio="none" viewBox="0 0 30 440" aria-hidden="true">
          <Dim x1={20} y1={0} x2={20} y2={440} label="10.20 m" vertical delay={0.7} />
        </svg>
        <div className="border border-stone-700/80 bg-[#121110] p-2">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={HERO_PHOTO} alt="Open-plan living room with a long sofa and a kitchen beyond" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 border border-stone-500/50 bg-[#0f0e0d]/70 p-1.5 backdrop-blur-sm"><KeyPlan /></div>
          </div>
          {/* title block */}
          <div className="mt-2 grid grid-cols-4 border border-stone-800 font-mono text-[10px] text-stone-400">
            {[['PROJECT', 'Courtyard House'], ['ROOM', 'Living · 01'], ['SCALE', '1 : 100'], ['SHEET', 'A-301']].map(([k, v], i) => (
              <div key={k} className={`px-2.5 py-2 ${i ? 'border-l border-stone-800' : ''}`}>
                <div className="tracking-[0.2em] text-stone-600">{k}</div>
                <div className="mt-0.5 truncate text-stone-300">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function SectionHead({ sheet, title, children }) {
  return (
    <div className="mb-14 grid gap-6 border-t border-stone-800 pt-6 lg:grid-cols-[260px_1fr] lg:gap-12">
      <p className="font-mono text-[11px] tracking-[0.25em] text-stone-500">{sheet}</p>
      <div>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-stone-100 sm:text-4xl">{title}</h2>
        {children && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-stone-400">{children}</p>}
      </div>
    </div>
  );
}

// a line drawing of the room on the left, the photograph on the right, with a handle between them
function SketchToPhoto() {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const move = (x) => {
    const r = ref.current.getBoundingClientRect();
    setPos(Math.max(3, Math.min(97, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] w-full cursor-ew-resize touch-none select-none overflow-hidden border border-stone-800"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) move(e.clientX); }}
      role="slider" aria-label="Compare the line drawing with the photograph" aria-valuenow={Math.round(pos)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') setPos(p => Math.max(3, p - 4)); if (e.key === 'ArrowRight') setPos(p => Math.min(97, p + 4)); }}
    >
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <filter id="pencil">
          <feColorMatrix type="saturate" values="0" />
          <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-3.2" intercept="1" /><feFuncG type="linear" slope="-3.2" intercept="1" /><feFuncB type="linear" slope="-3.2" intercept="1" />
          </feComponentTransfer>
        </filter>
      </svg>
      <img src={RENDER_PHOTO} alt="Furnished living room with a leather sofa, plants and gallery wall" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-[#ecebe6]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={RENDER_PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-multiply" style={{ filter: 'url(#pencil)' }} draggable={false} />
      </div>
      <div className="absolute inset-y-0 w-px bg-[#e7e2d9]" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-stone-400 bg-[#0f0e0d] font-mono text-[11px] text-stone-200">⇆</div>
      </div>
      <span className="absolute left-3 top-3 bg-[#0f0e0d]/80 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-stone-300">DRAWING</span>
      <span className="absolute right-3 top-3 bg-[#0f0e0d]/80 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-stone-300">PHOTOGRAPH</span>
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="relative min-h-screen bg-[#0f0e0d] font-sans text-stone-300 selection:bg-[#c8794a] selection:text-white">
      {/* drafting-sheet grid, fading out towards the bottom of the hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1100px] bg-[linear-gradient(rgba(231,226,217,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(231,226,217,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <nav className="fixed top-0 z-50 w-full border-b border-stone-800/70 bg-[#0f0e0d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-3" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            {/* monogram: a room with a door swing */}
            <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
              <rect x="1.5" y="1.5" width="25" height="25" fill="none" stroke="#e7e2d9" strokeWidth="1.5" />
              <path d="M1.5 26.5 V14 A12.5 12.5 0 0 1 14 26.5" fill="none" stroke="#c8794a" strokeWidth="1.5" />
            </svg>
            <span className="text-[15px] font-semibold tracking-tight text-stone-100">Arch-E-Tech</span>
          </a>
          <div className="hidden items-center gap-9 text-[13px] text-stone-400 md:flex">
            <a href="#engine" className="transition-colors hover:text-stone-100">How it works</a>
            <a href="#index" className="transition-colors hover:text-stone-100">Features</a>
            <a href="#renders" className="transition-colors hover:text-stone-100">Photo Render</a>
            <a href="#faq" className="transition-colors hover:text-stone-100">FAQ</a>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/auth" className="hidden text-[13px] text-stone-400 transition-colors hover:text-stone-100 sm:block">Log in</Link>
            <Link to="/auth" className="rounded-sm bg-[#e7e2d9] px-4 py-2 text-[13px] font-semibold text-[#141312] transition-colors hover:bg-white">Start designing</Link>
          </div>
        </div>
      </nav>

      <Hero />

      <main className="relative mx-auto max-w-7xl px-6">
        <section id="engine" className="scroll-mt-28 py-20">
          <SectionHead sheet="A-100 · HOW IT WORKS" title="One sentence in. A buildable plan out.">
            The same brief travels the whole way: it becomes a room program, a plan drawn to scale, a 3D model and a costed set of numbers.
          </SectionHead>
          <EngineLoop />
        </section>

        <section id="index" className="scroll-mt-28 py-20">
          <SectionHead sheet="DRAWING INDEX" title="Everything in one studio." />
          <ul className="border-t border-stone-800">
            {INDEX.map(item => (
              <li key={item.sheet} className="group grid grid-cols-[70px_1fr] gap-4 border-b border-stone-800 py-6 transition-colors hover:bg-stone-900/30 sm:grid-cols-[110px_240px_1fr] sm:gap-8 sm:px-2">
                <span className="font-mono text-[12px] text-stone-500 transition-colors group-hover:text-[#c8794a]">{item.sheet}</span>
                <span className="text-[17px] font-medium text-stone-100">{item.title}</span>
                <span className="col-span-2 text-[15px] leading-relaxed text-stone-400 sm:col-span-1">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="renders" className="scroll-mt-28 py-20">
          <SectionHead sheet="A-301 · PHOTO RENDER" title="From line drawing to photograph.">
            Each room is photographed empty first, in one shared house style, then furnished the way you describe. Drag across to compare.
          </SectionHead>
          <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-12">
            <ul className="space-y-5 text-[14px]">
              {[['01', 'Pick a house style', 'Modern, Japandi, Scandinavian, industrial and more.'],
                ['02', 'Photograph the empty room', 'Every room matches: same floors, walls and light.'],
                ['03', 'Describe the furniture', 'Your words decide what goes in and how it looks.'],
                ['04', 'Keep the ones you like', 'Saved photos stay in your gallery to rename or remake.']].map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[28px_1fr] gap-2">
                  <span className="font-mono text-[11px] text-[#c8794a]">{n}</span>
                  <span><span className="block text-stone-100">{t}</span><span className="text-stone-500">{d}</span></span>
                </li>
              ))}
            </ul>
            <SketchToPhoto />
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 py-20">
          <SectionHead sheet="NOTES" title="Questions, answered." />
          <div className="grid lg:grid-cols-[260px_1fr] lg:gap-12">
            <div />
            <ul className="border-t border-stone-800">
              {FAQ.map((f, i) => {
                const open = openFaq === i;
                return (
                  <li key={f.q} className="border-b border-stone-800">
                    <button onClick={() => setOpenFaq(open ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left" aria-expanded={open}>
                      <span className="text-[16px] text-stone-100">{f.q}</span>
                      {open ? <Minus className="h-4 w-4 shrink-0 text-stone-500" /> : <Plus className="h-4 w-4 shrink-0 text-stone-500" />}
                    </button>
                    <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <p className="overflow-hidden max-w-2xl text-[15px] leading-relaxed text-stone-400">{f.a}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="py-24">
          <div className="border border-stone-800 px-6 py-16 text-center sm:px-12">
            <p className="font-mono text-[11px] tracking-[0.25em] text-stone-500">BEGIN</p>
            <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-stone-100 sm:text-5xl">Start with a sentence.</h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-stone-400">Your first plan takes about ten seconds. No drawing skills needed.</p>
            <Link to="/auth" className="group mt-9 inline-flex items-center gap-2 rounded-sm bg-[#e7e2d9] px-6 py-3.5 text-sm font-semibold text-[#141312] transition-colors hover:bg-white">
              Start designing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>

      {/* footer as a drawing title block */}
      <footer className="border-t border-stone-800">
        <div className="mx-auto grid max-w-7xl grid-cols-2 font-mono text-[10px] text-stone-500 sm:grid-cols-5">
          {[['STUDIO', 'Arch-E-Tech'], ['PROJECT', 'Your next home'], ['SCALE', '1 : 100'], ['SHEET', 'A-000'], ['YEAR', String(new Date().getFullYear())]].map(([k, v], i) => (
            <div key={k} className={`px-6 py-5 ${i ? 'sm:border-l' : ''} ${i % 2 ? 'border-l sm:border-l' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''} border-stone-800`}>
              <div className="tracking-[0.2em] text-stone-600">{k}</div>
              <div className="mt-1 text-stone-300">{v}</div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

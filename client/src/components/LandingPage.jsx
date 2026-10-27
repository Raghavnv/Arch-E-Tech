import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ScanLine, PenTool, Box, Calculator, Sun, Sparkles,
  ChevronDown, Sofa, Building, Play, MoveHorizontal, ShieldCheck, Ruler
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import TechStory from './TechStory';

gsap.registerPlugin(ScrollTrigger);

const img = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const PHOTOS = {
  facade: '1487958449943-2429e8be8625',
  towers: '1486406146926-c627a92ad1ab',
  drafting: '1503387762-592deb58ef4e',
  villa: '1512917774080-9991f1c4c750',
  apartment: '1545324418-cc1a3fa10c00',
  poolHouse: '1564013799919-ab600027ffc6',
  livingRoom: '1600210492486-724fe5c67fb0',
  cube: '1600596542815-ffad4c1539a9',
  interior: '1600607687939-ce8a6c25118c',
  modern: '1613490493576-7fde63acd811',
  staged: '1600585154340-be6161a56a0c',
};
const MARQUEE_A = ['villa', 'interior', 'facade', 'cube', 'livingRoom', 'poolHouse'];
const MARQUEE_B = ['modern', 'drafting', 'apartment', 'towers', 'staged', 'villa'];

const FEATURES = [
  { icon: ScanLine, title: 'Prompt-Driven Blueprints', photo: 'facade', span: 'lg:col-span-2', body: 'Type "3-bedroom villa with master suite" and get a complete, zoned architectural layout in seconds.' },
  { icon: PenTool, title: 'Sub-Millimeter 2D CAD', photo: 'drafting', body: 'Intelligent 45° snapping, automatic wall joining and live dimensions.' },
  { icon: Box, title: 'First-Person Walkthrough', photo: 'interior', body: 'Step inside your design and walk through real doors with collision detection.' },
  { icon: Sofa, title: 'Virtual Stager', photo: 'livingRoom', body: 'Furnish empty rooms in modern, Japandi or industrial styles.' },
  { icon: Sun, title: 'Solar Simulation', photo: 'villa', body: 'Accurate sun position and shadows to optimise daylight in every room.' },
  { icon: Calculator, title: 'Live Cost Takeoffs', photo: 'apartment', span: 'lg:col-span-2', body: 'A real-time bill of quantities for wall lengths and material totals, exportable to PDF.' },
];

// Draggable before/after comparison
function CompareSlider() {
  const [pos, setPos] = useState(55);
  const box = useRef(null);
  const move = useCallback((clientX) => {
    const r = box.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);
  return (
    <div
      ref={box}
      className="group relative aspect-[4/3] cursor-ew-resize touch-none select-none overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_80px_-20px_rgba(99,102,241,0.35)]"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) move(e.clientX); }}
    >
      <img src={img(PHOTOS.interior, 1200)} alt="Staged room" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={img(PHOTOS.interior, 1200)} alt="Unfurnished shell" className="h-full w-full object-cover grayscale brightness-[1.35] contrast-[0.7] blur-[1px]" draggable={false} />
        <div className="absolute inset-0 bg-indigo-950/50 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(165,180,252,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(165,180,252,0.18)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>
      <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-200 backdrop-blur">Raw model</span>
      <span className="absolute right-4 top-4 rounded-full border border-indigo-300/30 bg-indigo-500/30 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur"><Sparkles className="mr-1 inline h-3 w-3" />Staged</span>
      <div className="absolute inset-y-0 w-px bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform group-active:scale-110">
          <MoveHorizontal className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Marquee({ ids, reverse = false }) {
  const row = [...ids, ...ids];
  return (
    <div className="flex w-max gap-4 animate-marquee" style={{ animationDirection: reverse ? 'reverse' : 'normal' }}>
      {row.map((k, i) => (
        <div key={i} className="h-40 w-64 shrink-0 overflow-hidden rounded-2xl border border-white/10 md:h-52 md:w-80">
          <img src={img(PHOTOS[k], 600)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-110" />
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const containerRef = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.hero-elem', { y: 36, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 0.1 });
      gsap.from('.hero-photo', { opacity: 0, scale: 0.85, y: 60, duration: 1.4, stagger: 0.15, ease: 'power3.out', delay: 0.5 });

      // parallax: each element drifts at its own speed while the hero scrolls away
      gsap.utils.toArray('.parallax').forEach((el) => {
        gsap.to(el, { yPercent: Number(el.dataset.speed || -20), ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
      });

      gsap.utils.toArray('.reveal').forEach((el) => {
        gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
      });
      gsap.from('.feature-card', { y: 60, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '#features', start: 'top 70%' } });

      // metric counters
      gsap.utils.toArray('.count').forEach((el) => {
        const end = Number(el.dataset.to);
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString(); } });
      });
    });
  }, { scope: containerRef });

  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const [openFaq, setOpenFaq] = useState(null);
  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-transparent font-sans text-zinc-300 selection:bg-indigo-300 selection:text-black">

      {/* NAV */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/5 bg-[#09090b]/60 px-6 py-3.5 backdrop-blur-2xl md:px-8">
        <div className="group flex cursor-pointer items-center gap-3" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-300 shadow-[0_0_20px_rgba(129,140,248,0.5)] transition-transform group-hover:rotate-6 group-hover:scale-105">
            <Building className="h-4 w-4 text-black" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">Arch-E-Tech</span>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-300 sm:inline">Studio v3.2</span>
        </div>

        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          {[['features', 'Modules'], ['technology', 'Engine'], ['stager-demo', 'Virtual Stager'], ['faq', 'FAQ']].map(([id, label]) => (
            <button key={id} onClick={() => scrollToSection(id)} className="relative text-zinc-400 transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-indigo-300 after:transition-all hover:text-white hover:after:w-full">{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link to="/auth" className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:block">Log in</Link>
          <Link to="/auth" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.35)] active:scale-95">Launch App</Link>
        </div>
      </nav>

      {/* HERO */}
      <header id="hero" className="relative overflow-hidden px-6 pb-24 pt-44">

        {/* blueprint line-art drawing itself behind the headline */}
        <svg className="pointer-events-none absolute left-1/2 top-24 w-[1200px] max-w-none -translate-x-1/2 opacity-[0.18]" viewBox="0 0 1200 520" fill="none" stroke="#818cf8" strokeWidth="1.2">
          <path className="draw-line" style={{ '--len': 3200 }} d="M60 460 H1140 M180 460 V200 L420 90 L660 200 V460 M420 90 V460 M660 300 H940 V460 M940 300 L1010 240 L1080 300 V460 M250 330 H340 V460 M500 250 H580 V330 H500 Z" />
          <circle className="draw-line" style={{ '--len': 400 }} cx="1040" cy="90" r="42" />
          <path className="draw-line" style={{ '--len': 300 }} d="M60 490 H660 M60 484 V496 M660 484 V496" />
        </svg>

        {/* floating photographs */}
        <div className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1500px] lg:block">
          <div className="parallax absolute left-[2.5%] top-40" data-speed="-30">
            <div className="hero-photo animate-float-slow h-60 w-44 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-indigo-900/40" style={{ '--r': '-7deg' }}>
              <img src={img(PHOTOS.villa, 500)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          </div>
          <div className="parallax absolute left-[7%] top-[26rem]" data-speed="-55">
            <div className="hero-photo animate-float h-36 w-52 overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
              <img src={img(PHOTOS.drafting, 500)} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="parallax absolute right-[2.5%] top-36" data-speed="-45">
            <div className="hero-photo animate-float h-44 w-60 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-cyan-900/30">
              <img src={img(PHOTOS.facade, 500)} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="parallax absolute right-[6%] top-[24rem]" data-speed="-25">
            <div className="hero-photo animate-float-slow h-56 w-40 overflow-hidden rounded-2xl border border-white/15 shadow-2xl" style={{ '--r': '6deg' }}>
              <img src={img(PHOTOS.interior, 500)} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="hero-elem mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-300">Autonomous Architectural Copilot</span>
          </div>

          <h1 className="hero-elem mb-6 text-5xl font-bold leading-[1.02] tracking-tighter text-white sm:text-6xl md:text-7xl lg:-mx-20 lg:text-[4.4rem]">
            Architecture, <br className="hidden sm:block" />
            <span className="font-serif text-6xl font-normal italic sm:text-7xl md:text-8xl lg:text-[5.4rem] text-gradient">engineered</span>
            <span className="text-zinc-500"> from sketch to 8K.</span>
          </h1>

          <p className="hero-elem mx-auto mb-10 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">
            Generate structurally sound multi-room blueprints, verify IBC codes instantly, and step inside with first-person 3D walkthroughs — all within a single unified browser studio.
          </p>

          <div className="hero-elem mb-20 flex flex-wrap items-center justify-center gap-4">
            <Link to="/auth" className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_40px_rgba(165,180,252,0.6)] active:scale-95">
              Start Designing Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button onClick={() => scrollToSection('technology')} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/10">
              <Play className="h-4 w-4 text-indigo-300" /> Watch it build
            </button>
          </div>
        </div>

        {/* Studio mockup */}
        <div className="hero-elem relative z-10 mx-auto max-w-5xl">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-r from-indigo-500/25 via-cyan-400/15 to-violet-500/25 blur-3xl" />

          {/* floating chips */}
          <div className="animate-float absolute -left-3 top-16 z-20 hidden items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300 backdrop-blur-xl md:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> IBC 100% pass
          </div>
          <div className="animate-float-slow absolute -right-3 bottom-24 z-20 hidden items-center gap-2 rounded-xl border border-indigo-300/25 bg-indigo-500/15 px-3 py-2 font-mono text-[11px] text-indigo-200 backdrop-blur-xl md:flex" style={{ '--r': '0deg' }}>
            <Ruler className="h-3.5 w-3.5" /> 1,840 sq ft · 3 bed
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl">
            <div className="flex h-10 items-center justify-between border-b border-white/10 bg-zinc-900/60 px-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="font-mono text-[10px] tracking-wider text-zinc-500">arch-e-tech.studio/live-engine</span>
              <span className="w-10" />
            </div>

            <div className="relative grid max-h-[520px] grid-cols-1 md:aspect-[16/9] md:grid-cols-2">
              <div className="relative flex flex-col justify-between overflow-hidden border-r border-white/10 p-6">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#818cf80d_1px,transparent_1px),linear-gradient(to_bottom,#818cf80d_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-indigo-300">2D Vector Draft</span>
                  <span className="font-mono text-[10px] text-zinc-600">1:50 Scale</span>
                </div>
                <div className="relative z-10 my-auto flex items-center justify-center py-6">
                  <svg viewBox="0 0 420 300" className="w-full max-w-sm" fill="none">
                    <g stroke="#a5b4fc" strokeWidth="4" strokeLinecap="square">
                      <path className="draw-line" style={{ '--len': 1000, animationDelay: '.6s' }} pathLength="1000" d="M20 20 H400 V260 H20 Z" />
                      <path className="draw-line" style={{ '--len': 300, animationDelay: '2s' }} pathLength="300" d="M20 140 H200 V20" />
                      <path className="draw-line" style={{ '--len': 200, animationDelay: '2.5s' }} pathLength="200" d="M20 80 H130 V20" />
                    </g>
                    <path className="draw-line" style={{ '--len': 120, animationDelay: '3s' }} pathLength="120" d="M200 80 A30 30 0 0 1 170 110 M200 80 V110" stroke="#71717a" strokeWidth="2" strokeDasharray="4 4" />
                    <g stroke="#52525b" strokeWidth="1"><path d="M20 280 H400 M20 274 V286 M400 274 V286" /></g>
                    <g fontFamily="JetBrains Mono, monospace" fontSize="10" className="animate-float">
                      <text x="36" y="118" fill="#c7d2fe">Master Suite</text>
                      <text x="30" y="55" fill="#71717a" fontSize="8">Ensuite</text>
                      <text x="236" y="146" fill="#c7d2fe">Living Pavilion</text>
                      <text x="190" y="296" fill="#71717a" fontSize="9">12.40 m</text>
                    </g>
                    <circle r="5" fill="#22d3ee"><animateMotion dur="9s" repeatCount="indefinite" path="M20 20 H400 V260 H20 Z" /></circle>
                  </svg>
                </div>
              </div>

              <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden bg-zinc-950 p-6">
                <img src={img(PHOTOS.cube, 1280)} alt="3D photorealistic render" className="absolute inset-0 h-full w-full scale-105 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/90 via-transparent to-[#09090b]/20" />
                <div className="relative z-10">
                  <span className="rounded border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-zinc-200 backdrop-blur-md">8K NEURAL RENDER</span>
                </div>
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 p-2.5 text-[11px] backdrop-blur-md"><span className="font-medium text-zinc-300">IBC Compliance:</span><span className="font-mono text-emerald-400">100% Pass</span></div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 p-2.5 text-[11px] backdrop-blur-md"><span className="font-medium text-zinc-300">Est. Takeoff Cost:</span><span className="font-mono text-white">$48,500 USD</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* METRICS */}
      <section className="border-y border-white/5 bg-white/[0.015] py-14 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 text-center md:grid-cols-4">
          {[
            [<><span className="count" data-to="50000">0</span>+</>, 'Sq Ft Drafted'],
            [<>&lt; <span className="count" data-to="3">0</span>s</>, 'AI Synthesis'],
            [<><span className="count" data-to="100">0</span>%</>, 'Code Compliant'],
            ['Zero', 'CAD Experience Needed'],
          ].map(([v, l], i) => (
            <div key={i}>
              <div className="mb-1 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">{v}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GALLERY MARQUEE */}
      <section className="overflow-hidden py-16" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
        <div className="space-y-4">
          <Marquee ids={MARQUEE_A} />
          <Marquee ids={MARQUEE_B} reverse />
        </div>
      </section>

      {/* TECHNOLOGY — scroll-driven story */}
      <TechStory />

      {/* FEATURES — bento with photography */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-28">
        <div className="reveal mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 font-serif text-4xl text-white md:text-6xl">A unified <span className="italic text-zinc-400">workflow.</span></h2>
          <p className="text-sm font-light leading-relaxed text-zinc-400 md:text-base">Draft, validate, simulate, and present your projects seamlessly within the browser.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, photo, span = '' }) => (
            <div key={title} className={`feature-card glow-card group relative min-h-[300px] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 ${span || 'lg:col-span-1'} ${span ? 'md:col-span-2' : ''}`}>
              <img src={img(PHOTOS[photo], 900)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition-all duration-700 group-hover:scale-110 group-hover:opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/70 to-transparent" />
              <div className="relative flex h-full min-h-[300px] flex-col justify-end p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur transition-colors group-hover:bg-indigo-400 group-hover:text-black">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                <p className="max-w-sm text-sm leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-200">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* VIRTUAL STAGER */}
      <section id="stager-demo" className="mx-auto max-w-6xl scroll-mt-20 border-t border-white/5 px-6 py-28">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div className="reveal space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <Sofa className="h-3 w-3" /> Virtual Staging
            </div>
            <h3 className="font-serif text-4xl leading-tight text-white md:text-6xl">From empty space to <span className="italic text-gradient">designer interior.</span></h3>
            <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
              Upload a picture of any empty room, specify your desired furnishings, and generate a fully staged, photorealistic interior in seconds.
            </p>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-indigo-300">
              <MoveHorizontal className="h-4 w-4" /> Drag the handle to compare
            </p>
          </div>
          <div className="reveal"><CompareSlider /></div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. ARCHITECTURE FAQ                                                       */}
      {/* ========================================================================= */}
      <section id="faq" className="py-24 px-6 max-w-3xl mx-auto border-t border-white/5">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
            Questions & Answers
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Do I need prior CAD experience to use Arch-E-Tech?",
              a: "No. You can generate complete multi-room layouts from plain text descriptions. For manual edits, our editor automatically snaps walls and angles for you."
            },
            {
              q: "Can I walk through my floor plan in 3D?",
              a: "Yes. Click the '3D View' tab and toggle 'First-Person Walkthrough'. You can navigate using standard WASD keys, and physical collisions prevent walking through solid walls."
            },
            {
              q: "How does the structural cost estimation work?",
              a: "The engine calculates linear meters of walls, counts doors and windows, and applies regional contractor rates to generate a live Bill of Quantities (BoQ) which can be exported to PDF."
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex items-center justify-between text-zinc-200 font-medium text-sm hover:bg-zinc-900/50 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800/50 pt-4 bg-zinc-900/20">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. BOTTOM CTA                                                             */}
      {/* ========================================================================= */}
      <section className="py-32 px-6 border-t border-white/5 text-center">
        <h2 className="font-serif text-5xl md:text-7xl text-white mb-6">Ready to <span className="italic text-gradient">build?</span></h2>
        <p className="text-zinc-400 text-base font-light mb-8">
          Draft your first project free. No credit card required.
        </p>
        <Link 
          to="/auth" 
          className="inline-flex items-center justify-center bg-white text-black font-semibold text-sm px-8 py-3.5 rounded-full hover:bg-zinc-200 transition-all active:scale-95"
        >
          Launch Studio
        </Link>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="border-t border-white/5 py-8 px-6 bg-[#0a0a0c]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-zinc-500" />
            <span className="font-semibold text-zinc-400">Arch-E-Tech Platform</span>
          </div>
          <div>© {new Date().getFullYear()} Arch-E-Tech. Engineered for precision.</div>
        </div>
      </footer>

    </div>
  );
}

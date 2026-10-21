import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, ScanLine, PenTool, Box, AlertTriangle, Calculator, 
  Code2, Layers, Zap, Sun, FileText, Magnet, LayoutTemplate, 
  MessageSquare, Image as ImageIcon, CheckCircle2, ShieldCheck, 
  Sparkles, ChevronDown, Eye, Sofa, Building, Check, Compass, 
  Sliders, RefreshCw, Activity
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import TechHologramEngine from './TechHologramEngine';

export default function LandingPage() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Entrance animations
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from('.hero-elem', {
        y: 35,
        opacity: 0,
        duration: 1.1,
        stagger: 0.12,
        ease: 'power3.out',
        delay: 0.1
      });
    });
  }, { scope: containerRef });

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // Interactive FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(null);
  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Before/After Stager Interactive Toggle
  const [stagedPreview, setStagedPreview] = useState(true);

  return (
    <div ref={containerRef} className="min-h-screen bg-transparent text-zinc-300 font-sans selection:bg-indigo-500 selection:text-white relative">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION                                                         */}
      {/* ========================================================================= */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/80 backdrop-blur-xl bg-zinc-950/80 fixed top-0 w-full z-50 shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)]">
            <Building className="w-4 h-4 text-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight text-lg">Arch-E-Tech</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              v2.0 LIVE
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button onClick={() => scrollToSection('features')} className="text-zinc-400 hover:text-white transition-colors">
            Core Modules
          </button>
          <button onClick={() => scrollToSection('technology')} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Technology Engine
          </button>
          <button onClick={() => scrollToSection('stager-demo')} className="text-zinc-400 hover:text-white transition-colors">
            AI Room Stager
          </button>
          <button onClick={() => scrollToSection('faq')} className="text-zinc-400 hover:text-white transition-colors">
            FAQ
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/auth" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link 
            to="/auth" 
            className="text-sm font-semibold text-black bg-white hover:bg-zinc-200 px-6 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95"
          >
            Launch Platform
          </Link>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. WELCOMING HERO SECTION                                                 */}
      {/* ========================================================================= */}
      <header className="pt-40 pb-20 px-6 max-w-7xl mx-auto relative overflow-hidden">
        
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-emerald-600/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="text-center max-w-4xl mx-auto relative z-10">
          
          {/* Pill Badge */}
          <div className="hero-elem inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 backdrop-blur-md mb-8 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-zinc-200 tracking-wide">
              The Autonomous Architectural & BIM Copilot
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-xs text-indigo-400 font-mono">Zero CAD Experience Needed</span>
          </div>

          {/* Main Headline */}
          <h1 className="hero-elem text-5xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-extrabold tracking-tight text-white mb-6 leading-[1.06]">
            Architectural intelligence,<br />
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              engineered from sketch to 8K.
            </span>
          </h1>

          {/* Welcoming Subtitle */}
          <p className="hero-elem text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto font-normal leading-relaxed">
            Welcome to Arch-E-Tech. Generate architecturally sound multi-room floor plans, step inside with first-person 3D walkthroughs, verify building codes automatically, and stage entire rooms with photorealistic AI — all within a single unified browser studio.
          </p>

          {/* Primary Action Buttons */}
          <div className="hero-elem flex flex-wrap items-center justify-center gap-4 mb-14">
            <Link 
              to="/auth" 
              className="inline-flex items-center justify-center gap-2.5 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 text-sm"
            >
              Start Designing Free <ArrowRight className="w-4 h-4" />
            </Link>
            <button 
              onClick={() => {
                scrollToSection('technology');
                setIsPlaying(true);
              }}
              className="inline-flex items-center justify-center gap-2.5 bg-zinc-900/90 text-white border border-zinc-700/80 hover:border-zinc-500 px-8 py-4 rounded-full font-semibold hover:bg-zinc-800 transition-all text-sm backdrop-blur-md shadow-xl"
            >
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" /> Watch Video Engine
            </button>
            <a 
              href="https://github.com/Raghavnv/Arch-E-Tech" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-zinc-400 hover:text-white px-5 py-4 rounded-full font-medium transition-colors text-sm"
            >
              <Code2 className="w-4 h-4" /> GitHub
            </a>
          </div>

          {/* Value Badges */}
          <div className="hero-elem flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 100% IBC/NBC Code Verified</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Fast 3-Second AI Renders</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-amber-400" /> WASD First-Person 3D Walkthrough</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Automatic Bill of Quantities</span>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. HERO GRAPHICAL STUDIO PREVIEW MOCKUP                                    */}
        {/* ========================================================================= */}
        <div className="mt-16 max-w-6xl mx-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/90 shadow-[0_20px_80px_rgba(0,0,0,0.8)] overflow-hidden relative group">
          
          {/* Mock Browser Header */}
          <div className="h-11 border-b border-zinc-800 bg-zinc-900/90 px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="text-xs text-zinc-500 font-mono ml-3">arch-e-tech.studio/live-engine</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Engine Active</span>
              <span className="text-zinc-600">•</span>
              <span>Floor 1 of 3</span>
            </div>
          </div>

          {/* Interactive Split Mock Studio Canvas */}
          <div className="grid grid-cols-1 md:grid-cols-2 aspect-[16/9] max-h-[580px] bg-black relative">
            
            {/* Left: 2D Vector CAD View */}
            <div className="relative border-r border-zinc-800 p-6 flex flex-col justify-between overflow-hidden bg-[#09090b]">
              {/* Subtle Grid */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-md">
                  2D VECTOR BLUEPRINT
                </span>
                <span className="text-xs text-zinc-500 font-mono">Grid: 40px Snap</span>
              </div>

              {/* Animated Blueprint Blueprint Graphic */}
              <div className="relative z-10 my-auto flex items-center justify-center">
                <svg width="420" height="280" viewBox="0 0 420 280" className="w-full max-w-sm drop-shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  {/* Outer Perimeter */}
                  <rect x="20" y="20" width="380" height="240" fill="none" stroke="#e4e4e7" strokeWidth="6" rx="4" />
                  {/* Master Suite partition */}
                  <line x1="20" y1="140" x2="200" y2="140" stroke="#e4e4e7" strokeWidth="5" />
                  <line x1="200" y1="20" x2="200" y2="140" stroke="#e4e4e7" strokeWidth="5" />
                  {/* Ensuite Bath */}
                  <line x1="130" y1="20" x2="130" y2="80" stroke="#e4e4e7" strokeWidth="4" />
                  <line x1="20" y1="80" x2="130" y2="80" stroke="#e4e4e7" strokeWidth="4" />
                  {/* Door swings (amber) */}
                  <path d="M 200 80 A 30 30 0 0 1 170 110" fill="none" stroke="#facc15" strokeWidth="2.5" strokeDasharray="4 4" />
                  <line x1="200" y1="80" x2="200" y2="110" stroke="#facc15" strokeWidth="3" />
                  {/* Window (blue) */}
                  <line x1="60" y1="20" x2="110" y2="20" stroke="#60a5fa" strokeWidth="6" />
                  <line x1="260" y1="20" x2="340" y2="20" stroke="#60a5fa" strokeWidth="6" />
                  {/* Labels */}
                  <text x="40" y="115" fill="#a1a1aa" fontSize="11" fontFamily="monospace">Master Suite</text>
                  <text x="35" y="55" fill="#71717a" fontSize="9" fontFamily="monospace">Ensuite</text>
                  <text x="250" y="140" fill="#a1a1aa" fontSize="11" fontFamily="monospace">Living & Dining</text>
                  {/* Dimension marker */}
                  <text x="210" y="272" fill="#52525b" fontSize="9" fontFamily="monospace">↔ 18' 6" [5.64m]</text>
                </svg>
              </div>

              <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Rooms: 3 Bed • 2 Bath</span>
                <span className="text-emerald-400">100% Verified Egress</span>
              </div>
            </div>

            {/* Right: 3D Photorealistic / Walkthrough View */}
            <div className="relative p-6 flex flex-col justify-between overflow-hidden bg-zinc-950">
              <img 
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80" 
                alt="3D Photorealistic Render" 
                className="absolute inset-0 w-full h-full object-cover filter brightness-90 contrast-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-white bg-indigo-600/90 border border-indigo-400/40 px-3 py-1 rounded-md flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3.5 h-3.5" /> 3D PHOTOREALISTIC RENDER
                </span>
                <span className="text-xs text-zinc-300 font-mono bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md">
                  SunCalc: 2:30 PM Noon
                </span>
              </div>

              {/* Floating Metric Badges */}
              <div className="relative z-10 flex flex-col gap-2.5">
                <div className="bg-black/75 backdrop-blur-md border border-zinc-700/80 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-zinc-200 font-semibold">IBC Compliance:</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">100% Pass (0 Clashes)</span>
                </div>
                <div className="bg-black/75 backdrop-blur-md border border-zinc-700/80 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-400" />
                    <span className="text-zinc-200 font-semibold">Live Takeoff Est:</span>
                  </div>
                  <span className="text-white font-mono font-bold">$48,500 USD</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 4. PLATFORM METRICS COUNTER BAR                                           */}
      {/* ========================================================================= */}
      <section className="py-14 border-y border-zinc-900 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-white mb-1">50,000+</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Sq Ft Drafted & Engineered</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-emerald-400 mb-1">&lt; 3.5s</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Fast AI Synthesis Speed</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-indigo-400 mb-1">100%</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Automated Code Compliance</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-amber-400 mb-1">10 Presets</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Seamless Wall Textures</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE 3D ARCHITECTURAL HOLOGRAPHIC CAD SIMULATOR                 */}
      {/* ========================================================================= */}
      <section id="technology" className="py-24 px-6 max-w-7xl mx-auto relative scroll-mt-24">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Sparkles className="w-3.5 h-3.5" /> Autonomous Architectural CAD Simulator
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            How Arch-E-Tech Works
          </h2>
          <p className="text-zinc-400 text-base md:text-lg font-light leading-relaxed">
            Interact with our live 3D holographic CAD simulator below. Click and drag to orbit 360°, explode architectural BIM layers, trigger LiDAR radar laser sweeps, and simulate dynamic solar illumination.
          </p>
        </div>

        {/* The Live Interactive 3D Holographic CAD Simulator */}
        <TechHologramEngine />

      </section>

      {/* ========================================================================= */}
      {/* 6. COMPUTATIONAL MODULES (Feature Grid)                                   */}
      {/* ========================================================================= */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto border-t border-zinc-900">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Unified Architectural Architecture
          </h2>
          <p className="text-zinc-400 text-base md:text-lg font-light leading-relaxed">
            Everything you need to draft, validate, simulate, and present your projects — zero fragmented tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <ScanLine className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Prompt-Driven Blueprints</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Type descriptions like "3-bedroom villa with master suite and ensuite bath" to generate full architectural layouts with realistic room dimensions in 3 seconds.
            </p>
            <span className="text-xs font-mono text-indigo-400 font-semibold">Generative AI Engine &rarr;</span>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <PenTool className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sub-Millimeter 2D CAD Canvas</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Vector draft with intelligent 45° angle snapping, automatic wall joining, door swings, and window insertions. All edits persist in real-time.
            </p>
            <span className="text-xs font-mono text-emerald-400 font-semibold">Fabric.js Vector Canvas &rarr;</span>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
              <Box className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">WASD First-Person Walkthrough</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Step right inside your design. Walk through physical door cutouts with authentic camera collision detection, floor slabs, and ceilings.
            </p>
            <span className="text-xs font-mono text-amber-400 font-semibold">WebGL Locomotion &rarr;</span>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <Sofa className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Whole-Room Virtual Stager</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Upload empty bedroom photos or pick templates to furnish entire spaces with 14mm wide-angle magazine quality in modern, Japandi, or industrial styles.
            </p>
            <span className="text-xs font-mono text-purple-400 font-semibold">AI Room Redecorator &rarr;</span>
          </div>

          {/* Card 5 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform">
              <Sun className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">SunCalc Solar Simulation</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Simulate accurate geographic sun position and shadows for any hour of the day to optimize room daylighting and energy efficiency.
            </p>
            <span className="text-xs font-mono text-teal-400 font-semibold">Daylighting Engine &rarr;</span>
          </div>

          {/* Card 6 */}
          <div className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-8 transition-all group relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Live Cost Takeoffs & Reports</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Real-time bill of quantities calculating wall linear meters, door/window costs, and furniture totals with one-click executive PDF exports.
            </p>
            <span className="text-xs font-mono text-rose-400 font-semibold">BOM Estimation &rarr;</span>
          </div>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 7. VIRTUAL ROOM STAGER INTERACTIVE SHOWCASE                               */}
      {/* ========================================================================= */}
      <section id="stager-demo" className="py-24 px-6 max-w-7xl mx-auto border-t border-zinc-900">
        
        <div className="bg-gradient-to-b from-zinc-950 via-zinc-900/60 to-zinc-950 border border-zinc-800 rounded-3xl p-8 md:p-14 overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <Sofa className="w-3.5 h-3.5" /> Virtual Stager Feature
              </div>
              
              <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Turn Empty Rooms into Designer Living Spaces
              </h3>
              
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                Upload a picture of any empty bedroom or bare space, specify your desired furnishings, and generate a fully furnished, wide-angle interior in 3 seconds.
              </p>

              {/* Interactive Toggle */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setStagedPreview(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    !stagedPreview ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Original Empty Space
                </button>
                <button
                  onClick={() => setStagedPreview(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    stagedPreview ? 'bg-emerald-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Staged Room
                </button>
              </div>

              <div className="pt-4">
                <Link
                  to="/render-studio"
                  className="inline-flex items-center gap-2 text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 px-5 py-3 rounded-xl transition-all border border-zinc-700"
                >
                  Open Virtual Room Stager &rarr;
                </Link>
              </div>
            </div>

            {/* Visual Image Preview */}
            <div className="lg:col-span-7 aspect-[16/10] rounded-2xl overflow-hidden border border-zinc-800 relative shadow-2xl">
              <img 
                src={stagedPreview 
                  ? "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80" 
                  : "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1280&q=80"
                } 
                alt="Room Staging Preview" 
                className="w-full h-full object-cover transition-all duration-300"
              />
              <div className="absolute top-4 left-4 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-white border border-zinc-800">
                {stagedPreview ? '✨ AI FURNISHED: ULTRA MODERN LUXURY' : 'ORIGINAL UNSTAGED ROOM'}
              </div>
            </div>

          </div>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 8. ARCHITECTURE FAQ (Welcoming & Informative)                             */}
      {/* ========================================================================= */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto border-t border-zinc-900">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            Everything you need to know about designing with Arch-E-Tech.
          </p>
        </div>

        <div className="space-y-4">
          
          {[
            {
              q: "Do I need prior architectural or CAD experience to use Arch-E-Tech?",
              a: "Not at all! Arch-E-Tech was designed specifically to bridge the gap between imagination and precision CAD. You can generate complete multi-room layouts from plain text descriptions, and our intelligent editor automatically snaps walls and angles for you."
            },
            {
              q: "How does the AI ensure the master bedroom is larger and properly laid out?",
              a: "Our architectural synthesis algorithms evaluate room hierarchies. When you request a master suite, it allocates a larger primary footprint (e.g. 380x300px), anchors an en-suite bath directly to it, and isolates secondary bedrooms to guarantee privacy and logical circulation."
            },
            {
              q: "Can I walk through my floor plan in first-person 3D?",
              a: "Yes! Click the '3D' tab and select 'First-Person Walkthrough'. You can walk around using standard WASD keys, sprint with Shift, and look around with your mouse. Physical collisions prevent walking through solid walls, while doorways remain completely open."
            },
            {
              q: "Can I save my work and export reports anytime?",
              a: "Yes. All drawings save in real-time to your browser's local cache and sync to the cloud database automatically. You can export architectural PDF reports with structural narratives and cost takeoffs anytime, even if your floor plan is a work in progress."
            }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden transition-all"
            >
              <button 
                onClick={() => toggleFaq(idx)}
                className="w-full p-6 text-left flex items-center justify-between text-white font-semibold text-sm hover:text-indigo-400 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${openFaq === idx ? 'rotate-180 text-white' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-6 text-zinc-400 text-xs md:text-sm leading-relaxed border-t border-zinc-900 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 9. BOTTOM WELCOMING CALL TO ACTION                                        */}
      {/* ========================================================================= */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-zinc-900 text-center">
        <div className="bg-gradient-to-tr from-indigo-950/40 via-zinc-900 to-emerald-950/30 border border-zinc-800 rounded-3xl p-12 md:p-20 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
              Ready to bring your architectural vision to life?
            </h2>
            <p className="text-zinc-400 text-base font-light">
              Create an account in seconds or draft freely. No credit card required.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <Link 
                to="/auth" 
                className="bg-white text-black font-bold text-sm px-8 py-4 rounded-full hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
              >
                Launch Arch-E-Tech Studio &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
              <Building className="w-3 h-3 text-black" />
            </div>
            <span className="font-bold text-zinc-300">Arch-E-Tech Platform</span>
            <span className="text-zinc-600">|</span>
            <span>Autonomous Architectural Studio</span>
          </div>
          <div>© {new Date().getFullYear()} Arch-E-Tech. Engineered for precision and photorealism.</div>
        </div>
      </footer>

    </div>
  );
}

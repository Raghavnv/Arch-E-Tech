import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, ScanLine, PenTool, Box, Calculator, Code2, 
  Layers, Zap, Sun, CheckCircle2, ShieldCheck, Sparkles, 
  ChevronDown, Eye, Sofa, Building, Check, Sliders, RefreshCw, 
  Activity, Play 
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
        y: 30,
        opacity: 0,
        duration: 1.2,
        stagger: 0.1,
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
    <div ref={containerRef} className="min-h-screen bg-transparent text-zinc-300 font-sans selection:bg-zinc-200 selection:text-black relative">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION (Refined Glassmorphism)                                 */}
      {/* ========================================================================= */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur-2xl bg-[#0a0a0c]/70 fixed top-0 w-full z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-7 h-7 bg-zinc-100 rounded-md flex items-center justify-center transition-transform group-hover:scale-105">
            <Building className="w-4 h-4 text-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-tight text-lg">Arch-E-Tech</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              Studio v3.2
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button onClick={() => scrollToSection('features')} className="text-zinc-400 hover:text-white transition-colors">
            Modules
          </button>
          <button onClick={() => scrollToSection('technology')} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
            Engine
          </button>
          <button onClick={() => scrollToSection('stager-demo')} className="text-zinc-400 hover:text-white transition-colors">
            Virtual Stager
          </button>
          <button onClick={() => scrollToSection('faq')} className="text-zinc-400 hover:text-white transition-colors">
            FAQ
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/auth" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
            Log in
          </Link>
          <Link 
            to="/auth" 
            className="text-sm font-semibold text-black bg-white hover:bg-zinc-200 px-5 py-2 rounded-full transition-transform hover:scale-105 active:scale-95"
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. WELCOMING HERO SECTION                                                 */}
      {/* ========================================================================= */}
      <header className="pt-48 pb-20 px-6 max-w-7xl mx-auto relative overflow-hidden">
        
        <div className="text-center max-w-4xl mx-auto relative z-10">
          
          <div className="hero-elem inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-medium text-zinc-300 tracking-wide uppercase">
              Autonomous Architectural Copilot
            </span>
          </div>

          <h1 className="hero-elem text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter text-white mb-6 leading-[1.05]">
            Architecture, <br className="hidden sm:block" />
            <span className="text-zinc-500">engineered from sketch to 8K.</span>
          </h1>

          <p className="hero-elem text-lg text-zinc-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Generate structurally sound multi-room blueprints, verify IBC codes instantly, and step inside with first-person 3D walkthroughs — all within a single unified browser studio.
          </p>

          <div className="hero-elem flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link 
              to="/auth" 
              className="inline-flex items-center justify-center gap-2 bg-white text-black px-7 py-3.5 rounded-full font-semibold hover:bg-zinc-200 transition-all active:scale-95 text-sm"
            >
              Start Designing Free <ArrowRight className="w-4 h-4" />
            </Link>
            <button 
              onClick={() => scrollToSection('technology')}
              className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800 px-7 py-3.5 rounded-full font-medium transition-all text-sm backdrop-blur-md"
            >
              <Play className="w-4 h-4 text-zinc-400" /> Watch Demo
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. HERO GRAPHICAL STUDIO PREVIEW MOCKUP                                    */}
        {/* ========================================================================= */}
        <div className="hero-elem mt-8 max-w-5xl mx-auto rounded-2xl border border-zinc-800/80 bg-[#0a0a0c] shadow-2xl overflow-hidden relative">
          
          <div className="h-10 border-b border-zinc-800/80 bg-zinc-900/50 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono tracking-wider">
              <span>arch-e-tech.studio/live-engine</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 aspect-[16/9] max-h-[500px] bg-[#0a0a0c] relative">
            
            {/* Left: 2D Vector CAD View */}
            <div className="relative border-r border-zinc-800/80 p-6 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]"></div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                  2D Vector Draft
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">1:50 Scale</span>
              </div>

              <div className="relative z-10 my-auto flex items-center justify-center">
                <svg width="380" height="250" viewBox="0 0 420 280" className="w-full max-w-sm">
                  <rect x="20" y="20" width="380" height="240" fill="none" stroke="#52525b" strokeWidth="4" rx="2" />
                  <line x1="20" y1="140" x2="200" y2="140" stroke="#52525b" strokeWidth="4" />
                  <line x1="200" y1="20" x2="200" y2="140" stroke="#52525b" strokeWidth="4" />
                  <line x1="130" y1="20" x2="130" y2="80" stroke="#52525b" strokeWidth="4" />
                  <line x1="20" y1="80" x2="130" y2="80" stroke="#52525b" strokeWidth="4" />
                  <path d="M 200 80 A 30 30 0 0 1 170 110" fill="none" stroke="#71717a" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="200" y1="80" x2="200" y2="110" stroke="#71717a" strokeWidth="2" />
                  <line x1="60" y1="20" x2="110" y2="20" stroke="#a1a1aa" strokeWidth="4" />
                  <line x1="260" y1="20" x2="340" y2="20" stroke="#a1a1aa" strokeWidth="4" />
                  
                  <text x="40" y="115" fill="#71717a" fontSize="10" fontFamily="monospace">Master Suite</text>
                  <text x="35" y="55" fill="#52525b" fontSize="8" fontFamily="monospace">Ensuite</text>
                  <text x="230" y="140" fill="#71717a" fontSize="10" fontFamily="monospace">Living Pavilion</text>
                </svg>
              </div>
            </div>

            {/* Right: 3D Render View */}
            <div className="relative p-6 flex flex-col justify-between overflow-hidden bg-zinc-950">
              <img 
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80" 
                alt="3D Photorealistic Render" 
                className="absolute inset-0 w-full h-full object-cover filter contrast-[1.02] grayscale-[0.1]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c]/90 via-transparent to-transparent"></div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-200 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded">
                  8K NEURAL RENDER
                </span>
              </div>

              <div className="relative z-10 flex flex-col gap-2">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-medium">IBC Compliance:</span>
                  <span className="text-emerald-400 font-mono">100% Pass</span>
                </div>
                <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-medium">Est. Takeoff Cost:</span>
                  <span className="text-white font-mono">$48,500 USD</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 4. PLATFORM METRICS COUNTER BAR                                           */}
      {/* ========================================================================= */}
      <section className="py-12 border-y border-zinc-900 bg-[#0a0a0c]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">50k+</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Sq Ft Drafted</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">&lt; 3s</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">AI Synthesis</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">100%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Code Compliant</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">Zero</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">CAD Experience Needed</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE 3D ARCHITECTURAL HOLOGRAPHIC CAD SIMULATOR                 */}
      {/* ========================================================================= */}
      <section id="technology" className="py-24 px-6 max-w-6xl mx-auto relative scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
            Interactive Architecture Engine
          </h2>
          <p className="text-zinc-400 text-sm md:text-base font-light leading-relaxed">
            Drag to orbit the 3D topology. Switch between exploded BIM layers, LiDAR radar sweeps, and dynamic solar illumination.
          </p>
        </div>
        <TechHologramEngine />
      </section>

      {/* ========================================================================= */}
      {/* 6. COMPUTATIONAL MODULES (Feature Grid)                                   */}
      {/* ========================================================================= */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto border-t border-zinc-900">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
            A Unified Workflow
          </h2>
          <p className="text-zinc-400 text-sm md:text-base font-light leading-relaxed">
            Draft, validate, simulate, and present your projects seamlessly within the browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Card 1 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <ScanLine className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">Prompt-Driven Blueprints</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Type descriptions like "3-bedroom villa with master suite" to generate full architectural layouts instantly.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <PenTool className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">Sub-Millimeter 2D CAD</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Vector draft with intelligent 45° angle snapping, automatic wall joining, and dynamic dimensions.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <Box className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">First-Person Walkthrough</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Step inside your design. Walk through physical doors with authentic camera collision detection.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <Sofa className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">Virtual Stager</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Furnish entire spaces with 14mm wide-angle magazine quality in modern, Japandi, or industrial styles.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <Sun className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">Solar Simulation</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Simulate accurate geographic sun position and shadows to optimize room daylighting.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-6 transition-colors group">
            <Calculator className="w-5 h-5 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
            <h3 className="text-base font-semibold text-white mb-2">Live Cost Takeoffs</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">
              Real-time bill of quantities calculating wall linear meters and material totals for quick estimation.
            </p>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. VIRTUAL ROOM STAGER INTERACTIVE SHOWCASE                               */}
      {/* ========================================================================= */}
      <section id="stager-demo" className="py-24 px-6 max-w-6xl mx-auto border-t border-zinc-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <Sofa className="w-3 h-3" /> Virtual Staging
            </div>
            
            <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              From empty space to designer interior.
            </h3>
            
            <p className="text-zinc-400 text-sm leading-relaxed">
              Upload a picture of any empty room, specify your desired furnishings, and generate a fully staged, photorealistic interior in seconds.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setStagedPreview(false)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  !stagedPreview ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Empty Room
              </button>
              <button
                onClick={() => setStagedPreview(true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  stagedPreview ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Staged
              </button>
            </div>
          </div>

          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-800 relative bg-[#0a0a0c]">
            <img 
              src={stagedPreview 
                ? "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80" 
                : "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1280&q=80"
              } 
              alt="Room Staging Preview" 
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. ARCHITECTURE FAQ                                                       */}
      {/* ========================================================================= */}
      <section id="faq" className="py-24 px-6 max-w-3xl mx-auto border-t border-zinc-900">
        
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
            <div key={idx} className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl overflow-hidden">
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
      <section className="py-32 px-6 border-t border-zinc-900 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">
          Ready to build?
        </h2>
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
      <footer className="border-t border-zinc-900 py-8 px-6 bg-[#0a0a0c]">
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

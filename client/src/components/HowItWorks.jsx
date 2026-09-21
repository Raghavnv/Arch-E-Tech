import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, MessageSquare, Zap, PenTool, Box, CheckCircle } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function HowItWorks() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll-based cinematic timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "+=4000",
        scrub: 1,
        pin: true,
        anticipatePin: 1
      }
    });

    // Scene 0 to 1: Intro to Text Prompt
    tl.to(".intro-text", { opacity: 0, y: -50, duration: 1 })
      .fromTo(".scene-1", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1 })
      .to(".prompt-box", { width: "100%", duration: 1.5, ease: "power2.inOut" })
      .to(".prompt-text", { opacity: 1, duration: 1, text: "A modern 3-bedroom layout with a large kitchen..." }, "+=0.5")
      
    // Scene 1 to 2: AI Processing (Gemini/YOLO)
    tl.to(".scene-1", { opacity: 0, scale: 0.9, duration: 1 }, "+=1")
      .fromTo(".scene-2", { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 1 })
      .to(".ai-node", { rotation: 360, duration: 2, ease: "none" })
      .fromTo(".ai-code", { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.3, duration: 1 }, "-=1.5")
      
    // Scene 2 to 3: 2D Blueprint (FabricJS)
    tl.to(".scene-2", { opacity: 0, x: -100, duration: 1 }, "+=1")
      .fromTo(".scene-3", { opacity: 0, x: 100 }, { opacity: 1, x: 0, duration: 1 })
      .fromTo(".blueprint-line", { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 2, ease: "power2.out" })
      
    // Scene 3 to 4: 3D Extrusion
    tl.to(".scene-3", { opacity: 0, rotationX: 45, duration: 1 }, "+=1")
      .fromTo(".scene-4", { opacity: 0, rotationX: -45 }, { opacity: 1, rotationX: 0, duration: 1 })
      .fromTo(".box-3d", { scaleZ: 0.1, y: 50 }, { scaleZ: 1, y: 0, duration: 2, ease: "bounce.out" });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="bg-black min-h-screen text-white font-sans overflow-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full p-6 z-50 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate('/')}
          className="pointer-events-auto flex items-center gap-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900/50 px-4 py-2 rounded-full backdrop-blur-md border border-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 text-xs font-bold tracking-widest uppercase backdrop-blur-md">
          Scroll to explore
        </div>
      </nav>

      {/* Cinematic Pinned Container */}
      <div ref={containerRef} className="h-screen w-full relative flex items-center justify-center">
        
        {/* Intro */}
        <div className="intro-text absolute text-center z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">Behind the Engine</h1>
          <p className="text-xl text-zinc-400 font-light">Scroll to see how Arch-E-Tech transforms ideas into architecture.</p>
        </div>

        {/* Scene 1: Input */}
        <div className="scene-1 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <MessageSquare className="w-16 h-16 text-indigo-400 mb-8" />
          <h2 className="text-3xl font-bold mb-12">1. The Idea</h2>
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="prompt-box w-0 h-12 bg-zinc-800 rounded-lg flex items-center px-4 overflow-hidden">
              <span className="prompt-text opacity-0 font-mono text-zinc-300 text-sm whitespace-nowrap"></span>
            </div>
          </div>
        </div>

        {/* Scene 2: AI */}
        <div className="scene-2 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <Zap className="w-16 h-16 text-yellow-400 mb-8" />
          <h2 className="text-3xl font-bold mb-12">2. AI Logic Processing</h2>
          <div className="relative w-64 h-64 flex items-center justify-center mb-8">
            <div className="ai-node absolute inset-0 border-2 border-dashed border-yellow-500/50 rounded-full"></div>
            <div className="absolute inset-4 border-2 border-yellow-500/20 rounded-full animate-ping"></div>
            <span className="font-bold text-yellow-400 tracking-widest">GEMINI 1.5</span>
          </div>
          <div className="font-mono text-xs text-zinc-500 flex flex-col gap-2">
            <span className="ai-code">Analyzing spatial requirements...</span>
            <span className="ai-code">Extracting 2D coordinates...</span>
            <span className="ai-code">Validating structural compliance...</span>
            <span className="ai-code text-green-400"><CheckCircle className="inline w-3 h-3 mr-1" /> JSON Array Generated</span>
          </div>
        </div>

        {/* Scene 3: 2D Canvas */}
        <div className="scene-3 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <PenTool className="w-16 h-16 text-emerald-400 mb-8" />
          <h2 className="text-3xl font-bold mb-12">3. Vector Drafting</h2>
          <div className="w-full max-w-3xl aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            {/* Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <svg width="400" height="300" viewBox="0 0 400 300" className="relative z-10">
              <rect x="50" y="50" width="300" height="200" fill="none" stroke="#10b981" strokeWidth="4" 
                    strokeDasharray="1000" strokeDashoffset="1000" className="blueprint-line" />
              <line x1="200" y1="50" x2="200" y2="250" stroke="#10b981" strokeWidth="4" 
                    strokeDasharray="1000" strokeDashoffset="1000" className="blueprint-line" />
            </svg>
          </div>
        </div>

        {/* Scene 4: 3D */}
        <div className="scene-4 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <Box className="w-16 h-16 text-white mb-8" />
          <h2 className="text-3xl font-bold mb-12">4. Procedural 3D</h2>
          <div className="w-full max-w-3xl aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl relative flex items-center justify-center perspective-1000">
            <div className="box-3d w-64 h-48 bg-zinc-800 border border-zinc-600 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center transform preserve-3d rotate-x-60 rotate-z-45">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="font-bold text-zinc-500">Rendered Mesh</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

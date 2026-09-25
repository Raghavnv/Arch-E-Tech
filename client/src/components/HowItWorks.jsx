import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, MessageSquare, Zap, PenTool, Box, CheckCircle, AlertTriangle, Image as ImageIcon, FileText, Calculator } from 'lucide-react';

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
        end: "+=8000",
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
      .fromTo(".box-3d", { scaleZ: 0.1, y: 50 }, { scaleZ: 1, y: 0, duration: 2, ease: "bounce.out" })

    // Scene 4 to 5: Clash Detection & Compliance
    tl.to(".scene-4", { opacity: 0, scale: 0.8, duration: 1 }, "+=1.5")
      .fromTo(".scene-5", { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 1 })
      .fromTo(".scanner-line", { top: "-10%" }, { top: "110%", duration: 1.5, ease: "linear", yoyo: true, repeat: 1 })
      .fromTo(".clash-alert", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out" }, "-=1")
      .to(".clash-alert", { opacity: 0, duration: 0.5 }, "+=1")
      .fromTo(".compliance-check", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 })

    // Scene 5 to 6: Concept Visualizer (Photorealistic)
    tl.to(".scene-5", { opacity: 0, x: -100, duration: 1 }, "+=1.5")
      .fromTo(".scene-6", { opacity: 0, x: 100 }, { opacity: 1, x: 0, duration: 1 })
      .to(".viz-overlay", { opacity: 1, duration: 2, ease: "power2.inOut" })

    // Scene 6 to 7: Reports & Takeoffs
    tl.to(".scene-6", { opacity: 0, y: -50, duration: 1 }, "+=1.5")
      .fromTo(".scene-7", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1 })
      .fromTo(".report-item", { opacity: 0, x: -20 }, { opacity: 1, x: 0, stagger: 0.2, duration: 1 });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="bg-transparent min-h-screen text-white font-sans overflow-hidden">
      
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
          <p className="text-xl text-zinc-400 font-light">Scroll to see how Arch-E-Tech transforms ideas into reality.</p>
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
            <span className="ai-code">Validating structural logic...</span>
            <span className="ai-code text-green-400"><CheckCircle className="inline w-3 h-3 mr-1" /> JSON Array Generated</span>
          </div>
        </div>

        {/* Scene 3: 2D Canvas */}
        <div className="scene-3 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <PenTool className="w-16 h-16 text-emerald-400 mb-8" />
          <h2 className="text-3xl font-bold mb-12">3. Vector Drafting</h2>
          <div className="w-full max-w-3xl aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
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

        {/* Scene 5: Clash Detection & Compliance */}
        <div className="scene-5 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <AlertTriangle className="w-16 h-16 text-orange-500 mb-8" />
          <h2 className="text-3xl font-bold mb-12">5. Automated Compliance</h2>
          <div className="w-full max-w-3xl aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
            {/* Wireframe Mock */}
            <div className="relative w-64 h-48 border border-zinc-700">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-700"></div>
              {/* Clash Alert */}
              <div className="clash-alert absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-950/90 border border-red-500 text-red-500 text-xs px-3 py-2 rounded-lg font-mono whitespace-nowrap z-20 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                ! AABB Collision Detected
              </div>
              {/* Compliance Check */}
              <div className="compliance-check absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-950/90 border border-green-500 text-green-500 text-xs px-3 py-2 rounded-lg font-mono whitespace-nowrap z-20 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> 100% Code Compliant
              </div>
            </div>
            {/* Scanner Line */}
            <div className="scanner-line absolute left-0 w-full h-1 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,1)] z-10"></div>
          </div>
        </div>

        {/* Scene 6: Concept Visualizer */}
        <div className="scene-6 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <ImageIcon className="w-16 h-16 text-blue-400 mb-8" />
          <h2 className="text-3xl font-bold mb-12">6. Photorealistic Visualization</h2>
          <div className="w-full max-w-3xl aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
            {/* Wireframe Background */}
            <div className="absolute inset-0 bg-[linear-gradient(45deg,#18181b_25%,transparent_25%,transparent_75%,#18181b_75%,#18181b),linear-gradient(45deg,#18181b_25%,transparent_25%,transparent_75%,#18181b_75%,#18181b)] bg-[size:40px_40px]"></div>
            
            {/* Overlay render image (simulated with a rich gradient) */}
            <div className="viz-overlay absolute inset-0 bg-gradient-to-br from-blue-900 via-zinc-800 to-amber-900 opacity-0 mix-blend-screen shadow-inner flex items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-widest drop-shadow-2xl">FINAL RENDER</span>
            </div>
          </div>
        </div>

        {/* Scene 7: PDF Reports & Takeoffs */}
        <div className="scene-7 absolute inset-0 flex flex-col items-center justify-center opacity-0 pointer-events-none">
          <FileText className="w-16 h-16 text-white mb-8" />
          <h2 className="text-3xl font-bold mb-12">7. Reports & Takeoffs</h2>
          <div className="w-full max-w-xl bg-zinc-100 rounded-sm shadow-[0_0_40px_rgba(255,255,255,0.1)] p-8 text-black transform rotate-1">
            <div className="border-b-2 border-black pb-4 mb-6">
              <h3 className="font-bold text-2xl tracking-tighter">PROJECT MANIFEST</h3>
              <p className="text-xs text-zinc-500 font-mono">ID: AE-2026-X19</p>
            </div>
            
            <div className="space-y-4 font-mono text-sm">
              <div className="report-item flex justify-between border-b border-zinc-300 pb-2">
                <span>Total Surface Area:</span>
                <span className="font-bold">2,450 sqft</span>
              </div>
              <div className="report-item flex justify-between border-b border-zinc-300 pb-2">
                <span>Material Est. (Wood):</span>
                <span className="font-bold">$12,400</span>
              </div>
              <div className="report-item flex justify-between border-b border-zinc-300 pb-2">
                <span>Material Est. (Glass):</span>
                <span className="font-bold">$8,200</span>
              </div>
              <div className="report-item flex justify-between items-center pt-4">
                <span className="text-xs text-zinc-500">Auto-Generated by Arch-E-Tech</span>
                <div className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded">
                  <CheckCircle className="w-3 h-3" /> <span className="text-[10px] font-bold">APPROVED</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

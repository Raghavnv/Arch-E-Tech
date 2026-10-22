import { useState, useEffect } from 'react';
import { MessageSquare, PenTool, Box, ShieldCheck, Sparkles } from 'lucide-react';

const STAGES = [
  { id: 'nlp', title: 'Generative NLP', icon: MessageSquare, desc: 'Natural language parsed into spatial JSON.' },
  { id: 'cad', title: 'Vector CAD', icon: PenTool, desc: 'Sub-millimeter 2D drafting on Fabric.js.' },
  { id: 'bim', title: 'Procedural BIM', icon: Box, desc: 'Instant 3D extrusion via Three.js.' },
  { id: 'audit', title: 'Code Audit', icon: ShieldCheck, desc: 'IBC/NBC compliance & clash detection.' },
  { id: 'render', title: 'Neural Render', icon: Sparkles, desc: '8K Photorealistic diffusion staging.' }
];

export default function TechHologramEngine() {
  const [activeStage, setActiveStage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-play interval
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isHovered]);

  return (
    <div 
      className="w-full max-w-5xl mx-auto bg-[#0a0a0c] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      
      {/* Top Header */}
      <div className="px-6 py-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="font-bold text-white text-sm tracking-tight">SYNTHESIS PIPELINE</span>
        </div>
        <div className="text-[10px] font-mono text-zinc-500 border border-zinc-800 px-2 py-1 rounded bg-black">
          v3.2 Data Flow
        </div>
      </div>

      {/* Main 3D Display Area */}
      <div className="relative h-[450px] bg-black overflow-hidden flex items-center justify-center" style={{ perspective: '1200px' }}>
        
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        {/* Central 3D Container */}
        <div 
          className="relative w-[300px] h-[300px] transition-transform duration-1000 ease-in-out transform-style-3d"
          style={{ transform: activeStage === 0 ? 'rotateX(0deg) rotateZ(0deg) scale(1.2)' : 'rotateX(60deg) rotateZ(45deg) scale(1)' }}
        >
          
          {/* Stage 0: NLP Prompt */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${activeStage === 0 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="bg-zinc-900/90 border border-indigo-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.2)] mb-8 w-80 translate-z-10">
              <span className="text-xs font-mono text-indigo-400 font-bold block mb-2">User Prompt:</span>
              <p className="text-sm text-zinc-200">"A modern 3-bedroom villa with a master suite and open living lounge."</p>
            </div>
            <div className="h-10 w-px bg-gradient-to-b from-indigo-500 to-transparent"></div>
            <div className="mt-4 bg-black border border-zinc-800 p-4 rounded-lg w-64 text-[10px] font-mono text-emerald-400">
              <span className="text-zinc-500">// Parsed JSON</span><br/>
              {"{"}<br/>
              &nbsp;&nbsp;"rooms": 3,<br/>
              &nbsp;&nbsp;"style": "modern",<br/>
              &nbsp;&nbsp;"master_suite": true<br/>
              {"}"}
            </div>
          </div>

          {/* Stage 1: Vector CAD */}
          <div className={`absolute inset-0 border-2 border-emerald-500/30 transition-opacity duration-500 ${activeStage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            {/* 2D Blueprint Lines */}
            <div className="absolute top-4 left-4 w-64 h-64 border-l-2 border-t-2 border-emerald-400"></div>
            <div className="absolute top-32 left-4 w-40 h-px bg-emerald-400"></div>
            <div className="absolute top-4 left-32 w-px h-28 bg-emerald-400"></div>
            {activeStage === 1 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded text-[10px] font-mono tracking-widest translate-z-12 shadow-xl">
                  FABRIC.JS 2D VECTOR
                </span>
              </div>
            )}
          </div>

          {/* Stage 2: Procedural BIM */}
          <div className={`absolute inset-0 transition-opacity duration-700 ${activeStage >= 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* 3D Extruded Walls */}
            <div className={`absolute top-4 left-4 w-64 h-2 bg-indigo-500 transition-transform duration-1000 ${activeStage >= 2 ? 'translate-z-12 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'translate-z-0'}`}></div>
            <div className={`absolute top-4 left-4 w-2 h-64 bg-indigo-500 transition-transform duration-1000 ${activeStage >= 2 ? 'translate-z-12 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'translate-z-0'}`}></div>
            <div className={`absolute top-32 left-4 w-40 h-2 bg-indigo-400 transition-transform duration-1000 delay-100 ${activeStage >= 2 ? 'translate-z-12' : 'translate-z-0'}`}></div>
            <div className={`absolute top-4 left-32 w-2 h-28 bg-indigo-400 transition-transform duration-1000 delay-200 ${activeStage >= 2 ? 'translate-z-12' : 'translate-z-0'}`}></div>
            
            {activeStage === 2 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-indigo-950/90 text-indigo-400 border border-indigo-500/50 px-3 py-1 rounded text-[10px] font-mono tracking-widest translate-z-24 shadow-xl">
                  THREE.JS EXTRUSION
                </span>
              </div>
            )}
          </div>

          {/* Stage 3: Code Audit */}
          <div className={`absolute inset-0 transition-opacity duration-500 ${activeStage >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            {/* Scanning Laser Plane */}
            {activeStage === 3 && (
              <div className="absolute top-0 left-0 w-full h-2 bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,1)] translate-z-16 animate-[scan_2s_ease-in-out_infinite]"></div>
            )}
            {activeStage >= 3 && (
              <>
                <div className="absolute top-16 left-16 bg-amber-500 text-black px-2 py-0.5 rounded text-[8px] font-bold translate-z-20">✓ IBC PASS</div>
                <div className="absolute top-40 left-40 bg-emerald-500 text-black px-2 py-0.5 rounded text-[8px] font-bold translate-z-20">✓ $45k EST</div>
              </>
            )}
          </div>

          {/* Stage 4: Neural Render */}
          <div className={`absolute -inset-10 transition-opacity duration-1000 z-50 ${activeStage === 4 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             <img 
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80" 
                alt="Render" 
                className="w-full h-full object-cover rounded-xl shadow-[0_0_50px_rgba(0,0,0,1)]"
             />
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 border border-white/20 rounded-lg text-[10px] font-bold tracking-widest text-white whitespace-nowrap">
               8K DIFFUSION RENDER
             </div>
          </div>

        </div>
      </div>

      {/* Bottom Timeline Controls */}
      <div className="p-4 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
        {STAGES.map((s, idx) => {
          const Icon = s.icon;
          const isActive = activeStage === idx;
          const isPassed = activeStage > idx;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStage(idx)}
              className={`flex-1 min-w-[120px] p-3 rounded-xl border transition-all text-left relative overflow-hidden ${
                isActive 
                  ? 'border-indigo-500 bg-indigo-500/10' 
                  : isPassed
                  ? 'border-zinc-700 bg-zinc-900/50'
                  : 'border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900'
              }`}
            >
              {isActive && <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 w-full animate-[progress_4s_linear]"></div>}
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : isPassed ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{s.title}</span>
              </div>
              <p className="text-[9px] text-zinc-500 font-mono truncate">{s.desc}</p>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

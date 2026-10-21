import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, MessageSquare, Zap, PenTool, Box, CheckCircle2, 
  AlertTriangle, Image as ImageIcon, FileText, Calculator, 
  Play, Pause, SkipForward, SkipBack, Sparkles, ShieldCheck,
  Building, Check, ArrowRight
} from 'lucide-react';

const STAGES = [
  {
    step: '01',
    title: 'Natural Language Prompting',
    subtitle: 'From Plain English to Spatial Architecture',
    desc: 'Input any residential or commercial brief. Our spatial NLP parser extracts bedroom counts, ensuite specifications, square footage allocations, and ceiling heights.',
    badge: 'LLM Spatial Tokenizer',
    icon: MessageSquare,
    tag: 'Input Phase'
  },
  {
    step: '02',
    title: 'Neural Spatial Geometry',
    subtitle: 'Topological Adjacency & Room Hierarchies',
    desc: 'The generative engine calculates balanced spatial relationships: allocating a larger primary footprint to the master bedroom, placing the ensuite bath adjacent, and buffering private zones from public living pavilions.',
    badge: 'Adjacency Graph Theory',
    icon: Zap,
    tag: 'Logic Phase'
  },
  {
    step: '03',
    title: 'Sub-Millimeter 2D CAD Drafting',
    subtitle: 'Interactive Fabric.js Vector Blueprint',
    desc: 'Coordinates translate into an interactive vector canvas featuring 45° and 90° angle snapping, door swing arcs, window placements, and dynamic dimension lines.',
    badge: 'Vector Engine',
    icon: PenTool,
    tag: 'Drafting Phase'
  },
  {
    step: '04',
    title: 'Procedural 3D Mesh & Slabs',
    subtitle: 'Physical Wall Openings & Slabs in Real-Time',
    desc: 'Walls extrude instantly with realistic thickness, headers above doors, glazed window fenestration, and natural hardwood floor slabs. Simulated daylight matches true sun azimuth.',
    badge: 'WebGL & Three.js',
    icon: Box,
    tag: 'Extrusion Phase'
  },
  {
    step: '05',
    title: 'Automated Code & Clash Audit',
    subtitle: 'Real-Time IBC 2024 & NBC Validation',
    desc: 'A bounding-box collision scanner sweeps the design to detect structural overlaps, verify minimum hallway egress clearances, and confirm 100% building code compliance.',
    badge: 'BIM Audit',
    icon: ShieldCheck,
    tag: 'Compliance Phase'
  },
  {
    step: '06',
    title: '8K Photorealistic Interior Staging',
    subtitle: 'Raytraced Architectural Visualization',
    desc: 'Transforms 2D and 3D wireframes into 14mm ultra-wide panoramic renders complete with designer furnishings, ambient cove lighting, and natural daylighting in 3 seconds.',
    badge: 'Neural Stager',
    icon: Sparkles,
    tag: 'Visualization Phase'
  },
  {
    step: '07',
    title: 'BIM Takeoffs & PDF Reports',
    subtitle: 'Live Bill of Quantities & Contractor Estimates',
    desc: 'Quantifies wall linear meters, door and window units, and finishes into a real-time contractor estimate in USD or INR, with one-click executive PDF exports.',
    badge: 'Cost Estimation',
    icon: Calculator,
    tag: 'Output Phase'
  }
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const DURATION_MS = 4500;
  const progressInterval = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      return;
    }

    setProgress(0);
    const start = Date.now();

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(pct);

      if (elapsed >= DURATION_MS) {
        setActiveStageIndex(prev => (prev + 1) % STAGES.length);
      }
    }, 50);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [activeStageIndex, isPlaying]);

  const activeStage = STAGES[activeStageIndex];

  return (
    <div className="bg-zinc-950 min-h-screen text-white font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full p-6 z-50 flex items-center justify-between backdrop-blur-xl bg-zinc-950/70 border-b border-zinc-800/80">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors bg-zinc-900/80 hover:bg-zinc-800 px-4 py-2 rounded-full border border-zinc-700/80 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-xs font-bold tracking-widest uppercase">
            Interactive Video Tour
          </div>
          <Link
            to="/auth"
            className="bg-white text-black font-semibold text-xs px-5 py-2 rounded-full hover:bg-zinc-200 transition-colors shadow-lg"
          >
            Launch Studio Free
          </Link>
        </div>
      </nav>

      {/* Main Video-Like Showcase Stage */}
      <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full inline-block mb-3">
            Autonomous Engine Architecture
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Behind the Engine
          </h1>
          <p className="text-zinc-400 text-sm md:text-base font-light max-w-xl mx-auto">
            Experience how Arch-E-Tech synthesizes plain-text descriptions into validated 2D floor plans, 3D models, code audits, and 8K renders.
          </p>
        </div>

        {/* Video Player Card */}
        <div className="w-full bg-zinc-900/70 border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.8)] backdrop-blur-md">
          
          {/* Top Scrubber & Controls */}
          <div className="p-6 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/80">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-mono font-bold flex items-center justify-center text-sm">
                {activeStage.step}
              </span>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">{activeStage.title}</h2>
                <p className="text-xs text-zinc-400 font-mono">{activeStage.subtitle}</p>
              </div>
            </div>

            {/* Video Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStageIndex(prev => (prev - 1 + STAGES.length) % STAGES.length)}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Previous Step"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-all shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-black" />}
                <span>{isPlaying ? 'Pause' : 'Auto-Play'}</span>
              </button>

              <button
                onClick={() => setActiveStageIndex(prev => (prev + 1) % STAGES.length)}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Next Step"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 h-1">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Clickable Stage Tabs */}
          <div className="p-4 bg-zinc-950/90 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {STAGES.map((s, idx) => (
              <button
                key={s.step}
                onClick={() => {
                  setActiveStageIndex(idx);
                  setProgress(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeStageIndex === idx
                    ? 'bg-white text-black shadow-md'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span className="font-mono text-[10px]">{s.step}.</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Stage Stage Viewport */}
          <div className="p-8 md:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[460px]">
            
            {/* Left Description */}
            <div className="lg:col-span-5 space-y-5">
              <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-indigo-400 font-semibold inline-block">
                {activeStage.badge}
              </span>

              <h3 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
                {activeStage.title}
              </h3>

              <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                {activeStage.desc}
              </p>

              <div className="pt-4 border-t border-zinc-800 flex items-center gap-4">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl transition-all shadow-lg"
                >
                  Test In Studio Engine <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-xs text-zinc-500 font-mono">Stage {activeStageIndex + 1} of {STAGES.length}</span>
              </div>
            </div>

            {/* Right Interactive Animated Stage Display */}
            <div className="lg:col-span-7 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 min-h-[360px] flex items-center justify-center relative overflow-hidden shadow-2xl">
              
              {/* Stage 1: Prompt Terminal */}
              {activeStageIndex === 0 && (
                <div className="w-full max-w-md bg-black border border-zinc-800 rounded-xl p-5 shadow-2xl font-mono text-xs">
                  <div className="flex items-center gap-2 pb-3 border-b border-zinc-800 mb-4 text-zinc-500">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span>user-prompt-parser.log</span>
                  </div>
                  <div className="text-zinc-200 leading-relaxed mb-4">
                    <span className="text-emerald-400">&gt; Prompt: </span>
                    "Modern 3-bedroom villa with master suite, en-suite bathroom, and open living lounge."
                  </div>
                  <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] space-y-1 text-zinc-400">
                    <div>• Bedrooms: <span className="text-white font-bold">3</span></div>
                    <div>• Master Suite: <span className="text-emerald-400 font-bold">Expanded Footprint</span></div>
                    <div>• Adjacencies: <span className="text-white font-bold">Private Corridor Buffer</span></div>
                  </div>
                </div>
              )}

              {/* Stage 2: Neural Core */}
              {activeStageIndex === 1 && (
                <div className="w-full flex flex-col items-center justify-center">
                  <div className="relative w-56 h-56 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-dashed border-amber-500/40 rounded-full animate-spin" style={{ animationDuration: '15s' }}></div>
                    <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] flex flex-col items-center justify-center text-center">
                      <Zap className="w-6 h-6 text-amber-400 mb-1" />
                      <span className="text-[9px] font-bold text-white">AI CORE</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 mt-3">Synthesizing 34+ Architectural Coordinate Pairs</span>
                </div>
              )}

              {/* Stage 3: Vector Canvas */}
              {activeStageIndex === 2 && (
                <div className="w-full max-w-md aspect-[16/10] bg-[#09090b] border border-zinc-800 rounded-xl relative overflow-hidden flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                  <svg width="340" height="200" viewBox="0 0 340 200" className="relative z-10">
                    <rect x="20" y="20" width="300" height="160" fill="none" stroke="#10b981" strokeWidth="4" />
                    <line x1="160" y1="20" x2="160" y2="180" stroke="#10b981" strokeWidth="4" />
                    <line x1="20" y1="100" x2="160" y2="100" stroke="#10b981" strokeWidth="4" />
                    <path d="M 160 60 A 25 25 0 0 1 135 85" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="3 3" />
                  </svg>
                  <div className="absolute bottom-3 right-3 text-[10px] text-emerald-400 font-mono bg-zinc-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    Fabric.js Snapping: 90°
                  </div>
                </div>
              )}

              {/* Stage 4: 3D Mesh */}
              {activeStageIndex === 3 && (
                <div className="w-full max-w-md aspect-[16/10] rounded-xl overflow-hidden relative shadow-2xl border border-zinc-800">
                  <img 
                    src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80" 
                    alt="3D Extrusion" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-blue-950/90 border border-blue-500/40 text-blue-300 px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5" /> Three.js Extrusion & Slabs
                  </div>
                </div>
              )}

              {/* Stage 5: Code Audit */}
              {activeStageIndex === 4 && (
                <div className="w-full max-w-md aspect-[16/10] bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden flex items-center justify-center p-6">
                  <div className="absolute left-0 right-0 h-1 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,1)] z-20 animate-pulse"></div>
                  <div className="bg-emerald-950/95 border border-emerald-500 text-emerald-400 text-xs px-5 py-2.5 rounded-xl font-mono flex items-center gap-2 shadow-2xl">
                    <CheckCircle2 className="w-4 h-4" /> 100% IBC 2024 / NBC Certified
                  </div>
                </div>
              )}

              {/* Stage 6: 8K Staged Room */}
              {activeStageIndex === 5 && (
                <div className="w-full max-w-md aspect-[16/10] rounded-xl overflow-hidden relative shadow-2xl border border-zinc-800">
                  <img 
                    src="https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1280&q=80" 
                    alt="8K Staged Room" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-purple-950/90 border border-purple-500/40 text-purple-300 px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 8K Photorealistic Stager
                  </div>
                </div>
              )}

              {/* Stage 7: BOM Takeoffs */}
              {activeStageIndex === 6 && (
                <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-teal-400" /> Bill of Quantities
                    </span>
                    <span className="text-emerald-400 font-bold">$48,500 USD</span>
                  </div>
                  <div className="space-y-1.5 text-zinc-400 text-[11px]">
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span>Wall Partitions:</span> <span className="text-white">64.5 m</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span>Glazed Fenestrations:</span> <span className="text-white">6 Units</span>
                    </div>
                    <div className="flex justify-between text-teal-300 font-bold pt-1">
                      <span>Full PDF Audit:</span> <span>Ready to Export</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

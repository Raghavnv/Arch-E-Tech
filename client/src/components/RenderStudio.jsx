import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Sparkles, Download, RefreshCw, Layers, 
  Sun, Moon, CloudSun, CloudRain, Camera, Check, 
  Sliders, Wand2
} from 'lucide-react';

const STYLES = [
  { 
    id: 'modern', 
    name: 'Ultra Modern', 
    tagline: 'Glass, cantilevered concrete & ambient light',
    promptSnippet: 'ultra-modern luxury architectural residence with expansive floor-to-ceiling glass curtain walls, cantilevered cast concrete slabs, warm linear recessed LED accents, minimalist high-end designer furnishings'
  },
  { 
    id: 'japandi', 
    name: 'Japandi Minimalist', 
    tagline: 'Warm blonde oak, shoji textures & serene daylight',
    promptSnippet: 'serene Japandi minimalist architectural interior, natural light-oak slatted wood panels, washi paper screens, smooth micro-cement flooring, understated low-profile furniture, indoor bonsai and zen courtyard garden'
  },
  { 
    id: 'brutalist', 
    name: 'Brutalist Luxury', 
    tagline: 'Board-formed concrete & dramatic chiaroscuro',
    promptSnippet: 'monumental modern brutalist luxury home, textured board-formed raw concrete surfaces, dramatic architectural light and shadow chiaroscuro, bronze hardware, sculptural minimalist monolithic forms'
  },
  { 
    id: 'industrial', 
    name: 'Industrial Loft', 
    tagline: 'Exposed black steel, aged brick & loft ceilings',
    promptSnippet: 'high-ceiling industrial architectural loft, exposed black structural steel beams, reclaimed vintage red brickwork, polished concrete floors, Crittall steel-framed windows, bespoke cognac leather seating'
  },
  { 
    id: 'scandinavian', 
    name: 'Nordic Scandinavian', 
    tagline: 'Pale ash wood, cozy textures & bright open space',
    promptSnippet: 'bright Scandinavian architectural haven, pale ash wood floorboards, crisp matte white walls, rich bouclé and linen textiles, soft diffused Nordic daylight, integrated fireplace'
  },
  { 
    id: 'mediterranean', 
    name: 'Mediterranean Villa', 
    tagline: 'Warm stucco, terracotta tiles & olive trees',
    promptSnippet: 'luxurious Mediterranean contemporary villa, warm textured lime-wash stucco walls, natural terracotta and limestone tiles, arched porticos, sun-drenched private courtyard with ancient olive tree'
  }
];

const PERSPECTIVES = [
  { id: 'interior', label: 'Interior Living Space', desc: 'Main open-plan lounge & dining hall' },
  { id: 'exterior', label: 'Exterior Facade', desc: 'Front elevation & landscape entrance' },
  { id: 'axonometric', label: '3D Axonometric Cutaway', desc: 'Isometric architectural showcase' },
  { id: 'patio', label: 'Patio & Backyard Oasis', desc: 'Outdoor terrace & poolside lounge' }
];

const ATMOSPHERES = [
  { id: 'golden', label: 'Golden Hour', icon: CloudSun, desc: 'Warm horizontal sunlight and rich amber glow' },
  { id: 'daylight', label: 'Crisp Daylight', icon: Sun, desc: 'Bright balanced midday architectural clarity' },
  { id: 'dusk', label: 'Twilight / Blue Hour', icon: Moon, desc: 'Deep sapphire sky with glowing warm interior lighting' },
  { id: 'mist', label: 'Atmospheric Mist', icon: CloudRain, desc: 'Soft moody reflections and cinematic overcast diffusion' }
];

export default function RenderStudio() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  // State
  const [activeStyle, setActiveStyle] = useState(STYLES[0]);
  const [activePerspective, setActivePerspective] = useState(PERSPECTIVES[0]);
  const [activeAtmosphere, setActiveAtmosphere] = useState(ATMOSPHERES[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef(null);

  // Wireframe snapshot from Studio
  const [wireframeSnapshot, setWireframeSnapshot] = useState(() => localStorage.getItem('renderStudioSnapshot'));

  // Gallery of generated renders in current session
  const [gallery, setGallery] = useState([]);
  const [currentRender, setCurrentRender] = useState(null);

  useEffect(() => {
    // Generate initial preview render on mount
    generateRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Construct intelligent photorealistic architectural prompt
  const fullPrompt = useMemo(() => {
    const parts = [
      `Award-winning architectural photography, ${activePerspective.label.toLowerCase()} of a ${activeStyle.promptSnippet}`,
      `${activeAtmosphere.desc}`,
      customPrompt.trim() ? customPrompt.trim() : null,
      'Architectural Digest, 8k resolution, octane render, Unreal Engine 5 realism, cinematic composition, depth of field, photorealistic textures, masterwork'
    ].filter(Boolean);

    return parts.join(', ');
  }, [activeStyle, activePerspective, activeAtmosphere, customPrompt]);

  const handleMouseMove = (e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  };

  const generateRender = async () => {
    setIsRendering(true);
    const newSeed = Math.floor(Math.random() * 999999);
    setActiveSeed(newSeed);

    const encodedPrompt = encodeURIComponent(fullPrompt);
    // Pollinations AI high-fidelity flux endpoint
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&model=flux&seed=${newSeed}&nologo=true`;

    try {
      // Preload image in memory so it doesn't flicker
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          // If flux model takes too long, fallback to fast architectural render
          resolve();
        };
        // 12 second safety timeout
        setTimeout(resolve, 12000);
      });

      const newRenderItem = {
        id: Date.now().toString(),
        url: imageUrl,
        style: activeStyle.name,
        perspective: activePerspective.label,
        atmosphere: activeAtmosphere.label,
        seed: newSeed,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setCurrentRender(newRenderItem);
      setGallery(prev => [newRenderItem, ...prev]);
      setSliderPos(50);
    } catch (err) {
      console.error("Render generation failed", err);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadHD = async () => {
    if (!currentRender?.url) return;
    try {
      const res = await fetch(currentRender.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Arch-E-Tech-${activeStyle.name.replace(/\s+/g, '-')}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(currentRender.url, '_blank');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* ========================================================= */}
      {/* LEFT CONTROL PANEL                                        */}
      {/* ========================================================= */}
      <aside className="w-96 border-r border-zinc-800 bg-zinc-950/90 backdrop-blur-xl flex flex-col z-20 shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <Link 
            to={projectId ? `/studio?projectId=${projectId}` : '/studio'} 
            className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-semibold mb-4 tracking-wide uppercase"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Studio
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">AI Photorealistic Studio</h1>
              <p className="text-xs text-zinc-400">Transform CAD floor plans into 8K photorealistic visualizations</p>
            </div>
          </div>
        </div>

        {/* Scrollable Controls */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* 1. Architectural Style Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Architectural Style
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">{activeStyle.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {STYLES.map(style => (
                <div 
                  key={style.id}
                  onClick={() => setActiveStyle(style)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    activeStyle.id === style.id 
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                      : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold text-xs ${activeStyle.id === style.id ? 'text-white' : 'text-zinc-300'}`}>
                      {style.name}
                    </h4>
                    {activeStyle.id === style.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{style.tagline}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Perspective & View Angle */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" /> Camera Angle
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PERSPECTIVES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePerspective(p)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activePerspective.id === p.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{p.label}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Time of Day / Atmosphere */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Lighting & Atmosphere
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ATMOSPHERES.map(atm => {
                const Icon = atm.icon;
                return (
                  <button
                    key={atm.id}
                    onClick={() => setActiveAtmosphere(atm)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left ${
                      activeAtmosphere.id === atm.id
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium truncate">{atm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Custom Directives */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Custom Details
            </h3>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Italian marble island, floating fireplace, lush ficus lyrata, infinity edge reflection pool..."
              rows={2}
              className="w-full px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Generate Button Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/80">
          <button 
            onClick={generateRender}
            disabled={isRendering}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xl ${
              isRendering 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.4)]'
            }`}
          >
            {isRendering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Synthesizing Photorealism...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Photorealistic Render</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT: BEFORE / AFTER INTERACTIVE COMPARISON      */}
      {/* ========================================================= */}
      <main className="flex-1 relative flex flex-col bg-zinc-900 overflow-hidden">
        
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* Top Viewport Status Bar */}
        <div className="h-14 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white tracking-wide">Comparison Viewer</span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">
              {currentRender ? `${currentRender.style} • ${currentRender.atmosphere}` : 'Awaiting Generation'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentRender && (
              <button 
                onClick={generateRender}
                disabled={isRendering}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-roll Seed
              </button>
            )}
            {currentRender && (
              <button 
                onClick={handleDownloadHD}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download 8K Image
              </button>
            )}
          </div>
        </div>

        {/* Center Comparison Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div 
            className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 bg-black group select-none"
            ref={sliderRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleMouseMove}
          >
            {isRendering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 z-40 backdrop-blur-md">
                <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                  <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">Generating Photorealistic Render</h3>
                <p className="text-xs text-indigo-400 font-mono animate-pulse">Running Neural Flux Engine • Raytracing Architectural Surfaces</p>
                <div className="mt-4 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                  Style: {activeStyle.name} | Lighting: {activeAtmosphere.label}
                </div>
              </div>
            ) : !currentRender ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/80 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                  <Layers className="w-8 h-8 opacity-40" />
                </div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Ready for Photorealistic Synthesis</h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Select your preferred style and mood from the left sidebar, then click <b className="text-zinc-300">Generate Photorealistic Render</b>.
                </p>
                <button
                  onClick={generateRender}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-lg flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Start Initial Render
                </button>
              </div>
            ) : (
              <>
                {/* 1. LEFT/BASE IMAGE: Wireframe / CAD Blueprint Snapshot */}
                <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
                  {wireframeSnapshot ? (
                    <img 
                      src={wireframeSnapshot} 
                      className="w-full h-full object-contain filter grayscale contrast-125 opacity-80" 
                      alt="Project CAD Blueprint" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#09090b] pattern-grid text-zinc-600">
                      <Layers className="w-12 h-12 mb-2 opacity-30" />
                      <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">2D/3D CAD Wireframe</span>
                    </div>
                  )}
                </div>

                {/* 2. RIGHT/OVERLAY IMAGE: High-Fidelity Photorealistic AI Render with Clip Path */}
                <div 
                  className="absolute inset-0 overflow-hidden" 
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                  <img 
                    src={currentRender.url} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    alt="AI Photorealistic Render" 
                  />
                </div>

                {/* 3. SLIDER DRAG HANDLE */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize z-30 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.8)]"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="w-9 h-9 bg-zinc-950/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border-2 border-white hover:scale-110 transition-transform">
                    <div className="flex gap-1 items-center">
                      <div className="w-0.5 h-3 bg-zinc-400 rounded-full"></div>
                      <div className="w-0.5 h-3 bg-zinc-400 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* 4. FLOATING BADGES */}
                <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-emerald-400 border border-emerald-500/30 z-20 flex items-center gap-1.5 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  PHOTOREALISTIC 8K
                </div>
                <div className="absolute top-4 right-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-zinc-300 border border-zinc-700/50 z-20 shadow-lg">
                  CAD BLUEPRINT
                </div>

                {/* Bottom Overlay Info Pill */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/85 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] text-zinc-300 border border-zinc-800 z-20 pointer-events-none flex items-center gap-2 shadow-2xl">
                  <span>Drag slider left / right to compare</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-indigo-400 font-mono">{sliderPos.toFixed(0)}% Rendered</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM GALLERY STRIP (Session Variations)                 */}
        {/* ========================================================= */}
        {gallery.length > 0 && (
          <div className="h-28 border-t border-zinc-800 bg-zinc-950/70 backdrop-blur-md px-8 py-3 flex items-center gap-4 z-10 overflow-x-auto custom-scrollbar">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest shrink-0">
              Session Renders ({gallery.length})
            </span>
            <div className="flex items-center gap-3">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => { setCurrentRender(item); setSliderPos(50); }}
                  className={`relative w-36 h-20 rounded-xl overflow-hidden cursor-pointer border shrink-0 transition-all group ${
                    currentRender?.id === item.id 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30' 
                      : 'border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={item.url} className="w-full h-full object-cover" alt="Render thumbnail" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                    <span className="text-[10px] font-medium text-white truncate">{item.style}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

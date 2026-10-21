import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Sparkles, Download, RefreshCw, Layers, 
  Sun, Moon, CloudSun, CloudRain, Camera, Check, 
  Sliders, Wand2, Zap, Upload, Sofa, Home, CheckCircle2, AlertCircle
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
    promptSnippet: 'monumental modern brutalist luxury home, textured board-formed raw concrete surfaces, dramatic architectural light and shadow chiaroscuro, bronze hardware, sculptural monolithic forms'
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

// Room Stager Presets
const EMPTY_ROOM_SAMPLES = [
  {
    id: 'bedroom',
    title: 'Empty Master Bedroom',
    desc: 'Bare wooden floor, blank white walls & large window',
    url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1280&q=80',
    defaultPrompt: 'King size upholstered platform bed with fluted walnut headboard, crisp white Belgian linen duvet, two floating bedside tables with warm brass pendant lamps, textured ivory wool rug, large framed minimalist art piece, fiddle leaf fig plant in ceramic pot'
  },
  {
    id: 'living',
    title: 'Empty Living Room',
    desc: 'Bright vacant room with floor-to-ceiling natural light',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1280&q=80',
    defaultPrompt: 'Curved cream bouclé sectional sofa, organic travertine coffee table, large abstract textured canvas on wall, sculptural floor lamp, olive tree in terracotta vessel, subtle recessed ceiling illumination'
  },
  {
    id: 'loft',
    title: 'Industrial Loft Space',
    desc: 'Exposed brick wall, concrete flooring & metal frame windows',
    url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1280&q=80',
    defaultPrompt: 'Distressed caramel leather sofa, raw steel bookcase, reclaimed wood dining table with matte black chairs, vintage Persian rug, warm Edison bulb pendant chandelier, gallery art wall'
  },
  {
    id: 'penthouse',
    title: 'Minimalist Penthouse',
    desc: 'Smooth micro-cement surfaces & skyline views',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80',
    defaultPrompt: 'Low-profile minimalist platform bed, Japanese tatami accents, blonde oak slatted accent wall, soft diffused recessed LED strip, linen curtains filtering skyline sunlight'
  }
];

const ROOM_TYPES = [
  { id: 'bedroom', label: 'Master Bedroom Suite' },
  { id: 'living', label: 'Living & Entertainment Lounge' },
  { id: 'dining', label: 'Kitchen & Dining Area' },
  { id: 'office', label: 'Executive Home Office' }
];

export default function RenderStudio() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  // Studio Mode: 'blueprint' (CAD 3D Render) or 'stager' (Photo Virtual Stager)
  const [studioMode, setStudioMode] = useState('blueprint');

  // Speed & Quality Engine: 'turbo' (3-5s) vs 'flux' (High-Fidelity)
  const [engineModel, setEngineModel] = useState('turbo');

  // Blueprint CAD to 3D Render State
  const [activeStyle, setActiveStyle] = useState(STYLES[0]);
  const [activePerspective, setActivePerspective] = useState(PERSPECTIVES[0]);
  const [activeAtmosphere, setActiveAtmosphere] = useState(ATMOSPHERES[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeSeed, setActiveSeed] = useState(42);

  // Virtual Room Stager State
  const [stagerSelectedPreset, setStagerSelectedPreset] = useState(EMPTY_ROOM_SAMPLES[0]);
  const [stagerRoomType, setStagerRoomType] = useState(ROOM_TYPES[0]);
  const [stagerStyle, setStagerStyle] = useState(STYLES[0]);
  const [stagerUserImage, setStagerUserImage] = useState(null);
  const [stagerPrompt, setStagerPrompt] = useState(EMPTY_ROOM_SAMPLES[0].defaultPrompt);
  const fileInputRef = useRef(null);

  // Rendering & Progress State
  const [isRendering, setIsRendering] = useState(false);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [renderPhase, setRenderPhase] = useState('');
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef(null);
  const timerRef = useRef(null);

  // Wireframe snapshot from Studio
  const [wireframeSnapshot] = useState(() => localStorage.getItem('renderStudioSnapshot'));

  // Gallery of generated renders in current session
  const [gallery, setGallery] = useState([]);
  const [currentRender, setCurrentRender] = useState(null);

  // Auto-generate preview on mount
  useEffect(() => {
    generateRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer for generation feedback
  useEffect(() => {
    if (isRendering) {
      setRenderElapsed(0);
      setRenderPhase('Initializing Neural Model...');
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const secs = ((Date.now() - start) / 1000).toFixed(1);
        setRenderElapsed(secs);
        if (secs > 1.5 && secs <= 3.5) {
          setRenderPhase('Synthesizing Spatial Geometry & Surfaces...');
        } else if (secs > 3.5 && secs <= 6.0) {
          setRenderPhase('Simulating Raytraced Daylight & Reflections...');
        } else if (secs > 6.0) {
          setRenderPhase('Applying Photorealistic Textures & Post-Processing...');
        }
      }, 200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRendering]);

  // Construct CAD Blueprint Render Prompt
  const blueprintPrompt = useMemo(() => {
    const parts = [
      `Award-winning architectural photography, ${activePerspective.label.toLowerCase()} of a ${activeStyle.promptSnippet}`,
      `${activeAtmosphere.desc}`,
      customPrompt.trim() ? customPrompt.trim() : null,
      'Architectural Digest showcase, 8k resolution, octane render, Unreal Engine 5 realism, cinematic composition, depth of field, photorealistic textures, masterwork'
    ].filter(Boolean);

    return parts.join(', ');
  }, [activeStyle, activePerspective, activeAtmosphere, customPrompt]);

  // Construct Virtual Room Stager Prompt
  const roomStagerPrompt = useMemo(() => {
    const parts = [
      `Award-winning interior design photography, fully furnished and staged ${stagerRoomType.label.toLowerCase()}`,
      `staged in ${stagerStyle.name.toLowerCase()} aesthetic, ${stagerStyle.promptSnippet}`,
      stagerPrompt.trim() ? stagerPrompt.trim() : null,
      'Architectural Digest, Elle Decor feature, luxury high-end designer staging, perfectly dressed bed and furniture, soft ambient architectural lighting, 8k resolution, photorealistic masterwork'
    ].filter(Boolean);

    return parts.join(', ');
  }, [stagerRoomType, stagerStyle, stagerPrompt]);

  const handleMouseMove = (e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setStagerUserImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const generateRender = async (forceModel = null) => {
    const chosenModel = forceModel || engineModel;
    setIsRendering(true);
    const newSeed = Math.floor(Math.random() * 999999);
    setActiveSeed(newSeed);

    const activePromptText = studioMode === 'stager' ? roomStagerPrompt : blueprintPrompt;
    const encodedPrompt = encodeURIComponent(activePromptText);
    
    // Fast Turbo (3-5s) vs Ultra FLUX (10-30s)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&model=${chosenModel}&seed=${newSeed}&nologo=true`;

    try {
      // Preload image with safe timeout
      const img = new Image();
      img.src = imageUrl;
      
      const maxWaitMs = chosenModel === 'turbo' ? 8000 : 35000;
      await new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        setTimeout(() => resolve(true), maxWaitMs);
      });

      const newRenderItem = {
        id: Date.now().toString(),
        url: imageUrl,
        mode: studioMode,
        model: chosenModel,
        style: studioMode === 'stager' ? stagerStyle.name : activeStyle.name,
        perspective: studioMode === 'stager' ? stagerRoomType.label : activePerspective.label,
        atmosphere: studioMode === 'stager' ? 'Interior Daylight' : activeAtmosphere.label,
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
      const prefix = studioMode === 'stager' ? 'Arch-E-Tech-Staged-Room' : 'Arch-E-Tech-Render';
      a.download = `${prefix}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(currentRender.url, '_blank');
    }
  };

  // Base comparison image for the left side of the split slider
  const leftComparisonImage = studioMode === 'stager'
    ? (stagerUserImage || stagerSelectedPreset.url)
    : wireframeSnapshot;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* ========================================================= */}
      {/* LEFT CONTROL PANEL                                        */}
      {/* ========================================================= */}
      <aside className="w-96 border-r border-zinc-800 bg-zinc-950/90 backdrop-blur-xl flex flex-col z-20 shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <Link 
            to={projectId ? `/studio?projectId=${projectId}` : '/studio'} 
            className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-semibold mb-3 tracking-wide uppercase"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Studio
          </Link>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">AI Photorealistic Studio</h1>
                <p className="text-[11px] text-zinc-400">Raytraced Renders & Virtual Staging</p>
              </div>
            </div>
          </div>

          {/* Mode Switcher: Blueprint 3D vs Virtual Room Stager */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
            <button
              onClick={() => { setStudioMode('blueprint'); setSliderPos(50); }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                studioMode === 'blueprint' 
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Blueprint 3D</span>
            </button>
            <button
              onClick={() => { setStudioMode('stager'); setSliderPos(50); }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                studioMode === 'stager' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sofa className="w-3.5 h-3.5" />
              <span>Room Stager</span>
            </button>
          </div>

          {/* Speed & Quality Toggle (Solves the slow render problem!) */}
          <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-black/40 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Engine Speed:
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setEngineModel('turbo')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                  engineModel === 'turbo'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Generates in 3-5 seconds using SDXL Turbo"
              >
                ⚡ Fast Turbo (3-5s)
              </button>
              <button
                onClick={() => setEngineModel('flux')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  engineModel === 'flux'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Ultra photorealism (FLUX.1) - takes 15-30s"
              >
                🌟 HD Ultra
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Controls */}
        <div className="flex-1 p-5 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* ========================================================= */}
          {/* TAB 1: BLUEPRINT TO 3D RENDERING CONTROLS                  */}
          {/* ========================================================= */}
          {studioMode === 'blueprint' && (
            <>
              {/* 1. Architectural Style Selection */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Architectural Style
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">{activeStyle.name}</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {STYLES.map(style => (
                    <div 
                      key={style.id}
                      onClick={() => setActiveStyle(style)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        activeStyle.id === style.id 
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className={`font-semibold text-xs ${activeStyle.id === style.id ? 'text-white' : 'text-zinc-300'}`}>
                          {style.name}
                        </h4>
                        {activeStyle.id === style.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{style.tagline}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Perspective & View Angle */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" /> Camera Angle
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PERSPECTIVES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setActivePerspective(p)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        activePerspective.id === p.id
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{p.label}</div>
                      <div className="text-[9px] text-zinc-500 truncate">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Time of Day / Atmosphere */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Lighting & Atmosphere
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {ATMOSPHERES.map(atm => {
                    const Icon = atm.icon;
                    return (
                      <button
                        key={atm.id}
                        onClick={() => setActiveAtmosphere(atm)}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition-all text-left ${
                          activeAtmosphere.id === atm.id
                            ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                            : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-medium truncate">{atm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Custom Directives */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Custom Details
                </h3>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Italian marble island, floating fireplace, lush indoor garden..."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: VIRTUAL ROOM STAGER & REDECORATOR CONTROLS         */}
          {/* ========================================================= */}
          {studioMode === 'stager' && (
            <>
              {/* 1. Upload or Pick Empty Room Photo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> Empty Room Photo
                  </h3>
                  {stagerUserImage && (
                    <button 
                      onClick={() => setStagerUserImage(null)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                    >
                      Reset to Presets
                    </button>
                  )}
                </div>

                {/* Upload Trigger */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-700 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-zinc-900/30 hover:bg-zinc-900/60 transition-all mb-3 group"
                >
                  <Upload className="w-5 h-5 mx-auto text-zinc-500 group-hover:text-emerald-400 mb-1" />
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white block">
                    {stagerUserImage ? 'Change Uploaded Photo' : 'Upload Empty Room Photo'}
                  </span>
                  <span className="text-[10px] text-zinc-500">JPG, PNG up to 10MB</span>
                </div>

                {/* Presets Gallery */}
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">Or choose an empty room template:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {EMPTY_ROOM_SAMPLES.map(sample => (
                    <div 
                      key={sample.id}
                      onClick={() => {
                        setStagerUserImage(null);
                        setStagerSelectedPreset(sample);
                        setStagerPrompt(sample.defaultPrompt);
                      }}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border p-1 transition-all ${
                        !stagerUserImage && stagerSelectedPreset.id === sample.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-zinc-800 bg-zinc-900/40 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={sample.url} alt={sample.title} className="w-full h-16 object-cover rounded-lg" />
                      <div className="mt-1">
                        <div className="text-[10px] font-bold text-white truncate">{sample.title}</div>
                        <div className="text-[8px] text-zinc-500 truncate">{sample.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Room Type Selector */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-emerald-400" /> Target Space Type
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROOM_TYPES.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => setStagerRoomType(rt)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        stagerRoomType.id === rt.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">{rt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Interior Style */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Interior Style
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setStagerStyle(style)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        stagerStyle.id === style.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{style.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Furnishing Wishlist */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Sofa className="w-3.5 h-3.5 text-emerald-400" /> Furniture & Decor Details
                </h3>
                <textarea
                  value={stagerPrompt}
                  onChange={(e) => setStagerPrompt(e.target.value)}
                  placeholder="e.g. King platform bed, fluted oak headboard, ambient LED lamps, bouclé armchair, large framed artwork..."
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </>
          )}

        </div>

        {/* Generate Button Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-950/80">
          <button 
            onClick={() => generateRender()}
            disabled={isRendering}
            className={`w-full py-3.5 rounded-xl font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 shadow-xl ${
              isRendering 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : studioMode === 'stager'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
            }`}
          >
            {isRendering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating ({renderElapsed}s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {studioMode === 'stager' ? 'Stage & Furnish Empty Room' : 'Generate 8K Photorealistic Render'}
                </span>
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
            <span className="text-xs font-semibold text-white tracking-wide">
              {studioMode === 'stager' ? 'Virtual Room Stager Split-Viewer' : 'CAD vs 8K Photorealism Viewer'}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">
              {currentRender ? `${currentRender.style} • ${currentRender.model.toUpperCase()} Engine` : 'Ready to Render'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentRender && (
              <button 
                onClick={() => generateRender()}
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
                <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                  <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight mb-1">
                  {studioMode === 'stager' ? 'Furnishing & Staging Room' : 'Synthesizing Photorealistic Render'}
                </h3>
                <p className="text-xs text-emerald-400 font-mono animate-pulse">{renderPhase}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                    Elapsed: {renderElapsed}s
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                    Engine: {engineModel === 'turbo' ? '⚡ SDXL Turbo (3-5s)' : '🌟 FLUX Ultra'}
                  </span>
                </div>
                {engineModel === 'flux' && parseFloat(renderElapsed) > 8 && (
                  <button
                    onClick={() => generateRender('turbo')}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" /> Switch to Fast Turbo (Instant 3s render)
                  </button>
                )}
              </div>
            ) : !currentRender ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/80 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                  <Layers className="w-8 h-8 opacity-40" />
                </div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Ready for Photorealistic Synthesis</h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Choose your room style and details from the left sidebar, then click Generate.
                </p>
                <button
                  onClick={() => generateRender()}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-lg flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Start Initial Render
                </button>
              </div>
            ) : (
              <>
                {/* 1. LEFT/BASE IMAGE: Empty Room Photo OR CAD Blueprint */}
                <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
                  {leftComparisonImage ? (
                    <img 
                      src={leftComparisonImage} 
                      className="w-full h-full object-cover filter contrast-105" 
                      alt="Base Reference" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#09090b] text-zinc-600">
                      <Layers className="w-12 h-12 mb-2 opacity-30" />
                      <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                        {studioMode === 'stager' ? 'Empty Room Photo' : '2D/3D CAD Wireframe'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. RIGHT/OVERLAY IMAGE: Furnished/Rendered Image with Split Clip Path */}
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
                  {studioMode === 'stager' ? 'AI FURNISHED & STAGED' : 'PHOTOREALISTIC 8K'}
                </div>
                <div className="absolute top-4 right-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider text-zinc-300 border border-zinc-700/50 z-20 shadow-lg">
                  {studioMode === 'stager' ? 'ORIGINAL EMPTY ROOM' : 'CAD BLUEPRINT'}
                </div>

                {/* Bottom Overlay Info Pill */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/85 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] text-zinc-300 border border-zinc-800 z-20 pointer-events-none flex items-center gap-2 shadow-2xl">
                  <span>Drag slider left / right to compare</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-emerald-400 font-mono">{sliderPos.toFixed(0)}% Staged</span>
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
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30' 
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

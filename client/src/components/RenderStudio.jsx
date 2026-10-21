import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Sparkles, Download, RefreshCw, Layers, 
  Sun, Moon, CloudSun, CloudRain, Camera, Check, 
  Sliders, Wand2, Zap, Upload, Sofa, Home, CheckCircle2, 
  Columns, Maximize2, Split, Eye, Info
} from 'lucide-react';

const STYLES = [
  { 
    id: 'modern', 
    name: 'Ultra Modern Luxury', 
    tagline: 'Expansive glass curtain walls, cantilevered slabs & warm ambient LEDs',
    promptSnippet: 'ultra-modern luxury architectural residence with expansive floor-to-ceiling glass curtain walls, cantilevered cast concrete slabs, warm linear recessed LED accents, minimalist high-end designer furnishings'
  },
  { 
    id: 'japandi', 
    name: 'Japandi Minimalist', 
    tagline: 'Warm blonde oak slats, shoji textures, washi pendants & serene daylight',
    promptSnippet: 'serene Japandi minimalist architectural interior, natural light-oak slatted wood panels, washi paper screens, smooth micro-cement flooring, understated low-profile furniture, indoor bonsai and zen courtyard garden'
  },
  { 
    id: 'scandinavian', 
    name: 'Nordic Scandinavian', 
    tagline: 'Pale ash wood, cozy bouclé, soft Nordic daylight & fireplace',
    promptSnippet: 'bright Scandinavian architectural haven, pale ash wood floorboards, crisp matte white walls, rich bouclé and linen textiles, soft diffused Nordic daylight, integrated fireplace'
  },
  { 
    id: 'industrial', 
    name: 'Industrial Loft', 
    tagline: 'Exposed structural steel, vintage brickwork, Crittall glass & cognac leather',
    promptSnippet: 'high-ceiling industrial architectural loft, exposed black structural steel beams, reclaimed vintage red brickwork, polished concrete floors, Crittall steel-framed windows, bespoke cognac leather seating'
  },
  { 
    id: 'contemporary', 
    name: 'Warm Contemporary', 
    tagline: 'Travertine stone, linen drapery, fluted wood & architectural cove lighting',
    promptSnippet: 'warm contemporary architectural masterwork, Italian silver travertine stone, acoustic fluted timber cladding, sheer organic linen drapery, sculptural bronze hardware, layered ambient lighting'
  },
  { 
    id: 'mediterranean', 
    name: 'Mediterranean Villa', 
    tagline: 'Limewash stucco, terracotta, arched porticos & sun-drenched courtyards',
    promptSnippet: 'luxurious Mediterranean contemporary villa, warm textured lime-wash stucco walls, natural terracotta and limestone tiles, arched porticos, sun-drenched private courtyard with ancient olive tree'
  }
];

// Architectural Camera Framing Options
const CAMERA_FRAMINGS = [
  { id: 'ultrawide', label: 'Ultra-Wide Full Room (14mm)', desc: 'Complete panoramic view from corner to corner' },
  { id: 'diagonal', label: 'Corner Diagonal (Wide)', desc: 'Dramatic depth showcasing adjacent walls and ceiling' },
  { id: 'panoramic', label: 'Panoramic Vista (Wall-to-Wall)', desc: 'Expansive horizontal perspective covering entire room' }
];

// Room Stager Presets (Wide-Angle Empty Rooms)
const EMPTY_ROOM_SAMPLES = [
  {
    id: 'living',
    title: 'Empty Living Lounge',
    desc: 'Spacious vacant room with natural daylight and open flow',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1280&q=80',
    type: 'living',
    defaultPrompt: 'Central grand conversational seating area with large modular sectional sofa in textured ivory bouclé, two Scandinavian lounge armchairs, organic dual-tier travertine coffee table, large textured wool area rug, full-height architectural media feature wall with integrated ribbon fireplace, formal dining area visible in background, floor-to-ceiling glass windows with sheer linen drapery, sculptural statement chandelier'
  },
  {
    id: 'bedroom',
    title: 'Empty Master Bedroom',
    desc: 'Wide vacant bedroom with hardwood floors & large window',
    url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1280&q=80',
    type: 'bedroom',
    defaultPrompt: 'Grand king-size upholstered platform bed with fluted walnut acoustic headboard, two floating bedside nightstands with warm amber pendant lighting, cozy sitting reading lounge corner with velvet armchair and ottoman, large plush area rug covering wide-plank hardwood floors, floor-to-ceiling panoramic glass windows with sheer drapery, recessed tray ceiling with warm ambient LED cove illumination'
  },
  {
    id: 'loft',
    title: 'Industrial Loft Space',
    desc: 'High ceiling loft with bare brick walls & wide floor',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1280&q=80',
    type: 'loft',
    defaultPrompt: 'Expansive open-plan living and dining loft: caramel distressed leather Chesterfield sofa, raw steel and glass coffee table, oversized Persian rug over polished concrete, solid oak 8-person dining table, black industrial Crittall window wall, vintage brass Edison bulb chandeliers throughout'
  },
  {
    id: 'penthouse',
    title: 'Modern Penthouse Suite',
    desc: 'Expansive open floor plan with panoramic skyline views',
    url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1280&q=80',
    type: 'penthouse',
    defaultPrompt: 'Full penthouse living salon with low-profile Italian designer sectional, sculptural marble plinth tables, acoustic blonde oak slatted wall panels, custom bar counter with leather stools, recessed ceiling light coves, floor-to-ceiling glass overlooking skyline'
  }
];

const ROOM_TYPES = [
  { 
    id: 'living', 
    label: 'Entire Living Room & Lounge',
    promptTemplate: 'entire massive luxury open-concept living room and lounge from wall to wall: central large modular sectional sofa arrangement with complementary bouclé lounge armchairs, sculpted marble coffee table, plush textured wool area rug, bespoke architectural media wall with integrated ribbon fireplace and illuminated niches, formal dining area visible in the open background, floor-to-ceiling panoramic glass windows with sheer drapery overlooking garden, statement sculptural ceiling chandelier and warm cove lighting, fiddle leaf fig tree in ceramic planter, complete comprehensive interior design across all 4 walls, ceiling and flooring, zero empty corners'
  },
  { 
    id: 'bedroom', 
    label: 'Entire Master Bedroom Suite',
    promptTemplate: 'entire grand master bedroom suite fully furnished from edge to edge: king-size upholstered platform bed with fluted walnut accent headboard, two floating bedside nightstands with warm designer pendant lamps, sitting reading lounge nook with velvet accent armchair, large custom textured area rug over wide-plank oak flooring, walk-in dressing room entryway, floor-to-ceiling panoramic picture windows with linen sheer curtains, recessed tray ceiling with warm ambient LED cove lighting, contemporary canvas artwork, completely styled from corner to corner'
  },
  { 
    id: 'dining', 
    label: 'Entire Kitchen & Dining Hall',
    promptTemplate: 'entire grand open-concept chef kitchen and formal dining pavilion: massive kitchen island with waterfall Calacatta marble countertop and leather counter stools, adjacent large 8-person solid walnut dining table with sculptural chairs, statement brass pendant lighting, floor-to-ceiling custom flat-panel millwork cabinetry with integrated panel-ready appliances, herringbone timber floors, wide panoramic glass doors to outdoor patio'
  },
  { 
    id: 'office', 
    label: 'Entire Executive Study & Library',
    promptTemplate: 'entire luxury executive home office and private library: expansive solid walnut executive desk with ergonomic leather armchair, guest conversational seating with two armchairs and side table, floor-to-ceiling custom built-in bookshelves with illuminated display shelves, large geometric area rug, floor-to-ceiling corner windows with sheer drapery, sculptural desk lamp, complete comprehensive library study room interior'
  }
];

export default function RenderStudio() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  // Studio Mode: 'stager' (Virtual Room Stager) or 'blueprint' (CAD 3D Render)
  const [studioMode, setStudioMode] = useState('stager');

  // Viewer Mode: 'side-by-side' (Clear Left/Right), 'full' (Full 8K Render), or 'split' (Interactive slider)
  const [viewerMode, setViewerMode] = useState('side-by-side');

  // Speed & Quality Engine: 'turbo' (3-5s) vs 'flux' (High-Fidelity)
  const [engineModel, setEngineModel] = useState('turbo');

  // Camera & Framing State
  const [cameraFraming, setCameraFraming] = useState(CAMERA_FRAMINGS[0]);

  // CAD Blueprint Render State
  const [activeStyle, setActiveStyle] = useState(STYLES[0]);
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

  // Peek original in Full View mode
  const [peekOriginal, setPeekOriginal] = useState(false);

  // Auto-generate preview on mount
  useEffect(() => {
    generateRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer for generation feedback
  useEffect(() => {
    if (isRendering) {
      setRenderElapsed(0);
      setRenderPhase('Setting Camera Perspective...');
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const secs = ((Date.now() - start) / 1000).toFixed(1);
        setRenderElapsed(secs);
        if (secs > 1.2 && secs <= 3.0) {
          setRenderPhase('Composing Wall-to-Wall Architecture...');
        } else if (secs > 3.0 && secs <= 5.5) {
          setRenderPhase('Furnishing Complete Room & Ambient Lighting...');
        } else if (secs > 5.5) {
          setRenderPhase('Refining 8K Textures & Photorealistic Finish...');
        }
      }, 200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRendering]);

  // Construct Whole-Room Master Prompt
  const activePromptText = useMemo(() => {
    if (studioMode === 'stager') {
      const parts = [
        `Award-winning architectural interior photography, ${cameraFraming.desc}`,
        `Complete panoramic view of an ${stagerRoomType.promptTemplate}`,
        `Designed in authentic ${stagerStyle.name} aesthetic with ${stagerStyle.promptSnippet}`,
        stagerPrompt.trim() ? `Custom detailing: ${stagerPrompt.trim()}` : null,
        'Architectural Digest showcase, Elle Decor cover feature, full room perspective, corner to corner, expansive interior, high ceiling with architectural lighting, 8k resolution, photorealistic masterwork, raytracing, zero empty walls, zero cropped vignettes, wide angle master shot'
      ].filter(Boolean);
      return parts.join(', ');
    } else {
      const parts = [
        `Award-winning architectural photography, ${cameraFraming.desc}`,
        `Complete panoramic view of a ${activeStyle.promptSnippet}`,
        customPrompt.trim() ? customPrompt.trim() : null,
        'Architectural Digest, full room perspective from corner to corner, 8k resolution, octane render, Unreal Engine 5 realism, cinematic composition, depth of field, photorealistic textures, masterwork'
      ].filter(Boolean);
      return parts.join(', ');
    }
  }, [studioMode, cameraFraming, stagerRoomType, stagerStyle, stagerPrompt, activeStyle, customPrompt]);

  const handleMouseMove = (e) => {
    if (!sliderRef.current || viewerMode !== 'split') return;
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

    const encodedPrompt = encodeURIComponent(activePromptText);
    
    // Fast Turbo (3-5s) vs Ultra FLUX
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
        roomType: studioMode === 'stager' ? stagerRoomType.label : 'CAD Visualization',
        seed: newSeed,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setCurrentRender(newRenderItem);
      setGallery(prev => [newRenderItem, ...prev]);
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
      const prefix = studioMode === 'stager' ? 'Arch-E-Tech-Whole-Room-Staged' : 'Arch-E-Tech-Render';
      a.download = `${prefix}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(currentRender.url, '_blank');
    }
  };

  // Base comparison image for the original space
  const leftComparisonImage = studioMode === 'stager'
    ? (stagerUserImage || stagerSelectedPreset.url)
    : wireframeSnapshot;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* ========================================================= */}
      {/* LEFT CONTROL PANEL                                        */}
      {/* ========================================================= */}
      <aside className="w-[420px] border-r border-zinc-800 bg-zinc-950/95 backdrop-blur-xl flex flex-col z-20 shadow-2xl shrink-0">
        
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
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">AI Virtual Room Stager</h1>
                <p className="text-[11px] text-zinc-400">Full-Room Architectural Furnishing & Staging</p>
              </div>
            </div>
          </div>

          {/* Studio Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
            <button
              onClick={() => setStudioMode('stager')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                studioMode === 'stager' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sofa className="w-3.5 h-3.5" />
              <span>Virtual Room Stager</span>
            </button>
            <button
              onClick={() => setStudioMode('blueprint')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                studioMode === 'blueprint' 
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>CAD Blueprint 3D</span>
            </button>
          </div>

          {/* Engine Speed Indicator */}
          <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-black/40 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Generation Speed:
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
          {/* VIRTUAL ROOM STAGER CONTROLS                              */}
          {/* ========================================================= */}
          {studioMode === 'stager' && (
            <>
              {/* 1. Target Room Type */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-emerald-400" /> Space to Stage
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROOM_TYPES.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => {
                        setStagerRoomType(rt);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        stagerRoomType.id === rt.id
                          ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{rt.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Whole-room layout</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Upload or Pick Room Photo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> Base Room Photo
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
                  className="border-2 border-dashed border-zinc-700 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-zinc-900/30 hover:bg-zinc-900/60 transition-all mb-2.5 group"
                >
                  <Upload className="w-5 h-5 mx-auto text-zinc-500 group-hover:text-emerald-400 mb-1" />
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white block">
                    {stagerUserImage ? 'Change Uploaded Photo' : 'Upload Your Empty Room Picture'}
                  </span>
                  <span className="text-[10px] text-zinc-500">JPG, PNG up to 10MB</span>
                </div>

                {/* Wide Angle Presets */}
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

              {/* 3. Camera Framing / Angle */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" /> Camera Framing
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {CAMERA_FRAMINGS.map(cf => (
                    <button
                      key={cf.id}
                      onClick={() => setCameraFraming(cf)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        cameraFraming.id === cf.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-xs font-semibold">{cf.label}</div>
                      <div className="text-[10px] text-zinc-500">{cf.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Interior Design Aesthetic */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Architectural Aesthetic
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

              {/* 5. Custom Whole-Room Directives */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Custom Furniture & Details
                </h3>
                <textarea
                  value={stagerPrompt}
                  onChange={(e) => setStagerPrompt(e.target.value)}
                  placeholder="e.g. Massive sectional sofa, central marble coffee table, two armchairs, large wool rug, dining area in background, statement lighting..."
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* CAD BLUEPRINT 3D CONTROLS                                 */}
          {/* ========================================================= */}
          {studioMode === 'blueprint' && (
            <>
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Architectural Style
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {STYLES.map(style => (
                    <div 
                      key={style.id}
                      onClick={() => setActiveStyle(style)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        activeStyle.id === style.id 
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
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

        </div>

        {/* Generate Button Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-950/80">
          <button 
            onClick={() => generateRender()}
            disabled={isRendering}
            className={`w-full py-3.5 rounded-xl font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 shadow-xl ${
              isRendering 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            }`}
          >
            {isRendering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Designing Full Room ({renderElapsed}s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Complete Furnished Room</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT: INTUITIVE SIDE-BY-SIDE / FULL VIEWER       */}
      {/* ========================================================= */}
      <main className="flex-1 relative flex flex-col bg-zinc-900 overflow-hidden">
        
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* Top Viewport Status & Intuitive View Mode Selector */}
        <div className="h-14 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md px-6 flex items-center justify-between z-10">
          
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white tracking-wide">
              {studioMode === 'stager' ? 'Room Transformation' : 'CAD to Photorealism'}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">
              {currentRender ? `${currentRender.style} • Full Room View` : 'Ready to Stage'}
            </span>
          </div>

          {/* Center: Crystal-Clear View Mode Selector (Fixes the confusing split slider!) */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewerMode('side-by-side')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewerMode === 'side-by-side'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Side-by-Side: View Original Space on Left, Furnished Room on Right"
            >
              <Columns className="w-3.5 h-3.5 text-emerald-400" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setViewerMode('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewerMode === 'full'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Full View: Expansive view of the completed furnished room"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Full Staged View</span>
            </button>
            <button
              onClick={() => setViewerMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewerMode === 'split'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Split Slider: Drag divider between original and furnished"
            >
              <Split className="w-3.5 h-3.5 text-amber-400" />
              <span>Split Slider</span>
            </button>
          </div>

          {/* Right Action Buttons */}
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

        {/* Center Viewer Area */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          
          {/* Loading Overlay */}
          {isRendering ? (
            <div className="w-full max-w-6xl aspect-video rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center shadow-2xl relative">
              <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight mb-1">
                Designing Complete Furnished Room
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
            </div>
          ) : !currentRender ? (
            <div className="w-full max-w-6xl aspect-video rounded-3xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                <Sofa className="w-8 h-8 opacity-40 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mb-1">Ready for Whole-Room Staging</h3>
              <p className="text-xs text-zinc-500 max-w-md mb-6">
                Select your space type and aesthetic from the left panel, then click Generate to create a wall-to-wall furnished room.
              </p>
              <button
                onClick={() => generateRender()}
                className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-lg flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Start Initial Render
              </button>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* VIEW MODE 1: SIDE-BY-SIDE (Clean & Crystal Clear!)         */}
              {/* ========================================================= */}
              {viewerMode === 'side-by-side' && (
                <div className="w-full max-w-6xl aspect-video grid grid-cols-2 gap-4 h-full max-h-[75vh]">
                  
                  {/* Left: Original Empty Room or CAD */}
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-xl group">
                    <img 
                      src={leftComparisonImage} 
                      className="w-full h-full object-cover filter contrast-105" 
                      alt="Original Space" 
                    />
                    <div className="absolute top-3 left-3 bg-zinc-950/85 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-zinc-400 border border-zinc-800 shadow-md">
                      ORIGINAL EMPTY ROOM / CAD
                    </div>
                  </div>

                  {/* Right: AI Furnished Whole Room */}
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-black shadow-[0_0_30px_rgba(16,185,129,0.15)] group">
                    <img 
                      src={currentRender.url} 
                      className="w-full h-full object-cover" 
                      alt="Furnished Full Room" 
                    />
                    <div className="absolute top-3 left-3 bg-emerald-950/90 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      AI FURNISHED FULL ROOM
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] text-zinc-300 border border-zinc-800 font-mono">
                      {currentRender.style} • 8K Wide View
                    </div>
                  </div>

                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW MODE 2: FULL STAGED VIEW (Expansive 8K Viewport)      */}
              {/* ========================================================= */}
              {viewerMode === 'full' && (
                <div className="relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden border border-zinc-800 bg-black shadow-2xl h-full max-h-[75vh]">
                  <img 
                    src={peekOriginal ? leftComparisonImage : currentRender.url} 
                    className="w-full h-full object-cover transition-all duration-200" 
                    alt="Furnished Full Room" 
                  />
                  <div className="absolute top-4 left-4 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 border border-emerald-500/40 shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {peekOriginal ? 'ORIGINAL ROOM REFERENCE' : 'FULL ROOM PHOTOREALISTIC STAGING'}
                  </div>
                  
                  {/* Hold to Peek Original Button */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <button
                      onMouseDown={() => setPeekOriginal(true)}
                      onMouseUp={() => setPeekOriginal(false)}
                      onTouchStart={() => setPeekOriginal(true)}
                      onTouchEnd={() => setPeekOriginal(false)}
                      className="px-4 py-2 rounded-full bg-zinc-950/85 hover:bg-black text-zinc-200 text-xs font-semibold border border-zinc-700/80 shadow-2xl flex items-center gap-2 backdrop-blur-md active:scale-95 transition-transform select-none"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Press & Hold to Peek Original</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW MODE 3: SPLIT SLIDER                                 */}
              {/* ========================================================= */}
              {viewerMode === 'split' && (
                <div 
                  className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-zinc-800 bg-black shadow-2xl select-none h-full max-h-[75vh]"
                  ref={sliderRef}
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleMouseMove}
                >
                  {/* Left: Original */}
                  <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
                    <img 
                      src={leftComparisonImage} 
                      className="w-full h-full object-cover filter contrast-105" 
                      alt="Base Reference" 
                    />
                  </div>

                  {/* Right: Furnished with clipPath */}
                  <div 
                    className="absolute inset-0 overflow-hidden" 
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                  >
                    <img 
                      src={currentRender.url} 
                      className="absolute inset-0 w-full h-full object-cover" 
                      alt="AI Furnished Full Room" 
                    />
                  </div>

                  {/* Drag Handle */}
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

                  {/* Badges */}
                  <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-400 border border-emerald-500/30 z-20">
                    AI FURNISHED FULL ROOM
                  </div>
                  <div className="absolute top-4 right-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-300 border border-zinc-700/50 z-20">
                    ORIGINAL EMPTY ROOM
                  </div>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/85 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] text-zinc-300 border border-zinc-800 z-20 pointer-events-none">
                    Drag slider left / right to compare ({sliderPos.toFixed(0)}%)
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* ========================================================= */}
        {/* BOTTOM GALLERY STRIP                                      */}
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

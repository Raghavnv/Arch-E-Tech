import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Image as ImageIcon, Layers, RefreshCw } from 'lucide-react';

const STYLES = [
  { id: 'modern', name: 'Ultra Modern', desc: 'Clean lines, glass, concrete' },
  { id: 'japandi', name: 'Japandi', desc: 'Minimalist wood, warm lighting' },
  { id: 'brutalist', name: 'Brutalist', desc: 'Raw concrete, dramatic shadows' },
  { id: 'industrial', name: 'Industrial', desc: 'Exposed steel, brick, loft style' }
];

export default function RenderStudio() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const navigate = useNavigate();
  
  const [activeStyle, setActiveStyle] = useState(STYLES[0]);
  const [isRendering, setIsRendering] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef(null);
  
  // Mock images for demonstration
  const [renderedImage, setRenderedImage] = useState(null);
  const wireframeImage = "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2671&auto=format&fit=crop"; // Placeholder for 3D wireframe

  const mockRenders = {
    'modern': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2000&auto=format&fit=crop',
    'japandi': 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2000&auto=format&fit=crop',
    'brutalist': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2000&auto=format&fit=crop',
    'industrial': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2000&auto=format&fit=crop'
  };

  const handleMouseMove = (e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  };

  const generateRender = () => {
    setIsRendering(true);
    // Simulate AI Generation time
    setTimeout(() => {
      setRenderedImage(mockRenders[activeStyle.id]);
      setIsRendering(false);
      setSliderPos(50); // Reset slider to middle to show before/after
    }, 3000);
  };

  return (
    <div className="flex h-screen bg-transparent text-zinc-100 font-sans overflow-hidden">
      
      {/* Sidebar Controls */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800">
          <Link to={`/studio?projectId=${projectId}`} className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Studio
          </Link>
          <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" /> AI Render
          </h1>
          <p className="text-sm text-zinc-400 mt-2">Transform your wireframe into a photorealistic visualization using ControlNet.</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Architectural Style</h3>
          <div className="space-y-3">
            {STYLES.map(style => (
              <div 
                key={style.id}
                onClick={() => setActiveStyle(style)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeStyle.id === style.id 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-zinc-800 bg-black hover:border-zinc-700'
                }`}
              >
                <h4 className={`font-semibold text-sm mb-1 ${activeStyle.id === style.id ? 'text-white' : 'text-zinc-300'}`}>{style.name}</h4>
                <p className="text-xs text-zinc-500">{style.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-black">
          <button 
            onClick={generateRender}
            disabled={isRendering}
            className={`w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              isRendering ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isRendering ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Rendering...</>
            ) : (
              <><ImageIcon className="w-4 h-4" /> Generate Image</>
            )}
          </button>
        </div>
      </aside>

      {/* Main Viewer area */}
      <main className="flex-1 relative flex items-center justify-center bg-zinc-900 overflow-hidden pattern-grid">
        
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 bg-black group"
             ref={sliderRef}
             onMouseMove={handleMouseMove}
             onTouchMove={(e) => handleMouseMove(e.touches[0])}
        >
          {isRendering ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-30">
              <div className="w-16 h-16 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <p className="text-indigo-400 font-medium animate-pulse">Running Neural Style Transfer...</p>
            </div>
          ) : !renderedImage ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
              <Layers className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a style and click Generate to see the magic.</p>
            </div>
          ) : (
            <>
              {/* Base Image (Wireframe) */}
              <img src={wireframeImage} className="absolute inset-0 w-full h-full object-cover grayscale opacity-50 blur-sm" alt="Wireframe" />
              
              {/* Overlay Image (Render) with Clip Path for Before/After */}
              <div 
                className="absolute inset-0 overflow-hidden" 
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img src={renderedImage} className="absolute inset-0 w-full h-full object-cover" alt="Rendered" />
              </div>

              {/* Slider Handle */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-zinc-200">
                  <div className="flex gap-1">
                    <div className="w-0.5 h-3 bg-zinc-400 rounded-full"></div>
                    <div className="w-0.5 h-3 bg-zinc-400 rounded-full"></div>
                  </div>
                </div>
              </div>
              
              {/* Badges */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider text-white border border-white/10 z-10">RENDERED</div>
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider text-white border border-white/10 z-10">WIREFRAME</div>
            </>
          )}
        </div>

        {/* Download Button overlay */}
        {renderedImage && !isRendering && (
          <button className="absolute bottom-8 right-8 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-full font-medium shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all flex items-center gap-2">
            <Download className="w-4 h-4" /> Export HD Render
          </button>
        )}
      </main>
    </div>
  );
}

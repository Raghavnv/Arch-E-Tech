import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, StickyNote, Image as ImageIcon, Palette, Type, MousePointer2, Move, Share2, Users, Download } from 'lucide-react';

const PinterestIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.168 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.624 0 12.017 0z"/>
  </svg>
);

export default function WarRoom() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const navigate = useNavigate();

  const [showPinterest, setShowPinterest] = useState(false);
  const mockPins = [
    "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=600&auto=format&fit=crop"
  ];

  // Canvas State (Pan & Zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef(null);

  // Board Items
  const [items, setItems] = useState([
    { id: '1', type: 'note', x: 200, y: 200, content: 'Need to maximize southern exposure for natural light.', color: 'bg-yellow-200' },
    { id: '2', type: 'image', x: 600, y: 150, content: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop' },
    { id: '3', type: 'palette', x: 300, y: 500, colors: ['#2A2A2A', '#F5F5F0', '#B0987A', '#5C6C71'] }
  ]);
  const [draggingId, setDraggingId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Panning functionality (Middle click or Space+Drag)
  const handleCanvasMouseDown = (e) => {
    if (e.target !== canvasRef.current) return;
    setIsPanning(true);
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    // Optional: implement zooming
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(prev => Math.max(0.1, Math.min(prev - e.deltaY * 0.01, 3)));
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [canvasRef.current]);

  // Item Dragging functionality
  const handleItemMouseDown = (e, id) => {
    e.stopPropagation();
    setDraggingId(id);
    const item = items.find(i => i.id === id);
    // Calculate offset considering pan and zoom
    dragOffset.current = {
      x: (e.clientX - pan.x) / zoom - item.x,
      y: (e.clientY - pan.y) / zoom - item.y
    };
  };

  const handleItemMouseMove = (e) => {
    if (!draggingId) return;
    setItems(prevItems => prevItems.map(item => {
      if (item.id === draggingId) {
        return {
          ...item,
          x: (e.clientX - pan.x) / zoom - dragOffset.current.x,
          y: (e.clientY - pan.y) / zoom - dragOffset.current.y
        };
      }
      return item;
    }));
  };

  const handleItemMouseUp = () => {
    setDraggingId(null);
  };

  // Add Item Generators
  const addNote = () => {
    setItems([...items, { id: Date.now().toString(), type: 'note', x: -pan.x/zoom + 300, y: -pan.y/zoom + 300, content: 'New note...', color: 'bg-yellow-200' }]);
  };
  
  const addImage = () => {
    const url = prompt("Enter image URL (e.g. Unsplash):", "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop");
    if (url) {
      setItems([...items, { id: Date.now().toString(), type: 'image', x: -pan.x/zoom + 400, y: -pan.y/zoom + 300, content: url }]);
    }
  };

  const addPalette = () => {
    setItems([...items, { id: Date.now().toString(), type: 'palette', x: -pan.x/zoom + 200, y: -pan.y/zoom + 400, colors: ['#000000', '#FFFFFF', '#4F46E5', '#10B981'] }]);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* Top Navigation */}
      <header className="h-16 border-b border-zinc-800 bg-black flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link to={`/studio?projectId=${projectId || ''}`} className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-6 bg-zinc-800 mx-2"></div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            War Room <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-widest ml-2">Beta</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center -space-x-2 mr-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-black flex items-center justify-center text-xs font-bold text-white z-30">You</div>
            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center text-xs font-bold text-white z-20">JD</div>
            <div className="w-8 h-8 rounded-full bg-pink-500 border-2 border-black flex items-center justify-center text-xs font-bold text-white z-10">AK</div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors border border-zinc-800">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      {/* Main Collaborative Area */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Left Toolbar */}
        <aside className="w-16 border-r border-zinc-800 bg-black flex flex-col items-center py-6 gap-6 z-20 shadow-2xl">
          <button onClick={addNote} className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Add Sticky Note">
            <StickyNote className="w-5 h-5" />
          </button>
          <button onClick={addImage} className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Add Image">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button onClick={addPalette} className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Add Color Palette">
            <Palette className="w-5 h-5" />
          </button>
          <div className="w-8 h-px bg-zinc-800"></div>
          <button 
            onClick={() => setShowPinterest(!showPinterest)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showPinterest ? 'bg-[#E60023] text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            title="Import from Pinterest"
          >
            <PinterestIcon className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors mt-auto" title="Pan Tool">
            <Move className="w-5 h-5" />
          </button>
        </aside>

        {/* Pinterest Slide-Out Panel */}
        <div className={`absolute top-0 bottom-0 left-16 w-80 bg-zinc-950 border-r border-zinc-800 z-10 transition-transform duration-300 flex flex-col shadow-2xl ${showPinterest ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <PinterestIcon className="w-4 h-4 text-[#E60023]" /> Pinterest Boards
            </h2>
            <button onClick={() => setShowPinterest(false)} className="text-zinc-500 hover:text-white">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
          <div className="p-4">
            <input 
              type="text" 
              placeholder="Paste board URL..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E60023] transition-colors mb-2"
            />
            <button className="w-full py-2 bg-[#E60023] hover:bg-[#d5001c] text-white rounded-lg text-sm font-semibold transition-colors">
              Connect Account
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pt-0">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Saved Pins</p>
            <div className="columns-2 gap-2 space-y-2">
              {mockPins.map((pin, i) => (
                <div 
                  key={i} 
                  className="relative group cursor-pointer break-inside-avoid"
                  onClick={() => {
                    // Spawn pin on canvas
                    setItems([...items, { id: Date.now().toString(), type: 'image', x: -pan.x/zoom + 300 + (Math.random()*100), y: -pan.y/zoom + 200 + (Math.random()*100), content: pin }]);
                  }}
                >
                  <img src={pin} className="w-full rounded-md object-cover" alt="pin" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                    <span className="bg-[#E60023] text-white text-xs font-bold px-2 py-1 rounded-full">Save</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Endless Canvas Workspace */}
        <div 
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden bg-zinc-950 pattern-grid ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            handleCanvasMouseMove(e);
            handleItemMouseMove(e);
          }}
          onMouseUp={() => {
            handleCanvasMouseUp();
            handleItemMouseUp();
          }}
          onMouseLeave={() => {
            handleCanvasMouseUp();
            handleItemMouseUp();
          }}
        >
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          
          {/* Canvas Transform Layer */}
          <div 
            className="absolute origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* Render Items */}
            {items.map(item => (
              <div 
                key={item.id}
                onMouseDown={(e) => handleItemMouseDown(e, item.id)}
                className="absolute cursor-move group"
                style={{ left: item.x, top: item.y }}
              >
                {/* Delete Button (Visible on hover) */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setItems(items.filter(i => i.id !== item.id)); }}
                  className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>

                {/* NOTE TYPE */}
                {item.type === 'note' && (
                  <div className={`w-64 h-64 ${item.color} shadow-2xl p-6 font-medium text-black text-lg leading-relaxed rounded-sm transform transition-transform hover:scale-105 active:scale-95`}>
                    <textarea 
                      className="w-full h-full bg-transparent resize-none focus:outline-none placeholder-black/50"
                      value={item.content}
                      onChange={(e) => setItems(items.map(i => i.id === item.id ? { ...i, content: e.target.value } : i))}
                      placeholder="Type a note..."
                    />
                  </div>
                )}

                {/* IMAGE TYPE */}
                {item.type === 'image' && (
                  <div className="p-2 bg-white shadow-2xl transform transition-transform hover:scale-105 active:scale-95 rounded-sm">
                    <img src={item.content} alt="Moodboard" className="max-w-md w-full object-cover rounded-sm pointer-events-none" draggable={false} />
                  </div>
                )}

                {/* PALETTE TYPE */}
                {item.type === 'palette' && (
                  <div className="flex bg-white p-3 rounded-xl shadow-2xl gap-2 transform transition-transform hover:scale-105 active:scale-95 border border-zinc-200">
                    {item.colors.map((color, idx) => (
                      <div key={idx} className="w-16 h-16 rounded-lg flex items-end p-2 shadow-inner border border-black/10" style={{ backgroundColor: color }}>
                        <span className="text-[10px] font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded text-black backdrop-blur-sm">{color}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 right-6 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl z-20 text-sm font-medium text-white">
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="hover:text-indigo-400 transition-colors">-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="hover:text-indigo-400 transition-colors">+</button>
      </div>
    </div>
  );
}

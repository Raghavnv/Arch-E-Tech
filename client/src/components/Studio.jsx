import { useState } from 'react';
import { Home, Layers, Settings, Save, Download, ScanLine, Box, AlertTriangle, Calculator, ChevronRight, LayoutTemplate, Magnet, Sun, MessageSquare, Image as ImageIcon, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import Canvas2D from './Canvas2D';
import Canvas3D from './Canvas3D';

export default function Studio() {
  const [drawingMode, setDrawingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('2D');
  const [activeFloor, setActiveFloor] = useState(1);
  const [canvasElements, setCanvasElements] = useState([]);
  const totalFloors = 3; // Mocked from project setup

  return (
    <div className="h-screen w-screen flex overflow-hidden font-sans bg-black text-zinc-100">
      
      {/* Left Sidebar - Project Metrics & Tools */}
      <aside className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col z-10 shrink-0">
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-black/50 backdrop-blur-sm">
          <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            Studio Engine
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={activeFloor}
              onChange={(e) => setActiveFloor(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 text-xs text-white rounded-md px-2 py-1 focus:outline-none"
            >
              {[...Array(totalFloors)].map((_, i) => (
                <option key={i+1} value={i+1}>Floor {i+1}</option>
              ))}
            </select>
            <Link to="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
              <Home className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Modules/Tabs */}
        <div className="flex border-b border-zinc-800">
          <button 
            onClick={() => setActiveTab('2D')}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === '2D' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            2D Draft
          </button>
          <button 
            onClick={() => setActiveTab('3D')}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === '3D' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            3D View
          </button>
        </div>

        {/* Toolbar (Quick Actions) */}
        <div className="p-3 border-b border-zinc-800 grid grid-cols-4 gap-2">
          <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white">
            <ScanLine className="w-4 h-4 mb-1.5" />
            <span className="text-[9px] font-medium text-center leading-tight">Auto Detect</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white">
            <Magnet className="w-4 h-4 mb-1.5" />
            <span className="text-[9px] font-medium text-center leading-tight">Smart Snap</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white">
            <LayoutTemplate className="w-4 h-4 mb-1.5" />
            <span className="text-[9px] font-medium text-center leading-tight">AI Layout</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white">
            <ImageIcon className="w-4 h-4 mb-1.5" />
            <span className="text-[9px] font-medium text-center leading-tight">Concept Viz</span>
          </button>
        </div>

        {/* Project Metrics Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          {/* Active Pipeline */}
          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Live Computations</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-2 text-zinc-300"><Box className="w-3.5 h-3.5" /> 3D Extrusion</span>
                <span className="text-emerald-400 text-[10px]">Active</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-2 text-zinc-300"><AlertTriangle className="w-3.5 h-3.5" /> Clash Detection</span>
                <span className="text-zinc-600 text-[10px]">Standby</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-2 text-zinc-300"><Sun className="w-3.5 h-3.5" /> Solar Sim</span>
                <span className="text-zinc-600 text-[10px]">Off</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/50 w-full"></div>

          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Vector Elements</span>
            </h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 rounded hover:bg-zinc-900 transition-colors">
                <span className="flex items-center gap-2 text-xs text-zinc-300"><div className="w-1.5 h-1.5 bg-zinc-400"></div> Walls</span>
                <span className="text-xs text-zinc-500 font-mono">{canvasElements.filter(el => el.type === 'wall').length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 rounded hover:bg-zinc-900 transition-colors">
                <span className="flex items-center gap-2 text-xs text-zinc-300"><div className="w-1.5 h-1.5 bg-yellow-400"></div> Doors</span>
                <span className="text-xs text-zinc-500 font-mono">{canvasElements.filter(el => el.type === 'door').length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 rounded hover:bg-zinc-900 transition-colors">
                <span className="flex items-center gap-2 text-xs text-zinc-300"><div className="w-1.5 h-1.5 bg-blue-400"></div> Windows</span>
                <span className="text-xs text-zinc-500 font-mono">{canvasElements.filter(el => el.type === 'window').length}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/50 w-full"></div>

          {/* Assistant & Reports */}
          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Assistants</h3>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  const violations = [];
                  canvasElements.forEach(el => {
                    if (el.type === 'door' && el.width < 50) {
                      violations.push('Violation (Code 1020.2): Door width is less than 32" clearance.');
                    }
                    if (el.type === 'wall' && el.width > 600) {
                      violations.push('Structural Warning: Span exceeds 20ft without supporting pillar.');
                    }
                    if (el.type === 'window' && el.width < 40) {
                      violations.push('Egress Warning (Code 1030): Window width insufficient for emergency escape.');
                    }
                  });
                  if (violations.length === 0) {
                    alert("✅ AI Inspector: All designs meet local compliance codes.");
                  } else {
                    alert("⚠️ AI Inspector Found Issues:\n\n- " + violations.join('\n- '));
                  }
                }}
                className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 transition-colors p-3 rounded-lg border border-zinc-800 text-left text-xs"
              >
                <span className="flex items-center gap-2 text-zinc-300"><MessageSquare className="w-4 h-4 text-white" /> Code Compliance RAG</span>
                <ChevronRight className="w-3 h-3 text-zinc-600" />
              </button>
              <button className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 transition-colors p-3 rounded-lg border border-zinc-800 text-left text-xs">
                <span className="flex items-center gap-2 text-zinc-300"><Calculator className="w-4 h-4 text-white" /> Live Cost Takeoff</span>
                <span className="text-emerald-400 font-mono">$0</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 grid grid-cols-2 gap-2 bg-black">
          <button className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white transition-colors border border-zinc-800">
            <FileText className="w-3.5 h-3.5" /> PDF Report
          </button>
          <button className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-xs font-semibold text-black transition-colors">
            Process 3D <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative bg-zinc-950 flex flex-col">
        {/* Floating Drafting Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1.5 rounded-full shadow-2xl">
          <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 border-r border-zinc-800 mr-1">
            Build Mode
          </div>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'wall' ? null : 'wall')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'wall' ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <Layers className="w-3.5 h-3.5" /> Wall
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'door' ? null : 'door')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'door' ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-yellow-400/70 hover:bg-zinc-700 hover:text-yellow-400'}`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Door
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'window' ? null : 'window')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'window' ? 'bg-blue-400 text-black' : 'bg-zinc-800 text-blue-400/70 hover:bg-zinc-700 hover:text-blue-400'}`}
          >
            <Box className="w-3.5 h-3.5" /> Window
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'stairs' ? null : 'stairs')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'stairs' ? 'bg-purple-400 text-black' : 'bg-zinc-800 text-purple-400/70 hover:bg-zinc-700 hover:text-purple-400'}`}
          >
            <Layers className="w-3.5 h-3.5 rotate-90" /> Stairs
          </button>
        </div>

        {/* Conditional Rendering of Canvas Engine using CSS to retain state */}
        <div className={activeTab === '2D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas2D drawingMode={drawingMode} setCanvasElements={setCanvasElements} />
        </div>
        <div className={activeTab === '3D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas3D elements={canvasElements} />
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Menu, MousePointer2, Box, Home, PenTool, LayoutTemplate, 
  Settings, Save, FileText, ChevronRight, Calculator, CheckCircle, 
  AlertTriangle, X, Maximize, MessageSquare, Layers, Sun, Eye, ImageIcon, Sparkles, Download, ScanLine, Magnet 
} from 'lucide-react';
import Canvas2D from './Canvas2D';
import Canvas3D from './Canvas3D';

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const [drawingMode, setDrawingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('2D');
  const [activeFloor, setActiveFloor] = useState(1);
  const [canvasElements, setCanvasElements] = useState([]);
  const [timeOfDay, setTimeOfDay] = useState(12); // Default to Noon
  const totalFloors = 3; // Mocked from project setup
  const [isSaving, setIsSaving] = useState(false);
  const [complianceResult, setComplianceResult] = useState(null);
  
  // Chat Copilot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hi! I'm your AI Architect. Ask me for design suggestions, code compliance, or how to optimize your current layout!" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch project from database or local storage
  useEffect(() => {
    const loadData = async () => {
      // First try to load draft if it exists (prioritize freshly generated AI drafts)
      const draft = localStorage.getItem('draftElements');
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft && parsedDraft.length > 0) {
            setCanvasElements(parsedDraft);
          }
        } catch(e) {}
        localStorage.removeItem('draftElements');
      }

      // Then fetch project from DB if ID exists
      if (projectId) {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            // Only overwrite if we didn't just load a fresh AI draft, or if the DB has actual data
            if (data.elements_data && data.elements_data.length > 0) {
              setCanvasElements(data.elements_data);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadData();
  }, [projectId]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // High-Quality Seamless Texture Library
  const TEXTURE_LIBRARY = [
    { id: 't1', name: 'Exposed Red Brick', category: 'Brick', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=512&auto=format&fit=crop' },
    { id: 't2', name: 'Whitewash Brick', category: 'Brick', url: 'https://images.unsplash.com/photo-1517825738774-7de9363ef735?q=80&w=512&auto=format&fit=crop' },
    { id: 't3', name: 'Raw Concrete', category: 'Concrete', url: 'https://images.unsplash.com/photo-1518241416805-4c60bc577033?q=80&w=512&auto=format&fit=crop' },
    { id: 't4', name: 'Polished Concrete', category: 'Concrete', url: 'https://images.unsplash.com/photo-1563229646-d2485fc3fce5?q=80&w=512&auto=format&fit=crop' },
    { id: 't5', name: 'Walnut Hardwood', category: 'Wood', url: 'https://images.unsplash.com/photo-1518174299623-286a11e86014?q=80&w=512&auto=format&fit=crop' },
    { id: 't6', name: 'Light Oak Board', category: 'Wood', url: 'https://images.unsplash.com/photo-1550993070-5b5c777242d5?q=80&w=512&auto=format&fit=crop' },
    { id: 't7', name: 'Calacatta Marble', category: 'Stone', url: 'https://images.unsplash.com/photo-1596489370617-64903ff6fb0f?q=80&w=512&auto=format&fit=crop' },
    { id: 't8', name: 'Dark Slate', category: 'Stone', url: 'https://images.unsplash.com/photo-1584282136015-6d601b38cf78?q=80&w=512&auto=format&fit=crop' },
    { id: 't9', name: 'Ceramic Hex Tile', category: 'Tile', url: 'https://images.unsplash.com/photo-1515903028308-2c069b1285ee?q=80&w=512&auto=format&fit=crop' },
    { id: 't10', name: 'Plaster Wall', category: 'Plaster', url: 'https://images.unsplash.com/photo-1587321528620-3b91a78fbff2?q=80&w=512&auto=format&fit=crop' },
  ];

  const handlePaintWall = (elementId) => {
    if (!selectedMaterial) return;
    setCanvasElements(prev => prev.map(el => 
      el.id === elementId ? { ...el, material: selectedMaterial.url } : el
    ));
  };

  const generatePDFReport = async () => {
    if (canvasElements.length === 0) {
      alert("Cannot generate report for an empty project.");
      return;
    }
    
    setIsGeneratingPDF(true);
    try {
      // 1. Fetch AI Narrative from Groq
      const res = await fetch(`${API_URL}/api/ai/report-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: canvasElements })
      });
      const aiData = await res.json();
      const narrative = aiData.narrative || "AI Analysis unavailable.";

      // 2. Take a snapshot of the current main canvas container
      const canvasContainer = document.getElementById("studio-canvas-container");
      let imgData = null;
      if (canvasContainer) {
        const canvas = await html2canvas(canvasContainer, { backgroundColor: '#09090b', scale: 2 });
        imgData = canvas.toDataURL('image/png');
      }

      // 3. Build the PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Title & Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Arch-E-Tech", 20, 20);
      
      pdf.setFontSize(16);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Project Architectural Report", 20, 30);
      
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, 35, 190, 35);

      // Add the visual snapshot
      if (imgData) {
        pdf.setFontSize(12);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Current Layout View (${activeTab})`, 20, 45);
        pdf.addImage(imgData, 'PNG', 20, 50, 170, 95);
      }

      // Add AI Narrative
      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text("AI Structural & Cost Analysis", 20, 160);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      
      const splitText = pdf.splitTextToSize(narrative, 170);
      pdf.text(splitText, 20, 170);

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated by Arch-E-Tech AI using Groq Llama-3 • ${new Date().toLocaleDateString()}`, 20, 285);

      // Save PDF
      pdf.save(`Project-Report-${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF. Check network connection.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Save project to database
  const saveProject = async () => {
    if (!projectId) return;
    setIsSaving(true);
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ elements_data: canvasElements })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

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
              <div className="flex flex-col gap-2 py-2 border-t border-zinc-900 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-zinc-300"><Sun className="w-3.5 h-3.5" /> Solar Sim (SunCalc)</span>
                  <span className="text-zinc-500 font-mono text-[10px]">{Math.floor(timeOfDay)}:00</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="24" 
                  step="0.5" 
                  value={timeOfDay} 
                  onChange={(e) => setTimeOfDay(Number(e.target.value))} 
                  className="w-full accent-white h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                />
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
                onClick={async () => {
                  setComplianceResult({ status: 'loading', messages: ['Analyzing structural integrity with Groq Llama-3...'] });
                  try {
                    const res = await fetch(`${API_URL}/api/ai/compliance`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ elements: canvasElements })
                    });
                    const data = await res.json();
                    setComplianceResult({ status: data.status, messages: data.messages });
                  } catch (err) {
                    console.error(err);
                    setComplianceResult({ status: 'warning', messages: ['Network error. Could not connect to Groq AI.'] });
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
          <button 
            onClick={generatePDFReport}
            disabled={isGeneratingPDF}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white transition-colors border border-zinc-800 disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <span className="flex items-center gap-2 animate-pulse"><FileText className="w-3.5 h-3.5" /> Building PDF...</span>
            ) : (
              <><FileText className="w-3.5 h-3.5" /> PDF Report</>
            )}
          </button>
          <Link 
            to={`/render-studio?projectId=${projectId}`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          >
            <ImageIcon className="w-3.5 h-3.5" /> Photo Render
          </Link>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main id="studio-canvas-container" className="flex-1 relative bg-zinc-950 flex flex-col">
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
          
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>
          
          <button 
            onClick={saveProject}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors bg-white/10 hover:bg-white/20 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Cloud'}
          </button>
          
          <button 
            onClick={() => {
              localStorage.setItem('immersiveDraft', JSON.stringify(canvasElements));
              navigate('/immersive');
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Immersive View
          </button>
        </div>

        {/* 2D / 3D Canvas Renders */}
        <div className={activeTab === '2D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas2D drawingMode={drawingMode} setCanvasElements={setCanvasElements} />
        </div>
        <div className={activeTab === '3D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas3D elements={canvasElements} timeOfDay={timeOfDay} onPaint={handlePaintWall} />
        </div>

        {/* 3D Material Painter Overlay */}
        {activeTab === '3D' && (
          <div className="absolute top-24 right-6 w-64 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-20">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Material Painter
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1">Select a material, then click a wall to paint.</p>
            </div>
            
            {selectedMaterial && (
              <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded border-2 border-indigo-500 overflow-hidden shrink-0">
                  <img src={selectedMaterial.url} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Active Brush</p>
                  <p className="text-[10px] text-zinc-400">{selectedMaterial.name}</p>
                </div>
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="ml-auto p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-3 h-80 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-2">
                {TEXTURE_LIBRARY.map((mat) => (
                  <button
                    key={mat.id}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedMaterial?.id === mat.id ? 'border-indigo-500 scale-95' : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    <img src={mat.url} alt={mat.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5">
                      <p className="text-[9px] font-semibold text-white truncate">{mat.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Copilot Floating Widget */}
        <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end">
          {/* Chat Window */}
          <div className={`mb-4 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col transition-all origin-bottom-right duration-300 ${
            chatOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 pointer-events-none translate-y-4'
          }`} style={{ height: '400px' }}>
            {/* Chat Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Sparkles className="w-4 h-4" /> AI Architect Copilot
              </div>
              <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2 text-sm rounded-2xl max-w-[85%] ${
                    msg.role === 'user' 
                      ? 'bg-indigo-500 text-white rounded-br-sm' 
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 bg-zinc-800 text-zinc-200 rounded-2xl rounded-bl-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                </div>
              )}
            </div>
            
              <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                
                const userMsg = chatInput;
                const newMsgs = [...chatMessages, { role: 'user', content: userMsg }];
                setChatMessages(newMsgs);
                setChatInput('');
                setIsTyping(true);
                
                try {
                  const res = await fetch(`${API_URL}/api/ai/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userMsg, elements: canvasElements })
                  });
                  const data = await res.json();
                  setChatMessages([...newMsgs, { role: 'ai', content: data.reply || "Error connecting to AI." }]);
                } catch (err) {
                  console.error(err);
                  setChatMessages([...newMsgs, { role: 'ai', content: "Network error connecting to Copilot." }]);
                } finally {
                  setIsTyping(false);
                }
              }}
              className="p-3 border-t border-zinc-800 bg-black flex gap-2 rounded-b-2xl"
            >
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your layout..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button type="submit" disabled={!chatInput.trim()} className="bg-white text-black p-2 rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Toggle Button */}
          <button 
            onClick={() => setChatOpen(!chatOpen)}
            className="w-14 h-14 bg-indigo-500 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-transform hover:scale-105 active:scale-95"
          >
            {chatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          </button>
        </div>
      </main>

      {/* Compliance Modal */}
      {complianceResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {complianceResult.status === 'success' ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                ) : complianceResult.status === 'loading' ? (
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">AI Inspector</h3>
                  <p className="text-xs text-zinc-400">
                    {complianceResult.status === 'success' ? 'Compliance Check Passed' : complianceResult.status === 'loading' ? 'Analyzing...' : 'Issues Found'}
                  </p>
                </div>
              </div>
              <button onClick={() => setComplianceResult(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-zinc-900 rounded-lg p-4 max-h-60 overflow-y-auto custom-scrollbar">
              <ul className="space-y-3">
                {complianceResult.messages.map((msg, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-zinc-300">
                    <span className="text-zinc-600 mt-0.5">•</span>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button 
              onClick={() => setComplianceResult(null)}
              className="w-full mt-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [showFurnitureCatalog, setShowFurnitureCatalog] = useState(false);
  const [activeFloor, setActiveFloor] = useState(1);
  const [canvasElements, setCanvasElements] = useState([]);
  const [timeOfDay, setTimeOfDay] = useState(12); // Default to Noon
  const totalFloors = 3; // Mocked from project setup
  const [isSaving, setIsSaving] = useState(false);
  const [complianceResult, setComplianceResult] = useState(null);
  
  // New Features State
  const [showCostModal, setShowCostModal] = useState(false);
  const [blueprintMode, setBlueprintMode] = useState(false);
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  
  // Chat Copilot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hi! I'm your AI Architect. Ask me for design suggestions, code compliance, or how to optimize your current layout!" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch project from database or local storage
  
  const calculateCosts = () => {
    let total = 0;
    const breakdown = [];
    
    const rates = {
      wall: 120, // per meter
      door: 350,
      window: 250,
      furniture_bed: 800,
      furniture_sofa: 1200,
      furniture_table: 600,
      stairs: 2500
    };

    let counts = {};
    canvasElements.forEach(el => {
      if (el.isGrid) return;
      const type = el.type || 'unknown';
      if (!counts[type]) counts[type] = { count: 0, length: 0, cost: 0 };
      
      let itemCost = 0;
      if (type === 'wall') {
        const lengthMeters = (el.width || 0) * 0.05;
        itemCost = lengthMeters * rates.wall;
        counts[type].length += lengthMeters;
      } else {
        itemCost = rates[type] || 100;
        counts[type].count += 1;
      }
      
      counts[type].cost += itemCost;
      total += itemCost;
    });

    Object.keys(counts).forEach(key => {
      breakdown.push({
        type: key.replace('furniture_', '').toUpperCase(),
        qty: key === 'wall' ? `${counts[key].length.toFixed(1)}m` : counts[key].count,
        cost: Math.round(counts[key].cost)
      });
    });

    return { total: Math.round(total), breakdown };
  };

  const costData = calculateCosts();

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
    { id: 't1', name: 'Red Brick', url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg', color: '#b91c1c' },
    { id: 't2', name: 'Hardwood Floor', url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg', color: '#b45309' },
    { id: 't3', name: 'Checkerboard Tile', url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg', color: '#52525b' },
    { id: 't4', name: 'Raw Concrete', color: '#94a3b8' },
    { id: 't5', name: 'White Plaster', color: '#f8fafc' },
    { id: 't6', name: 'Dark Slate', color: '#334155' },
    { id: 't7', name: 'Navy Blue Paint', color: '#1e3a8a' },
    { id: 't8', name: 'Forest Green Paint', color: '#14532d' },
  ];

  const handlePaintWall = (elementId) => {
    if (!selectedMaterial) return;
    setCanvasElements(prev => prev.map(el => 
      el.id === elementId ? { ...el, material: selectedMaterial.url || selectedMaterial.color, isColor: !selectedMaterial.url } : el
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const saveProject = async () => {
    if (!projectId) {
      alert("This is an unsaved draft. Generate this from the Dashboard to save to the cloud.");
      return;
    }
    setIsSaving(true);
    setSaveSuccess(false);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ elements_data: canvasElements })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save project.");
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
              <button 
                onClick={() => setShowCostModal(true)}
                className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 transition-colors p-3 rounded-lg border border-zinc-800 text-left text-xs"
              >
                <span className="flex items-center gap-2 text-zinc-300"><Calculator className="w-4 h-4 text-white" /> Live Cost Takeoff</span>
                <span className="text-emerald-400 font-mono">${costData.total.toLocaleString()}</span>
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
            onClick={() => setShowFurnitureCatalog(!showFurnitureCatalog)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${showFurnitureCatalog ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-emerald-400/70 hover:bg-zinc-700 hover:text-emerald-400'}`}
          >
            <Home className="w-3.5 h-3.5" /> Furniture
          </button>
          
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>
          
          <button 
            onClick={saveProject}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Cloud'}
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

        {/* Dynamic Feature Toggles */}
        <div className="absolute bottom-6 left-6 z-20 flex gap-2">
          {activeTab === '2D' && (
            <button
              onClick={() => setBlueprintMode(!blueprintMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${blueprintMode ? 'bg-blue-600 text-white border border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" /> Blueprint Mode
            </button>
          )}
          {activeTab === '3D' && (
            <button
              onClick={() => setWalkthroughMode(!walkthroughMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${walkthroughMode ? 'bg-emerald-600 text-white border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
            >
              <Eye className="w-4 h-4" /> First-Person Walkthrough
            </button>
          )}
        </div>

        {/* 2D / 3D Canvas Renders */}
        <div className={activeTab === '2D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas2D elements={canvasElements} drawingMode={drawingMode} setCanvasElements={setCanvasElements} blueprintMode={blueprintMode} />
        </div>
        <div className={activeTab === '3D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas3D elements={canvasElements} timeOfDay={timeOfDay} onPaint={handlePaintWall} walkthroughMode={walkthroughMode} />
        </div>

        {/* 2D Furniture Catalog Overlay */}
        {activeTab === '2D' && showFurnitureCatalog && (
          <div className="absolute top-24 left-6 w-64 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-4 z-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Furniture Catalog</h3>
              <button onClick={() => setShowFurnitureCatalog(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mb-3">Click to drop into center, then drag to arrange.</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('add-furniture', { detail: 'furniture_bed' }))}
                className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold">QB</div>
                <div>
                  <div className="text-xs font-semibold text-white">Queen Bed</div>
                  <div className="text-[10px] text-zinc-500">60" x 80"</div>
                </div>
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('add-furniture', { detail: 'furniture_sofa' }))}
                className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-indigo-900 flex items-center justify-center text-indigo-300 text-xs font-bold">LS</div>
                <div>
                  <div className="text-xs font-semibold text-white">Lounge Sofa</div>
                  <div className="text-[10px] text-zinc-500">80" x 35"</div>
                </div>
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('add-furniture', { detail: 'furniture_table' }))}
                className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-amber-900 flex items-center justify-center text-amber-400 text-xs font-bold">DT</div>
                <div>
                  <div className="text-xs font-semibold text-white">Dining Table</div>
                  <div className="text-[10px] text-zinc-500">70" x 45"</div>
                </div>
              </button>
            </div>
          </div>
        )}

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
                <div 
                  className="w-10 h-10 rounded border-2 border-indigo-500 overflow-hidden shrink-0"
                  style={{ backgroundColor: selectedMaterial.color || '#000' }}
                >
                  {selectedMaterial.url && <img src={selectedMaterial.url} className="w-full h-full object-cover" />}
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
                    style={{ backgroundColor: mat.color || '#333' }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedMaterial?.id === mat.id ? 'border-indigo-500 scale-95' : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    {mat.url && <img src={mat.url} alt={mat.name} className="w-full h-full object-cover" />}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-md p-1.5 border-t border-white/10">
                      <p className="text-[9px] font-semibold text-white truncate text-center">{mat.name}</p>
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

      {/* Cost Takeoff Modal */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Cost Breakdown</h3>
                  <p className="text-xs text-zinc-400">Live Bill of Quantities</p>
                </div>
              </div>
              <button onClick={() => setShowCostModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-zinc-900 rounded-lg p-4 max-h-60 overflow-y-auto custom-scrollbar">
              {costData.breakdown.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No elements added to the design yet.</p>
              ) : (
                <table className="w-full text-sm text-left text-zinc-300">
                  <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-800">
                    <tr>
                      <th className="pb-2 font-medium">Element</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {costData.breakdown.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-medium text-zinc-200">{item.type}</td>
                        <td className="py-3 text-right text-zinc-400">{item.qty}</td>
                        <td className="py-3 text-right text-emerald-400 font-mono">${item.cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-zinc-400 text-sm font-medium">Total Estimated Cost</span>
              <span className="text-2xl font-bold text-white tracking-tight">${costData.total.toLocaleString()}</span>
            </div>
            
            <button 
              onClick={() => setShowCostModal(false)}
              className="w-full mt-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

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

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Menu, MousePointer2, Box, Home, PenTool, LayoutTemplate, 
  Settings, Save, FileText, ChevronRight, Calculator, CheckCircle, 
  AlertTriangle, X, Maximize, MessageSquare, Layers, Sun, Eye, Image as ImageIcon, Sparkles, Download, ScanLine, Magnet, Link2 
} from 'lucide-react';
import Canvas2D from './Canvas2D';
import Canvas3D from './Canvas3D';
import { ARCHITECTURAL_TEXTURES } from '../utils/textureLibrary';
import { API_URL, api, apiHeaders, currencyPref, planArea, formatArea } from '../utils/api';
import { detectRooms } from '../utils/detectRooms';

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [drawingMode, setDrawingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('2D');
  const [showFurnitureCatalog, setShowFurnitureCatalog] = useState(false);
  const [activeFloor, setActiveFloor] = useState(1);
  const [canvasElements, setCanvasElements] = useState([]);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [projectMeta, setProjectMeta] = useState({ name: '', floors: 1 });
  const totalFloors = Math.max(1, projectMeta.floors || 1);
  const [smartSnap, setSmartSnap] = useState(() => localStorage.getItem('pref_smart_snap') === '1');
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };
  const [showAILayout, setShowAILayout] = useState(false);
  const [aiLayoutPrompt, setAiLayoutPrompt] = useState('');
  const [aiLayoutBusy, setAiLayoutBusy] = useState(false);
  const [aiLayoutError, setAiLayoutError] = useState(null);
  const [underlay, setUnderlay] = useState(() => {
    try { return projectId ? localStorage.getItem(`archetech_underlay_${projectId}`) : null; } catch { return null; }
  });
  const [underlayOpacity, setUnderlayOpacity] = useState(0.35);
  const [isSaving, setIsSaving] = useState(false);
  const [complianceResult, setComplianceResult] = useState(null);
  
  const [showCostModal, setShowCostModal] = useState(false);
  const [blueprintMode, setBlueprintMode] = useState(false);
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  const [showCeiling, setShowCeiling] = useState(false);
  const [isCapturingForRender, setIsCapturingForRender] = useState(false);
  const { symbol: currencySymbol, rate: currencyRate } = currencyPref();
  const prefMeasurement = localStorage.getItem("pref_measurement") || "metric";

  // every element belongs to a floor (1 if never set); the canvases only see the active one
  const floorOf = (el) => el.floor || 1;
  const floorElements = (canvasElements || []).filter(el => floorOf(el) === activeFloor);
  const setFloorElements = (next) => {
    setCanvasElements(prev => {
      const mine = typeof next === 'function' ? next(prev.filter(el => floorOf(el) === activeFloor)) : next;
      return [...prev.filter(el => floorOf(el) !== activeFloor), ...mine.map(el => ({ ...el, floor: activeFloor }))];
    });
  };
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hi! I'm your AI Architect. Ask me for design suggestions, code compliance, or how to optimize your current layout!" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const isUndoing = useRef(false);

  useEffect(() => {
    if (isUndoing.current) {
      isUndoing.current = false;
      return;
    }
    if (historyPointer >= 0 && JSON.stringify(history[historyPointer]) === JSON.stringify(canvasElements)) return;
    
    setHistory(h => {
      const newHistory = h.slice(0, historyPointer + 1);
      newHistory.push(canvasElements);
      return newHistory.slice(-30);
    });
    setHistoryPointer(p => Math.min(p + 1, 29));
  }, [canvasElements]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (historyPointer < history.length - 1) {
            isUndoing.current = true;
            const nextPtr = historyPointer + 1;
            setHistoryPointer(nextPtr);
            setCanvasElements(history[nextPtr]);
          }
        } else {
          if (historyPointer > 0) {
            isUndoing.current = true;
            const prevPtr = historyPointer - 1;
            setHistoryPointer(prevPtr);
            setCanvasElements(history[prevPtr]);
          }
        }
      }
      
      if (e.key.toLowerCase() === 'w') setDrawingMode(prev => prev === 'wall' ? null : 'wall');
      else if (e.key.toLowerCase() === 'd') setDrawingMode(prev => prev === 'door' ? null : 'door');
      else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'g') setDrawingMode(prev => prev === 'window' ? null : 'window');
      else if (e.key.toLowerCase() === 's') setDrawingMode(prev => prev === 'stairs' ? null : 'stairs');
      else if (e.key === 'Escape') setDrawingMode(null);
      else if (e.key === ' ') {
        e.preventDefault();
        setActiveTab(prev => prev === '2D' ? '3D' : '2D');
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [history, historyPointer]);
  
  const calculateCosts = () => {
    let total = 0;
    const breakdown = [];
    const multiplier = currencyRate;

    const rates = {
      wall: 120 * multiplier,
      door: 350 * multiplier,
      window: 250 * multiplier,
      furniture_bed: 800 * multiplier,
      furniture_sofa: 1200 * multiplier,
      furniture_table: 600 * multiplier,
      furniture_armchair: 400 * multiplier,
      furniture_bathtub: 1100 * multiplier,
      furniture_vanity: 700 * multiplier,
      furniture_kitchen: 1800 * multiplier,
      stairs: 2500 * multiplier
    };

    let counts = {};
    (canvasElements || []).forEach(el => {
      if (el.isGrid || el.type === 'room') return;
      const type = el.type || 'unknown';
      if (!counts[type]) counts[type] = { count: 0, length: 0, cost: 0 };
      
      let itemCost = 0;
      if (type === 'wall') {
        const lengthMeters = (el.width || 0) * 0.05;
        itemCost = lengthMeters * rates.wall;
        counts[type].length += lengthMeters;
      } else {
        itemCost = rates[type] || 300;
        counts[type].count += 1;
      }
      
      counts[type].cost += itemCost;
      total += itemCost;
    });

    Object.keys(counts).forEach(key => {
      const unit = prefMeasurement === 'imperial' ? 'ft' : 'm';
      const wallQty = prefMeasurement === 'imperial' ? (counts[key].length * 3.28084).toFixed(1) : counts[key].length.toFixed(1);
      breakdown.push({
        type: key.replace('furniture_', '').toUpperCase(),
        qty: key === 'wall' ? `${wallQty}${unit}` : counts[key].count,
        cost: Math.round(counts[key].cost)
      });
    });

    return { total: Math.round(total), breakdown };
  };

  const costData = calculateCosts();

  // true once the project has been read from the server; until then the empty starting canvas
  // must not be autosaved over the real plan
  const loadedRef = useRef(!projectId);
  // set while applying the server copy, so loading it doesn't count as an unsaved edit
  const fromServerRef = useRef(false);
  const dirtyKey = projectId ? `archetech_dirty_${projectId}` : null;

  useEffect(() => {
    let isMounted = true;
    loadedRef.current = !projectId;
    const loadData = async () => {
      const projectKey = projectId ? `archetech_project_${projectId}` : 'archetech_draft_project';
      // a saved project only trusts its own cache; the shared draft belongs to unsaved sketches
      const cached = localStorage.getItem(projectKey) || (projectId ? null : localStorage.getItem('draftElements'));
      let cachedElements = null;
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            cachedElements = parsed;
            if (isMounted && parsed.length > 0) setCanvasElements(parsed);
          }
        } catch (e) {}
      }

      if (!projectId) return;
      try {
        const data = await api(`/api/projects/${projectId}`);
        if (!isMounted) return;
        setProjectMeta({ name: data.name || '', floors: data.floors || 1 });
        // edits that never reached the server (refresh mid-autosave, network drop) are newer
        // than the server copy, so keep them and push them up instead of overwriting them
        const unsynced = localStorage.getItem(dirtyKey) === '1' && cachedElements;
        if (unsynced) {
          setCanvasElements(cachedElements);
          pushElements(cachedElements);
        } else if (Array.isArray(data.elements_data)) {
          fromServerRef.current = true;
          setCanvasElements(data.elements_data);
          localStorage.setItem(projectKey, JSON.stringify(data.elements_data));
        }
        loadedRef.current = true;
      } catch (e) {
        console.error("Cloud fetch failed, using local cache", e);
        if (isMounted) setSyncState('error');
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [projectId]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const TEXTURE_LIBRARY = ARCHITECTURAL_TEXTURES;

  const handlePaintWall = (elementId) => {
    if (!selectedMaterial) return;
    setFloorElements(prev => prev.map((el, idx) => {
      const matchId = el.id || `wall_${idx}`;
      if (matchId === elementId || el.id === elementId) {
        return { 
          ...el, 
          material: selectedMaterial.url || selectedMaterial.color, 
          isColor: !selectedMaterial.url 
        };
      }
      return el;
    }));
  };

  const handlePaintAllWalls = () => {
    if (!selectedMaterial) return;
    setFloorElements(prev => prev.map(el => {
      if (el.type === 'wall') {
        return {
          ...el,
          material: selectedMaterial.url || selectedMaterial.color,
          isColor: !selectedMaterial.url
        };
      }
      return el;
    }));
  };

  const generatePDFReport = async () => {
    if (canvasElements.length === 0) {
      alert("Cannot generate report for an empty project.");
      return;
    }
    
    setIsGeneratingPDF(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/report-narrative`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ elements: canvasElements })
      });
      const aiData = await res.json();
      const narrative = aiData.narrative || "AI Analysis unavailable.";

      const canvasContainer = document.getElementById("studio-canvas-container");
      let imgData = null;
      if (canvasContainer) {
        const canvas = await html2canvas(canvasContainer, { backgroundColor: '#09090b', scale: 2 });
        imgData = canvas.toDataURL('image/png');
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

      if (imgData) {
        pdf.setFontSize(12);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Current Layout View (${activeTab})`, 20, 45);
        pdf.addImage(imgData, 'PNG', 20, 50, 170, 95);
      }

      pdf.setFontSize(14);
      pdf.setTextColor(40, 40, 40);
      pdf.text("AI Structural & Cost Analysis", 20, 160);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      
      const splitText = pdf.splitTextToSize(narrative, 170);
      pdf.text(splitText, 20, 170);

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated by Arch-E-Tech AI • ${new Date().toLocaleDateString()}`, 20, 285);

      pdf.save(`Project-Report-${Date.now()}.pdf`);

      // keep a copy in Dashboard → Reports
      try {
        await api('/api/reports', {
          method: 'POST',
          body: {
            name: `${projectMeta.name || 'Project'} — Architectural Report`,
            project_id: projectId ? Number(projectId) : null,
            project_name: projectMeta.name || null,
            narrative,
            snapshot: imgData,
            costs: { ...costData, currency: currencyPref().code },
            element_count: canvasElements.length,
          },
        });
        showToast('Report downloaded and saved to your Reports.');
      } catch (e) {
        showToast(`PDF downloaded, but saving it to Reports failed: ${e.message}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF. Check network connection.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const [saveSuccess, setSaveSuccess] = useState(false);
  // 'saved' | 'saving' | 'error' — shown next to the save button so failed autosaves are visible
  const [syncState, setSyncState] = useState('saved');
  const elementsRef = useRef(canvasElements);
  const lastChangeRef = useRef(0);
  
  useEffect(() => {
    elementsRef.current = canvasElements;
    const projectKey = projectId ? `archetech_project_${projectId}` : 'archetech_draft_project';
    try {
      localStorage.setItem(projectKey, JSON.stringify(canvasElements));
      localStorage.setItem('draftElements', JSON.stringify(canvasElements));
      localStorage.setItem('renderStudioDraft', JSON.stringify(canvasElements));
      localStorage.setItem('immersiveDraft', JSON.stringify(canvasElements.filter(el => (el.floor || 1) === activeFloor)));
      localStorage.setItem('archetech_last_save_time', Date.now().toString());
      if (fromServerRef.current) {
        fromServerRef.current = false;
      } else if (dirtyKey && loadedRef.current) {
        localStorage.setItem(dirtyKey, '1');
        lastChangeRef.current = Date.now();
      }
    } catch (e) {
      console.warn("Local storage cache write failed:", e);
    }
  }, [canvasElements, projectId, activeFloor]);

  /** PUT the plan; clears the unsynced flag only when the server confirms. Returns success. */
  const pushElements = async (elements, { keepalive = false } = {}) => {
    if (!projectId || !localStorage.getItem('token')) return false;
    const startedAt = Date.now();
    setSyncState('saving');
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ elements_data: elements }),
        keepalive,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      // an edit made while this request was in flight is still unsynced
      if (lastChangeRef.current <= startedAt) localStorage.removeItem(dirtyKey);
      setSyncState('saved');
      return true;
    } catch (e) {
      console.warn(e);
      setSyncState('error');
      return false;
    }
  };

  const flushSave = async (navTarget = null) => {
    const ok = projectId && loadedRef.current ? await pushElements(elementsRef.current) : true;
    if (navTarget) navigate(navTarget);
    return ok;
  };

  // autosave shortly after the last edit
  useEffect(() => {
    if (!projectId || !loadedRef.current || localStorage.getItem(dirtyKey) !== '1') return;
    const timer = setTimeout(() => pushElements(elementsRef.current), 1200);
    return () => clearTimeout(timer);
  }, [canvasElements, projectId]);

  // closing or refreshing the tab: send whatever is still unsynced
  useEffect(() => {
    if (!projectId) return;
    const onHide = () => {
      if (loadedRef.current && localStorage.getItem(dirtyKey) === '1') {
        pushElements(elementsRef.current, { keepalive: true });
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [projectId]);

  const handleOpenRenderStudio = async () => {
    setIsCapturingForRender(true);
    try {
      await flushSave();
      const container = document.getElementById("studio-canvas-container");
      if (container) {
        const snap = await html2canvas(container, { backgroundColor: '#09090b', scale: 1 });
        localStorage.setItem('renderStudioSnapshot', snap.toDataURL('image/png'));
      }
    } catch (e) {
      console.warn("Could not capture studio snapshot", e);
    } finally {
      setIsCapturingForRender(false);
      navigate(`/render-studio?projectId=${projectId || ''}`);
    }
  };
  
  const [shareNote, setShareNote] = useState(null);
  const shareProject = async () => {
    try {
      await flushSave();
      const { share_token } = await api(`/api/projects/${projectId}/share`, { method: 'POST' });
      const url = `${window.location.origin}/shared/${share_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareNote('View-only link copied');
    } catch (e) {
      setShareNote(`Could not share: ${e.message}`);
    }
    setTimeout(() => setShareNote(null), 3000);
  };

  const saveProject = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const flash = () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); };
    try {
      if (projectId) {
        if (await flushSave()) flash();
        return;
      }
      // an unsaved sketch becomes a real project
      const newProject = await api('/api/projects', {
        method: 'POST',
        body: {
          name: projectMeta.name || `Project — ${new Date().toLocaleDateString()}`,
          elements_data: canvasElements,
        },
      });
      flash();
      navigate(`/studio?projectId=${newProject.id}`, { replace: true });
    } catch (e) {
      console.warn("Save failed", e);
      setSyncState('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden font-sans bg-transparent text-zinc-100">
      
      {/* Left Sidebar */}
      <aside className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col z-10 shrink-0">
        
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
            <button 
              type="button"
              onClick={() => flushSave('/dashboard')}
              title="Save changes and return to Dashboard"
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>

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

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
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
                <span className="text-xs text-zinc-500 font-mono">{(canvasElements || []).filter(el => el.type === 'wall').length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 rounded hover:bg-zinc-900 transition-colors">
                <span className="flex items-center gap-2 text-xs text-zinc-300"><div className="w-1.5 h-1.5 bg-yellow-400"></div> Doors</span>
                <span className="text-xs text-zinc-500 font-mono">{(canvasElements || []).filter(el => el.type === 'door').length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 rounded hover:bg-zinc-900 transition-colors">
                <span className="flex items-center gap-2 text-xs text-zinc-300"><div className="w-1.5 h-1.5 bg-blue-400"></div> Windows</span>
                <span className="text-xs text-zinc-500 font-mono">{(canvasElements || []).filter(el => el.type === 'window').length}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/50 w-full"></div>

          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Assistants</h3>
            <div className="space-y-2">
              <button 
                onClick={async () => {
                  setComplianceResult({ status: 'loading', messages: ['Analyzing structural integrity with AI...'] });
                  try {
                    const res = await fetch(`${API_URL}/api/ai/compliance`, {
                      method: 'POST',
                      headers: apiHeaders(),
                      body: JSON.stringify({ elements: canvasElements })
                    });
                    const data = await res.json();
                    setComplianceResult({ status: data.status, messages: data.messages });
                  } catch (err) {
                    console.error(err);
                    setComplianceResult({ status: 'warning', messages: ['Network error. Could not connect to AI.'] });
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
                <span className="text-emerald-400 font-mono">{currencySymbol}{costData.total.toLocaleString()}</span>
              </button>
            </div>
          </div>

        </div>

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
          <button 
            onClick={handleOpenRenderStudio}
            disabled={isCapturingForRender}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-xs font-semibold text-white transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50"
          >
            {isCapturingForRender ? (
              <span className="flex items-center gap-1.5 animate-pulse"><Sparkles className="w-3.5 h-3.5" /> Prepping...</span>
            ) : (
              <><ImageIcon className="w-3.5 h-3.5" /> Photo Render</>
            )}
          </button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main id="studio-canvas-container" className="flex-1 relative bg-zinc-950 flex flex-col">
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

          {drawingMode && (
            <button
              onClick={() => setDrawingMode(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors shadow-sm animate-pulse"
            >
              <X className="w-3.5 h-3.5" /> Stop Drawing
            </button>
          )}
          
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <button 
            onClick={() => setShowFurnitureCatalog(!showFurnitureCatalog)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${showFurnitureCatalog ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-emerald-400/70 hover:bg-zinc-700 hover:text-emerald-400'}`}
          >
            <Home className="w-3.5 h-3.5" /> Furniture
          </button>
          
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          {projectId && (
            <span
              title={syncState === 'error' ? 'Changes are kept in this browser and will be sent when the server answers' : undefined}
              className={`text-[11px] ${syncState === 'error' ? 'text-amber-400' : 'text-zinc-500'}`}
            >
              {syncState === 'saving' ? 'Saving…' : syncState === 'error' ? 'Not synced' : 'All changes saved'}
            </span>
          )}
          
          {projectId && (
            <button
              onClick={shareProject}
              title={shareNote || 'Copy a view-only link to this plan'}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" /> {shareNote || 'Share'}
            </button>
          )}

          <button 
            onClick={saveProject}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : syncState === 'error' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : syncState === 'error' ? 'Retry save' : 'Save Cloud'}
          </button>
          
          <button 
            onClick={() => flushSave('/immersive')}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Immersive View
          </button>
        </div>

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
            <>
              <button
                onClick={() => setWalkthroughMode(!walkthroughMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${walkthroughMode ? 'bg-emerald-600 text-white border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
              >
                <Eye className="w-4 h-4" /> {walkthroughMode ? 'Exit Walkthrough' : 'First-Person Walkthrough'}
              </button>
              <button
                onClick={() => setShowCeiling(!showCeiling)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${showCeiling ? 'bg-indigo-600 text-white border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
              >
                <Layers className="w-4 h-4" /> {showCeiling ? 'Roof & Ceiling: ON' : 'Roof & Ceiling: OFF'}
              </button>
            </>
          )}
        </div>

        <div className={activeTab === '2D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas2D elements={floorElements} drawingMode={drawingMode} setCanvasElements={setFloorElements} blueprintMode={blueprintMode} activeTab={activeTab} smartSnap={smartSnap} underlay={underlay} underlayOpacity={underlayOpacity} />
        </div>
        {/* mounted only while visible: a WebGL canvas created inside a display:none box stays blank after it is shown */}
        {activeTab === '3D' && (
          <div className="absolute inset-0">
            <Canvas3D 
              elements={floorElements} 
              timeOfDay={timeOfDay} 
              onPaint={handlePaintWall} 
              walkthroughMode={walkthroughMode}
              showCeiling={showCeiling}
            />
          </div>
        )}

        {activeTab === '2D' && showFurnitureCatalog && (
          <div className="absolute top-24 left-6 w-72 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-4 z-20 max-h-[450px] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-zinc-950/90 py-1">
              <h3 className="text-sm font-bold text-white">Full House Furniture Suite</h3>
              <button onClick={() => setShowFurnitureCatalog(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mb-3">Click any item to drop into center.</p>
            <div className="flex flex-col gap-2">
              {[
                { type: 'furniture_bed', name: 'King Platform Bed', sub: '80" x 75"', badge: 'BED' },
                { type: 'furniture_sofa', name: 'L-Sectional Lounge', sub: '90" x 40"', badge: 'SOFA' },
                { type: 'furniture_table', name: 'Executive Dining Table', sub: '75" x 45"', badge: 'DINING' },
                { type: 'furniture_armchair', name: 'Designer Armchair', sub: '35" x 35"', badge: 'CHAIR' },
                { type: 'furniture_bathtub', name: 'Freestanding Bathtub', sub: '65" x 32"', badge: 'BATH' },
                { type: 'furniture_vanity', name: 'Double Vanity Sink', sub: '60" x 22"', badge: 'SINK' },
                { type: 'furniture_kitchen', name: 'Kitchen Island w/ Stove', sub: '84" x 36"', badge: 'KITCHEN' },
              ].map((item) => (
                <button 
                  key={item.type}
                  onClick={() => window.dispatchEvent(new CustomEvent('add-furniture', { detail: item.type }))}
                  className="flex items-center gap-3 p-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded bg-indigo-950 text-indigo-400 flex items-center justify-center text-[10px] font-bold border border-indigo-500/30 group-hover:border-indigo-500">
                    {item.badge}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{item.name}</div>
                    <div className="text-[10px] text-zinc-500">{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
              <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded border-2 border-indigo-500 overflow-hidden shrink-0"
                    style={{ backgroundColor: selectedMaterial.color || '#000' }}
                  >
                    {selectedMaterial.url && <img src={selectedMaterial.url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">Active Brush</p>
                    <p className="text-[10px] text-zinc-400 truncate">{selectedMaterial.name}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedMaterial(null)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handlePaintAllWalls}
                  className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-all shadow-[0_0_12px_rgba(99,102,241,0.4)] flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Apply to All Walls
                </button>
              </div>
            )}

            <div className="p-3 h-64 overflow-y-auto overscroll-contain pointer-events-auto custom-scrollbar relative z-50">

              <div className="grid grid-cols-2 gap-2">
                {TEXTURE_LIBRARY.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => setSelectedMaterial(mat)}
                    style={{ backgroundColor: mat.color || '#333' }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedMaterial?.id === mat.id ? 'border-indigo-500 scale-95 ring-2 ring-indigo-500/40' : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    {mat.url && <img src={mat.url} alt={mat.name} className="w-full h-full object-cover pointer-events-none" />}
                    <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-md p-1.5 border-t border-white/10">
                      <p className="text-[9px] font-semibold text-white truncate text-center">{mat.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Copilot */}
        {/* the wrapper is click-through: it is as big as the chat box even when closed, and used to block the panels beneath it */}
        <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end pointer-events-none">
          <div className={`mb-4 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col transition-all origin-bottom-right duration-300 ${
            chatOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none translate-y-4'
          }`} style={{ height: '400px' }}>
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Sparkles className="w-4 h-4" /> AI Architect Copilot
              </div>
              <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
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
                    headers: apiHeaders(),
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

          <button 
            onClick={() => setChatOpen(!chatOpen)}
            className="pointer-events-auto w-14 h-14 bg-indigo-500 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-transform hover:scale-105 active:scale-95"
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
                        <td className="py-3 text-right text-emerald-400 font-mono">{currencySymbol}{item.cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-zinc-400 text-sm font-medium">Total Estimated Cost</span>
              <span className="text-2xl font-bold text-white tracking-tight">{currencySymbol}{costData.total.toLocaleString()}</span>
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
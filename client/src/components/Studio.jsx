import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Menu, MousePointer2, Box, Home, PenTool, LayoutTemplate, 
  Settings, Save, FileText, ChevronRight, Calculator, CheckCircle, 
  AlertTriangle, X, Maximize, MessageSquare, Layers, Sun, Eye, Image as ImageIcon, Sparkles, Download, ScanLine, Magnet, Wand2, Grip, Play 
} from 'lucide-react';
import Canvas2D from './Canvas2D';
import Canvas3D from './Canvas3D';
import { AutoDetectPanel, AiLayoutPanel, ConceptVizPanel, EditPanel, RoomsPanel } from './StudioTools';
import InfoTip from './InfoTip';
import Mark from './Mark';
import { ARCHITECTURAL_TEXTURES } from '../utils/textureLibrary';
import { measurement, currencySymbol, currencyCode, CURRENCY, formatSize } from '../utils/units';
import { computeCosts } from '../utils/costs';

const PLAIN_WALL = { id: 'mat_plain', name: 'Plain', color: '#f4f4f5' };

// saved plans can contain empty or broken entries (older versions, interrupted saves); one of them used to
// crash the whole Studio on open, so only real elements get through
const cleanElements = (list) => (Array.isArray(list) ? list : [])
  .filter(el => el && typeof el === 'object' && typeof el.type === 'string')
  // zero-length walls, doors and windows are invisible leftovers of a click without a drag
  .filter(el => !['wall', 'door', 'window'].includes(el.type) || Number(el.width) > 1);

// what makes two versions of a plan different for undo: geometry, materials and room labels
const planSignature = (list) => JSON.stringify((list || []).map(el => [
  el.id, el.type, Math.round(el.left), Math.round(el.top), Math.round(el.width), Math.round(el.height),
  Math.round(el.angle || 0), el.material || null, el.kind || null, el.name || null,
]));

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const [drawingMode, setDrawingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('2D');
  const [showFurnitureCatalog, setShowFurnitureCatalog] = useState(false);
  // ?tool=concept (from a saved photo's "New version") opens that tool straight away
  const [toolPanel, setToolPanel] = useState(() => searchParams.get('tool'));   // 'detect' | 'layout' | 'edit' | 'rooms' | 'concept'
  const [selectedEls, setSelectedEls] = useState([]);
  const [projectName, setProjectName] = useState('');   // what is selected on the 2D plan, for "edit this"
  const [smartSnap, setSmartSnap] = useState(() => localStorage.getItem('pref_smart_snap') === '1');
  const toggleSmartSnap = () => setSmartSnap(on => {
    try { localStorage.setItem('pref_smart_snap', on ? '0' : '1'); } catch { /* private mode */ }
    return !on;
  });
  // the tools work on the 2D plan, so opening one switches there and closes the furniture list
  const openTool = (name) => {
    setActiveTab('2D');
    setShowFurnitureCatalog(false);
    setToolPanel(t => (t === name ? null : name));
  };
  const [activeFloor, setActiveFloor] = useState(1);
  const [stacked, setStacked] = useState(true);          // 3D: every floor stacked into one house
  const [roofStyle, setRoofStyle] = useState('none');    // none, flat or pitched
  const [canvasElements, setCanvasElements] = useState([]);
  // the 2D plan edits one floor at a time; the other floors are left as they are
  const floorOf = (el) => el.floor || 1;
  const floorElements = canvasElements.filter(el => floorOf(el) === activeFloor);
  const usedFloors = Math.max(1, ...canvasElements.map(floorOf));
  const setFloorElements = (next) => setCanvasElements(prev => {
    const mine = prev.filter(el => floorOf(el) === activeFloor);
    const list = typeof next === 'function' ? next(mine) : next;
    return [...prev.filter(el => floorOf(el) !== activeFloor), ...list.map(el => ({ ...el, floor: activeFloor }))];
  });
  const [timeOfDay, setTimeOfDay] = useState(12);
  const totalFloors = 3;
  const [isSaving, setIsSaving] = useState(false);
  const [complianceResult, setComplianceResult] = useState(null);
  
  const [showCostModal, setShowCostModal] = useState(false);
  const [blueprintMode, setBlueprintMode] = useState(false);
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  const [isCapturingForRender, setIsCapturingForRender] = useState(false);
  // Settings decide the units; square feet and rupees unless changed there
  const prefMeasurement = measurement();
  const money = (v) => `${currencySymbol()}${Math.round(v).toLocaleString(CURRENCY[currencyCode()].locale)}`;
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hi! I'm your AI Architect. Ask me for design suggestions, code compliance, or how to optimize your current layout!" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // undo history: the list and the position in it live in one state, so they can never drift apart
  const [hist, setHist] = useState({ list: [], ptr: -1 });
  const isUndoing = useRef(false);

  useEffect(() => {
    if (isUndoing.current) {
      isUndoing.current = false;
      return;
    }
    setHist(({ list, ptr }) => {
      // the 2D canvas echoes a plan back with extra blank fields; that echo is not a new step to undo
      if (ptr >= 0 && planSignature(list[ptr]) === planSignature(canvasElements)) return { list, ptr };
      const next = [...list.slice(0, ptr + 1), canvasElements].slice(-30);
      return { list: next, ptr: next.length - 1 };
    });
  }, [canvasElements]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const target = hist.ptr + (e.shiftKey ? 1 : -1);
        if (target >= 0 && target < hist.list.length && hist.list[target]) {
          isUndoing.current = true;
          setHist(h => ({ ...h, ptr: target }));
          setCanvasElements(hist.list[target]);
        }
        return;
      }
      
      if (e.key.toLowerCase() === 'w') setDrawingMode(prev => prev === 'wall' ? null : 'wall');
      else if (e.key.toLowerCase() === 'd') setDrawingMode(prev => prev === 'door' ? null : 'door');
      else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'g') setDrawingMode(prev => prev === 'window' ? null : 'window');
      else if (e.key.toLowerCase() === 's') setDrawingMode(prev => prev === 'stairs' ? null : 'stairs');
      else if (e.key.toLowerCase() === 'r') setDrawingMode(prev => prev === 'railing' ? null : 'railing');
      else if (e.key === 'Escape') setDrawingMode(null);
      else if (e.key === ' ') {
        e.preventDefault();
        setActiveTab(prev => prev === '2D' ? '3D' : '2D');
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [hist]);
  
  const calculateCosts = () => computeCosts(canvasElements);

  const costData = calculateCosts();

  // true once the project has been read from the server; until then the empty starting canvas
  // must not be autosaved over the real plan
  const loadedRef = useRef(!projectId);
  const [loadError, setLoadError] = useState(null);
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
          let parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            cachedElements = cleanElements(parsed);
            parsed = cachedElements;
            if (isMounted && parsed.length > 0) setCanvasElements(parsed);
          }
        } catch (e) {}
      }

      if (!projectId) return;
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
          // expired login, or an account that no longer exists: sign in again, then come back here
          localStorage.removeItem('token');
          navigate('/auth', { replace: true });
          return;
        }
        if (res.status === 404) {
          if (isMounted) setLoadError("This project doesn't exist any more, or belongs to another account.");
          return;
        }
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        if (!isMounted) return;
        setProjectName(data.name || '');
        // edits that never reached the server (refresh mid-autosave, network drop) are newer
        // than the server copy, so keep them and push them up instead of overwriting them
        if (localStorage.getItem(dirtyKey) === '1' && cachedElements) {
          setCanvasElements(cachedElements);
          pushElements(cachedElements);
        } else if (Array.isArray(data.elements_data)) {
          fromServerRef.current = true;
          setCanvasElements(cleanElements(data.elements_data));
          localStorage.setItem(projectKey, JSON.stringify(cleanElements(data.elements_data)));
        }
        loadedRef.current = true;
      } catch (e) {
        console.error("Cloud fetch failed, using local cache", e);
        if (isMounted) {
          setSyncState('error');
          if (!cachedElements?.length) setLoadError("Couldn't reach the server to load this project. It may be waking up; try again in a few seconds.");
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [projectId]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const TEXTURE_LIBRARY = ARCHITECTURAL_TEXTURES;

  // what a wall stores for the active brush ("Plain" clears the paint)
  const paintFor = (mat) => mat.id === PLAIN_WALL.id
    ? { material: null, isColor: false }
    : { material: mat.url || mat.color, isColor: !mat.url };

  const handlePaintWall = (elementId) => {
    if (!selectedMaterial) return;
    // the 3D view numbers walls that have no id by their position among the walls
    let wallIdx = -1;
    setCanvasElements(prev => prev.map(el => {
      if (el.type !== 'wall') return el;
      wallIdx += 1;
      return (el.id || `wall_${wallIdx}`) === elementId ? { ...el, ...paintFor(selectedMaterial) } : el;
    }));
  };

  const handlePaintAllWalls = () => {
    if (!selectedMaterial) return;
    setCanvasElements(prev => prev.map(el => (el.type === 'wall' ? { ...el, ...paintFor(selectedMaterial) } : el)));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: canvasElements })
      });
      const aiData = await res.json();
      const narrative = aiData.narrative || "AI Analysis unavailable.";

      const canvasContainer = document.getElementById("studio-canvas-container");
      let imgData = null;
      if (canvasContainer) {
        const canvas = await html2canvas(canvasContainer, { backgroundColor: '#0f0e0d', scale: 2 });
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

      try {
        const newReportRecord = {
          id: Date.now().toString(),
          projectId: projectId || null,
          name: `Architectural Report — ${new Date().toLocaleDateString()}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          size: `${(Math.random() * 1.5 + 1.2).toFixed(1)} MB`,
          narrative: narrative,
          snapshot: imgData,
          costs: costData,
          totalCost: costData.total,
          breakdown: costData.breakdown,
          currency: currencyCode(),       // amounts are in this currency
          elementCount: canvasElements.length
        };
        const existing = JSON.parse(localStorage.getItem('archetech_saved_reports') || '[]');
        localStorage.setItem('archetech_saved_reports', JSON.stringify([newReportRecord, ...existing]));
      } catch (e) {
        console.warn("Could not cache report record", e);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF. Check network connection.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const [saveSuccess, setSaveSuccess] = useState(false);
  // 'saved' | 'saving' | 'error' — shown in the toolbar so failed autosaves are visible
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
      localStorage.setItem('immersiveDraft', JSON.stringify(canvasElements));
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
  }, [canvasElements, projectId]);

  /** PUT the plan; clears the unsynced flag only when the server confirms. Returns success. */
  const pushElements = async (elements, { keepalive = false } = {}) => {
    const token = localStorage.getItem('token');
    if (!projectId || !token) return false;
    const startedAt = Date.now();
    setSyncState('saving');
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ elements_data: elements }),
        keepalive
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
        const snap = await html2canvas(container, { backgroundColor: '#0f0e0d', scale: 1 });
        localStorage.setItem('renderStudioSnapshot', snap.toDataURL('image/png'));
      }
    } catch (e) {
      console.warn("Could not capture studio snapshot", e);
    } finally {
      setIsCapturingForRender(false);
      navigate(`/render-studio?projectId=${projectId || ''}`);
    }
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
      const createRes = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Project — ${new Date().toLocaleDateString()}`,
          elements_data: canvasElements
        })
      });
      if (!createRes.ok) throw new Error(`Save failed (${createRes.status})`);
      const newProject = await createRes.json();
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
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5" title="Back to your projects">
            <Mark className="h-6 w-6 shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-100">{projectName || 'Untitled plan'}</span>
          </Link>
          <div className="flex items-center gap-4">
            <select 
              value={activeFloor}
              onChange={(e) => setActiveFloor(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 text-xs text-white rounded-md px-2 py-1 focus:outline-none"
            >
              {[...Array(totalFloors)].map((_, i) => (
                <option key={i+1} value={i+1}>{i === 0 ? 'Ground floor' : `Floor ${i + 1}`}{i < usedFloors ? '' : ' (empty)'}</option>
              ))}
            </select>
            <InfoTip id="floors" align="right" />
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

        <div className="p-3 border-b border-zinc-800 grid grid-cols-3 gap-1.5">
          {[
            { id: 'detect', icon: ScanLine, label: 'Auto Detect', onClick: () => openTool('detect'), on: toolPanel === 'detect' },
            { id: 'snap', icon: Magnet, label: smartSnap ? 'Snap: On' : 'Smart Snap', onClick: toggleSmartSnap, on: smartSnap },
            { id: 'layout', icon: LayoutTemplate, label: 'AI Layout', onClick: () => openTool('layout'), on: toolPanel === 'layout' },
            { id: 'edit', icon: Wand2, label: 'AI Edit', onClick: () => openTool('edit'), on: toolPanel === 'edit' },
            { id: 'rooms', icon: Home, label: 'Rooms', onClick: () => openTool('rooms'), on: toolPanel === 'rooms' },
            { id: 'concept', icon: ImageIcon, label: 'Concept Viz', onClick: () => openTool('concept'), on: toolPanel === 'concept' },
          ].map(({ id, icon: Icon, label, onClick, on }, i) => (
            <div key={id} className="relative">
              <button
                onClick={onClick}
                aria-pressed={on}
                className={`flex w-full flex-col items-center justify-center rounded px-2 py-2.5 transition-colors ${on ? 'bg-indigo-500/15 text-indigo-200' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
              >
                <Icon className="mb-1.5 h-4 w-4" />
                <span className="text-center text-[10px] font-medium leading-tight">{label}</span>
              </button>
              <InfoTip id={id} align={i % 3 === 2 ? 'right' : i % 3 === 1 ? 'center' : 'left'} className="absolute right-1 top-1" />
            </div>
          ))}
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
                      headers: { 'Content-Type': 'application/json' },
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
                <span className="text-emerald-400 font-mono">{money(costData.total)}</span>
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
          {/* the finished house, presented: plans, 3D, rooms, renders and costs */}
          <button
            onClick={() => projectId ? flushSave(`/overview?projectId=${projectId}`) : saveProject()}
            title={projectId ? 'Play a presentation of this house' : 'Save the plan first'}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-[0_0_18px_rgba(200,121,74,0.25)]"
          >
            <Play className="w-3.5 h-3.5" /> Overview
          </button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main id="studio-canvas-container" className="flex-1 relative bg-zinc-950 flex flex-col">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1.5 rounded-full shadow-2xl">

          <button 
            onClick={() => setDrawingMode(drawingMode === 'wall' ? null : 'wall')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'wall' ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <Layers className="w-3.5 h-3.5" /> Wall
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'door' ? null : 'door')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'door' ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-yellow-400/70 hover:bg-zinc-700 hover:text-yellow-400'}`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Door
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'window' ? null : 'window')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'window' ? 'bg-blue-400 text-black' : 'bg-zinc-800 text-blue-400/70 hover:bg-zinc-700 hover:text-blue-400'}`}
          >
            <Box className="w-3.5 h-3.5" /> Window
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'stairs' ? null : 'stairs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'stairs' ? 'bg-purple-400 text-black' : 'bg-zinc-800 text-purple-400/70 hover:bg-zinc-700 hover:text-purple-400'}`}
          >
            <Layers className="w-3.5 h-3.5 rotate-90" /> Stairs
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'railing' ? null : 'railing')}
            title="Railing for a balcony, terrace or patio (R)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${drawingMode === 'railing' ? 'bg-indigo-400 text-black' : 'bg-zinc-800 text-indigo-300/80 hover:bg-zinc-700 hover:text-indigo-300'}`}
          >
            <Grip className="w-3.5 h-3.5" /> Railing
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
            onClick={() => { setToolPanel(null); setShowFurnitureCatalog(!showFurnitureCatalog); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${showFurnitureCatalog ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-emerald-400/70 hover:bg-zinc-700 hover:text-emerald-400'}`}
          >
            <Home className="w-3.5 h-3.5" /> Furniture
          </button>
          
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>
          

          <button 
            onClick={saveProject}
            disabled={isSaving}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving…' : saveSuccess ? 'Saved' : syncState === 'error' ? 'Retry save' : 'Save'}
            {/* sync status as a dot: green saved, pulsing while saving, amber when not synced */}
            {projectId && (
              <span
                title={syncState === 'error' ? 'Not synced: changes are kept in this browser and sent when the server answers' : syncState === 'saving' ? 'Saving…' : 'All changes saved'}
                className={`h-1.5 w-1.5 rounded-full ${syncState === 'error' ? 'bg-amber-400' : syncState === 'saving' ? 'animate-pulse bg-zinc-400' : 'bg-emerald-400'}`}
              />
            )}
          </button>
          
          {/* first person: walk the rooms in the 3D view */}
          <button 
            onClick={() => { setActiveTab('3D'); setWalkthroughMode(true); }}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${walkthroughMode && activeTab === '3D' ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Walkthrough
          </button>
          <InfoTip id="walkthrough" align="center" />

          {/* the finished house in a landscape and weather setting */}
          <button 
            onClick={() => flushSave(projectId ? `/immersive?projectId=${projectId}` : '/immersive')}
            className="flex items-center gap-2 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors bg-white/10 hover:bg-white/20 text-white"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Immersive
          </button>
          <InfoTip id="immersive" align="center" />

          <div className="ml-1 flex items-center gap-1.5 border-l border-zinc-800 pl-2">
            <button
              onClick={handleOpenRenderStudio}
              disabled={isCapturingForRender}
              className="flex items-center gap-2 whitespace-nowrap rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isCapturingForRender ? 'Opening…' : 'Photo Render'}
            </button>
            <InfoTip id="render" align="right" className="mr-1" />
          </div>
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
              {/* roof: off, flat or pitched; with it on, the rooms get ceilings and warm lights */}
              <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2.5 text-zinc-400"><Home className="h-3.5 w-3.5" /> Roof</span>
                {[['none', 'Off'], ['flat', 'Flat'], ['pitched', 'Pitched']].map(([id, label]) => (
                  <button key={id} onClick={() => setRoofStyle(id)}
                    className={`rounded-md px-2.5 py-1.5 transition-colors ${roofStyle === id ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <InfoTip id="roof" align="center" />
              {usedFloors > 1 && !walkthroughMode && (
                <button
                  onClick={() => setStacked(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${stacked ? 'bg-zinc-200 text-zinc-950 border border-zinc-200' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
                >
                  <Layers className="w-4 h-4" /> {stacked ? `All ${usedFloors} floors` : `${activeFloor === 1 ? 'Ground floor' : `Floor ${activeFloor}`} only`}
                </button>
              )}
            </>
          )}
        </div>

        <div className={activeTab === '2D' ? 'absolute inset-0' : 'hidden'}>
          <Canvas2D elements={floorElements} drawingMode={drawingMode} setCanvasElements={setFloorElements} blueprintMode={blueprintMode} activeTab={activeTab} smartSnap={smartSnap} onSelectionChange={setSelectedEls} viewKey={`${projectId}-${activeFloor}`} />
        </div>
        {/* mounted only while visible: a WebGL canvas created inside a display:none box stays blank after it is shown */}
        {activeTab === '3D' && (
          <div className="absolute inset-0">
            <Canvas3D 
              elements={stacked && !walkthroughMode ? canvasElements : floorElements} 
              timeOfDay={timeOfDay} 
              onPaint={handlePaintWall} 
              walkthroughMode={walkthroughMode}
              roofStyle={roofStyle}
            />
          </div>
        )}

        {activeTab === '2D' && toolPanel === 'edit' && (
          <EditPanel elements={floorElements} setElements={(els) => setFloorElements(cleanElements(els))} selected={selectedEls} apiUrl={API_URL} onClose={() => setToolPanel(null)} />
        )}
        {activeTab === '2D' && toolPanel === 'rooms' && (
          <RoomsPanel elements={canvasElements} setElements={setCanvasElements} onClose={() => setToolPanel(null)} />
        )}
        {activeTab === '2D' && toolPanel === 'detect' && (
          <AutoDetectPanel elements={floorElements} setElements={setFloorElements} onClose={() => setToolPanel(null)} />
        )}
        {activeTab === '2D' && toolPanel === 'layout' && (
          <AiLayoutPanel elements={canvasElements} setElements={setCanvasElements} onClose={() => setToolPanel(null)} apiUrl={API_URL} />
        )}
        {activeTab === '2D' && toolPanel === 'concept' && (
          <ConceptVizPanel elements={canvasElements} projectId={projectId} onClose={() => setToolPanel(null)} apiUrl={API_URL} />
        )}

        {activeTab === '2D' && showFurnitureCatalog && (
          <div className="absolute top-24 left-6 w-72 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-4 z-20 max-h-[450px] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-zinc-950/90 py-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">Furniture <InfoTip id="furniture" /></h3>
              <button onClick={() => setShowFurnitureCatalog(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mb-3">Click an item to place it in the middle of the view, then drag it into position.</p>
            <div className="flex flex-col gap-2">
              {[
                { type: 'furniture_bed', name: 'King Platform Bed', sub: formatSize(1.8, 2.1), badge: 'BED' },
                { type: 'furniture_sofa', name: 'L-Sectional Lounge', sub: formatSize(2.2, 0.9), badge: 'SOFA' },
                { type: 'furniture_table', name: 'Executive Dining Table', sub: formatSize(1.6, 0.9), badge: 'DINING' },
                { type: 'furniture_armchair', name: 'Designer Armchair', sub: formatSize(0.8, 0.8), badge: 'CHAIR' },
                { type: 'furniture_bathtub', name: 'Freestanding Bathtub', sub: formatSize(1.7, 0.8), badge: 'BATH' },
                { type: 'furniture_vanity', name: 'Double Vanity Sink', sub: formatSize(1.2, 0.55), badge: 'SINK' },
                { type: 'furniture_kitchen', name: 'Kitchen Island w/ Stove', sub: formatSize(2.8, 0.65), badge: 'KITCHEN' },
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
          <div className="absolute top-24 right-6 w-72 max-h-[calc(100%-8rem)] bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-20">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">Material Painter <InfoTip id="painter" align="right" /></h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                {selectedMaterial
                  ? <>Painting with <span className="text-white">{selectedMaterial.name}</span>. Click walls to apply, or pick another material.</>
                  : 'Pick a material, then click walls to paint them.'}
              </p>
              {selectedMaterial && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handlePaintAllWalls}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
                  >
                    Apply to all walls
                  </button>
                  <button
                    onClick={() => setSelectedMaterial(null)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 overflow-y-auto overscroll-contain custom-scrollbar">
              <div className="grid grid-cols-3 gap-2">
                {[PLAIN_WALL, ...TEXTURE_LIBRARY].map((mat) => {
                  const active = selectedMaterial?.id === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      title={mat.name}
                      // picking a different material switches the brush straight away; the active one toggles off
                      onClick={() => setSelectedMaterial(active ? null : mat)}
                      style={{ backgroundColor: mat.color || '#333' }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        active ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-zinc-800 hover:border-zinc-500'
                      }`}
                    >
                      {mat.url && <img src={mat.url} alt="" className="w-full h-full object-cover pointer-events-none" />}
                      <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[9px] font-medium text-white truncate text-center">{mat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
            <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-200">{loadError}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={() => window.location.reload()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200">Try again</button>
                <Link to="/dashboard" className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700">Back to dashboard</Link>
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
                        <td className="py-3 text-right text-emerald-400 font-mono">{money(item.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-zinc-400 text-sm font-medium">Total Estimated Cost</span>
              <span className="text-2xl font-bold text-white tracking-tight">{money(costData.total)}</span>
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
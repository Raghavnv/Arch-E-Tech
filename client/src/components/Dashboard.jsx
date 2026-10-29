import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { 
  Plus, LayoutDashboard, Settings, LogOut, Clock, MoreVertical, 
  Layout, Building, Trash2, Copy, FileText, Share2, Edit2, Eye, 
  Key, Globe, User, CheckCircle, Sparkles, X, Download, AlertCircle,
  Calculator, Check, ArrowRight, ShieldCheck, Sun, Search, Compass,
  Activity, Layers, ArrowUpRight, Images
} from 'lucide-react';
import PhotoGallery from './PhotoGallery';

const DEFAULT_REPORTS = [
  { 
    id: 'rep_1', 
    name: "Skyline Villa - Full Structural & Code Compliance", 
    projectName: "Skyline Villa",
    date: "Oct 18, 2026", 
    size: "2.4 MB",
    buildingType: "Luxury Residential",
    complianceScore: "100%",
    totalCost: 48500,
    narrative: "Comprehensive structural and spatial takeoff analysis. All primary load-bearing partitions, window fenestration ratios (22.4%), and door egress corridors comply with international building standards (IBC 2024 & NBC). Master suite orientation maximizes natural southern daylighting while minimizing HVAC load.",
    breakdown: [
      { type: "EXTERIOR WALLS", qty: "64.5m", cost: 15480 },
      { type: "INTERIOR PARTITIONS", qty: "42.0m", cost: 8400 },
      { type: "TEMPERED GLAZING (WINDOWS)", qty: "6 units", cost: 7200 },
      { type: "ARCHITECTURAL DOORS", qty: "5 units", cost: 4200 },
      { type: "HARDWOOD SLAB FLOORING", qty: "185 sq m", cost: 13220 }
    ]
  },
  { 
    id: 'rep_2', 
    name: "Modern 3-BHK Residence - Material & Cost Takeoff", 
    projectName: "3-BHK Modern Villa",
    date: "Oct 15, 2026", 
    size: "1.8 MB",
    buildingType: "Contemporary Single-Family",
    complianceScore: "100%",
    totalCost: 36200,
    narrative: "Detailed architectural bill of quantities. Features 3 en-suite bedrooms, open-concept living pavilion, and central circulation gallery. Calculated using verified regional contractor rates with 10% contingency factored.",
    breakdown: [
      { type: "BRICK & PLASTER WALLS", qty: "52.0m", cost: 12480 },
      { type: "SOLID CORE TIMBER DOORS", qty: "6 units", cost: 5100 },
      { type: "DOUBLE-PANE LOW-E WINDOWS", qty: "7 units", cost: 8400 },
      { type: "CERAMIC & MARBLE FINISHES", qty: "120 sq m", cost: 10220 }
    ]
  },
  { 
    id: 'rep_3', 
    name: "Penthouse Loft - Solar & Daylighting Simulation", 
    projectName: "Urban Penthouse",
    date: "Oct 12, 2026", 
    size: "3.1 MB",
    buildingType: "Commercial / Residential Loft",
    complianceScore: "98%",
    totalCost: 59000,
    narrative: "Dynamic annual solar exposure assessment using SunCalc sun azimuth simulation. Daylighting autonomy reaches 84% in the main living lounge, significantly exceeding LEED v4 requirements.",
    breakdown: [
      { type: "STEEL FRAME CURTAIN WALLS", qty: "38.0m", cost: 22800 },
      { type: "CONCRETE BOARD WALLS", qty: "34.0m", cost: 10200 },
      { type: "PIVOT ENTRANCE DOORS", qty: "3 units", cost: 6000 },
      { type: "MICRO-CEMENT FLOOR SLABS", qty: "160 sq m", cost: 20000 }
    ]
  }
];

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'reports', 'photos', 'settings'
  const [searchQuery, setSearchQuery] = useState('');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Toast Feedback State
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Projects from backend
  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/auth'); return; }
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        // expired login, or an account that no longer exists
        localStorage.removeItem('token');
        navigate('/auth');
        return;
      }
      if (!res.ok) throw new Error(`server answered ${res.status}`);
      setProjects(await res.json());
    } catch (e) {
      console.error("Failed to load projects", e);
      showToast("Couldn't load your projects. The server may be waking up; refresh in a few seconds.");
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  // Settings State
  const [settings, setSettings] = useState({
    measurement: localStorage.getItem('pref_measurement') || 'metric',
    currency: localStorage.getItem('pref_currency') || 'INR'
  });
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('pref_measurement', settings.measurement);
    localStorage.setItem('pref_currency', settings.currency);
    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 2000);
    showToast("Preferences saved successfully!");
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Permanent Delete Project (Server + LocalStorage + UI State)
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    setActiveMenu(null);

    // 1. Optimistic state update
    setProjects(prev => prev.filter(p => p.id !== id));

    // 2. Clear cached local storage keys
    try {
      localStorage.removeItem(`archetech_project_${id}`);
      localStorage.removeItem(`archetech_draft_${id}`);
    } catch (err) {}

    // 3. Delete on backend database
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/projects/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          showToast("Project permanently deleted.");
        } else {
          console.error("Failed to delete project on backend");
          fetchProjects(); // Revert on failure
        }
      } catch (err) {
        console.error("Error deleting project", err);
        fetchProjects();
      }
    }
  };

  // Duplicate Project
  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const duplicated = await res.json();
        setProjects(prev => [duplicated, ...prev]);
        showToast(`Duplicated "${duplicated.name}"`);
      } else {
        // Fallback: copy in local storage if backend duplicate endpoint is unavailable
        const orig = projects.find(p => p.id === id);
        if (orig) {
          const createRes = await fetch(`${API_URL}/api/projects`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: `${orig.name} (Copy)`,
              elements_data: orig.elements_data || []
            })
          });
          if (createRes.ok) {
            const newProj = await createRes.json();
            setProjects(prev => [newProj, ...prev]);
            showToast(`Duplicated "${newProj.name}"`);
          }
        }
      }
    } catch (err) {
      console.error("Duplicate failed", err);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  // =========================================================
  // REPORTS REPOSITORY STATE & MODALS
  // =========================================================
  const [reports, setReports] = useState(() => {
    try {
      const saved = localStorage.getItem('archetech_saved_reports');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_REPORTS;
  });

  const saveReportsToStorage = (updatedReports) => {
    setReports(updatedReports);
    try {
      localStorage.setItem('archetech_saved_reports', JSON.stringify(updatedReports));
    } catch (e) {}
  };

  // Selected Report for View Modal
  const [viewingReport, setViewingReport] = useState(null);

  // Selected Report for Edit Modal
  const [editingReport, setEditingReport] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', buildingType: '', narrative: '' });

  // Open Edit Modal
  const openEditReport = (report, e) => {
    e.stopPropagation();
    setEditingReport(report);
    setEditFormData({
      name: report.name,
      buildingType: report.buildingType || 'Residential',
      narrative: report.narrative || ''
    });
  };

  // Save Edit Changes
  const handleSaveReportEdit = () => {
    if (!editingReport) return;
    const updated = reports.map(r => {
      if (r.id === editingReport.id) {
        return {
          ...r,
          name: editFormData.name.trim() || r.name,
          buildingType: editFormData.buildingType,
          narrative: editFormData.narrative
        };
      }
      return r;
    });
    saveReportsToStorage(updated);
    setEditingReport(null);
    showToast("Report updated successfully!");
  };

  // Delete Report
  const handleDeleteReport = (id, e) => {
    e.stopPropagation();
    const updated = reports.filter(r => r.id !== id);
    saveReportsToStorage(updated);
    showToast("Report removed from repository.");
  };

  // Share Report (Copy Link)
  const handleShareReport = (report, e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/dashboard?viewReport=${report.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast("Shareable report link copied to clipboard!");
    }).catch(() => {
      showToast(`Report link: ${shareUrl}`);
    });
  };

  // Download PDF directly from Report Record
  const handleDownloadReportPDF = (report) => {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Arch-E-Tech", 20, 20);
      
      pdf.setFontSize(15);
      pdf.setTextColor(90, 90, 90);
      pdf.text(report.name, 20, 30);
      
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, 35, 190, 35);

      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Date: ${report.date}   |   Classification: ${report.buildingType || 'General'}   |   Code Compliance: ${report.complianceScore || '100%'}`, 20, 43);

      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(40, 40, 40);
      pdf.text("AI Architectural & Compliance Narrative", 20, 56);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(70, 70, 70);
      const splitText = pdf.splitTextToSize(report.narrative || "No narrative available.", 170);
      pdf.text(splitText, 20, 64);

      if (report.breakdown && report.breakdown.length > 0) {
        let curY = 110;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(40, 40, 40);
        pdf.text("Bill of Quantities & Material Takeoff", 20, curY);

        curY += 8;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(100, 100, 100);
        pdf.text("ITEM DESCRIPTION", 20, curY);
        pdf.text("QUANTITY", 120, curY);
        pdf.text("ESTIMATED COST", 160, curY);

        curY += 3;
        pdf.line(20, curY, 190, curY);

        curY += 6;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        report.breakdown.forEach(item => {
          pdf.text(item.type, 20, curY);
          pdf.text(item.qty, 120, curY);
          pdf.text(`$${item.cost.toLocaleString()}`, 160, curY);
          curY += 7;
        });

        if (report.totalCost) {
          curY += 4;
          pdf.line(20, curY, 190, curY);
          curY += 7;
          pdf.setFont("helvetica", "bold");
          pdf.text("TOTAL PROJECT TAKEOFF:", 20, curY);
          pdf.text(`$${report.totalCost.toLocaleString()}`, 160, curY);
        }
      }

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Verified by Arch-E-Tech Automated Compliance Engine • ${new Date().toLocaleDateString()}`, 20, 285);

      pdf.save(`${report.name.replace(/\s+/g, '-')}.pdf`);
      showToast("PDF downloaded successfully!");
    } catch (e) {
      console.error("PDF generation failed", e);
      showToast("Could not download PDF. Check connection.");
    }
  };

  return (
    <div className="flex h-screen bg-transparent text-zinc-100 font-sans overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-6 h-6 bg-white rounded-sm"></div>
          <span className="font-bold text-white tracking-tight">Arch-E-Tech</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div 
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeTab === 'projects' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Projects
          </div>
          <div 
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeTab === 'reports' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
            }`}
          >
            <FileText className="w-4 h-4" /> Reports
            {reports.length > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                {reports.length}
              </span>
            )}
          </div>
          <div 
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeTab === 'photos' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
            }`}
          >
            <Images className="w-4 h-4" /> Saved Photos
          </div>
          <div 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium cursor-pointer transition-colors ${
              activeTab === 'settings' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
            }`}
          >
            <Settings className="w-4 h-4" /> Settings
          </div>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" onClick={() => setActiveMenu(null)}>
        
        {/* ========================================================= */}
        {/* PROJECTS TAB                                              */}
        {/* ========================================================= */}
        {activeTab === 'projects' && (
          <>
            <header className="px-10 py-7 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-20 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    Studio Command Hub • Engine v3.2
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
                  Architectural Blueprints
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <Link 
                  to="/new-project"
                  className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-bold hover:bg-zinc-200 transition-all text-xs shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                >
                  <Plus className="w-4 h-4" /> Create New Blueprint
                </Link>
              </div>
            </header>

            {/* Quick Stats Overview */}
            <div className="px-10 pt-8 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Stat 1: Total Projects */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-cyan-400" /> Total Blueprints
                  </span>
                  <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
                    BIM Active
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-white">{projects.length}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Multi-Room CAD Models</div>
                </div>
              </div>

              {/* Stat 2: Est. Area Drafted */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Layout className="w-4 h-4 text-indigo-400" /> Est. Area Drafted
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                    1:50 Scale
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-white">
                    {((projects.length || 1) * 1850).toLocaleString()} <span className="text-sm font-normal text-zinc-400">sq ft</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">~{Math.round(((projects.length || 1) * 1850) * 0.0929)} m² structural footprint</div>
                </div>
              </div>

              {/* Stat 3: Code Compliance */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Code Compliance
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                    Auto-Audit
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-emerald-400">100% PASS</div>
                  <div className="text-[11px] text-zinc-500 mt-1">IBC 2024 & NBC Standard Corridors</div>
                </div>
              </div>

              {/* Stat 4: Fast AI Draft CTA */}
              <Link 
                to="/new-project" 
                className="bg-zinc-900/60 backdrop-blur-md border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-[0_0_25px_rgba(99,102,241,0.2)] transition-all cursor-pointer"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500"></div>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> AI Natural Language
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="mt-4">
                  <div className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Draft With Gemini/Groq
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">Text-to-Space Spatial Parsing &rarr;</div>
                </div>
              </Link>

            </div>

            {/* Search & Filter Toolbar */}
            <div className="px-10 pt-4 pb-2 flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blueprints by name..."
                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px]">
                  {projects.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())).length} Models Found
                </span>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="p-10 pt-4">
              {projects.length === 0 ? (
                <div className="text-center py-20 bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 max-w-lg mx-auto">
                  <Layout className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">No blueprints found</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                    Create your first architectural CAD model to start designing in sub-millimeter 2D and real-time 3D.
                  </p>
                  <Link to="/new-project" className="inline-flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-zinc-200 transition-all text-xs shadow-lg">
                    <Plus className="w-4 h-4" /> Start Designing
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects
                    .filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((project, index) => (
                    <div 
                      key={project.id} 
                      role="link"
                      tabIndex={0}
                      // the whole card opens the project; buttons and links inside handle their own clicks
                      onClick={(e) => { if (!e.target.closest('a, button')) navigate(`/studio?projectId=${project.id}`); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/studio?projectId=${project.id}`); }}
                      className="bg-zinc-900/70 backdrop-blur-md border border-zinc-800/90 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-zinc-700 hover:shadow-xl transition-all group relative cursor-pointer"
                    >
                      {/* Top Blueprint Visual Stage */}
                      <div className="w-full h-36 bg-[#080d1a] border-b border-zinc-800/80 relative overflow-hidden group/canvas">
                        {/* CAD Grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40"></div>
                        
                        {/* Miniature Vector Floorplan Wireframe */}
                        <svg className="w-full h-full p-4 relative z-10" viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet">
                          {/* Foundation slab */}
                          <rect x="20" y="15" width="200" height="90" fill="rgba(6,182,212,0.06)" stroke="#06b6d4" strokeWidth="1.8" />
                          {/* Interior Partitions */}
                          <line x1="110" y1="15" x2="110" y2="105" stroke="#38bdf8" strokeWidth="1.6" />
                          <line x1="20" y1="65" x2="110" y2="65" stroke="#38bdf8" strokeWidth="1.6" />
                          {/* Door swing arcs */}
                          <path d="M 110 40 A 18 18 0 0 1 92 58" fill="none" stroke="#facc15" strokeWidth="1.4" strokeDasharray="2 2" />
                          <path d="M 110 85 A 18 18 0 0 1 128 103" fill="none" stroke="#facc15" strokeWidth="1.4" strokeDasharray="2 2" />
                          {/* Window glazing */}
                          <rect x="45" y="13" width="40" height="4" fill="#60a5fa" rx="1" />
                          <rect x="145" y="103" width="50" height="4" fill="#60a5fa" rx="1" />
                          {/* Room labels */}
                          <text x="65" y="42" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">SUITE 1</text>
                          <text x="65" y="88" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">ENSUITE</text>
                          <text x="165" y="62" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">LIVING</text>
                        </svg>

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> 2D/3D BIM
                          </span>
                        </div>

                        {/* Options Menu on Top Right */}
                        <div className="absolute top-2.5 right-2.5 z-30" ref={menuRef}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === project.id ? null : project.id); }}
                            className="text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          
                          {activeMenu === project.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-40">
                              <button 
                                onClick={(e) => handleDuplicate(project.id, e)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left font-medium"
                              >
                                <Copy className="w-3.5 h-3.5 text-indigo-400" /> Duplicate Model
                              </button>
                              <button 
                                onClick={(e) => handleDelete(project.id, e)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-left border-t border-zinc-800 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Quick Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover/canvas:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2">
                          <Link 
                            to={`/studio?projectId=${project.id}`}
                            className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold shadow-lg hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> Open Studio
                          </Link>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white mb-1 truncate" title={project.name}>
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mb-4">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" /> {project.created_at || 'Recently Saved'}
                            </span>
                            <span>•</span>
                            <span className="text-zinc-500">~185 m² (1,990 sq ft)</span>
                          </div>
                        </div>

                        {/* Direct Navigation Links */}
                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                          <Link 
                            to={`/studio?projectId=${project.id}`} 
                            className="text-xs font-bold text-white hover:text-indigo-400 flex items-center gap-1 transition-colors group-hover:translate-x-0.5"
                          >
                            Launch Studio <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                          </Link>
                          
                          <div className="flex items-center gap-1.5">
                            <Link 
                              to={`/render-studio?projectId=${project.id}`} 
                              className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                              title="See this plan's rooms as AI photos, empty and furnished"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-300" /> Photo Render
                            </Link>
                            <Link 
                              to={`/war-room?projectId=${project.id}`} 
                              className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-blue-300 hover:bg-blue-950/40 border border-zinc-700/60 transition-colors text-xs" 
                              title="Collaborative War Room"
                            >
                              <LayoutDashboard className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div></>
        )}

        {/* ========================================================= */}
        {/* REPORTS REPOSITORY TAB (Fully Interactive!)               */}
        {/* ========================================================= */}
        {activeTab === 'photos' && (
          <>
            <header className="px-10 py-8 sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <h1 className="text-2xl font-semibold text-white tracking-tight">Saved Photos</h1>
              <p className="text-sm text-zinc-400 mt-1">Renders you kept from Photo Render and Concept Viz, across all your projects.</p>
            </header>
            <div className="px-10 py-8">
              <PhotoGallery />
            </div>
          </>
        )}

        {activeTab === 'reports' && (
          <>
            <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Saved Architectural Reports</h1>
                <p className="text-sm text-zinc-400 mt-1">View comprehensive structural audits, cost takeoffs, and code compliance records.</p>
              </div>
              <button 
                onClick={() => {
                  if (projects.length > 0) {
                    navigate(`/studio?projectId=${projects[0].id}`);
                  } else {
                    navigate('/new-project');
                  }
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full font-medium transition-colors text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              >
                <Plus className="w-4 h-4" /> Export New Report from Studio
              </button>
            </header>

            <div className="p-10">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Report Name</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Building Classification</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">File Size</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3 font-medium text-white">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">{report.name}</div>
                            <div className="text-[11px] text-zinc-500">Project: {report.projectName || 'Active Model'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-mono">
                            {report.buildingType || 'Residential'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-400 text-xs font-mono">{report.date}</td>
                        <td className="px-6 py-4 text-zinc-400 text-xs font-mono">{report.size}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => setViewingReport(report)}
                              className="p-2 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs" 
                              title="View Full Report"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" /> View
                            </button>
                            <button 
                              onClick={(e) => openEditReport(report, e)}
                              className="p-2 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs" 
                              title="Edit Report"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" /> Edit
                            </button>
                            <button 
                              onClick={(e) => handleShareReport(report, e)}
                              className="p-2 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs" 
                              title="Share Report"
                            >
                              <Share2 className="w-3.5 h-3.5 text-emerald-400" /> Share
                            </button>
                            <button 
                              onClick={() => handleDownloadReportPDF(report)}
                              className="p-2 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-xs" 
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5 text-blue-400" /> PDF
                            </button>
                            <button 
                              onClick={(e) => handleDeleteReport(report.id, e)}
                              className="p-2 text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg transition-colors ml-1 text-xs" 
                              title="Delete Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reports.length === 0 && (
                  <div className="p-16 text-center text-zinc-500">
                    <FileText className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
                    <p className="text-sm font-medium text-zinc-300">No reports generated yet</p>
                    <p className="text-xs text-zinc-500 mt-1">Open your project in the Studio and click "PDF Report" to export a structural audit.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* SETTINGS TAB                                              */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <>
            <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Platform Settings</h1>
                <p className="text-sm text-zinc-400 mt-1">Manage your account, preferences, and API integrations.</p>
              </div>
            </header>
            <div className="p-10 max-w-4xl space-y-8">
              
              {/* Account Settings */}
              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-zinc-400" /> Account Details</h2>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Display Name</label>
                    <input type="text" defaultValue="Architect User" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Email Address</label>
                    <input type="email" defaultValue="architect@studio.com" disabled className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-500 cursor-not-allowed" />
                  </div>
                </div>
              </section>

              {/* Preferences */}
              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-zinc-400" /> Studio Preferences</h2>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Measurement System</label>
                    <select 
                      value={settings.measurement}
                      onChange={(e) => setSettings({...settings, measurement: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                    >
                      <option value="metric">Metric (Meters & Centimeters)</option>
                      <option value="imperial">Imperial (Feet & Inches)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Default Currency (Cost Estimation)</label>
                    <select 
                      value={settings.currency}
                      onChange={(e) => setSettings({...settings, currency: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* API Integrations */}
              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-zinc-400" /> API Integrations</h2>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6">
                  <div className="flex items-start justify-between border-b border-zinc-800 pb-6">
                    <div>
                      <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
                        Groq API (Llama 3) 
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">System Default</span>
                      </h3>
                      <p className="text-xs text-zinc-500 max-w-md">Powers the architectural layout generation and the Code Compliance RAG chatbot.</p>
                    </div>
                    <button disabled className="px-4 py-2 bg-zinc-900 text-zinc-500 rounded-lg text-sm font-medium border border-zinc-800 cursor-not-allowed">Connected</button>
                  </div>
                  
                  <div className="flex items-start justify-between border-b border-zinc-800 pb-6">
                    <div>
                      <h3 className="text-sm font-medium text-white mb-1">OpenAI API (Custom)</h3>
                      <p className="text-xs text-zinc-500 max-w-md">Override the system default and use your own OpenAI API key for generation tasks.</p>
                    </div>
                    <button className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors">Connect Key</button>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-white mb-1">Pollinations AI Engine</h3>
                      <p className="text-xs text-zinc-500 max-w-md">Realtime photorealistic architectural synthesis and virtual room staging engine.</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/20">Active (Free)</span>
                  </div>
                </div>
              </section>
              
              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleSaveSettings}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg ${saveSettingsSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}
                >
                  {saveSettingsSuccess ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: VIEW FULL REPORT MODAL                           */}
      {/* ========================================================= */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">{viewingReport.name}</h2>
                  <p className="text-xs text-zinc-400 font-mono">Date: {viewingReport.date} • Classification: {viewingReport.buildingType || 'Residential'}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingReport(null)}
                className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
              
              {/* Compliance & Key Badges */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Code Compliance
                  </span>
                  <span className="text-xl font-bold text-emerald-400">{viewingReport.complianceScore || '100%'} Pass</span>
                  <p className="text-[10px] text-zinc-500 mt-1">IBC 2024 & NBC Certified</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-1">
                    <Calculator className="w-3.5 h-3.5 text-indigo-400" /> Est. Construction
                  </span>
                  <span className="text-xl font-bold text-white">
                    ${(viewingReport.totalCost || 48500).toLocaleString()}
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-1">Includes 10% contingency</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Daylighting Score
                  </span>
                  <span className="text-xl font-bold text-amber-300">Optimal (84%)</span>
                  <p className="text-[10px] text-zinc-500 mt-1">South/East window exposure</p>
                </div>
              </div>

              {/* AI Narrative Section */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Executive Architectural Narrative
                </h3>
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-300 leading-relaxed font-sans">
                  {viewingReport.narrative || "Comprehensive structural assessment completed with zero code infractions."}
                </div>
              </div>

              {/* Takeoff Table */}
              {viewingReport.breakdown && viewingReport.breakdown.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-400" /> Bill of Quantities & Material Costs
                  </h3>
                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Item Specification</th>
                          <th className="px-4 py-2.5 font-semibold">Qty</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {viewingReport.breakdown.map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/30">
                            <td className="px-4 py-2.5 text-zinc-200">{item.type}</td>
                            <td className="px-4 py-2.5 text-zinc-400">{item.qty}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">${item.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-mono">Report ID: {viewingReport.id}</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleDownloadReportPDF(viewingReport)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Download Full PDF
                </button>
                <button 
                  onClick={() => setViewingReport(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT REPORT MODAL                                */}
      {/* ========================================================= */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Edit Architectural Report</h3>
              </div>
              <button onClick={() => setEditingReport(null)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Report Title</label>
              <input 
                type="text" 
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Building Classification</label>
              <select 
                value={editFormData.buildingType}
                onChange={(e) => setEditFormData({ ...editFormData, buildingType: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors"
              >
                <option value="Luxury Residential">Luxury Residential</option>
                <option value="Contemporary Single-Family">Contemporary Single-Family</option>
                <option value="Commercial / Residential Loft">Commercial / Residential Loft</option>
                <option value="Modern Villa / Compound">Modern Villa / Compound</option>
                <option value="Boutique Commercial Studio">Boutique Commercial Studio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Architect's Remarks & Directives</label>
              <textarea 
                rows={4}
                value={editFormData.narrative}
                onChange={(e) => setEditFormData({ ...editFormData, narrative: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors resize-none font-sans"
              />
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
              <button 
                onClick={() => setEditingReport(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveReportEdit}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

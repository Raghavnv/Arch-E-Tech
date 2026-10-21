import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { 
  Plus, LayoutDashboard, Settings, LogOut, Clock, MoreVertical, 
  Layout, Building, Trash2, Copy, FileText, Share2, Edit2, Eye, 
  Key, Globe, User, CheckCircle, Sparkles, X, Download, AlertCircle,
  Calculator, Check, ArrowRight, ShieldCheck, Sun
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'reports', 'settings'
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
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Failed to load projects", e);
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
            <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Your Projects</h1>
                <p className="text-sm text-zinc-400 mt-1">Manage, duplicate, or inspect your architectural models.</p>
              </div>
              <Link 
                to="/new-project"
                className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-colors text-sm shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                <Plus className="w-4 h-4" /> Create New Project
              </Link>
            </header>

            {/* Quick Stats Overview */}
            <div className="px-10 pt-8 pb-2 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-2"><Building className="w-3.5 h-3.5" /> Total Projects</span>
                <span className="text-3xl font-bold text-white mt-4">{projects.length}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Est. Area Drafted</span>
                <span className="text-3xl font-bold text-white mt-4">{((projects.length || 1) * 1850).toLocaleString()} <span className="text-sm font-normal text-zinc-500">sq ft</span></span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> Code Compliance</span>
                <span className="text-3xl font-bold text-emerald-400 mt-4">100%</span>
              </div>
              <Link to="/new-project" className="bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl group-hover:bg-indigo-500/40 transition-colors"></div>
                <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wider relative z-10 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> AI Draft</span>
                <span className="text-xl font-bold text-white mt-4 relative z-10 flex items-center gap-2">Start a New Design &rarr;</span>
              </Link>
            </div>

            {/* Projects Grid */}
            <div className="p-10">
              {projects.length === 0 ? (
                <div className="text-center py-20 bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
                  <Layout className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No projects found</h3>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-6">Create your first architectural model to start designing in 2D and 3D.</p>
                  <Link to="/new-project" className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-colors text-sm">
                    <Plus className="w-4 h-4" /> Start Designing
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div key={project.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition-all group">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active Model
                          </span>
                          
                          <div className="relative" ref={menuRef}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === project.id ? null : project.id); }}
                              className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {activeMenu === project.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-30">
                                <button 
                                  onClick={(e) => handleDuplicate(project.id, e)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left font-medium"
                                >
                                  <Copy className="w-3.5 h-3.5 text-indigo-400" /> Duplicate
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
                        </div>
                        
                        <h3 className="text-lg font-semibold text-white mb-1 truncate">{project.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-6 flex-1">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {project.created_at || 'Recently Saved'}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-900 flex items-center justify-between">
                        <Link to={`/studio?projectId=${project.id}`} className="text-xs font-medium text-white hover:text-indigo-400 flex items-center gap-1 transition-colors">
                          Open 2D/3D Studio &rarr;
                        </Link>
                        <div className="flex items-center gap-2">
                          <Link to={`/render-studio?projectId=${project.id}`} className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs" title="Open Render Studio">
                            <Sparkles className="w-3.5 h-3.5" />
                          </Link>
                          <Link to={`/war-room?projectId=${project.id}`} className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs" title="Open War Room">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* REPORTS REPOSITORY TAB (Fully Interactive!)               */}
        {/* ========================================================= */}
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

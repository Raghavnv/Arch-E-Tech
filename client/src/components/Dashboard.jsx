import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LayoutDashboard, Settings, LogOut, Clock, MoreVertical, Layout, Building, Trash2, Copy, FileText, Share2, Edit2, Eye, Key, Globe, User } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'reports', 'settings'
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchProjects = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/projects`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        } else {
          setProjects([
            { id: 1, name: "Skyline Tower Gen-1", created_at: "2 hrs ago", status: "Processed" }
          ]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProjects();
  }, [navigate]);

  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

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

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setProjects(projects.filter(p => p.id !== id));
    setActiveMenu(null);
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  // Mock reports data
  const [reports, setReports] = useState([
    { id: 1, name: "Project Alpha - Structural Compliance", date: "Oct 12, 2026", size: "2.4 MB" },
    { id: 2, name: "Skyline Tower - Cost Estimation Takeoff", date: "Oct 15, 2026", size: "1.1 MB" },
    { id: 3, name: "Villa Nova - Solar & Daylighting Analysis", date: "Oct 18, 2026", size: "4.8 MB" }
  ]);

  return (
    <div className="flex h-screen bg-transparent text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
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
        
        {activeTab === 'projects' && (
          <>
            <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Your Projects</h1>
                <p className="text-sm text-zinc-400 mt-1">Manage and monitor your architectural models.</p>
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
                <span className="text-3xl font-bold text-white mt-4">{(projects.length * 1250).toLocaleString()} <span className="text-sm font-normal text-zinc-500">sq ft</span></span>
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

            <div className="p-10 pt-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Recent Workspaces</h2>
              {projects.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
                  <p className="text-zinc-500 mb-4">No projects found.</p>
                  <Link to="/new-project" className="text-white hover:underline text-sm font-medium">Create your first project</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map(project => (
                    <div key={project.id} className="group bg-zinc-950 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-600 transition-all relative overflow-visible flex flex-col">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                          <Building className="w-5 h-5 text-zinc-300" />
                        </div>
                        <div className="relative" ref={activeMenu === project.id ? menuRef : null}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === project.id ? null : project.id);
                            }}
                            className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {activeMenu === project.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-20">
                              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left">
                                <Copy className="w-4 h-4" /> Duplicate
                              </button>
                              <button 
                                onClick={(e) => handleDelete(project.id, e)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-left border-t border-zinc-800"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-white mb-1 truncate">{project.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mb-6 flex-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {project.created_at || 'Recently'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-auto">
                        <span className="bg-zinc-800 text-zinc-300 text-xs font-medium px-2.5 py-1 rounded-full">
                          {project.status || "Draft"}
                        </span>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/war-room?projectId=${project.id}`} className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                            War Room
                          </Link>
                          <Link to={`/studio?projectId=${project.id}`} className="text-xs font-medium text-white">
                            Open Studio →
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

        {activeTab === 'reports' && (
          <>
            <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Saved Reports</h1>
                <p className="text-sm text-zinc-400 mt-1">View, edit, or share exported project analytics.</p>
              </div>
            </header>
            <div className="p-10">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">Report Name</th>
                      <th className="px-6 py-4 font-medium">Date Generated</th>
                      <th className="px-6 py-4 font-medium">File Size</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-zinc-900/30 transition-colors group">
                        <td className="px-6 py-4 flex items-center gap-3 font-medium text-white">
                          <FileText className="w-5 h-5 text-indigo-400" />
                          {report.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{report.date}</td>
                        <td className="px-6 py-4 text-zinc-400">{report.size}</td>
                        <td className="px-6 py-4 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg transition-colors" title="Share">
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-red-400 hover:text-red-300 bg-red-950/30 rounded-lg transition-colors ml-2" 
                            title="Delete"
                            onClick={() => setReports(reports.filter(r => r.id !== report.id))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reports.length === 0 && (
                  <div className="p-12 text-center text-zinc-500">No reports generated yet. Export a PDF from the Studio to see it here.</div>
                )}
              </div>
            </div>
          </>
        )}

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
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                      <option>Imperial (Feet & Inches)</option>
                      <option>Metric (Meters & Centimeters)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Default Currency (Cost Estimation)</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                      <option>USD ($)</option>
                      <option>EUR (€)</option>
                      <option>INR (₹)</option>
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
                      <h3 className="text-sm font-medium text-white mb-1">Replicate API (ControlNet)</h3>
                      <p className="text-xs text-zinc-500 max-w-md">Enable high-resolution exports in the Render Studio using your own cloud compute credits.</p>
                    </div>
                    <button className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors">Connect Key</button>
                  </div>
                </div>
              </section>
              
              <div className="flex justify-end pt-4">
                <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg">Save Changes</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LayoutDashboard, Settings, LogOut, Clock, MoreVertical, Layout, Building, Trash2, Copy } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([
    { id: 1, name: "Skyline Tower Gen-1", type: "Commercial", date: "2 hrs ago", area: "12,500 sqft", status: "Processed" },
    { id: 2, name: "Urban Residence A", type: "Residential", date: "Yesterday", area: "2,400 sqft", status: "Draft" },
    { id: 3, name: "Warehouse Complex", type: "Industrial", date: "Oct 12", area: "45,000 sqft", status: "Clash Detected" },
  ]);

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

  const handleDuplicate = (project, e) => {
    e.stopPropagation();
    const newProject = {
      ...project,
      id: Date.now(),
      name: `${project.name} (Copy)`,
      date: "Just now",
      status: "Draft"
    };
    setProjects([newProject, ...projects]);
    setActiveMenu(null);
  };

  const handleSignOut = () => {
    // Mock sign out
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-6 h-6 bg-white rounded-sm"></div>
          <span className="font-bold text-white tracking-tight">Arch-E-Tech</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 text-white font-medium">
            <LayoutDashboard className="w-4 h-4" /> Projects
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 font-medium transition-colors">
            <Settings className="w-4 h-4" /> Settings
          </a>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" onClick={() => setActiveMenu(null)}>
        <header className="px-10 py-8 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-zinc-900">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Your Projects</h1>
            <p className="text-sm text-zinc-400 mt-1">Manage and monitor your architectural models.</p>
          </div>
          <Link 
            to="/new-project"
            className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Create New Project
          </Link>
        </header>

        <div className="p-10">
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
                      {project.type === 'Commercial' ? <Building className="w-5 h-5 text-zinc-300" /> : <Layout className="w-5 h-5 text-zinc-300" />}
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
                          <button 
                            onClick={(e) => handleDuplicate(project, e)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left"
                          >
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
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {project.date}</span>
                    <span>•</span>
                    <span>{project.area}</span>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-auto">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      project.status === 'Processed' ? 'bg-zinc-800 text-zinc-300' : 
                      project.status === 'Clash Detected' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 
                      'bg-zinc-900 text-zinc-500'
                    }`}>
                      {project.status}
                    </span>
                    <Link to="/studio" className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Studio →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

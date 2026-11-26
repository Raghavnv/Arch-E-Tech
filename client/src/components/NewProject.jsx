import OutdoorOptions, { promptWithFloors } from './OutdoorOptions';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ImportPlanModal from './ImportPlanModal';
import { isImperial } from '../utils/units';
import { ArrowLeft, ArrowRight, LayoutTemplate, ScanLine, PenTool, Magnet, Box, Sun, AlertTriangle, Calculator, MessageSquare, Image as ImageIcon, FileText, Check, Plus, Upload, Type, FileImage } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  // the plot is optional: frontage (along the road) x depth, which side the road is on, and Vastu
  const [plot, setPlot] = useState({ width: '', depth: '', facing: 'N', vastu: false });
  const [outdoor, setOutdoor] = useState({ patio: false, balcony: false, terrace: false });
  const imperial = isImperial();
  const toMetres = (v) => (imperial ? Number(v) * 0.3048 : Number(v));
  const plotGiven = Number(plot.width) > 0 && Number(plot.depth) > 0;
  const [config, setConfig] = useState({
    name: '',
    locality: '',
    floors: 1,
    initMode: 'generative',
    prompt: '',
    features: {
      textToLayout: false,
      aiDetection: true,
      canvasEditor: true,
      snapping: true,
      extrusion: true,
      solar: false,
      clashDetection: false,
      costEstimation: false,
      compliance: false,
      conceptViz: false,
      pdfReports: false
    }
  });

  const toggleFeature = (key) => {
    setConfig(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] }
    }));
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full">
        <button 
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-10 shadow-2xl">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
              Initialize Workspace
            </h2>
            <p className="text-zinc-400 text-sm">
              Define your project parameters to set up the 2D/3D studio environment.
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-8 max-w-xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Project Name</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="e.g. Q4 Commercial Block"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-600"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Project Locality (City, Region)</label>
                <input 
                  type="text" 
                  placeholder="e.g. New York City, NY"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-600"
                  value={config.locality || ''}
                  onChange={(e) => setConfig({ ...config, locality: e.target.value })}
                />
                <p className="text-xs text-zinc-500 mt-2">Used by the RAG LLM to fetch specific municipal building codes and regulations.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Number of Floors</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={config.floors || 1}
                    onChange={(e) => setConfig({ ...config, floors: parseInt(e.target.value) })}
                    className="flex-1 accent-white"
                  />
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-white text-lg">
                    {config.floors || 1}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">Initialization Method</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Option 1: Start from Scratch */}
                  <div 
                    onClick={() => setConfig({ ...config, initMode: 'scratch' })}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-3 ${
                      config.initMode === 'scratch' 
                        ? 'border-white bg-zinc-900' 
                        : 'border-zinc-800 bg-black hover:border-zinc-700'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${config.initMode === 'scratch' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}>
                      <LayoutTemplate className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className={`font-semibold mb-1 ${config.initMode === 'scratch' ? 'text-white' : 'text-zinc-300'}`}>Blank Canvas</h4>
                      <p className="text-xs text-zinc-500">Draft manually.</p>
                    </div>
                  </div>

                  {/* Option 2: AI Generative */}
                  <div 
                    onClick={() => setConfig({ ...config, initMode: 'generative' })}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-3 ${
                      config.initMode === 'generative' 
                        ? 'border-indigo-500 bg-indigo-500/10' 
                        : 'border-zinc-800 bg-black hover:border-zinc-700'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${config.initMode === 'generative' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className={`font-semibold mb-1 ${config.initMode === 'generative' ? 'text-white' : 'text-zinc-300'}`}>AI Prompt</h4>
                      <p className="text-xs text-zinc-500">Text-to-Blueprint.</p>
                    </div>
                  </div>

                  {/* Option 3: AI Upload */}
                  <div 
                    onClick={() => setConfig({ ...config, initMode: 'upload' })}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-3 ${
                      config.initMode === 'upload' 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-zinc-800 bg-black hover:border-zinc-700'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${config.initMode === 'upload' ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                      <ScanLine className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className={`font-semibold mb-1 ${config.initMode === 'upload' ? 'text-white' : 'text-zinc-300'}`}>Digitize Sketch</h4>
                      <p className="text-xs text-zinc-500">Upload drawing.</p>
                    </div>
                  </div>
                </div>
              </div>

              {config.initMode === 'generative' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Architectural Prompt</label>
                  <textarea 
                    placeholder="e.g. A modern 3-bedroom layout, 2500 sqft, with an open-concept kitchen and a master suite..."
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600 h-24 resize-none"
                    value={config.prompt || ''}
                    onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                  />
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <OutdoorOptions value={outdoor} onChange={setOutdoor} withFloors={false} floors={config.floors || 1} onFloors={(n) => setConfig({ ...config, floors: n })} />
                  </div>
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <p className="text-sm font-medium text-zinc-300">Plot <span className="font-normal text-zinc-500">(optional)</span></p>
                    <p className="mt-0.5 text-xs text-zinc-500">The house is fitted inside the plot after setbacks, with the front door on the road side.
                      You can also write it in the prompt, e.g. "30x40 plot, east facing, vastu".</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="text-xs text-zinc-400">Frontage ({imperial ? 'ft' : 'm'})
                        <input type="number" min="0" value={plot.width} onChange={(e) => setPlot({ ...plot, width: e.target.value })}
                          placeholder={imperial ? '30' : '9'} className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                      </label>
                      <label className="text-xs text-zinc-400">Depth ({imperial ? 'ft' : 'm'})
                        <input type="number" min="0" value={plot.depth} onChange={(e) => setPlot({ ...plot, depth: e.target.value })}
                          placeholder={imperial ? '40' : '12'} className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                      </label>
                      <label className="text-xs text-zinc-400">Road on the
                        <select value={plot.facing} onChange={(e) => setPlot({ ...plot, facing: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                          <option value="N">North</option><option value="E">East</option>
                          <option value="S">South</option><option value="W">West</option>
                        </select>
                      </label>
                      <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={plot.vastu} onChange={(e) => setPlot({ ...plot, vastu: e.target.checked })} className="accent-indigo-500" />
                        Follow Vastu
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {config.initMode === 'upload' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <button type="button" onClick={() => setImportOpen(true)} className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                    <FileImage className="w-8 h-8 text-zinc-500 mb-3" />
                    <p className="text-sm font-medium text-zinc-300">Have a floor plan? Upload it to trace it.</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPEG, WebP or PDF up to 15 MB</p>
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-900 mt-4">
                <button 
                  disabled={isGenerating || !config.name.trim()}
                  onClick={async () => {
                    if (config.initMode === 'upload') { setImportOpen(true); return; }
                    setIsGenerating(true);
                    setError('');
                    let initialElements = [];
                    let site = null;
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                    const token = localStorage.getItem('token');
                    
                    if (config.initMode === 'generative') {
                      try {
                        const res = await fetch(`${API_URL}/api/ai/generate-plan`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            // the Number of Floors slider, unless the prompt says otherwise (the generator draws up to 3)
                            prompt: promptWithFloors(config.prompt || 'Default modern house', Math.min(3, config.floors || 1)),
                            outdoor,
                            ...(plotGiven ? { plot_width_m: toMetres(plot.width), plot_depth_m: toMetres(plot.depth), facing: plot.facing } : {}),
                            ...(plot.vastu ? { vastu: true } : {}),
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data.elements) throw new Error(data.detail || `the server answered ${res.status}`);
                        initialElements = data.elements;
                        if (data.site || data.vastu || data.notes) {
                          site = { ...(data.site || {}), notes: data.notes || [], vastu_score: data.vastu?.score ?? null };
                        }
                      } catch (err) {
                        console.error('Failed to generate plan:', err);
                        setError(`Couldn't generate the plan (${err.message}). Please try again.`);
                        setIsGenerating(false);
                        return;
                      }
                    }


                    // Create the project in the DB
                    try {
                      const createRes = await fetch(`${API_URL}/api/projects`, {
                        method: 'POST',
                        headers: { 
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({
                          name: config.name || "Untitled Project",
                          elements_data: initialElements,
                          site,
                        })
                      });
                      if (createRes.status === 401) {
                        localStorage.removeItem('token');
                        navigate('/auth');
                        return;
                      }
                      if (!createRes.ok) throw new Error(`server answered ${createRes.status}`);
                      const newProject = await createRes.json();
                      navigate(`/studio?projectId=${newProject.id}`);
                    } catch (err) {
                      // never drop into an unsaved canvas silently: say so and let them retry
                      console.error("Failed to create project in DB", err);
                      setError(`Couldn't save the new project (${err.message}). Please try again.`);
                      setIsGenerating(false);
                    }
                  }}
                  className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isGenerating || !config.name.trim() ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div>
                      Generating Layout...
                    </>
                  ) : (
                    <>{config.initMode === 'upload' ? 'Upload a plan' : 'Launch Studio Engine'} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
              </div>

            </div>
          )}
        </div>
      </div>
      {importOpen && <ImportPlanModal onClose={() => setImportOpen(false)} mode="new"
        onAccept={async ({ elements, name }) => {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const res = await fetch(`${API_URL}/api/projects`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: config.name.trim() || name, elements_data: elements }),
          });
          if (res.status === 401) { localStorage.removeItem('token'); navigate('/auth'); throw new Error('Log in again.'); }
          if (!res.ok) throw new Error(`Couldn't create the project (the server answered ${res.status}).`);
          return (await res.json()).id;
        }}
        onFinished={(projectId) => navigate(`/studio?projectId=${projectId}`)} />}
    </div>
  );
}

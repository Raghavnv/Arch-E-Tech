import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LayoutTemplate, ScanLine, PenTool, Magnet, Box, Sun, AlertTriangle, Calculator, MessageSquare, Image as ImageIcon, FileText, Check, Plus, Upload, Type, FileImage } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
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
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full">
        <button 
          onClick={() => step === 1 ? navigate('/dashboard') : setStep(1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 1 ? 'Back to Dashboard' : 'Back to details'}
        </button>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-10 shadow-2xl">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
              {step === 1 ? "Initialize Workspace" : "Configure Pipeline"}
            </h2>
            <p className="text-zinc-400">
              {step === 1 ? "Give your project a name and upload an initial sketch to begin." : "Select the computational modules you want to enable for this project."}
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
                </div>
              )}

              {config.initMode === 'upload' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                    <FileImage className="w-8 h-8 text-zinc-500 mb-3" />
                    <p className="text-sm font-medium text-zinc-300">Have a floor plan? Drop it here.</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPG or PDF up to 10MB</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-900 mt-4">
                <button 
                  disabled={isGenerating || !config.name.trim()}
                  onClick={async () => {
                    setIsGenerating(true);
                    let initialElements = [];
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                    const token = localStorage.getItem('token');
                    
                    if (config.initMode === 'generative') {
                      try {
                        const res = await fetch(`${API_URL}/api/ai/generate-plan`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt: config.prompt || "Default modern house" })
                        });
                        const data = await res.json();
                        if (data.elements) {
                          initialElements = data.elements;
                        }
                      } catch (err) {
                        console.error("Backend AI generation failed", err);
                        initialElements = [
                          { "type": "wall", "left": 100, "top": 100, "width": 400, "height": 8, "angle": 0 },
                          { "type": "wall", "left": 500, "top": 100, "width": 300, "height": 8, "angle": 90 },
                          { "type": "wall", "left": 500, "top": 400, "width": 400, "height": 8, "angle": 180 },
                          { "type": "wall", "left": 100, "top": 400, "width": 300, "height": 8, "angle": 270 },
                          { "type": "door", "left": 250, "top": 400, "width": 60, "height": 4, "angle": 180 },
                          { "type": "window", "left": 500, "top": 200, "width": 80, "height": 4, "angle": 90 }
                        ];
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
                          elements_data: initialElements
                        })
                      });
                      
                      if (createRes.ok) {
                        const newProject = await createRes.json();
                        navigate(`/studio?projectId=${newProject.id}`);
                        return;
                      }
                    } catch (err) {
                      console.error("Failed to create project in DB", err);
                    }
                    
                    setIsGenerating(false);
                    // Fallback to local storage if DB fails
                    if (initialElements.length > 0) {
                      localStorage.setItem('draftElements', JSON.stringify(initialElements));
                    } else {
                      localStorage.removeItem('draftElements');
                    }
                    navigate('/studio');
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
                    <>Launch Studio Engine <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

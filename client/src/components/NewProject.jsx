import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ScanLine, Box, AlertTriangle, Calculator, FileImage, LayoutTemplate, Magnet, Sun, MessageSquare, Image as ImageIcon, FileText, PenTool } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    name: '',
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

              <div className="pt-2">
                <button 
                  onClick={() => setStep(2)}
                  disabled={!config.name.trim()}
                  className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    config.name.trim() ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Configure Pipeline <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60vh] overflow-y-auto pr-4 mb-8 custom-scrollbar">
                
                {/* Generative & Detection */}
                <FeatureToggle icon={<LayoutTemplate className="w-4 h-4"/>} title="AI Text-to-Layout" desc="Llama 3 NLP prompt to canvas generation." enabled={config.features.textToLayout} onClick={() => toggleFeature('textToLayout')} />
                <FeatureToggle icon={<ScanLine className="w-4 h-4"/>} title="YOLOv11 Floor Plan Detection" desc="Automated wall/door classification." enabled={config.features.aiDetection} onClick={() => toggleFeature('aiDetection')} />
                
                {/* 2D Canvas */}
                <FeatureToggle icon={<PenTool className="w-4 h-4"/>} title="Vector Canvas Editor" desc="Fabric.js interactive drag-and-drop." enabled={config.features.canvasEditor} onClick={() => toggleFeature('canvasEditor')} />
                <FeatureToggle icon={<Magnet className="w-4 h-4"/>} title="Smart Wall Snapping" desc="Perpendicular and grid alignment." enabled={config.features.snapping} onClick={() => toggleFeature('snapping')} />
                
                {/* 3D & Computation */}
                <FeatureToggle icon={<Box className="w-4 h-4"/>} title="2D-to-3D Extrusion" desc="Shapely + Three.js dynamic mesh building." enabled={config.features.extrusion} onClick={() => toggleFeature('extrusion')} />
                <FeatureToggle icon={<Sun className="w-4 h-4"/>} title="Solar & Shadow Sim" desc="Real-world sun angles via SunCalc." enabled={config.features.solar} onClick={() => toggleFeature('solar')} />
                <FeatureToggle icon={<AlertTriangle className="w-4 h-4"/>} title="3D Clash Detection" desc="AABB collision & swing clearance." enabled={config.features.clashDetection} onClick={() => toggleFeature('clashDetection')} />
                <FeatureToggle icon={<Calculator className="w-4 h-4"/>} title="Live Cost Takeoff" desc="Real-time volume and material pricing." enabled={config.features.costEstimation} onClick={() => toggleFeature('costEstimation')} />
                
                {/* Advanced / Output */}
                <FeatureToggle icon={<MessageSquare className="w-4 h-4"/>} title="RAG Compliance Agent" desc="Llama 3 + ChromaDB building code chat." enabled={config.features.compliance} onClick={() => toggleFeature('compliance')} />
                <FeatureToggle icon={<ImageIcon className="w-4 h-4"/>} title="Concept Visualizer" desc="ControlNet photorealistic renders." enabled={config.features.conceptViz} onClick={() => toggleFeature('conceptViz')} />
                <FeatureToggle icon={<FileText className="w-4 h-4"/>} title="Automated PDF Reports" desc="Export views and costs to jsPDF." enabled={config.features.pdfReports} onClick={() => toggleFeature('pdfReports')} />
              </div>

              <div className="pt-4 border-t border-zinc-900">
                <button 
                  onClick={async () => {
                    if (config.initMode === 'generative') {
                      try {
                        const res = await fetch('http://localhost:8000/api/ai/generate-plan', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt: config.prompt || "Default modern house" })
                        });
                        const data = await res.json();
                        if (data.elements) {
                          localStorage.setItem('draftElements', JSON.stringify(data.elements));
                        }
                      } catch (err) {
                        console.error("Backend not running, falling back to empty.");
                        localStorage.removeItem('draftElements');
                      }
                    } else if (config.initMode === 'upload') {
                       // We will leave this for YOLO later. For now, empty canvas.
                       localStorage.removeItem('draftElements');
                    } else {
                      localStorage.removeItem('draftElements');
                    }
                    navigate('/studio');
                  }}
                  className="w-full py-4 rounded-xl font-medium bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  Launch Studio Engine <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function FeatureToggle({ icon, title, desc, enabled, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
        enabled ? 'border-white bg-zinc-900' : 'border-zinc-800 bg-black hover:border-zinc-700'
      }`}
    >
      <div className={`mt-0.5 ${enabled ? 'text-white' : 'text-zinc-500'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold text-xs mb-1 ${enabled ? 'text-white' : 'text-zinc-300'}`}>{title}</h4>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{desc}</p>
      </div>
      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
        enabled ? 'border-white bg-white text-black' : 'border-zinc-700'
      }`}>
        {enabled && <Check className="w-2.5 h-2.5" />}
      </div>
    </div>
  );
}

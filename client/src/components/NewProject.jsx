import { useState, useRef } from 'react';
import { api } from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LayoutTemplate, ScanLine, PenTool, Magnet, Box, Sun, AlertTriangle, Calculator, MessageSquare, Image as ImageIcon, FileText, Check, Plus, Upload, Type, FileImage } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [sketch, setSketch] = useState(null);       // data URL of an uploaded floor plan to trace over
  const fileInputRef = useRef(null);

  // shrink the upload so it fits in browser storage; it is only a tracing guide
  const loadSketch = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setGenError('Please choose a PNG or JPG image of the plan.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setSketch(c.toDataURL('image/jpeg', 0.8));
        setGenError(null);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const [config, setConfig] = useState({
    name: '',
    locality: '',
    floors: 1,
    initMode: 'generative',
    prompt: ''
  });


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
                      <p className="text-xs text-zinc-500">Trace over a plan.</p>
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
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={(e) => loadSketch(e.target.files?.[0])} />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); loadSketch(e.dataTransfer.files?.[0]); }}
                    className="border-2 border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                  >
                    {sketch ? (
                      <>
                        <img src={sketch} alt="Uploaded plan" className="max-h-40 rounded-lg mb-3 opacity-90" />
                        <p className="text-xs text-zinc-400">Click to choose a different image</p>
                      </>
                    ) : (
                      <>
                        <FileImage className="w-8 h-8 text-zinc-500 mb-3" />
                        <p className="text-sm font-medium text-zinc-300">Have a floor plan? Drop it here.</p>
                        <p className="text-xs text-zinc-500 mt-1">PNG or JPG. It appears under the 2D canvas so you can trace walls over it.</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-900 mt-4">
                {genError && (
                  <p className="mb-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{genError}</p>
                )}
                <button 
                  disabled={isGenerating || !config.name.trim() || (config.initMode === 'upload' && !sketch)}
                  onClick={async () => {
                    setIsGenerating(true);
                    setGenError(null);
                    let initialElements = [];
                    try {
                      if (config.initMode === 'generative') {
                        const data = await api('/api/ai/generate-plan', {
                          method: 'POST',
                          body: { prompt: config.prompt.trim() || 'A modern 2 bedroom house' },
                        });
                        initialElements = (data.elements || []).map(el => ({ ...el, floor: 1 }));
                      }
                      const newProject = await api('/api/projects', {
                        method: 'POST',
                        body: {
                          name: config.name.trim(),
                          locality: config.locality.trim() || null,
                          floors: config.floors,
                          elements_data: initialElements,
                        },
                      });
                      if (sketch) {
                        try {
                          localStorage.setItem(`archetech_underlay_${newProject.id}`, sketch);
                        } catch {
                          setGenError('The sketch is too large to keep in this browser. Try a smaller image.');
                          setIsGenerating(false);
                          return;
                        }
                      }
                      navigate(`/studio?projectId=${newProject.id}`);
                    } catch (err) {
                      setGenError(`Could not create the project: ${err.message}`);
                      setIsGenerating(false);
                    }
                  }}
                  className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isGenerating || !config.name.trim() || (config.initMode === 'upload' && !sketch) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'
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

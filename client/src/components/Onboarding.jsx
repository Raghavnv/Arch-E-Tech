import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Building2, Ruler, Type } from 'lucide-react';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    projectName: '',
    buildingType: '',
    estimatedArea: '',
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else navigate('/studio');
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
        
        {/* Progress Bar */}
        <div className="flex h-2 w-full bg-slate-100">
          <div 
            className="bg-blue-600 transition-all duration-500 ease-out h-full" 
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-10 md:p-14">
          <div className="mb-10">
            <span className="text-sm font-semibold text-blue-600 tracking-wider uppercase mb-2 block">
              Step {step} of 3
            </span>
            <h2 className="text-3xl font-bold text-slate-900">
              {step === 1 && "What's your project name?"}
              {step === 2 && "Select building type"}
              {step === 3 && "Estimated floor area"}
            </h2>
            <p className="text-slate-500 mt-2">
              {step === 1 && "Give your new architectural project a recognizable identity."}
              {step === 2 && "This helps us tailor the AI detection to your specific needs."}
              {step === 3 && "Provide a rough estimate of the total square footage."}
            </p>
          </div>

          <div className="min-h-[140px]">
            {step === 1 && (
              <div className="relative">
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="e.g. Skyline Residency"
                  className="w-full text-xl pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-slate-800 placeholder:text-slate-400"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                />
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-4">
                {['Residential', 'Commercial', 'Industrial', 'Public'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, buildingType: type })}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                      formData.buildingType === type 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Building2 className={`w-8 h-8 mb-3 ${formData.buildingType === type ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-medium">{type}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="relative">
                <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  sq ft
                </div>
                <input 
                  type="number" 
                  autoFocus
                  placeholder="e.g. 2500"
                  className="w-full text-xl pl-14 pr-20 py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-slate-800 placeholder:text-slate-400"
                  value={formData.estimatedArea}
                  onChange={(e) => setFormData({ ...formData, estimatedArea: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className={`flex items-center gap-2 font-medium px-6 py-3 rounded-full transition-colors ${
                step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 font-medium px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40"
            >
              {step === 3 ? 'Go to Studio' : 'Continue'} 
              {step === 3 ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

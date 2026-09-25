import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const email = e.target.email.value;
    const password = e.target.password.value;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    try {
      if (isLogin) {
        let res;
        try {
          res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
        } catch (networkErr) {
          console.warn('Backend not reachable:', networkErr);
          localStorage.setItem('token', 'mock-token-for-dev');
          localStorage.setItem('isNewUser', 'false');
          navigate('/dashboard');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('isNewUser', 'false');
          navigate('/dashboard');
        } else {
          try {
            const errorData = await res.json();
            setError(errorData.detail || 'Login failed. Please check your credentials.');
          } catch (e) {
            setError(`Server error (${res.status}): The backend is unreachable or misconfigured.`);
          }
        }
      } else {
        const fullName = e.target.fullName.value;
        let res;
        try {
          res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, password })
          });
        } catch (networkErr) {
          console.warn('Backend not reachable:', networkErr);
          localStorage.setItem('token', 'mock-token-for-dev');
          localStorage.setItem('isNewUser', 'true');
          navigate('/welcome');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('isNewUser', 'true');
          navigate('/welcome');
        } else {
          try {
            const errorData = await res.json();
            setError(errorData.detail || 'Registration failed.');
          } catch (e) {
            setError(`Server error (${res.status}): The backend is unreachable or misconfigured.`);
          }
        }
      }
    } catch (err) {
      console.error("Unexpected auth error:", err);
      setError("An unexpected error occurred during authentication.");
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex font-sans relative">
      
      {/* Custom Error Toast */}
      {error && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:bg-red-500/20 p-1 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Left Panel: Graphic/Branding */}
      <div className="hidden lg:flex flex-1 relative bg-transparent/20 backdrop-blur-md flex-col items-center justify-center border-r border-zinc-900 overflow-hidden">
        {/* Abstract Architectural Grid Background */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#18181b 1px, transparent 1px), linear-gradient(90deg, #18181b 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
        
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 p-12 max-w-lg text-center">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-8 flex items-center justify-center">
            <span className="text-black font-bold text-2xl tracking-tighter">AE</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Construct the future.</h2>
          <p className="text-zinc-400 leading-relaxed text-lg">
            Join the platform that seamlessly blends AI inference with vector mathematics to revolutionize architectural design.
          </p>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="flex-1 flex flex-col justify-center relative">
        <Link to="/" className="absolute top-8 left-8 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="w-full max-w-sm mx-auto p-8">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="text-zinc-500 text-sm">
              {isLogin ? 'Enter your details to access your studio.' : 'Sign up to start building your projects.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Full Name</label>
                <input 
                  type="text" 
                  name="fullName"
                  placeholder="Zaha Hadid" 
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-600"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                name="email"
                placeholder="architect@studio.com" 
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-600"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                {isLogin && <a href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">Forgot password?</a>}
              </div>
              <input 
                type="password"
                name="password" 
                placeholder="••••••••" 
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-zinc-600"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-zinc-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }} 
              className="text-white hover:underline font-medium focus:outline-none"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, ArrowRight, AlertCircle, X, Mail, Lock, User, 
  Eye, EyeOff, Sparkles, Activity, CheckCircle2 
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../utils/api';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  // where a login-protected page sent us from
  const returnTo = location.state?.from || '/dashboard';

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fill Demo Credentials for instant 1-click test
  const handleQuickDemoLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/demo`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('isNewUser', 'false');
      navigate(returnTo);
    } catch (err) {
      setError(`Can't reach the server for the demo account: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const email = emailInput || e.target.email?.value;
    const password = passwordInput || e.target.password?.value;
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
          setError("Can't reach the server. Check your connection and try again.");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('isNewUser', 'false');
          navigate(returnTo);
        } else {
          try {
            const errorData = await res.json();
            setError(errorData.detail || 'Login failed. Please check your credentials.');
          } catch (e) {
            setError(`Server error (${res.status}): The backend is unreachable or misconfigured.`);
          }
        }
      } else {
        const fullName = nameInput || e.target.fullName?.value;
        let res;
        try {
          res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, password })
          });
        } catch (networkErr) {
          console.warn('Backend not reachable:', networkErr);
          setError("Can't reach the server. Check your connection and try again.");
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans relative overflow-hidden">
      
      {/* Custom Error Toast */}
      {error && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-rose-500/15 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
            <button onClick={() => setError(null)} className="ml-3 hover:bg-rose-500/20 p-1 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* left: photo panel (large screens only) */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-zinc-900 lg:block">
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/30" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex w-fit items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold tracking-tighter text-black">AE</div>
            <span className="text-lg font-semibold tracking-tight text-white">Arch-E-Tech</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Plan your home, room by room.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Describe what you need and get an editable floor plan, a 3D model and a cost estimate in one place.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-300">
              {['Floor plans generated from a description', 'Edit in 2D, review in 3D', 'Projects saved to your account'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-400" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: FUTURISTIC GLASSMORPHIC AUTH CARD                            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col justify-center relative px-6 sm:px-12 lg:px-16 py-12">
        
        {/* Back to Home Button */}
        <Link 
          to="/" 
          className="absolute top-8 left-8 sm:left-12 text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
        </Link>

        <div className="w-full max-w-md mx-auto">
          
          {/* Card Container with subtle gradient border */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 sm:p-10 relative">
            
            {/* Mode Switch Tabs (Sign In / Create Account) */}
            <div className="flex items-center p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 mb-8">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isLogin
                    ? 'bg-white text-black shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  !isLogin
                    ? 'bg-white text-black shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Header Text */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                {isLogin 
                  ? 'Sign in to continue to your projects.' 
                  : 'Start planning your first home in a few minutes.'}
              </p>
            </div>

            {/* 1-Click Quick Demo Sign-In Pill */}
            {isLogin && (
              <div className="mb-6 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-medium">Testing out the studio?</span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickDemoLogin}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors whitespace-nowrap shadow-sm"
                >
                  Try the Demo
                </button>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {!isLogin && (
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      name="fullName"
                      placeholder="Zaha Hadid" 
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    name="email"
                    placeholder="architect@studio.com" 
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Password
                  </label>
                  {!isLogin && <span className="text-[11px] text-zinc-500">At least 8 characters</span>}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="password" 
                    placeholder="••••••••" 
                    required
                    minLength={isLogin ? undefined : 8}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" /> {isLogin ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            {/* Bottom Toggle Note */}
            <div className="mt-6 text-center text-xs text-zinc-500">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }} 
                className="text-white hover:underline font-bold focus:outline-none ml-1"
              >
                {isLogin ? 'Sign up free' : 'Sign in here'}
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

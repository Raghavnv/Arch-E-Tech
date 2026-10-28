import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, ArrowRight, AlertCircle, X, Mail, Lock, User, 
  Eye, EyeOff, Sparkles, ShieldCheck, Activity, Box, Layers, Zap, CheckCircle2 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const navigate = useNavigate();

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fill Demo Credentials for instant 1-click test
  const handleQuickDemoLogin = () => {
    setEmailInput('demo@archetech.io');
    setPasswordInput('architect2026');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const email = emailInput || e.target.email?.value;
    const password = passwordInput || e.target.password?.value;
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
          setError("Can't reach the server. It may be waking up, try again in a few seconds.");
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
          setError("Can't reach the server. It may be waking up, try again in a few seconds.");
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

  // 3D Isometric Hologram Canvas Animation for Left Panel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let active = true;
    let angle = 30;
    let laserProgress = 0;

    const render = () => {
      if (!active) return;
      const width = canvas.width = canvas.parentElement.clientWidth;
      const height = canvas.height = canvas.parentElement.clientHeight;
      const cx = width / 2;
      const cy = height / 2 + 10;

      angle = (angle + 0.3) % 360;
      laserProgress = (laserProgress + 0.01) % 1;
      const laserX = -120 + laserProgress * 240;

      const radYaw = (angle * Math.PI) / 180;
      const radPitch = (26 * Math.PI) / 180;

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // 3D Projection Helper
      const project = (x, y, z) => {
        const x1 = x * Math.cos(radYaw) - z * Math.sin(radYaw);
        const z1 = x * Math.sin(radYaw) + z * Math.cos(radYaw);
        const y2 = y * Math.cos(radPitch) - z1 * Math.sin(radPitch);
        return { x: cx + x1 * 0.95, y: cy - y2 * 0.95 };
      };

      // Architectural Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      for (let i = -160; i <= 160; i += 32) {
        const p1 = project(i, -10, -160);
        const p2 = project(i, -10, 160);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const p3 = project(-160, -10, i);
        const p4 = project(160, -10, i);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
      }

      // Foundation Slab
      const f1 = project(-120, -10, -90);
      const f2 = project(130, -10, -90);
      const f3 = project(130, -10, 100);
      const f4 = project(-120, -10, 100);

      ctx.beginPath();
      ctx.moveTo(f1.x, f1.y);
      ctx.lineTo(f2.x, f2.y);
      ctx.lineTo(f3.x, f3.y);
      ctx.lineTo(f4.x, f4.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.stroke();

      // Modern Villa Rooms
      const rooms = [
        { x: -100, z: -70, w: 90, d: 70, h: 45, col: '#06b6d4' },
        { x: 0, z: -40, w: 110, d: 90, h: 50, col: '#3b82f6' },
        { x: -100, z: 10, w: 60, d: 50, h: 40, col: '#8b5cf6' }
      ];

      rooms.forEach(r => {
        const c1 = project(r.x, 0, r.z);
        const c2 = project(r.x + r.w, 0, r.z);
        const c3 = project(r.x + r.w, 0, r.z + r.d);
        const c4 = project(r.x, 0, r.z + r.d);

        const t1 = project(r.x, r.h, r.z);
        const t2 = project(r.x + r.w, r.h, r.z);
        const t3 = project(r.x + r.w, r.h, r.z + r.d);
        const t4 = project(r.x, r.h, r.z + r.d);

        // Floor
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.lineTo(c4.x, c4.y);
        ctx.closePath();
        ctx.fillStyle = `${r.col}18`;
        ctx.fill();

        // Wireframe edges
        ctx.strokeStyle = r.col;
        ctx.lineWidth = 1.6;
        const edges = [
          [c1, c2], [c2, c3], [c3, c4], [c4, c1],
          [t1, t2], [t2, t3], [t3, t4], [t4, t1],
          [c1, t1], [c2, t2], [c3, t3], [c4, t4]
        ];
        edges.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
      });

      // Sweeping Laser Scanner
      const l1 = project(laserX, 70, -100);
      const l2 = project(laserX, -10, -100);
      const l3 = project(laserX, -10, 110);
      const l4 = project(laserX, 70, 110);

      const grad = ctx.createLinearGradient(l1.x, l1.y, l3.x, l3.y);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.3)');

      ctx.beginPath();
      ctx.moveTo(l1.x, l1.y);
      ctx.lineTo(l4.x, l4.y);
      ctx.lineTo(l3.x, l3.y);
      ctx.lineTo(l2.x, l2.y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(l2.x, l2.y);
      ctx.lineTo(l3.x, l3.y);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>

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

      {/* ========================================================================= */}
      {/* LEFT PANEL: LIVING ARCHITECTURAL MATRIX & TELEMETRY                       */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-1 relative bg-zinc-950 border-r border-zinc-900 flex-col justify-between p-12 overflow-hidden select-none">
        
        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-extrabold text-black tracking-tighter text-sm shadow-md group-hover:scale-105 transition-transform">
              AE
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Arch-E-Tech</span>
          </Link>
          
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-mono font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            NEURAL CAD MATRIX ACTIVE
          </span>
        </div>

        {/* Center: Interactive 3D Architectural Canvas */}
        <div className="relative flex-1 my-6 flex items-center justify-center min-h-[360px]">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          
          {/* Floating Telemetry Chips in 3D Space */}
          <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-xl p-3 text-xs font-mono text-zinc-300 space-y-1 shadow-2xl">
            <div className="text-[10px] text-cyan-400 font-bold flex items-center gap-1.5 uppercase">
              <Activity className="w-3.5 h-3.5" /> Telemetry Feed
            </div>
            <div className="text-[11px]">Inference: <span className="text-white font-bold">8.4 ms</span></div>
            <div className="text-[11px]">Precision: <span className="text-emerald-400 font-bold">Sub-Millimeter CAD</span></div>
            <div className="text-[11px]">Audit: <span className="text-white font-bold">100% IBC Compliant</span></div>
          </div>
        </div>

        {/* Bottom Architectural Credo */}
        <div className="relative z-10 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6">
          <p className="text-sm text-zinc-300 leading-relaxed italic">
            "Arch-E-Tech merges topological adjacency graph theory with vector CAD precision — turning natural language concepts into structural BIM models and 8K renders in seconds."
          </p>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-3">
            <span className="font-mono text-zinc-400">Next-Gen Autonomous Architecture</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Studio Tier Verified
            </span>
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
          <div className="bg-zinc-900/70 backdrop-blur-2xl border border-zinc-800/90 rounded-3xl p-8 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            {/* Top Glowing Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500"></div>

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
                {isLogin ? 'Welcome Back' : 'Create Studio Account'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                {isLogin 
                  ? 'Access your architectural models, 3D simulations, and takeoffs.' 
                  : 'Start designing multi-room residences with AI precision.'}
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
                  Fill Demo Login
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
                  {isLogin && (
                    <span className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                      Forgot password?
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="password" 
                    placeholder="••••••••" 
                    required
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
                    <Activity className="w-4 h-4 animate-spin" /> Authenticating...
                  </span>
                ) : (
                  <>
                    <span>{isLogin ? 'Enter Studio' : 'Create Architect Account'}</span>
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

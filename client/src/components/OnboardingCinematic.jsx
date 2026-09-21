import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { Cpu, PenTool, Box } from 'lucide-react';

export default function OnboardingCinematic() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          navigate('/new-project');
        }
      });

      // Initial state setup
      gsap.set(['.text-layer', '.ai-core', '.floor-plan', '.block-3d'], { opacity: 0 });
      gsap.set('.text-layer', { y: 20 });
      gsap.set('.ai-core', { scale: 0.5, rotation: -180 });
      gsap.set('.floor-plan', { rotationX: 70, rotationZ: 45, scale: 0.5 });
      gsap.set('.block-3d', { zZ: -100, scaleZ: 0.1 });
      gsap.set('.container-3d', { perspective: 1500 });

      // PHASE 1: Neural Ignition
      tl.to('.text-1', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
        .to('.ai-core', { opacity: 1, scale: 1.2, rotation: 0, duration: 1.2, ease: 'elastic.out(1, 0.4)' }, "<")
        .to('.ai-core', { scale: 0, opacity: 0, duration: 0.4, ease: 'power2.in' }, "+=0.5")
        .to('.text-1', { opacity: 0, y: -20, duration: 0.4 }, "<")

      // PHASE 2: Procedural Blueprint (Neon Lines)
      tl.to('.text-2', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, "+=0.2")
        .to('.floor-plan', { opacity: 1, duration: 0.1 }, "<")
        .fromTo('.mesh-line', 
          { strokeDasharray: 2000, strokeDashoffset: 2000 }, 
          { strokeDashoffset: 0, duration: 1.5, stagger: 0.15, ease: 'power3.inOut' }, "<"
        )
        .to('.floor-plan', { rotationX: 55, rotationZ: 25, scale: 1.1, duration: 1.5, ease: 'power2.inOut' }, "<0.2")
        .to('.text-2', { opacity: 0, y: -20, duration: 0.4 }, "+=0.5")

      // PHASE 3: 3D Materialization
      tl.to('.text-3', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, "+=0.2")
        .to('.block-3d', { 
          opacity: 1, 
          scaleZ: 1, 
          z: 0, 
          y: -20,
          duration: 1.2, 
          stagger: { amount: 0.5, from: "random" }, 
          ease: 'back.out(1.5)' 
        }, "<")
        // Flash brilliant white
        .to('.block-3d', { 
          backgroundColor: '#ffffff', 
          borderColor: '#ffffff',
          boxShadow: '0 0 50px rgba(255,255,255,1)', 
          duration: 0.3, 
          stagger: 0.1 
        }, "+=0.4")

      // PHASE 4: Hyper-Zoom & Launch to New Project
      tl.to('.container-3d', { 
        scale: 8, 
        opacity: 0, 
        filter: 'blur(20px)', 
        duration: 1, 
        ease: 'power4.in' 
      }, "+=0.4")
      .to('.text-3', { opacity: 0, duration: 0.4 }, "<0.2");

    }, containerRef);

    return () => ctx.revert();
  }, [navigate]);

  return (
    <div ref={containerRef} className="w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans text-white relative">
      
      {/* Hyper Grid Background */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent to-black"></div>

      {/* 3D Visualizer Container */}
      <div className="container-3d relative w-full max-w-4xl h-[60vh] flex items-center justify-center z-10 transform-style-3d">
        
        {/* Phase 1: AI Core */}
        <div className="ai-core absolute z-30">
          <div className="relative">
            <Cpu className="w-24 h-24 text-indigo-500 relative z-10 drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]" />
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-50 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Phase 2: SVG Blueprint (Isometric) */}
        <div className="floor-plan absolute w-96 h-96 transform-style-3d z-20">
          <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">
            <rect x="50" y="50" width="300" height="300" fill="none" stroke="#10b981" strokeWidth="4" className="mesh-line" />
            <rect x="100" y="100" width="100" height="150" fill="none" stroke="#10b981" strokeWidth="4" className="mesh-line" />
            <line x1="200" y1="50" x2="200" y2="350" stroke="#10b981" strokeWidth="4" className="mesh-line" />
            <line x1="50" y1="200" x2="350" y2="200" stroke="#10b981" strokeWidth="4" className="mesh-line" />
          </svg>
          
          {/* Phase 3: 3D Blocks popping out of the floor plan */}
          <div className="absolute top-[50px] left-[50px] w-[150px] h-[150px] transform-style-3d">
            <div className="block-3d absolute inset-0 bg-zinc-900 border border-zinc-700 shadow-2xl" style={{ transform: 'translateZ(40px)' }}></div>
          </div>
          <div className="absolute top-[200px] left-[50px] w-[150px] h-[150px] transform-style-3d">
            <div className="block-3d absolute inset-0 bg-zinc-900 border border-zinc-700 shadow-2xl" style={{ transform: 'translateZ(60px)' }}></div>
          </div>
          <div className="absolute top-[50px] left-[200px] w-[150px] h-[300px] transform-style-3d">
            <div className="block-3d absolute inset-0 bg-zinc-900 border border-zinc-700 shadow-2xl" style={{ transform: 'translateZ(80px)' }}></div>
          </div>
        </div>

      </div>

      {/* Cinematic Text Descriptions */}
      <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center z-30 h-20">
        <div className="text-layer text-1 absolute flex flex-col items-center">
          <span className="text-indigo-400 font-mono text-sm tracking-widest uppercase mb-2">System Init</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">Initializing AI Core.</h2>
        </div>
        <div className="text-layer text-2 absolute flex flex-col items-center">
          <span className="text-emerald-400 font-mono text-sm tracking-widest uppercase mb-2">Vector Phase</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">Generating Geometry.</h2>
        </div>
        <div className="text-layer text-3 absolute flex flex-col items-center">
          <span className="text-white font-mono text-sm tracking-widest uppercase mb-2">Materialization</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">Welcome to Arch-E-Tech.</h2>
        </div>
      </div>
    </div>
  );
}

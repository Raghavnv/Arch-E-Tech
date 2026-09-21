import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Hammer, Ruler, ScanLine } from 'lucide-react';

export default function OnboardingCinematic() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useGSAP(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        navigate('/dashboard');
      }
    });

    // Setup initial states
    gsap.set('.text-layer', { opacity: 0, y: 30 });
    gsap.set('.crane', { opacity: 0, x: -100 });
    gsap.set('.blueprint-line', { scaleX: 0, transformOrigin: 'left' });
    gsap.set('.blueprint-col', { scaleY: 0, transformOrigin: 'bottom' });
    gsap.set('.grid-bg', { opacity: 0 });
    gsap.set('.icon-spin', { opacity: 0, rotation: -180, scale: 0 });

    // 1. Grid fades in like a blueprint
    tl.to('.grid-bg', { opacity: 0.4, duration: 1, ease: 'power2.inOut' })
      
      // 2. Icon & Text Phase 1
      .to('.icon-1', { opacity: 1, rotation: 0, scale: 1, duration: 0.8, ease: 'back.out(1.7)' })
      .to('.text-1', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '<0.2')
      
      // 3. Draw Blueprint Lines (Horizontal)
      .to('.blueprint-line', { scaleX: 1, duration: 1.5, stagger: 0.1, ease: 'power4.inOut' })
      
      // Clear Phase 1
      .to(['.text-1', '.icon-1'], { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' }, '+=0.2')
      
      // 4. Icon & Text Phase 2
      .to('.icon-2', { opacity: 1, rotation: 0, scale: 1, duration: 0.8, ease: 'back.out(1.7)' })
      .to('.text-2', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '<0.2')
      
      // 5. Crane & Extrusion (Vertical Columns)
      .to('.crane', { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }, '<')
      .to('.blueprint-col', { scaleY: 1, duration: 1.2, stagger: 0.1, ease: 'elastic.out(1, 0.5)' })
      
      // Clear Phase 2
      .to(['.text-2', '.icon-2', '.crane'], { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' }, '+=0.4')
      
      // 6. Final Welcome Text
      .to('.icon-3', { opacity: 1, rotation: 0, scale: 1, duration: 0.8, ease: 'back.out(1.7)' })
      .to('.text-3', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '<0.2')
      
      // 7. Fade everything out for transition
      .to('.anim-container', { opacity: 0, duration: 0.6, ease: 'power2.inOut', delay: 1.2 });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="w-screen h-screen bg-[#09090b] flex flex-col items-center justify-center overflow-hidden font-sans text-white relative">
      
      {/* Background Blueprint Grid */}
      <div className="grid-bg absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#3f3f46 1px, transparent 1px), linear-gradient(90deg, #3f3f46 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
      
      {/* Graphic Container (Blueprint & Construction) */}
      <div className="anim-container relative w-full max-w-4xl h-80 flex items-end justify-center mb-12 z-10">
        
        {/* Crane Graphic */}
        <div className="crane absolute top-0 right-20 w-32 h-64 border-r-4 border-t-4 border-yellow-500 rounded-tr-xl opacity-0">
          <div className="absolute top-0 -left-16 w-16 h-1 bg-yellow-500"></div>
          <div className="absolute top-1 -left-12 w-0.5 h-16 bg-zinc-400"></div>
        </div>

        {/* Horizontal Blueprint Lines */}
        <div className="blueprint-line absolute bottom-0 left-0 right-0 h-1 bg-zinc-100"></div>
        <div className="blueprint-line absolute bottom-12 left-10 right-10 h-0.5 bg-zinc-500"></div>
        <div className="blueprint-line absolute bottom-24 left-20 right-20 h-0.5 bg-zinc-500"></div>
        <div className="blueprint-line absolute bottom-36 left-32 right-32 h-0.5 bg-zinc-500"></div>
        
        {/* Vertical Buildings/Columns */}
        <div className="blueprint-col absolute bottom-0 left-[15%] w-16 h-48 bg-zinc-900 border-2 border-zinc-400"></div>
        <div className="blueprint-col absolute bottom-0 left-[30%] w-24 h-64 bg-zinc-800 border-2 border-zinc-300"></div>
        <div className="blueprint-col absolute bottom-0 left-[50%] w-20 h-40 bg-zinc-900 border-2 border-zinc-500"></div>
        <div className="blueprint-col absolute bottom-0 right-[25%] w-32 h-72 bg-white border-2 border-zinc-200"></div>
      </div>

      {/* Text Layers */}
      <div className="relative h-20 flex flex-col items-center justify-center text-center anim-container w-full z-20">
        <div className="absolute flex flex-col items-center justify-center">
          <Ruler className="icon-spin icon-1 w-8 h-8 text-zinc-400 mb-4 absolute -top-10" />
          <h2 className="text-layer text-1 text-2xl md:text-3xl font-semibold tracking-wide text-zinc-400">Drafting Blueprint Vectors...</h2>
        </div>
        <div className="absolute flex flex-col items-center justify-center">
          <Hammer className="icon-spin icon-2 w-8 h-8 text-yellow-500 mb-4 absolute -top-10" />
          <h2 className="text-layer text-2 text-2xl md:text-3xl font-semibold tracking-wide text-zinc-300">Extruding 3D Geometry...</h2>
        </div>
        <div className="absolute flex flex-col items-center justify-center">
          <ScanLine className="icon-spin icon-3 w-10 h-10 text-white mb-4 absolute -top-12" />
          <h2 className="text-layer text-3 text-4xl md:text-5xl font-bold tracking-tight text-white">Welcome to Arch-E-Tech.</h2>
        </div>
      </div>
    </div>
  );
}

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function OnboardingCinematic() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useGSAP(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        // Automatically navigate to the dashboard once the cinematic finishes
        navigate('/dashboard');
      }
    });

    // Setup initial states
    gsap.set('.text-layer', { opacity: 0, y: 20 });
    gsap.set('.line-h', { scaleX: 0, transformOrigin: 'center' });
    gsap.set('.line-v', { scaleY: 0, transformOrigin: 'bottom' });
    gsap.set('.grid-bg', { opacity: 0 });

    // 1. Fade in the grid
    tl.to('.grid-bg', { opacity: 0.3, duration: 1, ease: 'power2.inOut' })
      
      // 2. First text phase
      .to('.text-1', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
      .to('.text-1', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.in', delay: 0.5 })
      
      // 3. Draw Foundation (Horizontal Line)
      .to('.line-h', { scaleX: 1, duration: 1, ease: 'expo.out' })
      .to('.text-2', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '<')
      
      // 4. Draw Buildings/Graphs (Vertical Lines)
      .to('.line-v', { scaleY: 1, duration: 1, stagger: 0.1, ease: 'expo.out' })
      .to('.text-2', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.in', delay: 0.5 })
      
      // 5. Final Welcome Text
      .to('.text-3', { opacity: 1, y: 0, duration: 1, ease: 'power3.out' })
      
      // 6. Fade everything out for a smooth transition to the dashboard
      .to('.anim-container', { opacity: 0, duration: 0.8, ease: 'power2.inOut', delay: 1.5 });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans text-white relative">
      
      {/* Background Architectural Grid */}
      <div className="grid-bg absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      {/* Graphic Container (Abstract Buildings) */}
      <div className="anim-container relative w-full max-w-4xl h-64 flex items-end justify-center mb-16">
        {/* Horizontal Foundation Line */}
        <div className="line-h absolute bottom-0 left-4 right-4 h-1 bg-white z-20"></div>
        
        {/* Vertical Buildings/Columns */}
        <div className="line-v absolute bottom-1 left-[10%] w-16 h-32 bg-zinc-900 border border-zinc-700 z-10"></div>
        <div className="line-v absolute bottom-1 left-[25%] w-20 h-56 bg-zinc-800 border border-zinc-600 z-10"></div>
        <div className="line-v absolute bottom-1 left-[42%] w-24 h-40 bg-zinc-900 border border-zinc-700 z-10"></div>
        <div className="line-v absolute bottom-1 right-[35%] w-20 h-64 bg-white border border-zinc-300 z-10"></div>
        <div className="line-v absolute bottom-1 right-[20%] w-16 h-48 bg-zinc-800 border border-zinc-600 z-10"></div>
        <div className="line-v absolute bottom-1 right-[8%] w-12 h-24 bg-zinc-900 border border-zinc-700 z-10"></div>
      </div>

      {/* Text Layers */}
      <div className="relative h-12 flex items-center justify-center text-center anim-container w-full">
        <h2 className="text-layer text-1 absolute text-2xl md:text-3xl font-medium tracking-wide text-zinc-400">Initializing AI Inference Engine...</h2>
        <h2 className="text-layer text-2 absolute text-2xl md:text-3xl font-medium tracking-wide text-zinc-300">Constructing Vector Workspace...</h2>
        <h2 className="text-layer text-3 absolute text-4xl md:text-5xl font-bold tracking-tight text-white">Welcome to Arch-E-Tech.</h2>
      </div>
    </div>
  );
}

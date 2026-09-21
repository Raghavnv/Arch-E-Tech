import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ScanLine, PenTool, Box, AlertTriangle, Calculator, Code2, Layers, Zap, Sun, FileText, Magnet, LayoutTemplate, MessageSquare, Image as ImageIcon } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const containerRef = useRef(null);
  
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Hero entrance
      gsap.from('.hero-elem', {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.1
      });

      // Features stagger reveal
      gsap.fromTo('.feature-card', 
        { y: 50, opacity: 0 },
        {
          scrollTrigger: {
            trigger: '#features',
            start: 'top 90%',
          },
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power2.out'
        }
      );

      // Docs section reveal
      gsap.fromTo('.tech-step', 
        { opacity: 0, y: 40, scale: 0.95 },
        {
          scrollTrigger: {
            trigger: '#technology',
            start: 'top 80%',
          },
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: 'back.out(1.2)'
        }
      );
    });
  }, { scope: containerRef });

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      icon: <ScanLine className="w-6 h-6 text-white" />,
      title: "AI Floor Plan Generation",
      description: "Transform raw sketches or text prompts into fully editable 2D layouts instantly using our advanced AI engine.",
      span: "md:col-span-2 lg:col-span-2"
    },
    {
      icon: <PenTool className="w-6 h-6 text-white" />,
      title: "Interactive Smart Canvas",
      description: "Drag, drop, and edit layouts with a powerful vector editor that automatically snaps walls to perfect angles.",
      span: "md:col-span-1 lg:col-span-1"
    },
    {
      icon: <Box className="w-6 h-6 text-white" />,
      title: "Instant 3D Extrusion",
      description: "Watch your 2D plans seamlessly rise into interactive 3D meshes, complete with stunning conceptual renders.",
      span: "md:col-span-1 lg:col-span-1"
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-white" />,
      title: "Structural Clash Detection",
      description: "Automatically identify overlapping structures and verify door or window swing clearances before construction begins.",
      span: "md:col-span-2 lg:col-span-2"
    },
    {
      icon: <Calculator className="w-6 h-6 text-white" />,
      title: "Live Cost Estimation",
      description: "As you edit your canvas, surface areas and material volumes dynamically update to provide real-time project cost estimates.",
      span: "md:col-span-2 lg:col-span-2"
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-white" />,
      title: "Compliance & Reporting",
      description: "Chat with an AI assistant to verify building code compliance, and export your entire project into a comprehensive PDF report.",
      span: "md:col-span-1 lg:col-span-1"
    }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-zinc-800">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-6 h-6 bg-white rounded-sm mix-blend-difference"></div>
          <span className="font-bold text-white tracking-tight text-lg">Arch-E-Tech</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => scrollToSection('features')} className="text-sm font-medium hover:text-white transition-colors">Features</button>
          <button onClick={() => scrollToSection('technology')} className="text-sm font-medium hover:text-white transition-colors">Our Technology</button>
          <Link 
            to="/auth" 
            className="text-sm font-medium text-black bg-white px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
          >
            Launch Platform
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="px-6 max-w-7xl mx-auto min-h-[75vh] flex flex-col justify-center">
          <div className="text-center max-w-4xl mx-auto mb-32 mt-16">
            <div className="hero-elem inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span className="text-xs font-medium text-zinc-300 uppercase tracking-widest">Platform v2.0 Live</span>
            </div>
            <h1 className="hero-elem text-5xl md:text-7xl lg:text-[5rem] font-bold tracking-tighter text-white mb-8 leading-[1.05]">
              Architectural intelligence,<br />engineered for precision.
            </h1>
            <p className="hero-elem text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
              Transition from raw sketches to validated 3D models in seconds. Arch-E-Tech uses state-of-the-art AI and spatial algorithms to automate drafting, detect clashes, and estimate costs.
            </p>
            <div className="hero-elem flex items-center justify-center gap-4">
              <Link 
                to="/auth" 
                className="inline-flex items-center justify-center gap-2 bg-white text-black px-8 py-4 rounded-full font-medium hover:bg-zinc-200 transition-all"
              >
                Start designing <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="https://github.com/Raghavnv/Arch-E-Tech" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white border border-zinc-800 px-8 py-4 rounded-full font-medium hover:bg-zinc-800 transition-all"
              >
                <Code2 className="w-4 h-4" /> View Source
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-6 max-w-7xl mx-auto py-24 border-t border-zinc-900">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Computational Modules</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">Everything you need to move from ideation to structural validation, contained within a single unified workspace.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className={`feature-card p-8 rounded-3xl border border-zinc-800 hover:border-zinc-700 transition-all group overflow-hidden relative ${feature.span} ${
                  idx === 0 || idx === 3 ? 'bg-gradient-to-br from-zinc-900 to-black' : 'bg-zinc-900/50'
                }`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <div className="w-14 h-14 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm max-w-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Technology / Architecture Section */}
        <section id="technology" className="px-6 max-w-7xl mx-auto py-32 border-t border-zinc-900">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">How Arch-E-Tech Works</h2>
            <p className="text-zinc-400 text-lg">Our proprietary architecture bridges the gap between natural language, computer vision, and exact mathematical rendering.</p>
          </div>

          <div className="docs-section relative max-w-5xl mx-auto">
            {/* Connection Line Background */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-800 -translate-y-1/2 hidden md:block z-0"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              
              {/* Step 1 */}
              <div className="tech-step flex flex-col items-center text-center bg-black p-6 rounded-2xl border border-zinc-800 hover:border-white/50 transition-colors">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Step 01</span>
                <h4 className="text-lg font-bold text-white mb-2">Input Layer</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Provide a text prompt or upload a raw floor plan sketch.
                </p>
              </div>

              {/* Step 2 */}
              <div className="tech-step flex flex-col items-center text-center bg-black p-6 rounded-2xl border border-zinc-800 hover:border-white/50 transition-colors">
                <div className="w-16 h-16 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                  <Zap className="w-6 h-6 text-indigo-300" />
                </div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Step 02</span>
                <h4 className="text-lg font-bold text-white mb-2">AI Processing</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Google Gemini 1.5 Pro & YOLOv11 extract spatial mathematics and logic.
                </p>
              </div>

              {/* Step 3 */}
              <div className="tech-step flex flex-col items-center text-center bg-black p-6 rounded-2xl border border-zinc-800 hover:border-white/50 transition-colors">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Step 03</span>
                <h4 className="text-lg font-bold text-white mb-2">2D Vector Array</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Fabric.js translates the AI schema into an editable, interactive grid.
                </p>
              </div>

              {/* Step 4 */}
              <div className="tech-step flex flex-col items-center text-center bg-black p-6 rounded-2xl border border-zinc-800 hover:border-white/50 transition-colors">
                <div className="w-16 h-16 rounded-full bg-emerald-900 border border-emerald-700 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <Box className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Step 04</span>
                <h4 className="text-lg font-bold text-white mb-2">3D Extrusion</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Three.js procedurally generates photorealistic 3D meshes in real-time.
                </p>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-zinc-700 rounded-sm"></div>
            <span className="font-semibold text-zinc-400">Arch-E-Tech</span>
          </div>
          <div>© {new Date().getFullYear()} Arch-E-Tech. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

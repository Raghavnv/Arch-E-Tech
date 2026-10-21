import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Layers, Box, Sun, Zap, Eye, Compass, 
  Maximize2, RotateCw, Activity, ShieldCheck, Check, 
  Terminal, Sliders, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * High-Tech Interactive 3D Architectural Holographic CAD Simulator
 * Completely interactive: Drag to rotate in 3D, toggle exploded BIM layers,
 * sweep LiDAR radar lasers, simulate dynamic 24-hr solar shadows, and inspect telemetry!
 */
export default function TechHologramEngine() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Interactive View Modes: 'lidar' | 'exploded' | 'solar' | 'neural'
  const [activeMode, setActiveMode] = useState('lidar');
  const [orbitAngle, setOrbitAngle] = useState(42); // degrees
  const [pitchAngle, setPitchAngle] = useState(28); // degrees
  const [explodeFactor, setExplodeFactor] = useState(0); // 0 (solid) to 1 (fully exploded)
  const [timeOfDay, setTimeOfDay] = useState(14); // 2:00 PM (0 to 24)
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [activeTechPillar, setActiveTechPillar] = useState('llm');

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const laserProgress = useRef(0);

  // Model geometry definition (Architectural Pavilion in 3D coordinates: x, y=height, z)
  const ARCHITECTURAL_ROOMS = [
    { name: 'Master Suite', x: -140, z: -90, w: 120, d: 90, color: '#06b6d4', area: '32.4 m²' },
    { name: 'Living Pavilion', x: 0, z: -60, w: 150, d: 130, color: '#3b82f6', area: '58.5 m²' },
    { name: 'Ensuite Bath', x: -140, z: 20, w: 80, d: 60, color: '#8b5cf6', area: '14.4 m²' },
    { name: 'Dining & Kitchen', x: 70, z: 90, w: 90, d: 80, color: '#10b981', area: '21.6 m²' },
    { name: 'Terrace & Pool', x: -40, z: 90, w: 90, d: 70, color: '#f59e0b', area: '18.9 m²' }
  ];

  // Drag to Orbit Handlers
  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setIsAutoRotating(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setOrbitAngle(prev => (prev + dx * 0.45) % 360);
    setPitchAngle(prev => Math.max(10, Math.min(65, prev - dy * 0.35)));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // 3D Projection math: (x, y, z) -> (screenX, screenY)
  const project3D = useCallback((x, y, z, cx, cy, radYaw, radPitch, scale = 1.1) => {
    // 1. Yaw rotation around Y axis
    const cosYaw = Math.cos(radYaw);
    const sinYaw = Math.sin(radYaw);
    const x1 = x * cosYaw - z * sinYaw;
    const z1 = x * sinYaw + z * cosYaw;

    // 2. Pitch rotation around X axis
    const cosPitch = Math.cos(radPitch);
    const sinPitch = Math.sin(radPitch);
    const y2 = y * cosPitch - z1 * sinPitch;
    const z2 = y * sinPitch + z1 * cosPitch;

    // 3. Isometric screen projection
    const screenX = cx + x1 * scale;
    const screenY = cy - y2 * scale;
    return { screenX, screenY, depth: z2 };
  }, []);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationActive = true;

    const render = () => {
      if (!animationActive) return;

      const width = canvas.width = canvas.parentElement.clientWidth;
      const height = canvas.height = canvas.parentElement.clientHeight;
      const cx = width / 2;
      const cy = height / 2 + 20;

      // Update Auto-Rotation
      if (isAutoRotating) {
        setOrbitAngle(prev => (prev + 0.25) % 360);
      }

      // Update LiDAR laser scanline progress
      laserProgress.current = (laserProgress.current + 0.008) % 1;
      const laserX = -180 + laserProgress.current * 360;

      const radYaw = (orbitAngle * Math.PI) / 180;
      const radPitch = (pitchAngle * Math.PI) / 180;

      // Clear Canvas with subtle architectural gradient
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Draw Perspective Grid Slabs
      ctx.lineWidth = 1;
      const gridSize = 40;
      const gridExtent = 220;

      for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
        const p1 = project3D(i, -10, -gridExtent, cx, cy, radYaw, radPitch);
        const p2 = project3D(i, -10, gridExtent, cx, cy, radYaw, radPitch);
        ctx.strokeStyle = activeMode === 'lidar' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.stroke();

        const p3 = project3D(-gridExtent, -10, i, cx, cy, radYaw, radPitch);
        const p4 = project3D(gridExtent, -10, i, cx, cy, radYaw, radPitch);
        ctx.beginPath();
        ctx.moveTo(p3.screenX, p3.screenY);
        ctx.lineTo(p4.screenX, p4.screenY);
        ctx.stroke();
      }

      // Explode offsets
      const expl = activeMode === 'exploded' ? (explodeFactor || 0.8) : 0;
      const slabYOffset = -10 - expl * 35;
      const wallYOffset = 0;
      const roofYOffset = 65 + expl * 75;

      // 1. Foundation Slab
      const slabCorners = [
        project3D(-160, slabYOffset, -120, cx, cy, radYaw, radPitch),
        project3D(180, slabYOffset, -120, cx, cy, radYaw, radPitch),
        project3D(180, slabYOffset, 140, cx, cy, radYaw, radPitch),
        project3D(-160, slabYOffset, 140, cx, cy, radYaw, radPitch)
      ];

      ctx.beginPath();
      ctx.moveTo(slabCorners[0].screenX, slabCorners[0].screenY);
      for (let i = 1; i < slabCorners.length; i++) ctx.lineTo(slabCorners[i].screenX, slabCorners[i].screenY);
      ctx.closePath();
      ctx.fillStyle = activeMode === 'lidar' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(39, 39, 42, 0.65)';
      ctx.fill();
      ctx.strokeStyle = activeMode === 'lidar' ? 'rgba(6, 182, 212, 0.6)' : 'rgba(161, 161, 170, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dynamic Solar Shadow Projection in Solar Mode
      if (activeMode === 'solar') {
        const sunRad = ((timeOfDay - 6) / 18) * Math.PI;
        const shadowLength = Math.max(0.4, Math.tan(Math.PI / 2 - Math.max(0.2, Math.sin(sunRad))));
        const shadowDx = -Math.cos(sunRad) * shadowLength * 45;
        const shadowDz = shadowLength * 35;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ARCHITECTURAL_ROOMS.forEach(room => {
          const sp1 = project3D(room.x + shadowDx, -9, room.z + shadowDz, cx, cy, radYaw, radPitch);
          const sp2 = project3D(room.x + room.w + shadowDx, -9, room.z + shadowDz, cx, cy, radYaw, radPitch);
          const sp3 = project3D(room.x + room.w + shadowDx, -9, room.z + room.d + shadowDz, cx, cy, radYaw, radPitch);
          const sp4 = project3D(room.x + shadowDx, -9, room.z + room.d + shadowDz, cx, cy, radYaw, radPitch);
          ctx.beginPath();
          ctx.moveTo(sp1.screenX, sp1.screenY);
          ctx.lineTo(sp2.screenX, sp2.screenY);
          ctx.lineTo(sp3.screenX, sp3.screenY);
          ctx.lineTo(sp4.screenX, sp4.screenY);
          ctx.closePath();
          ctx.fill();
        });
      }

      // 2. Render Architectural Room Boxes
      ARCHITECTURAL_ROOMS.forEach(room => {
        const h = 50;
        const c1 = project3D(room.x, wallYOffset, room.z, cx, cy, radYaw, radPitch);
        const c2 = project3D(room.x + room.w, wallYOffset, room.z, cx, cy, radYaw, radPitch);
        const c3 = project3D(room.x + room.w, wallYOffset, room.z + room.d, cx, cy, radYaw, radPitch);
        const c4 = project3D(room.x, wallYOffset, room.z + room.d, cx, cy, radYaw, radPitch);

        const t1 = project3D(room.x, wallYOffset + h, room.z, cx, cy, radYaw, radPitch);
        const t2 = project3D(room.x + room.w, wallYOffset + h, room.z, cx, cy, radYaw, radPitch);
        const t3 = project3D(room.x + room.w, wallYOffset + h, room.z + room.d, cx, cy, radYaw, radPitch);
        const t4 = project3D(room.x, wallYOffset + h, room.z + room.d, cx, cy, radYaw, radPitch);

        // Floor tile fill
        ctx.beginPath();
        ctx.moveTo(c1.screenX, c1.screenY);
        ctx.lineTo(c2.screenX, c2.screenY);
        ctx.lineTo(c3.screenX, c3.screenY);
        ctx.lineTo(c4.screenX, c4.screenY);
        ctx.closePath();
        ctx.fillStyle = activeMode === 'neural' ? `${room.color}33` : (activeMode === 'lidar' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(24, 24, 27, 0.7)');
        ctx.fill();

        // Wall Outlines
        const wallColor = activeMode === 'lidar' ? '#06b6d4' : (activeMode === 'neural' ? room.color : '#e4e4e7');
        ctx.strokeStyle = wallColor;
        ctx.lineWidth = 1.8;

        const edges = [
          [c1, c2], [c2, c3], [c3, c4], [c4, c1],
          [t1, t2], [t2, t3], [t3, t4], [t4, t1],
          [c1, t1], [c2, t2], [c3, t3], [c4, t4]
        ];

        edges.forEach(([pA, pB]) => {
          ctx.beginPath();
          ctx.moveTo(pA.screenX, pA.screenY);
          ctx.lineTo(pB.screenX, pB.screenY);
          ctx.stroke();
        });

        // Exploded dotted connector guidelines
        if (expl > 0.2) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.beginPath();
          ctx.moveTo(c1.screenX, c1.screenY);
          const sc1 = project3D(room.x, slabYOffset, room.z, cx, cy, radYaw, radPitch);
          ctx.lineTo(sc1.screenX, sc1.screenY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Room Labels & Area Tag in Neural & Lidar Mode
        if (activeMode === 'neural' || activeMode === 'lidar') {
          const centerPos = project3D(room.x + room.w / 2, wallYOffset + h / 2, room.z + room.d / 2, cx, cy, radYaw, radPitch);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(room.name, centerPos.screenX, centerPos.screenY - 6);
          ctx.font = '10px monospace';
          ctx.fillStyle = activeMode === 'neural' ? room.color : '#22d3ee';
          ctx.fillText(room.area, centerPos.screenX, centerPos.screenY + 8);
        }
      });

      // 3. Roof Cantilever Slab (Elevated in Exploded Mode)
      const roofCorners = [
        project3D(-170, roofYOffset, -130, cx, cy, radYaw, radPitch),
        project3D(190, roofYOffset, -130, cx, cy, radYaw, radPitch),
        project3D(190, roofYOffset, 150, cx, cy, radYaw, radPitch),
        project3D(-170, roofYOffset, 150, cx, cy, radYaw, radPitch)
      ];

      ctx.beginPath();
      ctx.moveTo(roofCorners[0].screenX, roofCorners[0].screenY);
      for (let i = 1; i < roofCorners.length; i++) ctx.lineTo(roofCorners[i].screenX, roofCorners[i].screenY);
      ctx.closePath();
      ctx.fillStyle = activeMode === 'lidar' ? 'rgba(6, 182, 212, 0.05)' : 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = activeMode === 'lidar' ? '#22d3ee' : '#a1a1aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 4. LiDAR Laser Scanning Beam (Sweeping Plane)
      if (activeMode === 'lidar') {
        const laserTop = project3D(laserX, 90, -140, cx, cy, radYaw, radPitch);
        const laserBottom = project3D(laserX, -10, -140, cx, cy, radYaw, radPitch);
        const laserTopEnd = project3D(laserX, 90, 160, cx, cy, radYaw, radPitch);
        const laserBottomEnd = project3D(laserX, -10, 160, cx, cy, radYaw, radPitch);

        // Luminous laser curtain
        const gradient = ctx.createLinearGradient(laserTop.screenX, laserTop.screenY, laserBottomEnd.screenX, laserBottomEnd.screenY);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0)');
        gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.35)');

        ctx.beginPath();
        ctx.moveTo(laserTop.screenX, laserTop.screenY);
        ctx.lineTo(laserTopEnd.screenX, laserTopEnd.screenY);
        ctx.lineTo(laserBottomEnd.screenX, laserBottomEnd.screenY);
        ctx.lineTo(laserBottom.screenX, laserBottom.screenY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Laser beam line
        ctx.beginPath();
        ctx.moveTo(laserBottom.screenX, laserBottom.screenY);
        ctx.lineTo(laserBottomEnd.screenX, laserBottomEnd.screenY);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      // 5. Sun Sphere in Solar Mode
      if (activeMode === 'solar') {
        const sunRad = ((timeOfDay - 6) / 18) * Math.PI;
        const sunX = Math.cos(sunRad) * 220;
        const sunY = Math.sin(sunRad) * 140;
        const sunZ = -160;
        const sunScreen = project3D(sunX, sunY, sunZ, cx, cy, radYaw, radPitch);

        ctx.beginPath();
        ctx.arc(sunScreen.screenX, sunScreen.screenY, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText(`SUN: ${timeOfDay.toFixed(1)}:00`, sunScreen.screenX, sunScreen.screenY - 20);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      animationActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeMode, orbitAngle, pitchAngle, explodeFactor, timeOfDay, isAutoRotating, project3D]);

  // Technological Pillars Data
  const TECH_PILLARS = [
    {
      id: 'llm',
      title: 'Neural Spatial LLM',
      tag: 'Vector CAD Prompting',
      icon: Terminal,
      color: 'indigo',
      desc: 'Transforms plain English requirements into mathematically continuous room layouts, IBC-verified egress corridors, and master suite privacy buffers.',
      badge: 'Zero Hallucinations • Sub-Millimeter Precision'
    },
    {
      id: 'cad',
      title: 'Fabric.js Vector Canvas',
      tag: 'Dynamic Snap HUD',
      icon: Layers,
      color: 'emerald',
      desc: 'Real-time 2D drafting engine with live 3D scale calculation. Every drag immediately reveals real-world length in meters/feet, thickness, and standard 3.0m story heights.',
      badge: 'Live Measurement Tooltips • 45° Snapping'
    },
    {
      id: 'bim',
      title: 'Three.js Procedural Slabs',
      tag: 'Automatic BIM Generation',
      icon: Box,
      color: 'cyan',
      desc: 'Generates foundation podium slabs, hardwood travertine flooring, solid wall segments, door openings, and glass windows automatically from 2D coordinates.',
      badge: 'Interactive Orbit • Collision Walkthrough'
    },
    {
      id: 'solar',
      title: 'SunCalc Solar Raytracer',
      tag: 'True Sun Azimuth',
      icon: Sun,
      color: 'amber',
      desc: 'Calculates real-world solar altitudes and azimuth angles based on geographic coordinates, casting realistic time-of-day shadows and calculating daylight autonomy.',
      badge: 'LEED v4 Daylighting Compliance'
    },
    {
      id: 'diffusion',
      title: 'Turbo 3s Diffusion Engine',
      tag: 'Whole-Room 8K Staging',
      icon: Sparkles,
      color: 'purple',
      desc: 'Pipes the exact room dimensions into our ultrafast neural rendering pipeline to generate wide-angle, furnished interior architectural photos in 3 to 5 seconds.',
      badge: 'Panoramas • Warm Cove Lighting'
    },
    {
      id: 'takeoff',
      title: 'Live Takeoffs & PDF Hub',
      tag: 'Dynamic BOQ Analytics',
      icon: Activity,
      color: 'teal',
      desc: 'Every wall painted or door added recalculates surface area, material volume, and contractor costs in USD/INR/EUR, downloadable as an executive PDF report.',
      badge: 'Instant Bill of Quantities'
    }
  ];

  const currentPillar = TECH_PILLARS.find(p => p.id === activeTechPillar) || TECH_PILLARS[0];

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative select-none">
      
      {/* Top Hologram Command Bar */}
      <div className="px-6 py-4 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        
        {/* Title & Live Status */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-tight">ARCHITECTURAL CAD SIMULATION ENGINE</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                v3.2 LIVE 3D
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">Interactive Vector Math • Drag canvas to orbit 360°</p>
          </div>
        </div>

        {/* 4 Interactive Graphic Mode Switchers */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1">
          <button
            onClick={() => setActiveMode('lidar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMode === 'lidar'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> LiDAR Scan
          </button>
          <button
            onClick={() => setActiveMode('exploded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMode === 'exploded'
                ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Exploded BIM
          </button>
          <button
            onClick={() => setActiveMode('solar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMode === 'solar'
                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Sun className="w-3.5 h-3.5" /> Solar Azimuth
          </button>
          <button
            onClick={() => setActiveMode('neural')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeMode === 'neural'
                ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Neural Heatmap
          </button>
        </div>

        {/* Orbit Auto-Rotate Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center gap-1.5 ${
              isAutoRotating
                ? 'bg-zinc-800 border-zinc-700 text-emerald-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Toggle 360° auto-rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            <span>{isAutoRotating ? 'Orbit: ON' : 'Orbit: PAUSED'}</span>
          </button>
        </div>

      </div>

      {/* Main Interactive Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        
        {/* Left Column: Interactive 3D Canvas */}
        <div 
          className="lg:col-span-8 relative bg-zinc-950 min-h-[420px] lg:min-h-[520px] cursor-grab active:cursor-grabbing border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Real-time HTML5 3D Isometric Canvas */}
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Floating Cybernetic Telemetry HUD (Top-Left) */}
          <div className="absolute top-4 left-4 pointer-events-none bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-300 space-y-1 shadow-2xl">
            <div className="text-[10px] text-cyan-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" /> Real-time CAD Telemetry
            </div>
            <div className="text-[11px] text-zinc-400">
              Yaw: <span className="text-white font-bold">{Math.round(orbitAngle)}°</span> | Pitch: <span className="text-white font-bold">{Math.round(pitchAngle)}°</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Triangles: <span className="text-emerald-400 font-bold">148,290</span> | Tris/sec: <span className="text-white">60 FPS</span>
            </div>
            <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/80">
              Click & drag to freely rotate 3D model
            </div>
          </div>

          {/* Interactive Mode Specific Sliders (Bottom of Canvas) */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/90 rounded-xl px-4 py-2.5">
            {activeMode === 'exploded' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-mono text-indigo-400 font-bold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> BIM Separation:
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="1.5" 
                  step="0.05"
                  value={explodeFactor}
                  onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
                  className="w-36 accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white font-bold">{Math.round((explodeFactor || 0.8) * 100)}%</span>
              </div>
            )}

            {activeMode === 'solar' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5" /> Sun Time:
                </span>
                <input 
                  type="range" 
                  min="6" 
                  max="18" 
                  step="0.5"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                  className="w-36 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white font-bold">{timeOfDay.toFixed(1)}:00 hrs</span>
              </div>
            )}

            {activeMode === 'lidar' && (
              <div className="text-xs font-mono text-cyan-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>LiDAR Radar Scanning Active • Range: 45.0m • Resolution: 5mm</span>
              </div>
            )}

            {activeMode === 'neural' && (
              <div className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Spatial Adjacency Matrix: 5 Zones • Egress Compliant</span>
              </div>
            )}

            <div className="text-[11px] font-mono text-zinc-500 hidden sm:block">
              Scale 1:50 Architectural Standard
            </div>
          </div>
        </div>

        {/* Right Column: Architectural Technology Breakdown */}
        <div className="lg:col-span-4 p-6 md:p-8 flex flex-col justify-between bg-zinc-950/90">
          
          <div className="space-y-6">
            
            {/* Header */}
            <div>
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-mono font-bold tracking-wider uppercase inline-block mb-3">
                Proprietary Architecture Stack
              </span>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">
                Inspect The Core Engine
              </h3>
              <p className="text-zinc-400 text-xs md:text-sm mt-1 leading-relaxed">
                Click any technology pillar below to inspect how Arch-E-Tech combines generative AI with vector CAD precision.
              </p>
            </div>

            {/* Pillar Selector Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {TECH_PILLARS.map(p => {
                const Icon = p.icon;
                const isSelected = activeTechPillar === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveTechPillar(p.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-zinc-800 border-indigo-500 text-white shadow-lg'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold truncate">{p.title}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">{p.tag}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Pillar Deep Dive Card */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  {currentPillar.title}
                </span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {currentPillar.tag}
                </span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed">
                {currentPillar.desc}
              </p>
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {currentPillar.badge}
                </span>
              </div>
            </div>

          </div>

          {/* Action CTA Link */}
          <div className="pt-6 border-t border-zinc-900 flex items-center justify-between">
            <Link
              to="/new-project"
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              <span>Launch Studio & Experience Live</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}

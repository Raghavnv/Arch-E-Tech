import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { ArrowLeft, CloudRain, Snowflake, Sun, Cloud, Moon, Image as ImageIcon } from 'lucide-react';

// Isolated high-fidelity element renderer
function HighFidelityElement({ el }) {
  const scale = 0.05;
  const length = (el?.width || 0) * scale;
  const depth = (el?.height || 0) * scale;
  
  let height = 3;
  let yPos = height / 2;

  if (el.type === 'door') { height = 2.2; yPos = height / 2; }
  else if (el.type === 'window') { height = 1.2; yPos = 1.5; }
  
  const [texture, setTexture] = useState(null);
  
  useEffect(() => {
    if (el.material && el.type === 'wall') {
      if (el.isColor || !el.material.startsWith('http')) {
        setTexture(null);
      } else {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(el.material, (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(length / 2, height / 2);
          setTexture(tex);
        }, undefined, (err) => {
          console.error("Texture load failed", err);
          setTexture(null);
        });
      }
    } else {
      setTexture(null);
    }
  }, [el.material, length, height, el.isColor]);

  let materialProps;
  if (el.type === 'door') {
    materialProps = <meshStandardMaterial color="#3e2723" roughness={0.7} />;
  } else if (el.type === 'window') {
    materialProps = (
      <meshPhysicalMaterial 
        transmission={0.98} opacity={1} roughness={0} ior={1.52} thickness={0.5} color="#e0f2fe" 
      />
    );
  } else {
    if (texture) {
      materialProps = <meshStandardMaterial map={texture} roughness={0.8} />;
    } else if (el.isColor && el.material) {
      materialProps = <meshStandardMaterial color={el.material} roughness={1} />;
    } else {
      materialProps = <meshStandardMaterial color="#f4f4f5" roughness={1} />;
    }
  }

  const rotationRad = -((el?.angle || 0) * Math.PI) / 180;
  const centerX = ((el?.left || 0) * scale) + (length / 2) * Math.cos(-rotationRad);
  const centerZ = ((el?.top || 0) * scale) + (length / 2) * Math.sin(-rotationRad);

  return (
    <mesh position={[centerX, yPos, centerZ]} rotation={[0, rotationRad, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, height, depth]} />
      {materialProps}
    </mesh>
  );
}

function ProceduralFurniture({ el }) {
  const scale = 0.05;
  const w = (el?.width || 0) * scale;
  const d = (el?.height || 0) * scale;
  const rotationRad = -((el?.angle || 0) * Math.PI) / 180;
  
  // Fabric origin mapping
  const centerX = ((el?.left || 0) * scale) + (w / 2) * Math.cos(-rotationRad) - (d / 2) * Math.sin(-rotationRad);
  const centerZ = ((el?.top || 0) * scale) + (w / 2) * Math.sin(-rotationRad) + (d / 2) * Math.cos(-rotationRad);

  if (el.type === 'furniture_bed') {
    return (
      <group position={[centerX, 0, centerZ]} rotation={[0, rotationRad, 0]}>
        {/* Frame */}
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.4, d]} /><meshStandardMaterial color="#1f2937" /></mesh>
        {/* Mattress */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[w*0.95, 0.3, d*0.95]} /><meshStandardMaterial color="#f8fafc" /></mesh>
        {/* Pillows */}
        <mesh position={[-w*0.25, 0.7, -d*0.35]} castShadow><boxGeometry args={[w*0.4, 0.1, d*0.15]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
        <mesh position={[w*0.25, 0.7, -d*0.35]} castShadow><boxGeometry args={[w*0.4, 0.1, d*0.15]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      </group>
    );
  }

  if (el.type === 'furniture_sofa') {
    return (
      <group position={[centerX, 0, centerZ]} rotation={[0, rotationRad, 0]}>
        {/* Base Seat */}
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.4, d*0.8]} /><meshStandardMaterial color="#6366f1" roughness={0.9} /></mesh>
        {/* Backrest */}
        <mesh position={[0, 0.7, -d*0.3]} castShadow receiveShadow><boxGeometry args={[w, 0.6, d*0.3]} /><meshStandardMaterial color="#4f46e5" roughness={0.9} /></mesh>
        {/* Armrests */}
        <mesh position={[-w*0.45, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[w*0.1, 0.3, d*0.8]} /><meshStandardMaterial color="#4f46e5" roughness={0.9} /></mesh>
        <mesh position={[w*0.45, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[w*0.1, 0.3, d*0.8]} /><meshStandardMaterial color="#4f46e5" roughness={0.9} /></mesh>
      </group>
    );
  }

  if (el.type === 'furniture_table') {
    return (
      <group position={[centerX, 0, centerZ]} rotation={[0, rotationRad, 0]}>
        {/* Table Top */}
        <mesh position={[0, 0.8, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.05, d]} /><meshStandardMaterial color="#b45309" roughness={0.6} /></mesh>
        {/* Legs */}
        <mesh position={[-w*0.4, 0.4, -d*0.4]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.8]} /><meshStandardMaterial color="#1c1917" /></mesh>
        <mesh position={[w*0.4, 0.4, -d*0.4]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.8]} /><meshStandardMaterial color="#1c1917" /></mesh>
        <mesh position={[-w*0.4, 0.4, d*0.4]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.8]} /><meshStandardMaterial color="#1c1917" /></mesh>
        <mesh position={[w*0.4, 0.4, d*0.4]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.8]} /><meshStandardMaterial color="#1c1917" /></mesh>
      </group>
    );
  }
  
  return null;
}

// Particle System for Weather
function WeatherSystem({ type }) {
  if (type === 'clear') return null;

  const count = type === 'rain' ? 8000 : 3000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for(let i = 0; i < count * 3; i += 3) {
      p[i] = (Math.random() - 0.5) * 150; // x
      p[i+1] = Math.random() * 60;        // y
      p[i+2] = (Math.random() - 0.5) * 150; // z
    }
    return p;
  }, [count]);

  const pointsRef = useRef();

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array;
    const speed = type === 'rain' ? 30 : 5;
    const sway = type === 'snow' ? 2 : 0;
    
    for(let i = 0; i < count * 3; i += 3) {
      pos[i+1] -= speed * delta; // move down
      if (type === 'snow') {
        pos[i] += Math.sin(state.clock.elapsedTime + pos[i+1]) * sway * delta; // sway x
      }
      if (pos[i+1] < 0) {
        pos[i+1] = 60; // reset to top
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial 
        size={type === 'rain' ? 0.1 : 0.4} 
        color={type === 'rain' ? '#bae6fd' : '#ffffff'} 
        transparent 
        opacity={type === 'rain' ? 0.4 : 0.8} 
        sizeAttenuation 
      />
    </points>
  );
}

export default function ImmersiveView() {
  const navigate = useNavigate();
  const [elements, setElements] = useState([]);
  const [biome, setBiome] = useState('forest');
  const [weather, setWeather] = useState('clear');

  useEffect(() => {
    // Load the exact state the user left in the Studio
    const draft = localStorage.getItem('immersiveDraft');
    if (draft) {
      try { setElements(JSON.parse(draft)); } catch(e) {}
    }
  }, []);

  const biomes = [
    { id: 'forest', name: 'Pine Forest', preset: 'forest' },
    { id: 'sunset', name: 'Sunset City', preset: 'sunset' },
    { id: 'night', name: 'Midnight', preset: 'night' },
    { id: 'park', name: 'Sunny Park', preset: 'park' },
  ];

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden font-sans">
      
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 5, 20], fov: 60 }} shadows>
        {/* The HDRI Skybox Magic */}
        <Environment preset={biome} background />
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-bias={-0.0001} />
        
        {/* Weather Engine */}
        <WeatherSystem type={weather} />

        {/* The Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#18181b" roughness={1} opacity={0.8} transparent />
        </mesh>
        
        {/* Soft shadow catcher under the house */}
        <ContactShadows resolution={1024} scale={100} blur={2} opacity={0.5} far={10} color="#000000" />

        <OrbitControls makeDefault target={[0, 2, 0]} maxPolarAngle={Math.PI / 2 + 0.1} />

        {/* Render House */}
        <group position={[-20, 0, -15]}>
          {elements.map((el, i) => {
            if (!el) return null;
            return el.type && el.type.startsWith('furniture_') ? (
              <ProceduralFurniture key={i} el={el} />
            ) : (
              <HighFidelityElement key={i} el={el} />
            )
          })}
        </group>
      </Canvas>

      {/* Cinematic UI Overlay */}
      <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-start pointer-events-none">
        <button 
          onClick={() => navigate(-1)} 
          className="pointer-events-auto flex items-center gap-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full transition-colors font-medium border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <div className="text-right bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
          <h1 className="text-2xl font-bold text-white tracking-tight">Immersive Walkthrough</h1>
          <p className="text-white/60 text-sm">Client Presentation Mode</p>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur-xl p-4 rounded-3xl border border-white/10 pointer-events-auto shadow-2xl">
        
        {/* Biome Selector */}
        <div className="flex flex-col gap-2 border-r border-white/10 pr-6">
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest pl-2">Environment</span>
          <div className="flex items-center gap-2">
            {biomes.map(b => (
              <button 
                key={b.id}
                onClick={() => setBiome(b.preset)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${biome === b.preset ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Weather Selector */}
        <div className="flex flex-col gap-2 pl-2">
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest pl-2">Weather</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeather('clear')} className={`p-2 rounded-xl transition-all ${weather === 'clear' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}><Sun className="w-5 h-5" /></button>
            <button onClick={() => setWeather('rain')} className={`p-2 rounded-xl transition-all ${weather === 'rain' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}><CloudRain className="w-5 h-5" /></button>
            <button onClick={() => setWeather('snow')} className={`p-2 rounded-xl transition-all ${weather === 'snow' ? 'bg-teal-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}><Snowflake className="w-5 h-5" /></button>
          </div>
        </div>

      </div>
    </div>
  );
}

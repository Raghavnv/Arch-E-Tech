import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as SunCalc from 'suncalc';

function ExtrudedElement({ el, onPaint }) {
  // Scale factor to convert pixel units to 3D space units
  const scale = 0.05;
  const length = el.width * scale;
  const depth = el.height * scale;
  
  // Height configurations based on element type
  let height = 3; // default wall height (approx 3m)
  let yPos = height / 2;

  if (el.type === 'door') {
    height = 2.2; 
    yPos = height / 2;
  } else if (el.type === 'window') {
    height = 1.2; 
    yPos = 1.5; // Raised off the ground
  } else if (el.type === 'stairs') {
    height = 0.5;
    yPos = height / 2;
  }

  // Handle Texture Loading dynamically without Suspense crashes
  const [texture, setTexture] = useState(null);
  
  useEffect(() => {
    if (el.material && el.type === 'wall') {
      const loader = new THREE.TextureLoader();
      loader.load(el.material, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(length / 2, height / 2); // Dynamic scaling based on wall size
        setTexture(tex);
      });
    } else {
      setTexture(null);
    }
  }, [el.material, length, height]);

  let materialProps;
  if (el.type === 'door') {
    materialProps = <meshStandardMaterial color="#78350f" roughness={0.9} />;
  } else if (el.type === 'window') {
    materialProps = (
      <meshPhysicalMaterial 
        transmission={0.95} 
        opacity={1} 
        roughness={0.05} 
        ior={1.5} 
        thickness={0.5} 
        color="#e0f2fe" 
      />
    );
  } else if (el.type === 'stairs') {
    materialProps = <meshStandardMaterial color="#52525b" roughness={0.8} metalness={0.2} />;
  } else {
    // Wall (Textured or Matte)
    if (texture) {
      materialProps = <meshStandardMaterial map={texture} roughness={0.7} />;
    } else {
      materialProps = <meshStandardMaterial color="#fafafa" roughness={1} />;
    }
  }

  // Convert Fabric.js origin (left-center) to Three.js origin (center-center)
  const rotationRad = -(el.angle * Math.PI) / 180; // Fabric rotation is inverted in 3D Z-plane
  const centerX = (el.left * scale) + (length / 2) * Math.cos(-rotationRad);
  const centerZ = (el.top * scale) + (length / 2) * Math.sin(-rotationRad);

  return (
    <mesh 
      position={[centerX, yPos, centerZ]} 
      rotation={[0, rotationRad, 0]} 
      castShadow 
      receiveShadow
      onClick={(e) => {
        if (el.type === 'wall') {
          e.stopPropagation();
          onPaint(el.id);
        }
      }}
    >
      <boxGeometry args={[length, height, depth]} />
      {materialProps}
    </mesh>
  );
}

function ProceduralFurniture({ el }) {
  const scale = 0.05;
  const w = el.width * scale;
  const d = el.height * scale;
  const rotationRad = -(el.angle * Math.PI) / 180;
  
  // Fabric origin mapping
  const centerX = (el.left * scale) + (w / 2) * Math.cos(-rotationRad) - (d / 2) * Math.sin(-rotationRad);
  const centerZ = (el.top * scale) + (w / 2) * Math.sin(-rotationRad) + (d / 2) * Math.cos(-rotationRad);

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

export default function Canvas3D({ elements = [], timeOfDay = 12, onPaint }) {
  // Use SunCalc to calculate sun position (using Bangalore, India coordinates)
  const date = new Date();
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  date.setHours(hours, minutes, 0, 0);

  const sunPos = SunCalc.getPosition(date, 12.9716, 77.5946);
  
  // Convert spherical (azimuth/altitude) to Cartesian (x,y,z) for directional light
  const distance = 50;
  // Note: SunCalc azimuth is 0 at South, moving clockwise. 
  // Three.js Y is up, X is right, Z is forward.
  const x = distance * Math.cos(sunPos.altitude) * Math.sin(sunPos.azimuth);
  const y = distance * Math.sin(sunPos.altitude);
  const z = distance * Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth);
  
  // Determine if it's night time
  const intensity = sunPos.altitude > 0 ? 1.5 : 0;
  
  return (
    <div className="absolute inset-0 bg-zinc-950">
      <Canvas camera={{ position: [0, 20, 20], fov: 50 }} shadows>
        <color attach="background" args={['#09090b']} />
        
        <ambientLight intensity={sunPos.altitude > 0 ? 0.4 : 0.1} />
        
        {sunPos.altitude > 0 && (
          <directionalLight 
            position={[x, y, z]} 
            intensity={intensity} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
          />
        )}
        <Environment preset={sunPos.altitude > 0 ? "city" : "night"} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <shadowMaterial transparent opacity={0.4} />
        </mesh>

        <Grid 
          infiniteGrid 
          fadeDistance={100} 
          sectionColor="#3f3f46" 
          cellColor="#18181b" 
          sectionSize={2} 
          cellSize={0.5}
        />
        
        <OrbitControls makeDefault />

        {/* Dynamically extrude all 2D elements */}
        {elements.map((el, i) => (
          el.type.startsWith('furniture_') ? (
            <ProceduralFurniture key={i} el={el} />
          ) : (
            <ExtrudedElement key={i} el={el} onPaint={onPaint} />
          )
        ))}
        
      </Canvas>
    </div>
  );
}

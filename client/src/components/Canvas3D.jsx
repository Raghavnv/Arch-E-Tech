import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';

export default function Canvas3D() {
  return (
    <div className="absolute inset-0 bg-zinc-950">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows>
        <color attach="background" args={['#09090b']} />
        
        {/* Lighting setup for realistic architectural rendering */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        <Environment preset="city" />

        {/* Infinite Architectural Grid */}
        <Grid 
          infiniteGrid 
          fadeDistance={50} 
          sectionColor="#3f3f46" 
          cellColor="#18181b" 
          sectionSize={1} 
          cellSize={0.25}
        />
        
        <OrbitControls makeDefault />

        {/* Placeholder Extruded Wall (We will dynamically feed this from Canvas2D later) */}
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          {/* args: [width, height, depth] */}
          <boxGeometry args={[6, 3, 0.3]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.7} />
        </mesh>

        <mesh position={[-3.15, 1.5, 2]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 3, 0.3]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.7} />
        </mesh>
      </Canvas>
    </div>
  );
}

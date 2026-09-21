import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';

function ExtrudedElement({ el }) {
  // Scale factor to convert pixel units to 3D space units
  const scale = 0.05;
  const length = el.width * scale;
  const depth = el.height * scale;
  
  // Height configurations based on element type
  let height = 3; // default wall height (approx 3m)
  let yPos = height / 2;
  let material;

  if (el.type === 'door') {
    height = 2.2; 
    yPos = height / 2;
    material = <meshStandardMaterial color="#78350f" roughness={0.9} />; // Rich dark wood
  } else if (el.type === 'window') {
    height = 1.2; 
    yPos = 1.5; // Raised off the ground
    material = (
      <meshPhysicalMaterial 
        transmission={0.95} 
        opacity={1} 
        roughness={0.05} 
        ior={1.5} 
        thickness={0.5} 
        color="#e0f2fe" 
      />
    ); // Realistic architectural glass
  } else if (el.type === 'stairs') {
    height = 0.5;
    yPos = height / 2;
    material = <meshStandardMaterial color="#52525b" roughness={0.8} metalness={0.2} />; // Concrete/Steel
  } else {
    // Wall
    material = <meshStandardMaterial color="#fafafa" roughness={1} />; // Matte white plaster
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
    >
      <boxGeometry args={[length, height, depth]} />
      {material}
    </mesh>
  );
}

export default function Canvas3D({ elements = [] }) {
  return (
    <div className="absolute inset-0 bg-zinc-950">
      <Canvas camera={{ position: [0, 20, 20], fov: 50 }} shadows>
        <color attach="background" args={['#09090b']} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        />
        <Environment preset="city" />

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
          <ExtrudedElement key={i} el={el} />
        ))}
        
      </Canvas>
    </div>
  );
}

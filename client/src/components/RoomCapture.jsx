import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { HouseModel } from './Canvas3D';
import { cameraForRoom } from '../utils/roomCamera';

/*
 * A photo of one room taken inside the 3D house: the camera stands at eye level in the corner that
 * looks at the most windows and doors, with a wide real-estate lens, and the picture is taken once
 * the room has rendered. Used as the base picture that Photo Render furnishes, so the furnished room
 * is the actual room of this house.
 *
 *   <RoomCapture elements={plan} room={roomElement} withFurniture={false} onDone={dataUrl => …} onError={…} />
 *
 * Mount it while a capture is wanted; it renders off screen and calls onDone once.
 */
const W = 1024, H = 768;        // the render size Photo Render works at
const SETTLE_MS = 1200;         // wall textures are rasterised asynchronously; give them time

function Snap({ onShot }) {
  const { camera, gl, scene } = useThree();
  const started = useRef(null);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    started.current ??= performance.now();
    if (performance.now() - started.current < SETTLE_MS) return;
    done.current = true;
    gl.render(scene, camera);
    onShot(gl.domElement.toDataURL('image/jpeg', 0.9));
  });
  return null;
}

export default function RoomCapture({ elements, room, withFurniture = false, onDone, onError }) {
  const fired = useRef(false);
  // only this room's floor, drawn as the ground floor; furniture only when asked for
  const scene = useMemo(() => {
    const floor = room.floor || 1;
    return (elements || []).filter(e => e && e.type && (e.floor || 1) === floor)
      .filter(e => withFurniture || !e.type.startsWith('furniture_'))
      .map(e => ({ ...e, floor: 1 }));
  }, [elements, room, withFurniture]);
  const view = useMemo(() => cameraForRoom({ ...room, floor: 1 }, scene), [room, scene]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!fired.current) { fired.current = true; onError?.(new Error('The 3D view took too long to draw.')); }
    }, 20000);
    return () => clearTimeout(t);
  }, [onError]);

  const shot = (url) => {
    if (fired.current) return;
    fired.current = true;
    onDone(url);
  };

  return (
    <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
      <Canvas dpr={1} gl={{ preserveDrawingBuffer: true, antialias: true }} frameloop="always">
        <PerspectiveCamera makeDefault position={view.position} fov={view.fov} near={0.05} far={200} aspect={W / H}
          onUpdate={(c) => c.lookAt(...view.target)} />
        {/* a bright sky behind the windows, even daylight inside, the room's own ceiling light */}
        <color attach="background" args={['#dfe9f3']} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#ffffff', '#c9b89f', 0.75]} />
        <directionalLight position={[20, 30, 10]} intensity={0.6} />
        <HouseModel elements={scene} roofStyle="flat" isDay />
        <Snap onShot={shot} />
      </Canvas>
    </div>
  );
}

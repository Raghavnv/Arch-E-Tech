import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/*
 * Ceiling designs and light fittings, drawn for one room.
 *
 * A room element may carry `ceiling: { style, light, color }`:
 *   style  plain | cove | tray | coffered | wood | pop | beams
 *   light  flush | chandelier | pendant | spots | fan | ring | none
 *   color  the ceiling's paint (the gypsum / POP parts); wood stays wood
 * Everything is placed in the room's own box (x, z, w, d in metres; the ceiling is at `top`), so the
 * same pieces draw in the house, in the walkthrough, in photo captures and in the panel's preview.
 */
export const CEILING_STYLES = [
  { id: 'plain', name: 'Plain', desc: 'A flat painted ceiling', rate: 0 },
  { id: 'cove', name: 'False ceiling, cove light', desc: 'A gypsum drop round the edge with a hidden LED glow', rate: 95 },
  { id: 'tray', name: 'Tray ceiling', desc: 'Two stepped levels rising to the middle, lit from the step', rate: 120 },
  { id: 'coffered', name: 'Coffered', desc: 'A grid of deep panels, classic and formal', rate: 140 },
  { id: 'wood', name: 'Wooden slats', desc: 'Warm timber battens across the ceiling', rate: 160 },
  { id: 'pop', name: 'POP design, round', desc: 'A drop ceiling with a round lit recess over the centre', rate: 110 },
  { id: 'beams', name: 'Exposed beams', desc: 'Timber beams across the room', rate: 90 },
];
export const LIGHT_TYPES = [
  { id: 'flush', name: 'Flush light', desc: 'A simple round ceiling light', price: 40 },
  { id: 'chandelier', name: 'Chandelier', desc: 'A ring of candle lights on a drop', price: 450 },
  { id: 'pendant', name: 'Pendants', desc: 'A row of hanging lights, over a table or island', price: 260 },
  { id: 'spots', name: 'Recessed spots', desc: 'Downlights in a grid', price: 160 },
  { id: 'fan', name: 'Fan with light', desc: 'A ceiling fan with a light kit', price: 180 },
  { id: 'ring', name: 'LED ring', desc: 'A modern floating ring of light', price: 220 },
  { id: 'none', name: 'No ceiling light', desc: 'Lamps only', price: 0 },
];
export const CEILING_COLOURS = [['White', '#f3f1ed'], ['Warm white', '#efe6d6'], ['Pale grey', '#dcdad6'], ['Sky', '#dde8f0'], ['Charcoal', '#3a3a3c']];

const WOOD = '#9a6a3f', WOOD_DARK = '#6b4528', GLOW = '#ffd9a0';
const glowMat = (on, k = 1) => ({ color: '#fff3df', emissive: GLOW, emissiveIntensity: (on ? 0.7 : 2.4) * k, toneMapped: false });

function Slab({ x, z, w, d, y, t = 0.06, color }) {
  if (w <= 0.01 || d <= 0.01) return null;
  return (
    <mesh position={[x + w / 2, y, z + d / 2]} receiveShadow>
      <boxGeometry args={[w, t, d]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

/** A frame of four bands round a rectangle (the drop of a false ceiling), `band` wide. */
function Frame({ x, z, w, d, band, y, t, color }) {
  return (
    <>
      <Slab x={x} z={z} w={w} d={band} y={y} t={t} color={color} />
      <Slab x={x} z={z + d - band} w={w} d={band} y={y} t={t} color={color} />
      <Slab x={x} z={z + band} w={band} d={d - 2 * band} y={y} t={t} color={color} />
      <Slab x={x + w - band} z={z + band} w={band} d={d - 2 * band} y={y} t={t} color={color} />
    </>
  );
}

/** A thin glowing strip round a rectangle: the LED hidden in a cove. */
function GlowLoop({ x, z, w, d, y, day }) {
  const s = 0.025;
  return (
    <group>
      {[[x, z, w, s], [x, z + d - s, w, s], [x, z, s, d], [x + w - s, z, s, d]].map(([a, b, ww, dd], i) => (
        <mesh key={i} position={[a + ww / 2, y, b + dd / 2]}>
          <boxGeometry args={[ww, 0.02, dd]} />
          <meshStandardMaterial {...glowMat(day, 1.2)} />
        </mesh>
      ))}
    </group>
  );
}

function holesOverlap(rect, holes) {
  return holes.some(h => h.x < rect.x + rect.w && rect.x < h.x + h.w && h.z < rect.z + rect.d && rect.z < h.z + h.d);
}

/** The ceiling of one room in its chosen design. `top` is the underside of the slab above. */
export function RoomCeiling({ rect, style = 'plain', color = '#f3f1ed', top, day, holes = [] }) {
  const { x, z, w, d } = rect;
  if (style === 'plain' || holesOverlap(rect, holes)) {
    return <Slab x={x} z={z} w={w} d={d} y={top + 0.04} t={0.08} color={color} />;
  }
  const base = <Slab x={x} z={z} w={w} d={d} y={top + 0.04} t={0.08} color={style === 'wood' || style === 'beams' ? '#efe8dc' : color} />;
  const band = Math.min(0.7, Math.min(w, d) * 0.2);
  if (style === 'cove') {
    const drop = 0.28;
    return (
      <group>
        {base}
        <Frame x={x} z={z} w={w} d={d} band={band} y={top - drop} t={0.1} color={color} />
        {/* the upturned lip that hides the LED, and the LED itself */}
        <Frame x={x + band - 0.06} z={z + band - 0.06} w={w - 2 * band + 0.12} d={d - 2 * band + 0.12} band={0.06} y={top - drop + 0.1} t={0.12} color={color} />
        <GlowLoop x={x + band - 0.03} z={z + band - 0.03} w={w - 2 * band + 0.06} d={d - 2 * band + 0.06} y={top - drop + 0.17} day={day} />
      </group>
    );
  }
  if (style === 'tray') {
    const b2 = band * 0.7;
    return (
      <group>
        {base}
        <Frame x={x} z={z} w={w} d={d} band={band} y={top - 0.32} t={0.1} color={color} />
        <Frame x={x + band} z={z + band} w={w - 2 * band} d={d - 2 * band} band={b2} y={top - 0.16} t={0.1} color={color} />
        <GlowLoop x={x + band + b2} z={z + band + b2} w={w - 2 * (band + b2)} d={d - 2 * (band + b2)} y={top - 0.1} day={day} />
        <GlowLoop x={x + band} z={z + band} w={w - 2 * band} d={d - 2 * band} y={top - 0.26} day={day} />
      </group>
    );
  }
  if (style === 'coffered') {
    const nx = Math.max(2, Math.round(w / 1.2)), nz = Math.max(2, Math.round(d / 1.2));
    const beams = [];
    for (let i = 0; i <= nx; i++) beams.push(<Slab key={`x${i}`} x={x + (i * w) / nx - 0.08} z={z} w={0.16} d={d} y={top - 0.1} t={0.2} color={color} />);
    for (let j = 0; j <= nz; j++) beams.push(<Slab key={`z${j}`} x={x} z={z + (j * d) / nz - 0.08} w={w} d={0.16} y={top - 0.1} t={0.2} color={color} />);
    return <group>{base}{beams}</group>;
  }
  if (style === 'wood') {
    const along = w >= d;                       // battens run along the long side
    const span = along ? d : w, n = Math.floor(span / 0.14);
    const slats = [];
    for (let i = 0; i < n; i++) {
      const o = 0.04 + i * 0.14;
      slats.push(along
        ? <mesh key={i} position={[x + w / 2, top - 0.06, z + o + 0.04]}><boxGeometry args={[w - 0.04, 0.05, 0.08]} /><meshStandardMaterial color={i % 3 ? WOOD : '#a47448'} roughness={0.6} /></mesh>
        : <mesh key={i} position={[x + o + 0.04, top - 0.06, z + d / 2]}><boxGeometry args={[0.08, 0.05, d - 0.04]} /><meshStandardMaterial color={i % 3 ? WOOD : '#a47448'} roughness={0.6} /></mesh>);
    }
    return <group><Slab x={x} z={z} w={w} d={d} y={top + 0.04} t={0.08} color="#2a2420" />{slats}</group>;
  }
  if (style === 'pop') {
    const r = Math.max(0.5, Math.min(w, d) / 2 - band * 0.6);
    return (
      <group>
        {base}
        {/* a drop ceiling with a round hole: drawn as the drop slab with a ring cut in it */}
        <PopDrop x={x} z={z} w={w} d={d} r={r} y={top - 0.25} color={color} />
        <mesh position={[x + w / 2, top - 0.17, z + d / 2]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[r - 0.04, 0.02, 8, 64]} />
          <meshStandardMaterial {...glowMat(day, 1.3)} />
        </mesh>
      </group>
    );
  }
  if (style === 'beams') {
    const along = w < d;                        // beams span the short way
    const span = along ? d : w, n = Math.max(2, Math.round(span / 1.0));
    const items = [];
    for (let i = 1; i < n; i++) {
      const o = (i * span) / n;
      items.push(along
        ? <mesh key={i} position={[x + w / 2, top - 0.11, z + o]} castShadow><boxGeometry args={[w, 0.22, 0.16]} /><meshStandardMaterial color={WOOD_DARK} roughness={0.7} /></mesh>
        : <mesh key={i} position={[x + o, top - 0.11, z + d / 2]} castShadow><boxGeometry args={[0.16, 0.22, d]} /><meshStandardMaterial color={WOOD_DARK} roughness={0.7} /></mesh>);
    }
    return <group>{base}{items}</group>;
  }
  return base;
}

function PopDrop({ x, z, w, d, r, y, color }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(Math.PI / 2);
    return g;
  }, [w, d, r]);
  return (
    <mesh geometry={geo} position={[x + w / 2, y + 0.1, z + d / 2]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ------------------------------------------------------------------------------------------------
// Light fittings
// ------------------------------------------------------------------------------------------------
function Bulb({ position, r = 0.05, day, k = 1 }) {
  return <mesh position={position}><sphereGeometry args={[r, 12, 10]} /><meshStandardMaterial {...glowMat(day, k)} /></mesh>;
}

function Chandelier({ y, size, day }) {
  const R = Math.min(0.55, size * 0.16);
  const arms = 8;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.25, 0]}><cylinderGeometry args={[0.012, 0.012, 0.5, 6]} /><meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.1, 0.1, 0.03, 20]} /><meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, -0.55, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[R, 0.015, 8, 48]} /><meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, -0.62, 0]}><sphereGeometry args={[0.07, 16, 12]} /><meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} /></mesh>
      {Array.from({ length: arms }).map((_, i) => {
        const a = (i / arms) * Math.PI * 2, cx = Math.cos(a) * R, cz = Math.sin(a) * R;
        return (
          <group key={i}>
            <mesh position={[cx, -0.5, cz]}><cylinderGeometry args={[0.022, 0.026, 0.09, 10]} /><meshStandardMaterial color="#f6f0e4" /></mesh>
            <Bulb position={[cx, -0.42, cz]} r={0.03} day={day} k={1.4} />
            {/* a crystal drop under each arm */}
            <mesh position={[cx * 0.85, -0.68, cz * 0.85]}><octahedronGeometry args={[0.03]} /><meshPhysicalMaterial color="#ffffff" transmission={0.8} roughness={0.05} thickness={0.1} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function Pendants({ y, rect, day }) {
  const along = rect.w >= rect.d, L = (along ? rect.w : rect.d) * 0.5, n = L > 1.6 ? 3 : 2;
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: n }).map((_, i) => {
        const o = -L / 2 + (L * i) / (n - 1);
        const [px, pz] = along ? [o, 0] : [0, o];
        return (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, -0.45, 0]}><cylinderGeometry args={[0.004, 0.004, 0.9, 4]} /><meshStandardMaterial color="#222" /></mesh>
            <mesh position={[0, -0.98, 0]}><coneGeometry args={[0.17, 0.2, 24, 1, true]} /><meshStandardMaterial color="#1f2a2a" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} /></mesh>
            <Bulb position={[0, -1.04, 0]} r={0.045} day={day} k={1.5} />
          </group>
        );
      })}
    </group>
  );
}

function Spots({ y, rect, day }) {
  const nx = Math.max(2, Math.round(rect.w / 1.3)), nz = Math.max(2, Math.round(rect.d / 1.3));
  const out = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const px = -rect.w / 2 + ((i + 0.5) * rect.w) / nx, pz = -rect.d / 2 + ((j + 0.5) * rect.d) / nz;
      out.push(
        <group key={`${i}-${j}`} position={[px, y - 0.005, pz]}>
          <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.075, 0.016, 6, 24]} /><meshStandardMaterial color="#d9d6d0" metalness={0.5} roughness={0.4} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}><circleGeometry args={[0.065, 24]} /><meshStandardMaterial {...glowMat(day, 2)} /></mesh>
        </group>,
      );
    }
  }
  return <group>{out}</group>;
}

function Fan({ y, day }) {
  const blades = useRef(null);
  useFrame((_, dt) => { if (blades.current) blades.current.rotation.y += dt * 2.2; });
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.12, 0]}><cylinderGeometry args={[0.02, 0.02, 0.24, 8]} /><meshStandardMaterial color="#5b4b3c" /></mesh>
      <mesh position={[0, -0.28, 0]}><cylinderGeometry args={[0.11, 0.13, 0.1, 24]} /><meshStandardMaterial color="#5b4b3c" metalness={0.4} roughness={0.5} /></mesh>
      <group ref={blades} position={[0, -0.3, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation-y={(i * 2 * Math.PI) / 3} position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 0.012, 0.13]} />
            <meshStandardMaterial color="#8a6744" roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.4, 0]}><sphereGeometry args={[0.09, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial {...glowMat(day, 1.1)} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function Ring({ y, size, day }) {
  const R = Math.min(0.7, size * 0.18);
  return (
    <group position={[0, y - 0.6, 0]}>
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * R, 0.3, Math.sin(a) * R]}><cylinderGeometry args={[0.002, 0.002, 0.6, 4]} /><meshStandardMaterial color="#888" /></mesh>;
      })}
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[R, 0.025, 12, 80]} /><meshStandardMaterial {...glowMat(day, 1.3)} /></mesh>
    </group>
  );
}

function Flush({ y, day }) {
  return (
    <mesh position={[0, y - 0.03, 0]}>
      <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
      <meshStandardMaterial color="#fff3df" emissive="#ffd9a8" emissiveIntensity={day ? 0.6 : 2.2} />
    </mesh>
  );
}

/** The light fitting(s) of one room plus the light they give. `y` is the ceiling height under the design. */
export function RoomLight({ rect, light = 'flush', style = 'plain', top, day, withLamp = true }) {
  const cx = rect.x + rect.w / 2, cz = rect.z + rect.d / 2;
  const size = Math.min(rect.w, rect.d);
  // fittings hang from the lowest part of the ceiling over the middle of the room
  const y = style === 'pop' || style === 'tray' || style === 'cove' ? top - 0.02 : style === 'wood' ? top - 0.09 : top - 0.0;
  const power = day ? 0.9 : 3.2;
  return (
    <group position={[cx, 0, cz]}>
      {light === 'flush' && <Flush y={y} day={day} />}
      {light === 'chandelier' && <Chandelier y={y} size={size} day={day} />}
      {light === 'pendant' && <Pendants y={y} rect={rect} day={day} />}
      {light === 'spots' && <Spots y={y - 0.0} rect={{ w: rect.w * 0.8, d: rect.d * 0.8 }} day={day} />}
      {light === 'fan' && <Fan y={y} day={day} />}
      {light === 'ring' && <Ring y={y} size={size} day={day} />}
      {withLamp && light !== 'none' && (
        <pointLight position={[0, top - (light === 'chandelier' ? 0.75 : light === 'pendant' ? 1.0 : 0.35), 0]}
          intensity={power * (light === 'chandelier' ? 1.3 : 1)} distance={Math.max(rect.w, rect.d) * 1.6 + 2} decay={2} color="#ffd6a0" />
      )}
      {/* a cove or tray glows too: a soft fill so the ceiling reads lit */}
      {withLamp && (style === 'cove' || style === 'tray' || style === 'pop') && (
        <pointLight position={[0, top - 0.4, 0]} intensity={power * 0.5} distance={Math.max(rect.w, rect.d) * 1.2 + 1} decay={2} color="#ffe2b8" />
      )}
    </group>
  );
}

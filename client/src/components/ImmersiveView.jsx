import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, Environment } from '@react-three/drei';
import { ArrowLeft } from 'lucide-react';
import { HouseModel, PLAN_SCALE } from './Canvas3D';
import Mark from './Mark';

/*
 * Immersive View: the house on its own plot in an ordinary residential street. Lawn, compound wall
 * and gate, a driveway and a stone path to the front door, hedges and trees; then the footpath, the
 * road and the neighbours' houses, fading into haze. The house is turned so its entrance faces the
 * street. Time of day, weather and the kind of plot can be changed.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PLINTH = 0.45;           // the house sits on a raised plinth, like most Indian homes

const TIMES = {
  morning: { label: 'Morning', sun: [60, 25, 40], light: 1.5, sunColor: '#ffe2c0', hemi: 0.55, fog: '#d9dfe4', day: true },
  noon: { label: 'Noon', sun: [20, 90, 15], light: 2.0, sunColor: '#fff6e8', hemi: 0.7, fog: '#dfe6eb', day: true },
  evening: { label: 'Evening', sun: [-70, 9, 30], light: 1.3, sunColor: '#ffb27a', hemi: 0.4, fog: '#e2c3a8', day: true },
  night: { label: 'Night', sun: [-30, 45, 25], light: 0.45, sunColor: '#9fb3d9', hemi: 0.45, fog: '#0d1220', day: false },
};
const SETTINGS = {
  street: { label: 'Residential street' },
  corner: { label: 'Corner plot' },
  garden: { label: 'Garden plot' },
};
const WEATHER = { clear: 'Clear', overcast: 'Overcast', rain: 'Rain' };

// ---------------------------------------------------------------------------------------------
// Textures drawn once on canvases: grass, asphalt, paving
// ---------------------------------------------------------------------------------------------
const texCache = {};
function canvasTexture(key, draw, repeat = 1) {
  if (!texCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache[key] = t;
  }
  const t = texCache[key].clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}
const speckle = (g, base, colors, n) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
};
const grassTex = (r) => canvasTexture('grass', g => speckle(g, '#5f7a3c', ['#6d8a45', '#526b33', '#7a9550', '#4a6130'], 9000), r);
const asphaltTex = (r) => canvasTexture('asphalt', g => speckle(g, '#3b3b3d', ['#444446', '#333335', '#4c4b4a'], 7000), r);
const pavingTex = (r) => canvasTexture('paving', g => {
  g.fillStyle = '#b7aa98'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,60,50,0.35)'; g.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let y = 0; y < 256; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
}, r);
const earthTex = (r) => canvasTexture('earth', g => speckle(g, '#6b7350', ['#737b55', '#646b48', '#7d7a58'], 6000), r);

function Ground({ x, z, w, d, tex, y = 0, color = '#ffffff', rough = 0.95 }) {
  const map = useMemo(() => tex(Math.max(w, d) / 4), [tex, w, d]);
  map.repeat.set(w / 4, d / 4);
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={color} roughness={rough} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------------------------
function Tree({ position, scale = 1, kind = 'broad', tint = 0 }) {
  const leaf = ['#3f5f2a', '#4b6b30', '#365424', '#56743a'][tint % 4];
  const leaf2 = ['#527a35', '#5d843c', '#46692e', '#668a44'][tint % 4];
  if (kind === 'slender') {   // an ashoka-like column of leaves
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.1, 0.14, 1.6, 6]} /><meshStandardMaterial color="#5a4632" roughness={1} /></mesh>
        <mesh position={[0, 3.6, 0]} castShadow><coneGeometry args={[0.9, 5.2, 7]} /><meshStandardMaterial color={leaf} roughness={1} flatShading /></mesh>
      </group>
    );
  }
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 2.8, 7]} /><meshStandardMaterial color="#5c4733" roughness={1} /></mesh>
      <mesh position={[0, 3.6, 0]} castShadow><icosahedronGeometry args={[1.9, 0]} /><meshStandardMaterial color={leaf} roughness={1} flatShading /></mesh>
      <mesh position={[0.9, 3.1, 0.5]} castShadow><icosahedronGeometry args={[1.3, 0]} /><meshStandardMaterial color={leaf2} roughness={1} flatShading /></mesh>
      <mesh position={[-0.8, 3.3, -0.6]} castShadow><icosahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color={leaf2} roughness={1} flatShading /></mesh>
    </group>
  );
}

function Hedge({ x, z, w, d, h = 0.9 }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#3e5c2b" roughness={1} />
    </mesh>
  );
}

function Shrub({ position, s = 0.6, c = '#4f7034' }) {
  return (
    <mesh position={[position[0], s * 0.7, position[2]]} castShadow>
      <icosahedronGeometry args={[s, 0]} />
      <meshStandardMaterial color={c} roughness={1} flatShading />
    </mesh>
  );
}

function Planter({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.32, 0.26, 0.6, 12]} /><meshStandardMaterial color="#8a6a52" roughness={0.9} /></mesh>
      <mesh position={[0, 0.85, 0]} castShadow><icosahedronGeometry args={[0.42, 0]} /><meshStandardMaterial color="#4c7333" roughness={1} flatShading /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Boundary, street furniture, neighbours
// ---------------------------------------------------------------------------------------------
function CompoundWall({ x0, x1, z, gateFrom, gateTo, color = '#d9d2c5' }) {
  // a 1.2 m rendered wall with a coping, broken by the gate opening
  const pieces = [[x0, gateFrom], [gateTo, x1]].filter(([a, b]) => b - a > 0.2);
  return (
    <group>
      {pieces.map(([a, b], i) => (
        <group key={i}>
          <mesh position={[(a + b) / 2, 0.6, z]} castShadow receiveShadow><boxGeometry args={[b - a, 1.2, 0.22]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
          <mesh position={[(a + b) / 2, 1.25, z]} castShadow><boxGeometry args={[b - a, 0.08, 0.3]} /><meshStandardMaterial color="#9b9184" roughness={0.8} /></mesh>
        </group>
      ))}
      {[gateFrom, gateTo].map((gx, i) => (
        <mesh key={`p${i}`} position={[gx, 0.8, z]} castShadow><boxGeometry args={[0.4, 1.6, 0.4]} /><meshStandardMaterial color="#b8ad9c" roughness={0.85} /></mesh>
      ))}
      {/* a low metal gate of vertical bars, swung open */}
      <group position={[gateFrom + 0.2, 0, z]} rotation={[0, -Math.PI / 2.6, 0]}>
        {[0.15, 1.05].map(y => (
          <mesh key={y} position={[0.9, y, 0]} castShadow><boxGeometry args={[1.8, 0.05, 0.05]} /><meshStandardMaterial color="#2f2b27" metalness={0.5} roughness={0.5} /></mesh>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[0.1 + i * 0.18, 0.6, 0]} castShadow><boxGeometry args={[0.03, 1.0, 0.03]} /><meshStandardMaterial color="#2f2b27" metalness={0.5} roughness={0.5} /></mesh>
        ))}
      </group>
    </group>
  );
}

function SideWall({ x, z0, z1, color = '#d9d2c5' }) {
  return (
    <mesh position={[x, 0.75, (z0 + z1) / 2]} castShadow receiveShadow>
      <boxGeometry args={[0.22, 1.5, z1 - z0]} /><meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function StreetLight({ position, facing = 1, on }) {
  return (
    <group position={position}>
      <mesh position={[0, 3, 0]} castShadow><cylinderGeometry args={[0.07, 0.1, 6, 8]} /><meshStandardMaterial color="#3a3836" metalness={0.4} roughness={0.6} /></mesh>
      <mesh position={[0, 5.95, facing * 0.7]}><boxGeometry args={[0.08, 0.08, 1.4]} /><meshStandardMaterial color="#3a3836" /></mesh>
      <mesh position={[0, 5.85, facing * 1.35]}>
        <boxGeometry args={[0.35, 0.12, 0.5]} />
        <meshStandardMaterial color="#fff1d6" emissive="#ffcf8a" emissiveIntensity={on ? 3 : 0.05} />
      </mesh>
      {on && <pointLight position={[0, 5.5, facing * 1.4]} intensity={9} distance={18} decay={2} color="#ffcf8a" />}
    </group>
  );
}

const NEIGHBOUR_COLORS = ['#e8e1d3', '#d8cbb6', '#c9d0cc', '#e3d6c4', '#cfc6b8', '#e6dccb'];
const ROOF_COLORS = ['#7d4a32', '#5c5753', '#8a5a3c', '#6e4334'];

/** A neighbour's house: a simple one or two storey block with windows and a roof, on its own plot. */
function NeighbourHouse({ x, z, w, d, storeys, roof, tint, night, facing = 1 }) {
  const h = storeys * 3.1;
  const winColor = night ? '#ffd79a' : '#5f7280';
  const wins = [];
  for (let s = 0; s < storeys; s++) {
    for (let k = 0; k < Math.max(2, Math.floor(w / 3)); k++) {
      const wx = -w / 2 + (k + 0.5) * (w / Math.max(2, Math.floor(w / 3)));
      wins.push([wx, s * 3.1 + 1.7]);
    }
  }
  return (
    <group position={[x, PLINTH * 0.6, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={NEIGHBOUR_COLORS[tint % NEIGHBOUR_COLORS.length]} roughness={0.9} />
      </mesh>
      {wins.map(([wx, wy], i) => (
        <mesh key={i} position={[wx, wy, facing * (d / 2 + 0.01)]} rotation={[0, facing > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[1.2, 1.3]} />
          <meshStandardMaterial color={winColor} emissive={night && (i * 7 + tint) % 3 ? '#ffc477' : '#000000'} emissiveIntensity={night ? 1.4 : 0} roughness={0.2} />
        </mesh>
      ))}
      {roof === 'pitched' ? (
        <mesh position={[0, h + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} scale={[(w + 0.8) / Math.SQRT2, 1, (d + 0.8) / Math.SQRT2]} castShadow>
          <coneGeometry args={[1, 2.2, 4, 1]} /><meshStandardMaterial color={ROOF_COLORS[tint % ROOF_COLORS.length]} roughness={0.8} flatShading />
        </mesh>
      ) : (
        <mesh position={[0, h + 0.3, 0]} castShadow><boxGeometry args={[w + 0.3, 0.6, d + 0.3]} /><meshStandardMaterial color="#b9b0a2" roughness={0.9} /></mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Rain
// ---------------------------------------------------------------------------------------------
function Rain() {
  const count = 6000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      p[i] = (Math.random() - 0.5) * 120; p[i + 1] = Math.random() * 40; p[i + 2] = (Math.random() - 0.5) * 120;
    }
    return p;
  }, []);
  const ref = useRef();
  useFrame((_, delta) => {
    const pos = ref.current?.geometry.attributes.position.array;
    if (!pos) return;
    for (let i = 1; i < count * 3; i += 3) { pos[i] -= 28 * delta; if (pos[i] < 0) pos[i] = 40; }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} /></bufferGeometry>
      <pointsMaterial size={0.08} color="#cfdbe6" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------------------------
// The site: where the house sits, which side faces the street, and everything around it
// ---------------------------------------------------------------------------------------------
function useSite(elements) {
  return useMemo(() => {
    const ground = elements.filter(e => (e.floor || 1) === 1);
    const rooms = elements.filter(e => e.type === 'room');
    const shell = rooms.length ? rooms : elements.filter(e => e.type === 'wall');
    if (!shell.length) return null;
    const box = (e) => e.type === 'room'
      ? [e.left, e.top - e.height / 2, e.left + e.width, e.top + e.height / 2]
      : [Math.min(e.left, e.left + e.width * Math.cos((e.angle || 0) * Math.PI / 180)), e.top - 4,
         Math.max(e.left, e.left + e.width * Math.cos((e.angle || 0) * Math.PI / 180)), e.top + e.width * Math.abs(Math.sin((e.angle || 0) * Math.PI / 180)) + 4];
    const bs = shell.map(box);
    const x0 = Math.min(...bs.map(b => b[0])), y0 = Math.min(...bs.map(b => b[1]));
    const x1 = Math.max(...bs.map(b => b[2])), y1 = Math.max(...bs.map(b => b[3]));

    // the entrance: the side of the ground floor with the most outside doors faces the street
    const near = { bottom: 0, top: 0, left: 0, right: 0 };
    let door = null;
    ground.filter(e => e.type === 'door').forEach(d => {
      const dists = { top: Math.abs(d.top - y0), bottom: Math.abs(d.top - y1), left: Math.abs(d.left - x0), right: Math.abs(d.left - x1) };
      const [side, dist] = Object.entries(dists).sort((a, b) => a[1] - b[1])[0];
      if (dist < 14) { near[side] += 1; door = door || { side, x: d.left, y: d.top }; }
    });
    const front = Object.entries(near).sort((a, b) => b[1] - a[1])[0][1] > 0
      ? Object.entries(near).sort((a, b) => b[1] - a[1])[0][0] : 'bottom';
    const rotation = { bottom: 0, top: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[front];

    const cx = ((x0 + x1) / 2) * PLAN_SCALE, cz = ((y0 + y1) / 2) * PLAN_SCALE;
    const w = (x1 - x0) * PLAN_SCALE, d = (y1 - y0) * PLAN_SCALE;
    const turned = front === 'left' || front === 'right';
    const W = turned ? d : w, D = turned ? w : d;      // footprint once turned to face the street (+z)

    // where the front door ends up along the street side, to line the path up with it
    let doorX = 0;
    const entry = ground.find(e => e.type === 'door' && (() => {
      const dd = { top: Math.abs(e.top - y0), bottom: Math.abs(e.top - y1), left: Math.abs(e.left - x0), right: Math.abs(e.left - x1) };
      return dd[front] < 14;
    })());
    if (entry) {
      const ex = entry.left * PLAN_SCALE - cx, ez = entry.top * PLAN_SCALE - cz;
      doorX = ex * Math.cos(rotation) + ez * Math.sin(rotation);
    }
    return { cx, cz, W, D, rotation, doorX };
  }, [elements]);
}

function Site({ site, setting, time, elements, roofStyle, camX }) {
  const night = !TIMES[time].day;
  const { W, D } = site;
  const side = setting === 'garden' ? 6 : 3.2;          // side setbacks
  const plotW = W + side * 2;
  const frontYard = setting === 'garden' ? 9 : 6.5;
  const rear = setting === 'garden' ? 8 : 4;
  const fz = D / 2 + frontYard;                           // the front boundary
  const bz = -D / 2 - rear;                               // the back boundary
  const walkW = 2.2, roadW = 8;
  const roadZ = fz + walkW + roadW / 2;
  const farWalk = fz + walkW + roadW;
  const gateW = 3.6;
  const gateX = Math.max(-plotW / 2 + 1, Math.min(plotW / 2 - gateW - 1, site.doorX - gateW / 2));
  const driveX = gateX > 0 ? -plotW / 2 + 1.2 : plotW / 2 - 4.2;

  // neighbours along this side of the street and across it
  const neighbours = useMemo(() => {
    const list = [];
    const rnd = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const slots = setting === 'corner' ? [-1, 2] : setting === 'garden' ? [-1, 1] : [-2, -1, 1, 2];
    slots.forEach((k, i) => {
      const nw = 8 + rnd(i) * 4, nd = 9 + rnd(i + 5) * 4;
      const x = k * (plotW / 2 + nw / 2 + 4.5) + (k > 0 ? 1 : -1) * (Math.abs(k) - 1) * (nw + 6);
      list.push({ x, z: -1 + rnd(i + 2) * 2, w: nw, d: nd, storeys: 1 + (rnd(i + 3) > 0.45 ? 1 : 0), roof: rnd(i + 4) > 0.5 ? 'pitched' : 'flat', tint: i, facing: 1 });
    });
    [-1.6, -0.5, 0.6, 1.7].forEach((k, i) => {
      if (setting === 'garden' && Math.abs(k) > 1) return;
      const nw = 9 + rnd(i + 11) * 4, nd = 9 + rnd(i + 13) * 3;
      list.push({ x: k * 15, z: farWalk + 6 + nd / 2, w: nw, d: nd, storeys: 1 + (rnd(i + 17) > 0.35 ? 1 : 0), roof: rnd(i + 19) > 0.5 ? 'pitched' : 'flat', tint: i + 3, facing: -1 });
    });
    return list;
  }, [plotW, farWalk, setting]);

  // street furniture keeps clear of where the viewer stands
  const lamps = [-34, -20, -6, 8, 22, 36].filter(x => Math.abs(x - camX) > 7);
  const streetTrees = [-28, -18, -2, 14, 30].filter(x => Math.abs(x - camX) > 5);

  return (
    <group>
      {/* the land beyond the street, then this plot's lawn */}
      <Ground x={0} z={20} w={400} d={400} tex={earthTex} y={-0.02} />
      <Ground x={0} z={(fz + bz) / 2} w={plotW} d={fz - bz} tex={grassTex} y={0.01} />

      {/* driveway and a stone path from the gate to the front door */}
      <Ground x={driveX + 1.5} z={(fz + D / 2) / 2} w={3} d={fz - D / 2} tex={pavingTex} y={0.02} color="#d6cbbb" />
      <Ground x={gateX + gateW / 2} z={(fz + D / 2) / 2} w={1.4} d={fz - D / 2 + 0.6} tex={pavingTex} y={0.025} color="#e3d8c8" />

      {/* boundary: rendered wall on the street with a gate, walls down the sides, a hedge at the back */}
      <CompoundWall x0={-plotW / 2} x1={plotW / 2} z={fz} gateFrom={gateX} gateTo={gateX + gateW} />
      {setting !== 'corner' && <SideWall x={-plotW / 2} z0={bz} z1={fz} />}
      <SideWall x={plotW / 2} z0={bz} z1={fz} />
      <Hedge x={0} z={bz + 0.4} w={plotW - 0.6} d={0.7} h={1.4} />
      {setting === 'corner' && <Hedge x={-plotW / 2 + 0.4} z={(fz + bz) / 2} w={0.7} d={fz - bz - 0.6} h={1.1} />}

      {/* planting: shrub beds inside the front wall, trees in the corners of the plot, planters at the door */}
      {Array.from({ length: Math.max(3, Math.floor(plotW / 2.2)) }).map((_, i) => {
        const x = -plotW / 2 + 1 + i * 2.2;
        if (x > gateX - 0.8 && x < gateX + gateW + 0.8) return null;
        if (x > driveX - 0.6 && x < driveX + 3.6) return null;
        return <Shrub key={`s${i}`} position={[x, 0, fz - 0.8]} s={0.45 + (i % 3) * 0.12} c={i % 2 ? '#4f7034' : '#5d7d3c'} />;
      })}
      <Tree position={[-plotW / 2 + 2, 0, fz - 2.5]} scale={1.1} tint={1} />
      <Tree position={[plotW / 2 - 2, 0, bz + 2.5]} scale={1.25} tint={2} />
      {setting === 'garden' && <>
        <Tree position={[plotW / 2 - 2.5, 0, fz - 3]} kind="slender" scale={1.1} tint={0} />
        <Tree position={[-plotW / 2 + 2.5, 0, bz + 3]} scale={1.3} tint={3} />
        <Tree position={[0, 0, bz + 2]} kind="slender" scale={1.2} tint={1} />
      </>}
      {/* at night: a warm light over the door and low lights along the path */}
      {night && (
        <>
          <mesh position={[site.doorX, PLINTH + 2.5, D / 2 + 0.08]}><boxGeometry args={[0.25, 0.25, 0.12]} /><meshStandardMaterial color="#fff3df" emissive="#ffcf8a" emissiveIntensity={3} /></mesh>
          <pointLight position={[site.doorX, PLINTH + 2.3, D / 2 + 0.8]} intensity={6} distance={9} decay={2} color="#ffcf8a" />
          {[0.25, 0.55, 0.85].map(f => {
            const pz = D / 2 + 0.6 + (fz - D / 2 - 0.6) * f;
            return (
              <group key={f} position={[gateX + gateW / 2 + 1, 0, pz]}>
                <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.05, 0.05, 0.6, 8]} /><meshStandardMaterial color="#2f2b27" /></mesh>
                <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.09, 12, 8]} /><meshStandardMaterial color="#fff3df" emissive="#ffd59a" emissiveIntensity={2.5} /></mesh>
                <pointLight position={[0, 0.7, 0]} intensity={1.2} distance={3.5} decay={2} color="#ffd59a" />
              </group>
            );
          })}
        </>
      )}
      <Planter position={[site.doorX - 1.2, PLINTH, D / 2 + 0.9]} />
      <Planter position={[site.doorX + 1.2, PLINTH, D / 2 + 0.9]} />

      {/* the plinth and front steps */}
      <mesh position={[0, PLINTH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W + 0.6, PLINTH, D + 0.6]} /><meshStandardMaterial color="#9c948a" roughness={0.9} />
      </mesh>
      {[0, 1, 2].map(i => (
        <mesh key={`st${i}`} position={[site.doorX, (PLINTH / 3) * (i + 0.5), D / 2 + 0.3 + (2 - i) * 0.32 + 0.16]} receiveShadow castShadow>
          <boxGeometry args={[1.8, PLINTH / 3, 0.32]} /><meshStandardMaterial color="#b3aa9e" roughness={0.9} />
        </mesh>
      ))}

      {/* the house itself, turned to face the street and lifted onto its plinth */}
      <group position={[0, PLINTH, 0]} rotation={[0, site.rotation, 0]}>
        <group position={[-site.cx, 0, -site.cz]}>
          <HouseModel elements={elements} roofStyle={roofStyle} isDay={!night} />
        </group>
      </group>

      {/* the street: footpath with a kerb, the road with a centre line, the footpath opposite */}
      <Ground x={0} z={fz + walkW / 2} w={200} d={walkW} tex={pavingTex} y={0.12} color="#c9c0b3" />
      <mesh position={[0, 0.07, fz + walkW]} receiveShadow><boxGeometry args={[200, 0.15, 0.2]} /><meshStandardMaterial color="#8d877f" /></mesh>
      <Ground x={0} z={roadZ} w={200} d={roadW} tex={asphaltTex} y={0.005} color={night ? '#9aa0a8' : '#ffffff'} rough={0.85} />
      {Array.from({ length: 34 }).map((_, i) => (
        <mesh key={`m${i}`} position={[-100 + i * 6, 0.015, roadZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.6, 0.14]} /><meshStandardMaterial color="#e9e4d6" roughness={0.6} />
        </mesh>
      ))}
      <Ground x={0} z={farWalk + walkW / 2} w={200} d={walkW} tex={pavingTex} y={0.12} color="#c9c0b3" />
      {setting === 'corner' && (
        <>
          <Ground x={-plotW / 2 - walkW - roadW / 2} z={-20} w={roadW} d={80} tex={asphaltTex} y={0.006} color={night ? '#9aa0a8' : '#ffffff'} />
          <Ground x={-plotW / 2 - walkW / 2} z={-20} w={walkW} d={80} tex={pavingTex} y={0.12} color="#c9c0b3" />
        </>
      )}

      {streetTrees.map((x, i) => (
        Math.abs(x - (gateX + gateW / 2)) > 4 && <Tree key={`t${i}`} position={[x, 0, fz + walkW * 0.55]} scale={0.95} tint={i} kind={i % 3 === 2 ? 'slender' : 'broad'} />
      ))}
      {lamps.map((x, i) => <StreetLight key={`l${i}`} position={[x, 0, farWalk + 0.4]} facing={-1} on={night} />)}

      {/* neighbours, each on its own plot with a wall and a tree */}
      {neighbours.map((n, i) => (
        <group key={`n${i}`}>
          <NeighbourHouse {...n} night={night} />
          <CompoundWall x0={n.x - n.w / 2 - 2.5} x1={n.x + n.w / 2 + 2.5} z={n.facing > 0 ? fz : farWalk + 2.5}
            gateFrom={n.x - 1.5} gateTo={n.x + 1.5} color={['#d9d2c5', '#cbbfae', '#d4d8d2'][i % 3]} />
          <Tree position={[n.x + n.w / 2 + 1.2, 0, n.facing > 0 ? fz - 2.5 : farWalk + 4]} scale={0.9 + (i % 3) * 0.15} tint={i + 1} kind={i % 4 === 3 ? 'slender' : 'broad'} />
        </group>
      ))}

      {/* trees far behind, so the street sits in a neighbourhood rather than an empty plain */}
      {Array.from({ length: 14 }).map((_, i) => (
        <Tree key={`b${i}`} position={[-70 + i * 11 + (i % 2) * 3, 0, bz - 12 - (i % 3) * 6]} scale={1.2 + (i % 4) * 0.15} tint={i} kind={i % 3 === 0 ? 'slender' : 'broad'} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
export default function ImmersiveView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const [elements, setElements] = useState(null);
  const [name, setName] = useState('');
  const [setting, setSetting] = useState('street');
  const [time, setTime] = useState('evening');
  const [weather, setWeather] = useState('clear');
  const [roofStyle, setRoofStyle] = useState('pitched');

  // the whole house (every floor) from the project; the last Studio state as a fallback
  useEffect(() => {
    const fromDraft = () => {
      try { setElements(JSON.parse(localStorage.getItem('immersiveDraft') || '[]')); } catch { setElements([]); }
    };
    if (!projectId) { fromDraft(); return; }
    fetch(`${API_URL}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(p => { setElements((p.elements_data || []).filter(e => e && typeof e.type === 'string')); setName(p.name || ''); })
      .catch(fromDraft);
  }, [projectId]);

  const site = useSite(elements || []);
  const t = TIMES[time];
  const overcast = weather !== 'clear';
  const fogColor = overcast && t.day ? '#b9bec2' : t.fog;
  const back = () => navigate(projectId ? `/studio?projectId=${projectId}` : -1);

  const chip = (on) => `rounded-md px-3 py-1.5 text-xs transition-colors ${on ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-300 hover:bg-white/10'}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 font-sans">
      {elements === null ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">Setting the scene…</div>
      ) : !site ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-300">
          <p>This plan has no walls yet, so there is no house to place.</p>
          <button onClick={back} className="text-sm underline">Back to the Studio</button>
        </div>
      ) : (
        // standing on the road, a little to one side, looking across at the house
        <Canvas shadows camera={{ position: [Math.max(6, site.W * 0.5), 5 + site.W * 0.08, site.D / 2 + 12 + Math.max(site.W, site.D) * 0.45], fov: 50, near: 0.3, far: 600 }}>
          <color attach="background" args={[t.day ? fogColor : '#0b1020']} />
          <fog attach="fog" args={[fogColor, overcast ? 35 : 55, overcast ? 140 : 210]} />
          {t.day && (
            <Sky sunPosition={t.sun} turbidity={overcast ? 14 : 6} rayleigh={overcast ? 0.6 : time === 'evening' ? 2.4 : 1.2}
              mieCoefficient={overcast ? 0.02 : 0.006} mieDirectionalG={0.85} distance={450000} />
          )}
          {!t.day && <Stars radius={180} depth={60} count={3000} factor={4} fade speed={0.4} />}
          <hemisphereLight args={[t.day ? '#dfe9f2' : '#30406a', t.day ? '#5d6b45' : '#0d0f14', overcast ? t.hemi * 1.2 : t.hemi]} />
          <directionalLight
            position={t.sun}
            intensity={overcast ? t.light * 0.35 : t.light}
            color={t.sunColor}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}
            shadow-camera-far={260}
            shadow-bias={-0.0004}
          />
          {/* soft reflections for glass and surfaces; the sky itself is drawn by <Sky> */}
          <Environment preset={t.day ? 'city' : 'night'} environmentIntensity={t.day ? 0.45 : 0.25} />
          {weather === 'rain' && <Rain />}

          <Site site={site} setting={setting} time={time} elements={elements} roofStyle={roofStyle} camX={Math.max(6, site.W * 0.5)} />

          <OrbitControls makeDefault target={[0, 3, 0]} maxPolarAngle={Math.PI / 2 - 0.06} minDistance={6} maxDistance={95} enableDamping dampingFactor={0.06} />
        </Canvas>
      )}

      {/* header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <button onClick={back} className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white backdrop-blur-md hover:bg-black/70">
          <ArrowLeft className="h-4 w-4" /> Back to Studio
        </button>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/45 px-4 py-2.5 backdrop-blur-md">
          <Mark className="h-6 w-6" />
          <div>
            <p className="text-sm font-semibold text-white">{name || 'Your home'}</p>
            <p className="font-mono text-[10px] tracking-[0.2em] text-white/55">IMMERSIVE VIEW · {SETTINGS[setting].label.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* scene controls */}
      <div className="absolute bottom-6 left-1/2 flex w-[min(980px,calc(100%-2rem))] -translate-x-1/2 flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-black/55 px-5 py-3 backdrop-blur-xl">
        {[
          ['Setting', SETTINGS, setting, setSetting],
          ['Time', TIMES, time, setTime],
          ['Weather', WEATHER, weather, setWeather],
          ['Roof', { flat: 'Flat', pitched: 'Pitched' }, roofStyle, setRoofStyle],
        ].map(([label, options, value, set]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">{label.toUpperCase()}</span>
            <div className="flex rounded-lg bg-white/5 p-0.5">
              {Object.entries(options).map(([id, o]) => (
                <button key={id} onClick={() => set(id)} className={chip(value === id)}>{typeof o === 'string' ? o : o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

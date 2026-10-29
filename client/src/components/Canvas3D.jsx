import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, PointerLockControls } from '@react-three/drei';
import * as SunCalc from 'suncalc';
import { Eye, Layers, Compass, Maximize2, X } from 'lucide-react';
import { useWallMaterial } from '../utils/wallTexture';

const SCALE = 0.05; // 1 unit in 2D (px) = 0.05m in 3D (e.g. 100px = 5m)
const WALL_HEIGHT = 3.0; // 3 meters
const DOOR_HEIGHT = 2.2;
const WINDOW_SILL_HEIGHT = 0.9;
const WINDOW_HEADER_HEIGHT = 2.2;
const PLAYER_HEIGHT = 1.7;
const FLOOR_TO_FLOOR = 3.2;   // storey height: 3.0 m walls + 0.2 m slab
const RAIL_HEIGHT = 1.05;
const PLAYER_RADIUS = 0.45;

// =================================================================
// 1. SMART WALL & OPENINGS SEGMENTATION
// =================================================================

/**
 * Computes wall segments with physical openings (doors/windows cutouts).
 * Returns solid wall segments (with headers/sills) and physical door/window frames.
 */
function useProcessedArchitecture(elements) {
  return useMemo(() => {
    const walls = elements.filter(el => el && el.type === 'wall');
    const doors = elements.filter(el => el && el.type === 'door');
    const windows = elements.filter(el => el && el.type === 'window');
    const furniture = elements.filter(el => el && el.type && el.type.startsWith('furniture_'));
    // the top floor's stairs only mark where the flight arrives: they cut the slab, nothing is built
    const stairs = elements.filter(el => el && el.type === 'stairs' && !el.arrival);
    const stairHoles = elements.filter(el => el && el.type === 'stairs');
    const railings = elements.filter(el => el && el.type === 'railing');

    // Calculate overall bounding box for Foundation and Roof
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    const wallData = walls.map((w, index) => {
      const length = (w.width || 100) * SCALE;
      const depth = Math.max((w.height || 8) * SCALE, 0.2);
      const angle = w.angle || 0;
      const rad = (angle * Math.PI) / 180;
      
      const x0 = (w.left || 0) * SCALE;
      const z0 = (w.top || 0) * SCALE;
      const ux = Math.cos(rad);
      const uz = Math.sin(rad);
      const nx = -uz;
      const nz = ux;
      
      const x1 = x0 + length * ux;
      const z1 = z0 + length * uz;

      minX = Math.min(minX, x0, x1);
      maxX = Math.max(maxX, x0, x1);
      minZ = Math.min(minZ, z0, z1);
      maxZ = Math.max(maxZ, z0, z1);

      return {
        id: w.id || `wall_${index}`,
        raw: w,
        length,
        depth,
        angle,
        rad,
        x0, z0,
        x1, z1,
        ux, uz,
        nx, nz,
        material: w.material,
        isColor: w.isColor,
        openings: []
      };
    });

    const claimedOpenings = new Set();

    // Associate doors and windows with the closest collinear wall
    wallData.forEach(wall => {
      [...doors, ...windows].forEach(op => {
        if (claimedOpenings.has(op.id)) return;

        const opLen = (op.width || 60) * SCALE;
        const opRad = ((op.angle || 0) * Math.PI) / 180;
        const opX = (op.left || 0) * SCALE + (opLen / 2) * Math.cos(opRad);
        const opZ = (op.top || 0) * SCALE + (opLen / 2) * Math.sin(opRad);

        // Vector from wall start to opening center
        const vx = opX - wall.x0;
        const vz = opZ - wall.z0;

        // Projection along wall direction
        const s = vx * wall.ux + vz * wall.uz;
        // Perpendicular distance to wall line
        const perpDist = Math.abs(vx * wall.nx + vz * wall.nz);

        // Check angle alignment (within 30 deg or 180 +/- 30 deg)
        let angleDiff = Math.abs(((op.angle || 0) - wall.angle) % 180);
        if (angleDiff > 90) angleDiff = 180 - angleDiff;

        if (perpDist < 0.8 && s >= 0 && s <= wall.length && angleDiff < 35) {
          claimedOpenings.add(op.id);
          const halfW = opLen / 2;
          const start = Math.max(0, s - halfW);
          const end = Math.min(wall.length, s + halfW);
          if (end - start > 0.1) {
            wall.openings.push({
              id: op.id,
              type: op.type,
              start,
              end,
              center: s,
              width: end - start,
              raw: op
            });
          }
        }
      });

      // Sort openings from wall start to end
      wall.openings.sort((a, b) => a.start - b.start);
    });

    // Unclaimed openings (standalone doors/windows not directly placed on a wall)
    const standaloneOpenings = [...doors, ...windows].filter(op => !claimedOpenings.has(op.id));

    // Collision line segments for Walkthrough Player (doors are open passages!)
    const collisionSegments = [];

    wallData.forEach(wall => {
      let currentPos = 0;
      wall.openings.forEach(op => {
        if (op.start > currentPos + 0.1) {
          // Solid wall segment
          const s0 = currentPos;
          const s1 = op.start;
          collisionSegments.push({
            x0: wall.x0 + s0 * wall.ux,
            z0: wall.z0 + s0 * wall.uz,
            x1: wall.x0 + s1 * wall.ux,
            z1: wall.z0 + s1 * wall.uz,
            depth: wall.depth
          });
        }
        currentPos = Math.max(currentPos, op.end);
      });

      if (currentPos < wall.length - 0.1) {
        collisionSegments.push({
          x0: wall.x0 + currentPos * wall.ux,
          z0: wall.z0 + currentPos * wall.uz,
          x1: wall.x0 + wall.length * wall.ux,
          z1: wall.z0 + wall.length * wall.uz,
          depth: wall.depth
        });
      }
    });

    // railings stop the walkthrough too
    railings.forEach(r => {
      const a = ((r.angle || 0) * Math.PI) / 180, L = (r.width || 0) * SCALE;
      const x0 = (r.left || 0) * SCALE, z0 = (r.top || 0) * SCALE;
      collisionSegments.push({ x0, z0, x1: x0 + L * Math.cos(a), z1: z0 + L * Math.sin(a), depth: 0.1 });
    });

    // Bounding dimensions for slab/roof
    const hasBounds = isFinite(minX) && isFinite(maxX);
    const bounds = hasBounds ? {
      minX, maxX, minZ, maxZ,
      width: Math.max(maxX - minX, 10),
      depth: Math.max(maxZ - minZ, 10),
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2
    } : {
      minX: -10, maxX: 10, minZ: -10, maxZ: 10,
      width: 20, depth: 20,
      centerX: 0, centerZ: 0
    };

    return {
      wallData,
      standaloneOpenings,
      furniture,
      stairs,
      stairHoles,
      railings,
      collisionSegments,
      bounds
    };
  }, [elements]);
}

// =================================================================
// 2. TEXTURE & MATERIAL LOADER HELPER
// =================================================================

/**
 * Renders a <meshStandardMaterial> from the props object returned by useWallMaterial.
 * This ensures each mesh gets its own material instance.
 */
function WallMaterial({ matProps }) {
  const { key, ...props } = matProps;
  return <meshStandardMaterial key={key} {...props} />;
}

// =================================================================
// 3. ARCHITECTURAL WALL WITH REAL DOOR/WINDOW OPENINGS
// =================================================================

// whether the scene is lit by day: at night the glass glows with the rooms' lights behind it
const DayContext = createContext(true);

function WindowGlass({ w, h }) {
  const isDay = useContext(DayContext);
  return (
    <mesh>
      <boxGeometry args={[w, h, 0.02]} />
      <meshPhysicalMaterial color={isDay ? '#a9c4d4' : '#ffd9a8'} emissive={isDay ? '#000000' : '#ffbf73'} emissiveIntensity={isDay ? 0 : 0.9}
        roughness={0.04} metalness={0.15} transparent opacity={isDay ? 0.55 : 0.85} envMapIntensity={1.2} />
    </mesh>
  );
}

function ArchitecturalWall({ wall, onPaint }) {
  const { x0, z0, ux, uz, nx, nz, depth, length, angle, openings, id, material, isColor } = wall;
  const matProps = useWallMaterial(material, isColor, length, WALL_HEIGHT);
  const rotY = -((angle || 0) * Math.PI) / 180;

  // Build segments
  const segments = [];
  let currentPos = 0;

  openings.forEach((op, idx) => {
    // 1. Solid wall segment before the opening
    if (op.start > currentPos + 0.05) {
      const segLen = op.start - currentPos;
      const centerS = currentPos + segLen / 2;
      segments.push(
        <mesh
          key={`wall-seg-${idx}`}
          position={[x0 + centerS * ux, WALL_HEIGHT / 2, z0 + centerS * uz]}
          rotation={[0, rotY, 0]}
          castShadow
          receiveShadow
          onClick={(e) => { e.stopPropagation(); if (e.delta <= 4) onPaint?.(id); }}
        >
          <boxGeometry args={[segLen, WALL_HEIGHT, depth]} />
          <WallMaterial matProps={matProps} />
        </mesh>
      );
    }

    const opLen = op.end - op.start;
    const opCenterS = op.start + opLen / 2;
    const opCenterX = x0 + opCenterS * ux;
    const opCenterZ = z0 + opCenterS * uz;

    if (op.type === 'door') {
      // DOORWAY OPENING:
      // A. Lintel/Header above the door (wall material)
      const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
      segments.push(
        <mesh
          key={`door-lintel-${idx}`}
          position={[opCenterX, DOOR_HEIGHT + lintelHeight / 2, opCenterZ]}
          rotation={[0, rotY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[opLen, lintelHeight, depth]} />
          <WallMaterial matProps={matProps} />
        </mesh>
      );

      // B. Architectural Door Frame (Jambs + Header in dark oak/charcoal)
      const jambWidth = 0.06;
      const frameDepth = depth * 1.1;
      segments.push(
        <group key={`door-frame-${idx}`} position={[opCenterX, 0, opCenterZ]} rotation={[0, rotY, 0]}>
          {/* Top jamb */}
          <mesh position={[0, DOOR_HEIGHT, 0]} castShadow>
            <boxGeometry args={[opLen, jambWidth, frameDepth]} />
            <meshStandardMaterial color="#1e1b18" roughness={0.7} />
          </mesh>
          {/* Left jamb */}
          <mesh position={[-opLen / 2 + jambWidth / 2, DOOR_HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[jambWidth, DOOR_HEIGHT, frameDepth]} />
            <meshStandardMaterial color="#1e1b18" roughness={0.7} />
          </mesh>
          {/* Right jamb */}
          <mesh position={[opLen / 2 - jambWidth / 2, DOOR_HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[jambWidth, DOOR_HEIGHT, frameDepth]} />
            <meshStandardMaterial color="#1e1b18" roughness={0.7} />
          </mesh>

          {/* C. Door Panel slightly open (30 degree ajar for a welcoming walk-through feel) */}
          <group position={[-opLen / 2 + jambWidth, 0, 0]} rotation={[0, 0.55, 0]}>
            <mesh position={[(opLen - jambWidth * 2) / 2, DOOR_HEIGHT / 2, 0]} castShadow>
              <boxGeometry args={[opLen - jambWidth * 2, DOOR_HEIGHT - 0.02, 0.04]} />
              <meshStandardMaterial color="#3e2723" roughness={0.6} />
            </mesh>
            {/* Elegant metallic handle */}
            <mesh position={[opLen * 0.8, 1.0, 0.04]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      );
    } else if (op.type === 'window') {
      // WINDOW OPENING:
      // A. Bottom Wall Sill (from y=0 to WINDOW_SILL_HEIGHT)
      segments.push(
        <mesh
          key={`window-sill-${idx}`}
          position={[opCenterX, WINDOW_SILL_HEIGHT / 2, opCenterZ]}
          rotation={[0, rotY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[opLen, WINDOW_SILL_HEIGHT, depth]} />
          <WallMaterial matProps={matProps} />
        </mesh>
      );

      // B. Top Wall Lintel (from WINDOW_HEADER_HEIGHT to WALL_HEIGHT)
      const lintelHeight = WALL_HEIGHT - WINDOW_HEADER_HEIGHT;
      segments.push(
        <mesh
          key={`window-lintel-${idx}`}
          position={[opCenterX, WINDOW_HEADER_HEIGHT + lintelHeight / 2, opCenterZ]}
          rotation={[0, rotY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[opLen, lintelHeight, depth]} />
          <WallMaterial matProps={matProps} />
        </mesh>
      );

      // C. Modern Glass Pane & Aluminum Frame
      const windowHeight = WINDOW_HEADER_HEIGHT - WINDOW_SILL_HEIGHT;
      const windowCenterY = WINDOW_SILL_HEIGHT + windowHeight / 2;
      segments.push(
        <group key={`window-glass-frame-${idx}`} position={[opCenterX, windowCenterY, opCenterZ]} rotation={[0, rotY, 0]}>
          {/* Sleek Minimalist Outer Frame */}
          {/* a slim frame round the opening (it used to be a solid box that filled it, so windows looked black) */}
          {[[0, windowHeight / 2 - 0.03, opLen, 0.06], [0, -windowHeight / 2 + 0.03, opLen, 0.06],
            [-opLen / 2 + 0.03, 0, 0.06, windowHeight], [opLen / 2 - 0.03, 0, 0.06, windowHeight],
            [0, 0, 0.04, windowHeight]].map(([fx, fy, fw, fh], k) => (
            <mesh key={k} position={[fx, fy, 0]} castShadow>
              <boxGeometry args={[fw, fh, depth * 0.6]} />
              <meshStandardMaterial color="#2a2724" roughness={0.4} metalness={0.6} />
            </mesh>
          ))}
          <WindowGlass w={opLen - 0.08} h={windowHeight - 0.08} />
        </group>
      );
    }

    currentPos = Math.max(currentPos, op.end);
  });

  // Final wall segment after the last opening
  if (currentPos < length - 0.05) {
    const segLen = length - currentPos;
    const centerS = currentPos + segLen / 2;
    segments.push(
      <mesh
        key="wall-final-seg"
        position={[x0 + centerS * ux, WALL_HEIGHT / 2, z0 + centerS * uz]}
        rotation={[0, rotY, 0]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); if (e.delta <= 4) onPaint?.(id); }}
      >
        <boxGeometry args={[segLen, WALL_HEIGHT, depth]} />
        <WallMaterial matProps={matProps} />
      </mesh>
    );
  }

  return <group>{segments}</group>;
}

// =================================================================
// 4. STANDALONE OPENINGS (Not snapped to a wall)
// =================================================================

function StandaloneOpening({ el }) {
  const length = (el?.width || 60) * SCALE;
  const depth = (el?.height || 8) * SCALE;
  const rotY = -((el?.angle || 0) * Math.PI) / 180;
  const rad = ((el?.angle || 0) * Math.PI) / 180;
  const cx = (el?.left || 0) * SCALE + (length / 2) * Math.cos(rad);
  const cz = (el?.top || 0) * SCALE + (length / 2) * Math.sin(rad);

  if (el.type === 'door') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, DOOR_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[length, DOOR_HEIGHT, depth * 1.2]} />
          <meshStandardMaterial color="#451a03" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[cx, 1.5, cz]} rotation={[0, rotY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[length, 1.2, depth * 1.2]} />
        <meshPhysicalMaterial transmission={0.8} transparent opacity={0.9} roughness={0.1} color="#93c5fd" />
      </mesh>
    </group>
  );
}

// =================================================================
// 5. PROCEDURAL 3D FURNITURE & FIXTURES
// =================================================================

function ProceduralFurniture({ el }) {
  const w = (el?.width || 80) * 0.05;
  const d = (el?.height || 50) * 0.05;
  const rotY = -((el?.angle || 0) * Math.PI) / 180;
  const rad = ((el?.angle || 0) * Math.PI) / 180;
  const cx = (el?.left || 0) * 0.05 + (w / 2) * Math.cos(rad);
  const cz = (el?.top || 0) * 0.05 + (w / 2) * Math.sin(rad);

  if (el.type === 'furniture_bed') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.3, d]} /><meshStandardMaterial color="#1e1e24" roughness={0.7} /></mesh>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow><boxGeometry args={[w * 0.94, 0.3, d * 0.94]} /><meshStandardMaterial color="#f8fafc" roughness={0.9} /></mesh>
        {/* blanket over the foot end, so the bed reads against a pale floor */}
        <mesh position={[0, 0.61, d * 0.16]} castShadow receiveShadow><boxGeometry args={[w * 0.96, 0.04, d * 0.6]} /><meshStandardMaterial color="#64748b" roughness={0.95} /></mesh>
        <mesh position={[0, 0.7, -d * 0.46]} castShadow receiveShadow><boxGeometry args={[w, 0.8, 0.1]} /><meshStandardMaterial color="#2d2d38" roughness={0.8} /></mesh>
        <mesh position={[-w * 0.25, 0.65, -d * 0.32]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[w * 0.38, 0.12, d * 0.2]} /><meshStandardMaterial color="#e2e8f0" roughness={0.9} /></mesh>
        <mesh position={[w * 0.25, 0.65, -d * 0.32]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[w * 0.38, 0.12, d * 0.2]} /><meshStandardMaterial color="#e2e8f0" roughness={0.9} /></mesh>
      </group>
    );
  }

  if (el.type === 'furniture_sofa') {
    const arm = w * 0.09;
    const n = w > 2.2 ? 3 : 2;
    const cw = (w - arm * 2) / n;
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.22, d * 0.9]} /><meshStandardMaterial color="#3f4a66" roughness={0.9} /></mesh>
        <mesh position={[0, 0.58, -d * 0.38]} castShadow receiveShadow><boxGeometry args={[w, 0.56, d * 0.2]} /><meshStandardMaterial color="#46537a" roughness={0.9} /></mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (w / 2 - arm / 2), 0.4, 0]} castShadow receiveShadow><boxGeometry args={[arm, 0.42, d * 0.9]} /><meshStandardMaterial color="#46537a" roughness={0.9} /></mesh>
        ))}
        {Array.from({ length: n }).map((_, i) => {
          const x = -w / 2 + arm + cw * (i + 0.5);
          return (
            <group key={i}>
              <mesh position={[x, 0.39, d * 0.07]} castShadow receiveShadow><boxGeometry args={[cw - 0.03, 0.17, d * 0.58]} /><meshStandardMaterial color="#5b6b94" roughness={0.95} /></mesh>
              <mesh position={[x, 0.66, -d * 0.24]} rotation={[-0.18, 0, 0]} castShadow><boxGeometry args={[cw - 0.05, 0.38, d * 0.13]} /><meshStandardMaterial color="#5b6b94" roughness={0.95} /></mesh>
            </group>
          );
        })}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx * (w / 2 - 0.08), 0.045, lz * (d * 0.4)]}><cylinderGeometry args={[0.03, 0.025, 0.09]} /><meshStandardMaterial color="#1c1917" roughness={0.5} /></mesh>
        ))}
      </group>
    );
  }

  if (el.type === 'furniture_table') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.06, d]} /><meshStandardMaterial color="#92400e" roughness={0.5} /></mesh>
        {([[-w * 0.42, -d * 0.4], [w * 0.42, -d * 0.4], [-w * 0.42, d * 0.4], [w * 0.42, d * 0.4]]).map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.36, lz]} castShadow><cylinderGeometry args={[0.03, 0.02, 0.72]} /><meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.7} /></mesh>
        ))}
      </group>
    );
  }

  if (el.type === 'furniture_armchair') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.2, d * 0.92]} /><meshStandardMaterial color="#2f6574" roughness={0.85} /></mesh>
        <mesh position={[0, 0.34, d * 0.04]} castShadow receiveShadow><boxGeometry args={[w * 0.68, 0.14, d * 0.66]} /><meshStandardMaterial color="#4a8fa3" roughness={0.95} /></mesh>
        <mesh position={[0, 0.58, -d * 0.4]} castShadow receiveShadow><boxGeometry args={[w, 0.5, d * 0.16]} /><meshStandardMaterial color="#2f6574" roughness={0.85} /></mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (w / 2 - w * 0.08), 0.38, 0]} castShadow><boxGeometry args={[w * 0.16, 0.3, d * 0.9]} /><meshStandardMaterial color="#2f6574" roughness={0.85} /></mesh>
        ))}
      </group>
    );
  }

  if (el.type === 'furniture_bathtub') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.27, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.54, d]} /><meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.05} /></mesh>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[w - 0.14, 0.02, d - 0.14]} /><meshStandardMaterial color="#9ec9e8" roughness={0.05} metalness={0.2} /></mesh>
        <mesh position={[-w * 0.4, 0.68, 0]} castShadow><cylinderGeometry args={[0.018, 0.018, 0.22]} /><meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.12} /></mesh>
        <mesh position={[w * 0.4, 0.56, 0]}><cylinderGeometry args={[0.035, 0.035, 0.015]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} /></mesh>
      </group>
    );
  }

  if (el.type === 'furniture_vanity') {
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.76, d]} /><meshStandardMaterial color="#6b5d52" roughness={0.6} /></mesh>
        <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[w * 1.02, 0.04, d * 1.02]} /><meshStandardMaterial color="#e7e5e4" roughness={0.2} /></mesh>
        <mesh position={[0, 0.8, d * 0.06]}><cylinderGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.26, 0.04, 28]} /><meshStandardMaterial color="#fafafa" roughness={0.1} /></mesh>
        <mesh position={[0, 0.9, -d * 0.3]} castShadow><cylinderGeometry args={[0.014, 0.014, 0.2]} /><meshStandardMaterial color="#d4d4d8" metalness={0.95} roughness={0.1} /></mesh>
        <mesh position={[0, 1.25, -d * 0.5 - 0.01]}><boxGeometry args={[w * 0.8, 0.7, 0.02]} /><meshStandardMaterial color="#dbeafe" metalness={0.9} roughness={0.05} /></mesh>
      </group>
    );
  }

  if (el.type === 'furniture_kitchen') {
    const long = w >= d;
    const run = long ? w : d;
    const hob = (sign) => [long ? sign * run * 0.22 : 0, 0.945, long ? 0 : sign * run * 0.22];
    return (
      <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.86, d]} /><meshStandardMaterial color="#e7e2da" roughness={0.55} /></mesh>
        <mesh position={[0, 0.89, 0]} castShadow><boxGeometry args={[w * 1.02, 0.05, d * 1.02]} /><meshStandardMaterial color="#44403c" roughness={0.25} metalness={0.15} /></mesh>
        <mesh position={hob(-1).map((v, i) => (i === 1 ? 0.92 : v))}><boxGeometry args={[long ? Math.min(run * 0.26, 0.9) : d * 0.7, 0.02, long ? d * 0.7 : Math.min(run * 0.26, 0.9)]} /><meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.2} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([ox, oz], i) => {
          const [hx, hy, hz] = hob(1);
          return (
            <mesh key={i} position={[hx + ox * Math.min(w, d) * 0.17, hy, hz + oz * Math.min(w, d) * 0.17]}>
              <cylinderGeometry args={[Math.min(w, d) * 0.1, Math.min(w, d) * 0.1, 0.012, 20]} /><meshStandardMaterial color="#18181b" roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[w * 1.003, 0.012, d * 1.003]} /><meshStandardMaterial color="#a8a29e" /></mesh>
      </group>
    );
  }

  return null;
}


// =================================================================
// 5.5 PROCEDURAL ARCHITECTURAL STAIRCASE
// =================================================================

function ProceduralStairs({ el }) {
  const length = Math.max((el.width || 60) * SCALE, 1.2);
  const width = Math.max((el.height || 20) * SCALE, 0.9);
  const angle = el.angle || 0;
  const rotY = -(angle * Math.PI) / 180;
  const startX = (el.left || 0) * SCALE;
  const startZ = (el.top || 0) * SCALE;
  
  // Total stairs height = 3.0m (matching standard floor height)
  const totalHeight = 3.0;
  const numSteps = 14;
  const stepHeight = totalHeight / numSteps;
  const stepDepth = length / numSteps;

  return (
    <group position={[startX, 0, startZ]} rotation={[0, rotY, 0]}>
      {Array.from({ length: numSteps }).map((_, i) => (
        <group key={i} position={[(i + 0.5) * stepDepth, (i + 0.5) * stepHeight, 0]}>
          {/* Step tread */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[stepDepth * 1.05, stepHeight, width]} />
            <meshStandardMaterial color="#a855f7" roughness={0.6} metalness={0.15} />
          </mesh>
          {/* Nosing accent */}
          <mesh position={[0, stepHeight * 0.46, 0]}>
            <boxGeometry args={[stepDepth * 1.08, 0.03, width * 1.02]} />
            <meshStandardMaterial color="#581c87" roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Handrails */}
      <mesh 
        position={[length / 2, totalHeight / 2 + 0.45, -width / 2]} 
        rotation={[0, 0, Math.atan2(totalHeight, length)]} 
        castShadow
      >
        <boxGeometry args={[Math.sqrt(length * length + totalHeight * totalHeight), 0.05, 0.05]} />
        <meshStandardMaterial color="#2e1065" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh 
        position={[length / 2, totalHeight / 2 + 0.45, width / 2]} 
        rotation={[0, 0, Math.atan2(totalHeight, length)]} 
        castShadow
      >
        <boxGeometry args={[Math.sqrt(length * length + totalHeight * totalHeight), 0.05, 0.05]} />
        <meshStandardMaterial color="#2e1065" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// =================================================================
// 6. AUTOMATIC FOUNDATION, INTERIOR SLAB & ROOF/CEILING (Feature B)
// =================================================================

const FLOOR_LOOK = {
  living: ['wood', '#b98a5b'], dining: ['wood', '#b98a5b'], lounge: ['wood', '#b98a5b'],
  master_bedroom: ['wood', '#c9a77c'], bedroom: ['wood', '#c9a77c'], study: ['wood', '#a9825a'],
  kitchen: ['tile', '#d8d4cf'], utility: ['tile', '#d8d4cf'], bathroom: ['tile', '#b9d3e0'],
  balcony: ['tile', '#a39787'], patio: ['tile', '#a39787'],
};
const floorTextureCache = {};

function floorTexture(pattern, color) {
  const key = `${pattern}:${color}`;
  if (floorTextureCache[key]) return floorTextureCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2;
  if (pattern === 'wood') {
    for (let y = 0; y < 256; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
      const off = ((y / 32) % 2) * 96 + 40;
      g.beginPath(); g.moveTo(off, y); g.lineTo(off, y + 32); g.stroke();
      g.fillStyle = `rgba(${(y * 7) % 40},${(y * 3) % 25},0,0.06)`;
      g.fillRect(0, y + 2, 256, 28);
    }
  } else {
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  floorTextureCache[key] = tex;
  return tex;
}

function FloorPiece({ p, pattern, color }) {
  const tex = useMemo(() => {
    const t = floorTexture(pattern, color).clone();
    t.needsUpdate = true;
    const tile = pattern === 'wood' ? 1.4 : 1.2;   // metres per texture repeat
    t.repeat.set(p.w / tile, p.d / tile);
    return t;
  }, [pattern, color, p.w, p.d]);
  return (
    <mesh position={[p.x + p.w / 2, 0.025, p.z + p.d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[p.w, p.d]} />
      <meshStandardMaterial map={tex} roughness={pattern === 'wood' ? 0.55 : 0.25} metalness={0.02} />
    </mesh>
  );
}

/** A room's finished floor; on an upper storey it stops at the stairwell. */
function RoomFloor({ room, holes = [] }) {
  const [pattern, color] = FLOOR_LOOK[room.kind] || FLOOR_LOOK.living;
  const pieces = cutAll([roomRect(room)], holes);
  return pieces.map((p, i) => <FloorPiece key={i} p={p} pattern={pattern} color={color} />);
}

// =================================================================
// 7. TRUE FIRST-PERSON WALKTHROUGH PLAYER (Feature A)
// =================================================================

// =================================================================
// 8. RAILINGS, STOREYS, CEILING LIGHTS AND ROOF
// =================================================================

function ProceduralRailing({ el }) {
  const L = Math.max((el.width || 0) * SCALE, 0.2);
  const rotY = -((el.angle || 0) * Math.PI) / 180;
  const posts = Math.max(2, Math.round(L / 1.0) + 1);
  return (
    <group position={[(el.left || 0) * SCALE, 0, (el.top || 0) * SCALE]} rotation={[0, rotY, 0]}>
      {Array.from({ length: posts }).map((_, i) => (
        <mesh key={i} position={[(i / (posts - 1)) * L, RAIL_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.05, RAIL_HEIGHT, 0.05]} />
          <meshStandardMaterial color="#2a2724" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[L / 2, RAIL_HEIGHT, 0]} castShadow>
        <boxGeometry args={[L, 0.06, 0.08]} />
        <meshStandardMaterial color="#2a2724" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[L / 2, RAIL_HEIGHT * 0.5, 0]}>
        <boxGeometry args={[L, 0.03, 0.03]} />
        <meshStandardMaterial color="#2a2724" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[L / 2, RAIL_HEIGHT * 0.48, 0]}>
        <boxGeometry args={[L, RAIL_HEIGHT * 0.9, 0.015]} />
        <meshPhysicalMaterial color="#cfe3ea" transparent opacity={0.22} roughness={0.05} />
      </mesh>
    </group>
  );
}

const roomRect = (r) => ({ x: r.left * SCALE, z: (r.top - r.height / 2) * SCALE, w: r.width * SCALE, d: r.height * SCALE });

function stairRect(st) {
  const L = (st.width || 0) * SCALE, W = (st.height || 0) * SCALE;
  const x = (st.left || 0) * SCALE, z = (st.top || 0) * SCALE;
  return Math.abs(Math.sin(((st.angle || 0) * Math.PI) / 180)) > 0.5
    ? { x: x - W / 2, z, w: W, d: L }
    : { x, z: z - W / 2, w: L, d: W };
}

/** A rectangle with a hole cut out, as up to four rectangles. */
function rectMinus(r, h) {
  const ix0 = Math.max(r.x, h.x), iz0 = Math.max(r.z, h.z);
  const ix1 = Math.min(r.x + r.w, h.x + h.w), iz1 = Math.min(r.z + r.d, h.z + h.d);
  if (ix0 >= ix1 || iz0 >= iz1) return [r];
  const out = [];
  if (iz0 > r.z) out.push({ x: r.x, z: r.z, w: r.w, d: iz0 - r.z });
  if (iz1 < r.z + r.d) out.push({ x: r.x, z: iz1, w: r.w, d: r.z + r.d - iz1 });
  if (ix0 > r.x) out.push({ x: r.x, z: iz0, w: ix0 - r.x, d: iz1 - iz0 });
  if (ix1 < r.x + r.w) out.push({ x: ix1, z: iz0, w: r.x + r.w - ix1, d: iz1 - iz0 });
  return out.filter(p => p.w > 0.05 && p.d > 0.05);
}

const cutAll = (rects, holes) => holes.reduce((acc, h) => acc.flatMap(r => rectMinus(r, h)), rects);

/** The floor slab under an upper storey, with the stairwell left open. */
function StoreySlab({ rooms, holes }) {
  const pieces = cutAll(rooms.map(roomRect), holes);
  return pieces.map((p, i) => (
    <mesh key={i} position={[p.x + p.w / 2, -0.1, p.z + p.d / 2]} castShadow receiveShadow>
      <boxGeometry args={[p.w + 0.2, 0.2, p.d + 0.2]} />
      <meshStandardMaterial color="#d6d0c6" roughness={0.85} />
    </mesh>
  ));
}

const LIT = new Set(['living', 'dining', 'lounge', 'kitchen', 'master_bedroom', 'bedroom', 'study', 'bathroom', 'utility', 'balcony']);

/** A ceiling over every room and a warm light in each: what makes the house feel lived in. */
function CeilingsAndLights({ rooms, holes, isDay, withCeiling }) {
  const lightPower = isDay ? 0.9 : 3.2;
  return (
    <group>
      {withCeiling && cutAll(rooms.filter(r => r.kind !== 'balcony').map(roomRect), holes).map((p, i) => (
        <mesh key={`c-${i}`} position={[p.x + p.w / 2, WALL_HEIGHT + 0.04, p.z + p.d / 2]} receiveShadow>
          <boxGeometry args={[p.w, 0.08, p.d]} />
          <meshStandardMaterial color="#f3f1ed" roughness={0.9} />
        </mesh>
      ))}
      {rooms.filter(r => LIT.has(r.kind)).slice(0, 16).map((r, i) => {
        const q = roomRect(r);
        const cx = q.x + q.w / 2, cz = q.z + q.d / 2;
        return (
          <group key={`l-${i}`} position={[cx, WALL_HEIGHT - 0.18, cz]}>
            {/* the fitting: a glowing disc under the ceiling */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
              <meshStandardMaterial color="#fff3df" emissive="#ffd9a8" emissiveIntensity={isDay ? 0.6 : 2.2} />
            </mesh>
            <pointLight intensity={lightPower} distance={Math.max(q.w, q.d) * 1.6 + 2} decay={2} color="#ffd6a0" />
          </group>
        );
      })}
    </group>
  );
}

/** Roof over the top storey: a flat slab with a parapet, or a hipped roof over the footprint. */
function Roof({ rooms, style }) {
  if (!rooms.length || style === 'none') return null;
  const rects = rooms.map(roomRect);
  if (style === 'flat') {
    return (
      <group>
        {rects.map((p, i) => (
          <mesh key={i} position={[p.x + p.w / 2, WALL_HEIGHT + 0.14, p.z + p.d / 2]} castShadow receiveShadow>
            <boxGeometry args={[p.w + 0.5, 0.24, p.d + 0.5]} />
            <meshStandardMaterial color="#b9b2a6" roughness={0.9} />
          </mesh>
        ))}
        {(() => {
          const x0 = Math.min(...rects.map(p => p.x)) - 0.25, z0 = Math.min(...rects.map(p => p.z)) - 0.25;
          const x1 = Math.max(...rects.map(p => p.x + p.w)) + 0.25, z1 = Math.max(...rects.map(p => p.z + p.d)) + 0.25;
          const y = WALL_HEIGHT + 0.5, t = 0.12;
          return [[(x0 + x1) / 2, z0, x1 - x0, t], [(x0 + x1) / 2, z1, x1 - x0, t], [x0, (z0 + z1) / 2, t, z1 - z0], [x1, (z0 + z1) / 2, t, z1 - z0]]
            .map(([x, z, w, d], i) => (
              <mesh key={`p-${i}`} position={[x, y, z]} castShadow>
                <boxGeometry args={[w, 0.5, d]} />
                <meshStandardMaterial color="#cfc8bd" roughness={0.9} />
              </mesh>
            ));
        })()}
      </group>
    );
  }
  // hipped roof: a four-sided pyramid stretched over the footprint, with eaves
  const x0 = Math.min(...rects.map(p => p.x)), z0 = Math.min(...rects.map(p => p.z));
  const x1 = Math.max(...rects.map(p => p.x + p.w)), z1 = Math.max(...rects.map(p => p.z + p.d));
  const w = x1 - x0 + 0.7, d = z1 - z0 + 0.7;   // eaves just past the walls
  const h = Math.min(3.2, Math.max(1.4, Math.min(w, d) * 0.28));
  return (
    <group position={[(x0 + x1) / 2, WALL_HEIGHT + 0.02, (z0 + z1) / 2]}>
      <mesh position={[0, h / 2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w / Math.SQRT2, 1, d / Math.SQRT2]} castShadow receiveShadow>
        <coneGeometry args={[1, h, 4, 1]} />
        <meshStandardMaterial color="#8a4b2c" roughness={0.75} flatShading />
      </mesh>
    </group>
  );
}

/** One storey: everything drawn on that floor, lifted to its height. */
function Storey({ elements, level, isTop, onPaint, roofStyle, isDay }) {
  const { wallData, standaloneOpenings, furniture, stairs, stairHoles, railings } = useProcessedArchitecture(elements);
  const rooms = useMemo(() => elements.filter(el => el && el.type === 'room'), [elements]);
  // the slab above this storey is cut where the stairs from here come up
  const holesAbove = useMemo(() => stairs.map(stairRect), [stairs]);
  const holesHere = useMemo(() => stairHoles.filter(s => s.arrival).map(stairRect), [stairHoles]);
  const lightsOn = roofStyle !== 'none' || !isTop;
  return (
    <DayContext.Provider value={isDay}>
    <group position={[0, (level - 1) * FLOOR_TO_FLOOR, 0]}>
      {level > 1 && <StoreySlab rooms={rooms} holes={holesHere} />}
      {rooms.map((room, i) => <RoomFloor key={room.id || i} room={room} holes={holesHere} />)}
      {wallData.map(wall => <ArchitecturalWall key={wall.id} wall={wall} onPaint={onPaint} />)}
      {standaloneOpenings.map((op, i) => <StandaloneOpening key={op.id || i} el={op} />)}
      {furniture.map((item, i) => <ProceduralFurniture key={item.id || i} el={item} />)}
      {stairs.map((item, i) => <ProceduralStairs key={item.id || i} el={item} />)}
      {railings.map((item, i) => <ProceduralRailing key={item.id || i} el={item} />)}
      {/* lower storeys always have a ceiling (the next floor's slab); the top one when the roof is on */}
      {lightsOn && <CeilingsAndLights rooms={rooms} holes={holesAbove} isDay={isDay} withCeiling={isTop} />}
      {/* a lower floor is roofed by the floor above, and by a terrace slab wherever nothing is built on it */}
      {!isTop && cutAll(rooms.map(roomRect), holesAbove).map((p, i) => (
        <mesh key={`t-${i}`} position={[p.x + p.w / 2, WALL_HEIGHT + 0.1, p.z + p.d / 2]} castShadow receiveShadow>
          <boxGeometry args={[p.w + 0.2, 0.2, p.d + 0.2]} />
          <meshStandardMaterial color="#cfc8bd" roughness={0.9} />
        </mesh>
      ))}
      {isTop && <Roof rooms={rooms.filter(r => r.kind !== 'balcony')} style={roofStyle} />}
    </group>
    </DayContext.Provider>
  );
}

/** The whole house (every storey, roof and lights) with no ground, sky or camera: for other scenes. */
export function HouseModel({ elements, roofStyle = 'pitched', isDay = true }) {
  const levels = useMemo(() => {
    const by = {};
    (elements || []).forEach(el => { if (el && el.type) (by[el.floor || 1] = by[el.floor || 1] || []).push(el); });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map(level => ({ level, elements: by[level] }));
  }, [elements]);
  return levels.map(({ level, elements: els }, i) => (
    <Storey key={level} elements={els} level={level} isTop={i === levels.length - 1} roofStyle={roofStyle} isDay={isDay} />
  ));
}

export { SCALE as PLAN_SCALE, FLOOR_TO_FLOOR };

function FirstPersonPlayer({ collisionSegments, bounds, initialPosition, onLockChange }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const [_isLocked, setIsLocked] = useState(false);

  // Keyboard input states
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  });

  const velocity = useRef(new THREE.Vector3());
  const bobTimer = useRef(0);

  // place the walker once, when the walkthrough starts: re-running this whenever the parent re-rendered
  // (a new bounds object each time) is what kept snapping people back to the start after a few steps
  const spawned = useRef(false);
  useEffect(() => {
    if (spawned.current) return;
    spawned.current = true;
    if (initialPosition) {
      camera.position.set(initialPosition[0], PLAYER_HEIGHT, initialPosition[1]);
    } else {
      camera.position.set(bounds.centerX, PLAYER_HEIGHT, bounds.maxZ + 3);
      camera.lookAt(bounds.centerX, PLAYER_HEIGHT, bounds.centerZ);
    }
  }, [initialPosition, bounds, camera]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true;
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame physics loop: WASD Movement + Wall Sliding Collisions
  useFrame((_, delta) => {
    if (!controlsRef.current?.isLocked) return;

    // Cap delta to prevent huge jumps on tab switch
    const dt = Math.min(delta, 0.1);
    const speed = keys.current.sprint ? 5.8 : 3.0; // m/s
    const damping = Math.exp(-10 * dt);

    // Compute camera forward & right in the horizontal XZ plane
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (keys.current.forward) moveDir.add(forward);
    if (keys.current.backward) moveDir.sub(forward);
    if (keys.current.right) moveDir.add(right);
    if (keys.current.left) moveDir.sub(right);

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
      velocity.current.x += moveDir.x * speed * 25 * dt;
      velocity.current.z += moveDir.z * speed * 25 * dt;
      bobTimer.current += dt * (keys.current.sprint ? 16 : 10);
    } else {
      bobTimer.current = 0;
    }

    // Apply damping
    velocity.current.x *= damping;
    velocity.current.z *= damping;

    // Next candidate position
    let nextX = camera.position.x + velocity.current.x * dt;
    let nextZ = camera.position.z + velocity.current.z * dt;

    // Check collision against all solid wall segments (Doorways are open so player walks through!)
    for (const seg of collisionSegments) {
      const vx = seg.x1 - seg.x0;
      const vz = seg.z1 - seg.z0;
      const segLenSq = vx * vx + vz * vz;
      if (segLenSq < 0.001) continue;

      // Project player onto segment line
      const t = Math.max(0, Math.min(1, ((nextX - seg.x0) * vx + (nextZ - seg.z0) * vz) / segLenSq));
      const closestX = seg.x0 + t * vx;
      const closestZ = seg.z0 + t * vz;

      const dx = nextX - closestX;
      const dz = nextZ - closestZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = PLAYER_RADIUS + (seg.depth || 0.2) / 2;

      if (dist < minDist && dist > 0.0001) {
        // Resolve collision: push out along normal
        const pushDist = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        nextX += nx * pushDist;
        nextZ += nz * pushDist;
      }
    }

    camera.position.x = nextX;
    camera.position.z = nextZ;

    // Subtle natural head bob
    const bobOffset = Math.sin(bobTimer.current) * (keys.current.sprint ? 0.04 : 0.02);
    camera.position.y = PLAYER_HEIGHT + bobOffset;
  });

  return (
    <>
      <PointerLockControls
        ref={controlsRef}
        onLock={() => {
          setIsLocked(true);
          onLockChange?.(true);
        }}
        onUnlock={() => {
          setIsLocked(false);
          onLockChange?.(false);
        }}
      />
    </>
  );
}

// =================================================================
// 8. MAIN EXPORTED CANVAS 3D COMPONENT
// =================================================================

export default function Canvas3D({
  elements = [],
  timeOfDay = 12,
  onPaint,
  walkthroughMode = false,
  roofStyle = 'none',          // 'none' | 'flat' | 'pitched'
  autoRotate = false,          // the camera circles the house on its own (Overview)
  onToggleWalkthrough,
  onToggleCeiling
}) {
  // walking is done on one storey; looking at the house can stack every floor
  const levels = useMemo(() => {
    const by = {};
    elements.forEach(el => { if (el) (by[el.floor || 1] = by[el.floor || 1] || []).push(el); });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map(level => ({ level, elements: by[level] }));
  }, [elements]);
  const ground = levels.length ? levels[0].elements : elements;
  const { collisionSegments, bounds } = useProcessedArchitecture(walkthroughMode ? ground : elements);
  const height = levels.length ? levels[levels.length - 1].level * FLOOR_TO_FLOOR : FLOOR_TO_FLOOR;
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // Sun calculation using SunCalc
  const date = new Date();
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  date.setHours(hours, minutes, 0, 0);
  const sunPos = SunCalc.getPosition(date, 12.9716, 77.5946);

  const sunDistance = 60;
  const sunX = sunDistance * Math.cos(sunPos.altitude) * Math.sin(sunPos.azimuth);
  const sunY = Math.max(sunDistance * Math.sin(sunPos.altitude), 2);
  const sunZ = sunDistance * Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth);
  const isDay = sunPos.altitude > 0;

  return (
    <div className="absolute inset-0 bg-zinc-950 select-none overflow-hidden" id="studio-3d-viewport">
      <Canvas
        camera={{
          // the orbit camera stands back in proportion to the house, so small and large plans both fill the view
          position: walkthroughMode ? [bounds.centerX, PLAYER_HEIGHT, bounds.maxZ + 4]
            : [bounds.centerX, Math.max(bounds.width, bounds.depth) * 0.7 + 4 + height, bounds.centerZ + Math.max(bounds.width, bounds.depth) * 0.7 + 4 + height],
          fov: walkthroughMode ? 75 : 45
        }}
        shadows
      >
        <color attach="background" args={[isDay ? '#0f0e0d' : '#030712']} />

        {/* Ambient & Natural Sunlight */}
        <ambientLight intensity={isDay ? 0.45 : 0.12} />
        <directionalLight
          position={[sunX, sunY, sunZ]}
          intensity={isDay ? 1.6 : 0.08}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        <Environment preset={isDay ? "city" : "night"} />

        {/* Ground grid */}
        <Grid
          infiniteGrid
          fadeDistance={120}
          sectionColor="#27272a"
          cellColor="#18181b"
          sectionSize={2}
          cellSize={0.5}
        />

        {/* foundation under the whole house */}
        <mesh position={[bounds.centerX, -0.1, bounds.centerZ]} receiveShadow>
          <boxGeometry args={[bounds.width + 5, 0.2, bounds.depth + 5]} />
          <meshStandardMaterial color="#2a2724" roughness={0.9} />
        </mesh>

        {/* every storey at its height; lights inside, the roof on the top one */}
        {levels.map(({ level, elements: els }, i) => (
          <Storey
            key={level}
            elements={els}
            level={levels.length > 1 ? level : 1}
            isTop={i === levels.length - 1}
            onPaint={onPaint}
            roofStyle={roofStyle}
            isDay={isDay}
          />
        ))}

        {/* Controls: First-Person Walkthrough (Feature A) vs Orbit Mode */}
        {walkthroughMode ? (
          <FirstPersonPlayer
            collisionSegments={collisionSegments}
            bounds={bounds}
            onLockChange={setIsPointerLocked}
          />
        ) : (
          <OrbitControls
            makeDefault
            target={[bounds.centerX, Math.min(height / 2, 4), bounds.centerZ]}
            maxPolarAngle={Math.PI / 2 + 0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={0.8}
            minDistance={2}
            maxDistance={180}
            dampingFactor={0.05}
          />
        )}
      </Canvas>

      {/* ============================================================= */}
      {/* HUD OVERLAYS & CONTROLS FOR WALKTHROUGH MODE (Feature A)      */}
      {/* ============================================================= */}
      {walkthroughMode && (
        <>
          {/* Center Crosshair Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="w-1 h-1 bg-white/80 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]"></div>
              <div className="absolute w-3 h-0.5 bg-white/40"></div>
              <div className="absolute h-3 w-0.5 bg-white/40"></div>
            </div>
          </div>

          {/* Dynamic Click-to-Lock Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
            {!isPointerLocked ? (
              <div className="px-5 py-2.5 rounded-full bg-zinc-950/95 backdrop-blur-md border border-emerald-500/70 text-xs font-medium text-zinc-100 shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center gap-3 animate-pulse">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>CLICK CANVAS TO ENTER FIRST-PERSON</span>
                </div>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">Lock mouse & walk with <b className="text-white">WASD</b></span>
              </div>
            ) : (
              <div className="px-5 py-2.5 rounded-full bg-zinc-950/85 backdrop-blur-md border border-zinc-700/80 text-xs font-medium text-zinc-200 shadow-2xl flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>WALKTHROUGH ACTIVE</span>
                </div>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-300">Mouse look • <b className="text-white">W A S D</b> walk • <b className="text-white">SHIFT</b> sprint • <b className="text-white">ESC</b> unlock</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
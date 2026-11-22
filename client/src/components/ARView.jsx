import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import QRCode from 'qrcode';
import { ArrowLeft, Box, Home, Loader2, Maximize, Move, RotateCcw, RotateCw, Smartphone, X } from 'lucide-react';
import { HouseModel, PLAN_SCALE } from './Canvas3D';

/*
 * AR view: the house in the real world through a phone's camera.
 *   Model      – a 1:40 model, about the size of a shoebox to a suitcase, to set on a table or the plot
 *   Life size  – the house at full size where you stand: walk into the rooms and see their real size
 * Android (Chrome) runs it in the browser with WebXR: point at the floor, tap to place, turn and resize
 * with the buttons. iPhone and iPad open Apple's AR viewer with a USDZ model of the house made on the
 * spot. On a computer the page shows the model and a QR code that opens this page on a phone.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MODEL_SCALE = 1 / 40;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function useBounds(elements) {
  return useMemo(() => {
    const shell = elements.filter(e => e.type === 'room' || e.type === 'wall');
    if (!shell.length) return null;
    const xs = [], zs = [];
    shell.forEach(e => {
      if (e.type === 'room') { xs.push(e.left, e.left + e.width); zs.push(e.top - e.height / 2, e.top + e.height / 2); }
      else { const a = ((e.angle || 0) * Math.PI) / 180; xs.push(e.left, e.left + e.width * Math.cos(a)); zs.push(e.top, e.top + e.width * Math.sin(a)); }
    });
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { cx: ((x0 + x1) / 2) * PLAN_SCALE, cz: ((z0 + z1) / 2) * PLAN_SCALE, w: (x1 - x0) * PLAN_SCALE, d: (z1 - z0) * PLAN_SCALE };
  }, [elements]);
}

/** The house centred on its own origin, standing on y = 0, at the given scale. */
function House({ elements, bounds, roof, scale, groupRef }) {
  return (
    <group ref={groupRef} scale={scale}>
      <group position={[-bounds.cx, 0, -bounds.cz]}>
        <HouseModel elements={elements} roofStyle={roof ? 'pitched' : 'none'} isDay />
      </group>
    </group>
  );
}

/** In an AR session: follow the floor with a ring, place the house where the user taps. */
function ARPlacer({ hitSource, placed, setPlaced, children, spin, size }) {
  const { gl } = useThree();
  const reticle = useRef(null);
  const anchor = useRef(null);
  const last = useRef(null);
  useEffect(() => {
    const session = gl.xr.getSession();
    if (!session) return undefined;
    const onSelect = () => {
      if (!last.current || !anchor.current) return;
      anchor.current.position.copy(last.current);
      setPlaced(true);
    };
    session.addEventListener('select', onSelect);
    return () => session.removeEventListener('select', onSelect);
  }, [gl, setPlaced]);
  useFrame((state, _delta, frame) => {
    if (!frame || !hitSource.current) return;
    const space = gl.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitSource.current);
    if (hits.length && space) {
      const pose = hits[0].getPose(space);
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      last.current = p;
      if (reticle.current) { reticle.current.visible = !placed; reticle.current.position.copy(p); }
    } else if (reticle.current) reticle.current.visible = false;
    if (anchor.current) anchor.current.rotation.y = spin;
  });
  return (
    <>
      <mesh ref={reticle} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.12, 0.16, 40]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <group ref={anchor} visible={placed} scale={size}>{children}</group>
    </>
  );
}

export default function ARView() {
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('model');            // model | life
  const [roof, setRoof] = useState(true);
  const [xrOK, setXrOK] = useState(null);               // can this browser run WebXR AR?
  const [inAR, setInAR] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [spin, setSpin] = useState(0);
  const [size, setSize] = useState(1);
  const [busy, setBusy] = useState('');
  const [qr, setQr] = useState('');
  const overlay = useRef(null);
  const glRef = useRef(null);
  const hitSource = useRef(null);
  const exportRef = useRef(null);
  const ios = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`${API_URL}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async r => {
        if (r.status === 401) { navigate(`/auth?next=${encodeURIComponent(`/ar?projectId=${projectId}`)}`); throw new Error('Please sign in.'); }
        if (!r.ok) throw new Error("This project couldn't be loaded.");
        return r.json();
      })
      .then(setProject)
      .catch(e => setError(e.message));
  }, [projectId, navigate]);
  useEffect(() => {
    let live = true;
    if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then(ok => live && setXrOK(ok)).catch(() => live && setXrOK(false));
    else setTimeout(() => live && setXrOK(false), 0);
    QRCode.toDataURL(window.location.href, { margin: 1, width: 240, color: { dark: '#0a0a0a', light: '#ffffff' } }).then(u => live && setQr(u)).catch(() => {});
    return () => { live = false; };
  }, []);

  const elements = useMemo(() => (project?.elements_data || []).filter(e => e && typeof e.type === 'string'), [project]);
  const bounds = useBounds(elements);
  const scale = mode === 'model' ? MODEL_SCALE : 1;

  // ---- Android / WebXR -------------------------------------------------------------------------
  const startAR = async () => {
    setError('');
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: overlay.current },
      });
      const gl = glRef.current;
      gl.xr.enabled = true;
      gl.xr.setReferenceSpaceType('local');
      await gl.xr.setSession(session);
      const viewer = await session.requestReferenceSpace('viewer');
      hitSource.current = await session.requestHitTestSource({ space: viewer });
      session.addEventListener('end', () => { hitSource.current = null; setInAR(false); setPlaced(false); });
      setPlaced(false); setSpin(0); setSize(1);
      setInAR(true);
    } catch (e) {
      setError(`AR couldn't start: ${e.message || e}`);
    }
  };
  const endAR = () => glRef.current?.xr.getSession()?.end();

  // ---- iPhone / iPad: Quick Look with a USDZ, made ahead so the button is a plain AR link ---------
  const [usdz, setUsdz] = useState(null);
  useEffect(() => {
    if (!ios || !project) return undefined;
    let live = true, made = null, t = null, tries = 0;
    const run = async () => {                             // once the house is in the scene and its textures drawn
      const root = exportRef.current;
      if (!root) { if (live && tries++ < 30) t = setTimeout(run, 500); return; }
      setBusy('Preparing the AR model…');
      try {
        const was = root.scale.clone();
        root.scale.setScalar(mode === 'model' ? MODEL_SCALE : 1);
        root.updateMatrixWorld(true);
        const buffer = await new USDZExporter().parseAsync(root, { quickLookCompatible: true });
        root.scale.copy(was);
        root.updateMatrixWorld(true);
        made = URL.createObjectURL(new Blob([buffer], { type: 'model/vnd.usdz+zip' }));
        if (live) setUsdz(made);
      } catch (e) {
        if (live) setError(`Couldn't make the AR model: ${e.message || e}`);
      } finally { if (live) setBusy(''); }
    };
    t = setTimeout(run, 1500);
    return () => { live = false; clearTimeout(t); if (made) URL.revokeObjectURL(made); };
  }, [ios, project, mode, roof]);

  if (!projectId) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-300">Open AR from a project.</div>;
  if (error && !project) return <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300"><p>{error}</p><Link to="/dashboard" className="text-sm underline">Your projects</Link></div>;
  if (!project) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!bounds) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-300">This plan has no walls yet.</div>;

  const span = Math.max(bounds.w, bounds.d);
  const cm = Math.round(span * MODEL_SCALE * 100);
  const chip = (on) => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${on ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:bg-white/10'}`;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Canvas
        camera={{ position: [span * 1.2, span * 1.0, span * 1.5], fov: 45, near: 0.01, far: 500 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        onCreated={({ gl }) => { glRef.current = gl; }}
        style={{ background: inAR ? 'transparent' : '#18181b' }}
      >
        <hemisphereLight args={['#ffffff', '#b9a98f', 1.0]} />
        <directionalLight position={[8, 14, 6]} intensity={1.3} />
        {inAR ? (
          <ARPlacer hitSource={hitSource} placed={placed} setPlaced={setPlaced} spin={spin} size={size * scale}>
            <House elements={elements} bounds={bounds} roof={roof} scale={1} />
          </ARPlacer>
        ) : (
          <>
            <House elements={elements} bounds={bounds} roof={roof} scale={1} groupRef={exportRef} />
            <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><circleGeometry args={[span * 0.9, 48]} /><meshStandardMaterial color="#27272a" /></mesh>
            <OrbitControls target={[0, 2, 0]} maxPolarAngle={Math.PI / 2 - 0.05} />
          </>
        )}
      </Canvas>

      {/* what's shown over the camera during AR (WebXR dom-overlay) */}
      <div ref={overlay} className={inAR ? 'pointer-events-none absolute inset-0' : 'hidden'}>
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex justify-between p-4">
          <p className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
            {placed ? (mode === 'model' ? 'Walk around the model' : 'Walk into the rooms') : 'Point at the floor, then tap to place the house'}
          </p>
          <button onClick={endAR} className="rounded-full bg-black/60 p-2 text-white"><X className="h-4 w-4" /></button>
        </div>
        {placed && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex justify-center gap-2">
            <button onClick={() => setSpin(s => s + Math.PI / 12)} className="rounded-full bg-black/60 p-3 text-white"><RotateCcw className="h-5 w-5" /></button>
            <button onClick={() => setSpin(s => s - Math.PI / 12)} className="rounded-full bg-black/60 p-3 text-white"><RotateCw className="h-5 w-5" /></button>
            {mode === 'model' && <>
              <button onClick={() => setSize(s => Math.max(0.3, s / 1.25))} className="rounded-full bg-black/60 px-4 text-lg text-white">−</button>
              <button onClick={() => setSize(s => Math.min(4, s * 1.25))} className="rounded-full bg-black/60 px-4 text-lg text-white">+</button>
            </>}
            <button onClick={() => setPlaced(false)} className="flex items-center gap-1.5 rounded-full bg-black/60 px-4 text-xs text-white"><Move className="h-4 w-4" /> Move</button>
          </div>
        )}
      </div>

      {!inAR && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <Link to={`/studio?projectId=${projectId}`} className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm backdrop-blur-md"><ArrowLeft className="h-4 w-4" /> Studio</Link>
            <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-right backdrop-blur-md">
              <p className="text-sm font-semibold">{project.name}</p>
              <p className="font-mono text-[10px] tracking-[0.2em] text-white/55">AR VIEW</p>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/65 p-4 backdrop-blur-xl sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <div className="flex rounded-lg bg-white/5 p-0.5">
                    <button onClick={() => setMode('model')} className={chip(mode === 'model')}><Box className="h-3.5 w-3.5" /> Model</button>
                    <button onClick={() => setMode('life')} className={chip(mode === 'life')}><Maximize className="h-3.5 w-3.5" /> Life size</button>
                  </div>
                  <div className="flex rounded-lg bg-white/5 p-0.5">
                    <button onClick={() => setRoof(true)} className={chip(roof)}><Home className="h-3.5 w-3.5" /> Roof</button>
                    <button onClick={() => setRoof(false)} className={chip(!roof)}>Open top</button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {mode === 'model'
                    ? `A 1:40 model, about ${cm} cm across: set it on a table, or on the plot itself to see how the house sits.`
                    : 'The house at its real size, where you stand. Best outdoors on open ground: walk in through the door and stand in each room.'}
                </p>
                {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
              </div>

              {xrOK ? (
                <button onClick={startAR} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950">
                  <Smartphone className="h-4 w-4" /> Start AR
                </button>
              ) : ios ? (
                usdz && !busy ? (
                  <a rel="ar" href={`${usdz}#allowsContentScaling=${mode === 'model' ? 1 : 0}`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950">
                    {/* Quick Look opens only from a link that holds an image */}
                    <img src={qr || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='} alt="" className="hidden" />
                    <Smartphone className="h-4 w-4" /> Open in AR
                  </a>
                ) : (
                  <span className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-5 py-3 text-sm text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin" /> {busy || 'Preparing the AR model…'}
                  </span>
                )
              ) : (
                <div className="flex items-center gap-3">
                  {qr && <img src={qr} alt="QR code that opens this AR view on a phone" className="h-28 w-28 rounded-lg" />}
                  <p className="max-w-[12rem] text-xs text-white/60">
                    {xrOK === null ? 'Checking for AR…' : 'Scan with your phone to open this view there (sign in with the same account). AR runs in Chrome on Android, and on iPhone and iPad.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

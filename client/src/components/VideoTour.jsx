import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Environment } from '@react-three/drei';
import { Clapperboard, Download, Loader2, Play, Share2, Square, X } from 'lucide-react';
import { Site, useSite, useSiteLayout, PLINTH, TIMES } from './ImmersiveView';
import { FLOOR_TO_FLOOR } from './Canvas3D';
import { cameraForRoom } from '../utils/roomCamera';
import { formatArea } from '../utils/units';

/*
 * Video tour: a short film of the house to send to family or a client. It flies in over the street,
 * drifts past the front, walks up the path to the door, then goes room by room at eye level and
 * ends on the photo renders, with titles drawn over the picture. Recorded in the browser
 * (MediaRecorder on the composited canvas) as MP4 where the browser can, otherwise WebM.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const W = 1280, H = 720, FADE = 0.4;
const ORDER = ['living', 'lounge', 'dining', 'kitchen', 'master_bedroom', 'bedroom', 'study', 'balcony', 'bathroom'];
const KIND_NAME = { living: 'Living room', lounge: 'Lounge', dining: 'Dining', kitchen: 'Kitchen', master_bedroom: 'Master bedroom', bedroom: 'Bedroom', study: 'Study', balcony: 'Balcony', bathroom: 'Bathroom', utility: 'Utility' };

const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return list.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
}

/** The shot list: [{ dur, kind: '3d' | 'photo' | 'card', cam(k) -> {pos, look}, title, sub }]. */
function useShots(elements, site, layout, photos, name) {
  return useMemo(() => {
    if (!site) return [];
    const c = Math.cos(site.rotation), s = Math.sin(site.rotation);
    const world = ([x, y, z]) => { const lx = x - site.cx, lz = z - site.cz; return [lx * c + lz * s, y + PLINTH, -lx * s + lz * c]; };
    const R = Math.max(site.W, site.D) * 0.9 + 9;
    const rooms = elements.filter(e => e.type === 'room' && e.kind !== 'hallway' && (e.area || 0) >= 3);
    const beds = rooms.filter(r => r.kind === 'bedroom' || r.kind === 'master_bedroom').length;
    const area = rooms.reduce((sum, r) => sum + (r.area || 0), 0);
    const floors = new Set(elements.map(e => e.floor || 1)).size;
    const shots = [];
    // 1. in from above the street
    shots.push({ dur: 4.5, kind: '3d', title: name || 'Your new home',
      sub: [beds ? `${beds} bedroom${beds > 1 ? 's' : ''}` : null, formatArea(area), floors > 1 ? `${floors} floors` : 'single storey'].filter(Boolean).join('  ·  '),
      big: true,
      cam: (k) => ({ pos: lerp3([-R * 0.9, R * 0.9 + 10, layout.fz + R * 1.2], [-R * 0.75, 6, R * 0.9], ease(k)), look: [0, 2.5, 0] }) });
    // 2. drift across the front
    shots.push({ dur: 6, kind: '3d', cam: (k) => {
      const a = lerp(-0.75, 0.75, ease(k));
      return { pos: [Math.sin(a) * R, 4.2 - Math.sin(k * Math.PI) * 1.2, Math.cos(a) * R], look: [0, 2.6, 0] };
    } });
    // 3. up the path to the door
    const gx = layout.gateX + layout.gateW / 2;
    shots.push({ dur: 4.5, kind: '3d', title: 'The entrance', cam: (k) => {
      const e = ease(k);
      return { pos: lerp3([gx, 1.7, layout.fz + 2.5], [site.doorX, 1.75 + PLINTH * 0.6, site.doorZ + 2.6], e),
        look: lerp3([site.doorX, 2.2, site.doorZ], [site.doorX, 1.6 + PLINTH, site.doorZ - 1], e) };
    } });
    // 4. room by room, the main rooms first, one bathroom
    const ordered = [...rooms].sort((p, q) => (ORDER.indexOf(p.kind) + 99 * (ORDER.indexOf(p.kind) < 0)) - (ORDER.indexOf(q.kind) + 99 * (ORDER.indexOf(q.kind) < 0))
      || (p.floor || 1) - (q.floor || 1) || (q.area || 0) - (p.area || 0));
    let baths = 0;
    for (const r of ordered) {
      if (r.kind === 'bathroom' && baths++ >= 1) continue;
      if (shots.length >= 12) break;
      const v = cameraForRoom(r, elements);
      const up = ((r.floor || 1) - 1) * FLOOR_TO_FLOOR;
      const p0 = world([v.position[0], v.position[1] + up, v.position[2]]);
      const t0 = world([v.target[0], v.target[1] + up, v.target[2]]);
      const dx = t0[0] - p0[0], dz = t0[2] - p0[2];
      shots.push({ dur: 3.6, kind: '3d', title: r.name || KIND_NAME[r.kind] || 'Room',
        sub: `${formatArea(r.area || 0)}${(r.floor || 1) > 1 ? `  ·  floor ${r.floor}` : ''}`, cam: (k) => {
          const e = ease(k), a = lerp(-0.14, 0.14, e);
          const ca = Math.cos(a), sa = Math.sin(a);
          const step = 0.35 * e / Math.max(0.01, Math.hypot(dx, dz));
          return { pos: [p0[0] + dx * step, p0[1], p0[2] + dz * step], look: [p0[0] + dx * ca - dz * sa, t0[1], p0[2] + dx * sa + dz * ca] };
        } });
    }
    // 5. the photo renders
    photos.slice(0, 6).forEach(p => shots.push({ dur: 3.4, kind: 'photo', image: p.image, title: p.title, sub: 'Photo render' }));
    // 6. pull back for the end
    shots.push({ dur: 4, kind: '3d', title: name || 'Your new home', sub: 'Designed with Arch-E-Tech', big: true,
      cam: (k) => ({ pos: lerp3([R * 0.55, 3, R * 0.85], [R * 0.9, 9, R * 1.4], ease(k)), look: [0, 2.4, 0] }) });
    let at = 0;
    return shots.map(sh => { const out = { ...sh, start: at }; at += sh.dur; return out; });
  }, [elements, site, layout, photos, name]);
}

function caption(ctx, shot, k) {
  if (!shot.title) return;
  const alpha = Math.min(1, k * shot.dur / 0.5, (1 - k) * shot.dur / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  if (shot.big) {
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '600 56px Inter, system-ui, sans-serif';
    ctx.fillText(shot.title, W / 2, H - 130);
    ctx.font = '400 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (shot.sub) ctx.fillText(shot.sub, W / 2, H - 86);
  } else {
    ctx.font = '600 30px Inter, system-ui, sans-serif';
    const w = Math.max(ctx.measureText(shot.title).width, shot.sub ? 200 : 0) + 48;
    ctx.fillStyle = 'rgba(12,12,14,0.62)';
    ctx.beginPath(); ctx.roundRect(40, H - 128, w, shot.sub ? 88 : 60, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(shot.title, 64, H - 86);
    if (shot.sub) { ctx.font = '400 18px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(shot.sub, 64, H - 56); }
  }
  ctx.restore();
}

/** Inside the off-screen canvas: moves the camera along the shot list, renders, and composites
 *  the frame with titles onto the visible 2D canvas (which is what gets recorded). */
function Director({ shots, clock, out, bitmaps, onEnd }) {
  useFrame(({ gl, scene, camera }) => {
    const ctx = out.current?.getContext('2d');
    if (!ctx || !shots.length) return;
    const total = shots[shots.length - 1].start + shots[shots.length - 1].dur;
    const t = clock.current.running ? (performance.now() - clock.current.t0) / 1000 : 1.6;   // the poster: just after the fade in
    if (clock.current.running && t >= total) onEnd();
    const i = Math.max(0, shots.findIndex(sh => t < sh.start + sh.dur));
    const shot = shots[i] || shots[0];
    const k = Math.min(1, (t - shot.start) / shot.dur);
    if (shot.kind === '3d') {
      const { pos, look } = shot.cam(k);
      camera.position.set(...pos);
      camera.lookAt(...look);
      camera.fov = shot.title && !shot.big ? 64 : 52;
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
      ctx.drawImage(gl.domElement, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, W, H);
      const img = bitmaps.current[shot.image];
      if (img) {
        const z = 1.04 + 0.06 * k;                                   // a slow push in
        const sc = Math.max(W / img.width, H / img.height) * z;
        ctx.drawImage(img, (W - img.width * sc) / 2 - 20 * k, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
      }
    }
    caption(ctx, shot, k);
    // fade through black between shots, and in and out of the film
    const edge = Math.min(t - shot.start, shot.start + shot.dur - t);
    if (edge < FADE) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - edge / FADE) * (i === 0 && t - shot.start < FADE ? 1 : 0.85)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, 1);
  return null;
}

export default function VideoTour({ projectId, elements, projectName, onClose }) {
  const site = useSite(elements);
  const layout = useSiteLayout(site || { W: 10, D: 10, doorX: 0 }, 'street');
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState('loading');     // loading | ready | playing | recording | done | error
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState(null);          // { url, blob, ext }
  const out = useRef(null);
  const clock = useRef({ running: false, t0: 0 });
  const bitmaps = useRef({});
  const recorder = useRef(null);
  const shots = useShots(elements, site, layout, photos, projectName);
  const total = shots.length ? shots[shots.length - 1].start + shots[shots.length - 1].dur : 0;
  const mime = useMemo(() => pickMime(), []);

  // the photo renders, decoded up front (fetched as blobs, so the canvas stays recordable)
  useEffect(() => {
    let live = true;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const names = Object.fromEntries(elements.filter(e => e.type === 'room').map(r => [r.id, r.name]));
    (projectId ? fetch(`${API_URL}/api/projects/${projectId}/renders`, { headers }).then(r => (r.ok ? r.json() : [])) : Promise.resolve([]))
      .then(async list => {
        const picks = list.filter(r => !String(r.room_key).startsWith('__') && r.furnished_image)
          .map(r => ({ image: r.furnished_image, title: names[r.room_key] || r.room_name }));
        for (const p of picks) {
          try { bitmaps.current[p.image] = await createImageBitmap(await (await fetch(p.image)).blob()); } catch { /* skip it */ }
        }
        if (live) setPhotos(picks.filter(p => bitmaps.current[p.image]));
      })
      .catch(() => {})
      .finally(() => { if (live) setTimeout(() => setState(s => (s === 'loading' ? 'ready' : s)), 1500); });
    return () => { live = false; };
  }, [projectId, elements]);

  useEffect(() => {
    if (state !== 'playing' && state !== 'recording') return;
    const id = setInterval(() => setProgress(Math.min(1, (performance.now() - clock.current.t0) / 1000 / total)), 200);
    return () => clearInterval(id);
  }, [state, total]);
  useEffect(() => () => { if (video?.url) URL.revokeObjectURL(video.url); }, [video]);

  const start = (record) => {
    setError(''); setProgress(0);
    if (record) {
      if (!out.current?.captureStream || !mime) { setError("This browser can't record video. Try Chrome or Edge on a computer."); return; }
      const chunks = [];
      const rec = new MediaRecorder(out.current.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        if (video?.url) URL.revokeObjectURL(video.url);
        setVideo({ url: URL.createObjectURL(blob), blob, ext: mime.includes('mp4') ? 'mp4' : 'webm' });
        setState('done');
      };
      rec.start(500);
      recorder.current = rec;
    }
    clock.current = { running: true, t0: performance.now() };
    setState(record ? 'recording' : 'playing');
  };
  const stop = () => {
    clock.current.running = false;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    else setState('ready');
    recorder.current = null;
  };
  const onEnd = () => {
    clock.current.running = false;
    if (recorder.current?.state === 'recording') { recorder.current.stop(); recorder.current = null; }
    else setState('ready');
  };

  const fileName = `${(projectName || 'house').replace(/[^\w-]+/g, '_')}_tour.${video?.ext || 'mp4'}`;
  const share = async () => {
    const file = new File([video.blob], fileName, { type: video.blob.type });
    try { await navigator.share({ files: [file], title: projectName || 'Our house' }); }
    catch (e) { if (e.name !== 'AbortError') setError("Sharing isn't available here; download the video instead."); }
  };
  const canShare = !!(video && navigator.canShare?.({ files: [new File([video.blob], fileName, { type: video.blob.type })] }));
  const busy = state === 'playing' || state === 'recording';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-[min(980px,100%)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Clapperboard className="h-4 w-4 text-zinc-400" /> Video tour</h3>
          <button onClick={() => { stop(); onClose(); }} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          A {Math.round(total)}-second film: the street, the way in, {shots.filter(s => s.kind === '3d' && s.title && !s.big).length - 1} rooms{photos.length ? ` and ${photos.length} photo renders` : ''}. Ready to send on WhatsApp or email.
        </p>

        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          {video && state === 'done'
            ? <video src={video.url} controls autoPlay className="aspect-video w-full" />
            : <canvas ref={out} width={W} height={H} className="aspect-video w-full" />}
          {state === 'loading' && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Setting up the shots…</p>
          )}
          {busy && <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-orange-500" style={{ width: `${progress * 100}%` }} /></div>}
          {state === 'recording' && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC</span>}
        </div>

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!busy && state !== 'done' && (
            <>
              <button disabled={state === 'loading' || !site} onClick={() => start(true)}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-50">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Record video
              </button>
              <button disabled={state === 'loading' || !site} onClick={() => start(false)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
                <Play className="h-3.5 w-3.5" /> Preview
              </button>
            </>
          )}
          {busy && (
            <button onClick={stop} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          )}
          {state === 'done' && video && (
            <>
              <a href={video.url} download={fileName} className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-white">
                <Download className="h-3.5 w-3.5" /> Download ({(video.blob.size / 1e6).toFixed(1)} MB, {video.ext.toUpperCase()})
              </a>
              {canShare && <button onClick={share} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"><Share2 className="h-3.5 w-3.5" /> Share</button>}
              <button onClick={() => { setState('ready'); setVideo(null); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Record again</button>
            </>
          )}
          <span className="ml-auto text-[10px] text-zinc-600">Keep this tab open while it records; it plays in real time.</span>
        </div>
      </div>

      {/* the 3D scene renders off screen; the picture above is composited from it */}
      {site && state !== 'done' && (
        <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
          <Canvas dpr={1} shadows gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 52, near: 0.05, far: 600, position: [0, 30, 40] }}>
            <color attach="background" args={[TIMES.noon.fog]} />
            <fog attach="fog" args={[TIMES.noon.fog, 60, 230]} />
            <Sky sunPosition={TIMES.morning.sun} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} mieDirectionalG={0.85} distance={450000} />
            <hemisphereLight args={["#dfe9f2", "#5d6b45", TIMES.morning.hemi]} />
            <ambientLight intensity={0.35} />{/* lifts the rooms indoors, where the sun does not reach */}
            <directionalLight position={TIMES.morning.sun} intensity={TIMES.morning.light} color={TIMES.morning.sunColor} castShadow
              shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={260} shadow-bias={-0.0004} />
            <Environment preset="city" environmentIntensity={0.45} />
            <Site site={site} setting="street" time="morning" elements={elements} roofStyle="pitched" camX={999} />
            <Director shots={shots} clock={clock} out={out} bitmaps={bitmaps} onEnd={onEnd} />
          </Canvas>
        </div>
      )}
    </div>
  );
}

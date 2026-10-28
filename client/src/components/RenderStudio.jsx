import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Download, Upload, RefreshCw, ImageOff, Columns, Split, AlertTriangle, Check, Loader2,
} from 'lucide-react';

/*
 * Photo Render: every room of the plan photographed twice by the AI. First the empty room, in one
 * shared look so all rooms belong to the same house; then that same room furnished the way the owner
 * describes. Images are made and stored by the backend (Cloudflare Workers AI).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STYLE_IDS = ['modern', 'japandi', 'scandinavian', 'industrial', 'contemporary', 'indian'];
const KIND_LABEL = {
  living: 'Living room', lounge: 'Lounge', dining: 'Dining room', kitchen: 'Kitchen', master_bedroom: 'Master bedroom',
  bedroom: 'Bedroom', bathroom: 'Bathroom', study: 'Study', utility: 'Utility',
};
const KIND_ORDER = ['living', 'lounge', 'dining', 'kitchen', 'master_bedroom', 'bedroom', 'study', 'bathroom', 'utility'];
const PROMPT_HINT = {
  living: 'e.g. a big L-shaped grey sofa facing a TV wall, wooden coffee table, plants by the window',
  dining: 'e.g. a round six-seater walnut table with cane chairs and a brass pendant',
  kitchen: 'e.g. white handleless cabinets, quartz counters, an island with three bar stools',
  master_bedroom: 'e.g. a king bed with an upholstered headboard, a reading chair in the corner, warm lighting',
  bedroom: 'e.g. a single bed and a study desk for a teenager, blue and white colours, lots of shelves',
  bathroom: 'e.g. a walk-in shower with black fittings, a floating wooden vanity, green tiles',
  study: 'e.g. a large desk facing the window, bookshelves on one wall, a comfy armchair',
};

const PX_PER_M = 20;

// rooms of the plan, with the facts the photos need (size, windows)
function roomsFromPlan(all) {
  const elements = (all || []).filter(e => e && typeof e === 'object');
  const windows = elements.filter(e => e.type === 'window');
  return elements
    .filter(e => e.type === 'room' && e.kind && e.kind !== 'hallway')
    .map((r, i) => {
      const x0 = r.left, x1 = r.left + r.width, y0 = r.top - r.height / 2, y1 = r.top + r.height / 2;
      const near = w => w.left >= x0 - 8 && w.left <= x1 + 8 && w.top >= y0 - 8 && w.top <= y1 + 8;
      return {
        key: r.id || `room_${i}`,
        name: r.name || KIND_LABEL[r.kind] || r.kind,
        kind: r.kind,
        floor: r.floor || 1,
        width_m: Math.round((r.width / PX_PER_M) * 10) / 10,
        depth_m: Math.round((r.height / PX_PER_M) * 10) / 10,
        area: r.area || Math.round((r.width * r.height) / (PX_PER_M * PX_PER_M)),
        windows: windows.filter(near).length,
      };
    })
    .sort((a, b) => a.floor - b.floor || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
}

function download(dataUrl, name) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

function Spinner({ label, started }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/75 backdrop-blur-sm">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-300" />
      <p className="text-sm text-zinc-200">{label}</p>
      <p className="font-mono text-xs text-zinc-500">{Math.floor((now - started) / 1000)}s · usually 5 to 20 seconds</p>
    </div>
  );
}

function Panel({ title, image, busy, children }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : children}
        {busy && <Spinner {...busy} />}
      </div>
    </div>
  );
}

function Compare({ before, after }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const move = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={ref}
      // capped so the whole picture and the controls below it fit on screen
      style={{ maxWidth: 'calc(70vh * 4 / 3)' }}
      className="relative mx-auto aspect-[4/3] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl border border-zinc-800"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) move(e.clientX); }}
    >
      <img src={after} alt="Furnished" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="Empty" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black shadow-lg">⇆</div>
      </div>
      <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">Empty</span>
      <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">Furnished</span>
    </div>
  );
}

export default function RenderStudio() {
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [renders, setRenders] = useState({});          // room_key -> stored photos
  const [enabled, setEnabled] = useState(true);
  const [styleNames, setStyleNames] = useState({});
  const [style, setStyle] = useState('modern');
  const [selected, setSelected] = useState(null);
  const [prompts, setPrompts] = useState({});
  const [busy, setBusy] = useState({});                // room_key -> { which, label, started }
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('side');            // 'side' | 'compare'
  const fileRef = useRef(null);

  const call = async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      navigate('/auth', { replace: true });
      throw new Error('Please sign in again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  };

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [proj, list, status] = await Promise.all([
          call(`/api/projects/${projectId}`),
          call(`/api/projects/${projectId}/renders`),
          call('/api/render/status'),
        ]);
        setProject(proj);
        setEnabled(status.enabled);
        setStyleNames(status.styles || {});
        setRenders(Object.fromEntries(list.map(r => [r.room_key, r])));
        setPrompts(Object.fromEntries(list.filter(r => r.prompt).map(r => [r.room_key, r.prompt])));
        const houseStyle = list.find(r => r.empty_image)?.style;
        if (houseStyle) setStyle(houseStyle);
      } catch (e) {
        setLoadError(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const rooms = useMemo(() => roomsFromPlan(project?.elements_data || []), [project]);
  useEffect(() => { if (!selected && rooms.length) setSelected(rooms[0].key); }, [rooms, selected]);
  const room = rooms.find(r => r.key === selected);
  const shot = room ? renders[room.key] : null;
  const roomBusy = room ? busy[room.key] : null;

  const run = async (target, which, label, request) => {
    setError(null);
    setBusy(b => ({ ...b, [target.key]: { which, label, started: Date.now() } }));
    try {
      const row = await request();
      setRenders(r => ({ ...r, [row.room_key]: row }));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(b => { const n = { ...b }; delete n[target.key]; return n; });
    }
  };

  const roomBody = (r) => ({ room_key: r.key, room_name: r.name, kind: r.kind, style, width_m: r.width_m, depth_m: r.depth_m, windows: r.windows });

  const makeEmpty = (r) => run(r, 'empty', `Photographing the empty ${r.name.toLowerCase()}…`,
    () => call(`/api/projects/${projectId}/renders/empty`, roomBody(r)));

  const furnish = (r) => run(r, 'furnished', `Furnishing the ${r.name.toLowerCase()}…`,
    () => call(`/api/projects/${projectId}/renders/furnish`, { room_key: r.key, style, prompt: prompts[r.key] || '' }));

  const makeAllEmpty = async () => {
    // one at a time: each new room uses the ones already made as references, so the house stays consistent
    for (const r of rooms.filter(x => !renders[x.key]?.empty_image)) {
      setSelected(r.key);
      if (!(await makeEmpty(r))) break;
    }
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !room) return;
    const reader = new FileReader();
    reader.onload = () => run(room, 'empty', 'Uploading your photo…',
      () => call(`/api/projects/${projectId}/renders/upload`, { ...roomBody(room), image: reader.result }));
    reader.readAsDataURL(file);
  };

  const missingEmpty = rooms.filter(r => !renders[r.key]?.empty_image).length;
  const styleChanged = Object.values(renders).some(r => r.empty_image && r.style !== style);

  if (!projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300">
        <p>Open Photo Render from a project in the Studio.</p>
        <Link to="/dashboard" className="text-sm text-white underline underline-offset-4">Go to your projects</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 lg:h-screen lg:flex-row lg:overflow-hidden">

      {/* left: house style and the rooms of the plan */}
      <aside className="flex shrink-0 flex-col border-b border-zinc-800 lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <Link to={`/studio?projectId=${projectId}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Back to Studio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">Photo Render</h1>
            <p className="truncate text-xs text-zinc-500">{project?.name || 'Loading…'}</p>
          </div>
        </div>

        <div className="border-b border-zinc-800 px-5 py-4">
          <p className="mb-2 text-xs font-medium text-zinc-400">House style</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_IDS.map(id => (
              <button
                key={id}
                onClick={() => setStyle(id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  style === id ? 'border-indigo-400 bg-indigo-500/15 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {styleNames[id] || id}
              </button>
            ))}
          </div>
          {styleChanged && (
            <p className="mt-2 text-[11px] leading-snug text-amber-300/90">
              Rooms already photographed keep their old style until you regenerate their empty photo.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-xs font-medium text-zinc-400">Rooms ({rooms.length})</p>
          {missingEmpty > 0 && enabled && (
            <button
              onClick={makeAllEmpty}
              disabled={Object.keys(busy).length > 0}
              className="text-xs font-medium text-indigo-300 hover:text-indigo-200 disabled:opacity-40"
            >
              Photograph all empty rooms
            </button>
          )}
        </div>
        <ul className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto">
          {rooms.map(r => {
            const s = renders[r.key];
            const thumb = s?.furnished_image || s?.empty_image;
            const on = r.key === selected;
            return (
              <li key={r.key} className="shrink-0 lg:shrink">
                <button
                  onClick={() => setSelected(r.key)}
                  className={`flex w-56 items-center gap-3 rounded-lg p-2 text-left transition-colors lg:w-full ${on ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                    {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
                    {busy[r.key] && <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-indigo-300" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-100">{r.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {r.area ? `${Math.round(r.area)} m² · ` : ''}
                      {s?.furnished_image ? <span className="text-emerald-400">Furnished</span> : s?.empty_image ? 'Empty photo ready' : 'Not photographed'}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
          {project && !rooms.length && (
            <li className="px-2 py-4 text-xs text-zinc-500">This plan has no rooms yet. Generate a layout or use Auto Detect in the Studio first.</li>
          )}
        </ul>
      </aside>

      {/* main: the selected room, empty and furnished */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">

          {!enabled && (
            <div className="mb-5 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p>AI photos aren't switched on yet. Add <code className="font-mono text-xs">CLOUDFLARE_ACCOUNT_ID</code> and{' '}
                <code className="font-mono text-xs">CLOUDFLARE_API_TOKEN</code> to the backend's environment on Render, then reload this page.
                You can still upload your own photo of an empty room.</p>
            </div>
          )}
          {loadError && <p className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{loadError}</p>}

          {room && (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{room.name}</h2>
                  <p className="text-sm text-zinc-500">
                    {KIND_LABEL[room.kind] || room.kind} · {room.width_m} × {room.depth_m} m
                    {room.windows ? ` · ${room.windows} window${room.windows > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                {shot?.empty_image && shot?.furnished_image && (
                  <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
                    <button onClick={() => setView('side')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === 'side' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>
                      <Columns className="h-3.5 w-3.5" /> Side by side
                    </button>
                    <button onClick={() => setView('compare')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === 'compare' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>
                      <Split className="h-3.5 w-3.5" /> Compare
                    </button>
                  </div>
                )}
              </div>

              {view === 'compare' && shot?.empty_image && shot?.furnished_image && !roomBusy ? (
                <Compare before={shot.empty_image} after={shot.furnished_image} />
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Panel title="1 · Empty room" image={shot?.empty_image} busy={roomBusy?.which === 'empty' ? roomBusy : null}>
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <ImageOff className="h-6 w-6 text-zinc-600" />
                      <p className="max-w-xs text-sm text-zinc-400">See this room as a bare shell, in the same style as the rest of the house.</p>
                      <button
                        onClick={() => makeEmpty(room)}
                        disabled={!enabled || !!roomBusy}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-40"
                      >
                        Photograph empty room
                      </button>
                    </div>
                  </Panel>
                  <Panel title="2 · Furnished" image={shot?.furnished_image} busy={roomBusy?.which === 'furnished' ? roomBusy : null}>
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                      <Sparkles className="h-6 w-6 text-zinc-600" />
                      <p className="max-w-xs text-sm text-zinc-400">
                        {shot?.empty_image ? 'Describe how you want it below, then furnish the room.' : 'Photograph the empty room first; it is furnished from that photo.'}
                      </p>
                    </div>
                  </Panel>
                </div>
              )}

              {/* how to furnish it */}
              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
                <label htmlFor="furnish-prompt" className="mb-2 block text-sm font-medium">How should this room be furnished?</label>
                <textarea
                  id="furnish-prompt"
                  rows={3}
                  value={prompts[room.key] || ''}
                  onChange={(e) => setPrompts(p => ({ ...p, [room.key]: e.target.value }))}
                  placeholder={PROMPT_HINT[room.kind] || 'Describe the furniture, colours and mood you want'}
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Leave it blank for a {styleNames[style] || style} {(KIND_LABEL[room.kind] || '').toLowerCase()} with the usual furniture. Your words are added on top of the house style.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => furnish(room)}
                    disabled={!enabled || !shot?.empty_image || !!roomBusy}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" /> {shot?.furnished_image ? 'Furnish again' : 'Furnish this room'}
                  </button>
                  {shot?.empty_image && (
                    <button
                      onClick={() => makeEmpty(room)}
                      disabled={!enabled || !!roomBusy}
                      className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                      title="Makes a new empty photo; the furnished one is cleared because it would no longer match"
                    >
                      <RefreshCw className="h-4 w-4" /> New empty photo
                    </button>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={!!roomBusy}
                    className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Upload className="h-4 w-4" /> Use my own photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
                  <div className="ml-auto flex gap-2">
                    {shot?.empty_image && (
                      <button onClick={() => download(shot.empty_image, `${room.name}-empty.jpg`)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">
                        <Download className="h-3.5 w-3.5" /> Empty
                      </button>
                    )}
                    {shot?.furnished_image && (
                      <button onClick={() => download(shot.furnished_image, `${room.name}-furnished.jpg`)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">
                        <Download className="h-3.5 w-3.5" /> Furnished
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                  </p>
                )}
                {shot?.furnished_image && !error && !roomBusy && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" /> Saved with this project.</p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

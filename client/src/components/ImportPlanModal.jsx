import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Ruler, ScanLine, Upload, X } from 'lucide-react';
import { formatArea, isImperial } from '../utils/units';

/*
 * Import a floor plan drawing (photo, scan or PDF) as an editable plan.
 *
 *   pick     choose the file; opt in to sharing it to improve the reader
 *   reading  the backend sends it to the plan reader (model + OCR)
 *   review   the detected plan over the faded drawing; fix the scale by measuring one known length
 *
 * Mount it only while it is open, so each import starts fresh.
 * onAccept({ elements, name }) applies the plan and resolves to the project id it went into;
 * onFinished(projectId) runs once the import has been recorded.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const U = 20;          // plan units per metre
const ORIGIN = 100;    // imported plans start here (plan units)
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const MAX_MB = 15;
const ROOM_FILL = {
  living: '#f5d796', dining: '#f0c98a', lounge: '#efe6c8', kitchen: '#f0a06e', bedroom: '#a0c8f0',
  master_bedroom: '#7fb2ea', bathroom: '#8cdcdc', balcony: '#aadc8c', hallway: '#d4d4d8', study: '#c9e4c5',
  utility: '#d9c3a5',
  closet: '#c9a27a',
};
const SCALE_SOURCE = {
  given: 'set by you',
  'dimension text': 'read from the room sizes written on the drawing',
  'wall thickness': 'estimated from wall thickness — measure a known length to be sure',
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// stretch the whole plan about its origin, e.g. after measuring a known length
function scaleElements(elements, f) {
  const s = (v) => Math.round(ORIGIN + (v - ORIGIN) * f);
  return elements.map(e => (e.type === 'room'
    ? { ...e, left: s(e.left), top: s(e.top), width: Math.round(e.width * f), height: Math.round(e.height * f),
        area: Math.round(e.area * f * f * 10) / 10 }
    : { ...e, left: s(e.left), top: s(e.top), width: Math.round(e.width * f) }));
}

const scaleMatrix = (m, f) => ({ a: m.a * f, b: m.b * f, c: m.c * f, d: m.d * f,
  e: ORIGIN + (m.e - ORIGIN) * f, f: ORIGIN + (m.f - ORIGIN) * f });

function lineEnds(e) {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return [e.left, e.top, e.left + e.width * Math.cos(a), e.top + e.width * Math.sin(a)];
}

function PlanPreview({ elements, image, matrix, drawingOpacity, measuring, points, onPoint }) {
  const svgRef = useRef(null);
  const box = useMemo(() => {
    const xs = [], ys = [];
    for (const e of elements) {
      if (e.type === 'room') { xs.push(e.left, e.left + e.width); ys.push(e.top - e.height / 2, e.top + e.height / 2); }
      else { const [x0, y0, x1, y1] = lineEnds(e); xs.push(x0, x1); ys.push(y0, y1); }
    }
    const pad = 30;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
  }, [elements]);

  const click = (ev) => {
    if (!measuring || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    onPoint({ x: p.x, y: p.y });
  };

  const rooms = elements.filter(e => e.type === 'room');
  const lines = (type) => elements.filter(e => e.type === type);
  return (
    <svg ref={svgRef} viewBox={box.join(' ')} onClick={click}
      className={`h-full w-full rounded-lg bg-white ${measuring ? 'cursor-crosshair' : ''}`}>
      {image?.preview && matrix && (
        <image href={image.preview} width={image.width} height={image.height} opacity={drawingOpacity}
          transform={`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`} />
      )}
      {rooms.map(r => (
        <g key={r.id}>
          <rect x={r.left} y={r.top - r.height / 2} width={r.width} height={r.height}
            fill={ROOM_FILL[r.kind] || '#e4e4e7'} fillOpacity={0.45} />
          <text x={r.left + r.width / 2} y={r.top} textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(9, Math.min(r.width, r.height) / 7)} fill="#18181b" fontFamily="sans-serif">
            {r.name}
          </text>
        </g>
      ))}
      {lines('wall').map(w => { const [x0, y0, x1, y1] = lineEnds(w);
        return <line key={w.id} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#18181b" strokeWidth={8} strokeLinecap="square" />; })}
      {lines('window').map(w => { const [x0, y0, x1, y1] = lineEnds(w);
        return <line key={w.id} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#3b82f6" strokeWidth={6} />; })}
      {lines('door').map(w => { const [x0, y0, x1, y1] = lineEnds(w);
        return <line key={w.id} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ef4444" strokeWidth={6} />; })}
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5} fill="#c8794a" stroke="white" strokeWidth={2} />)}
      {points.length === 2 && (
        <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#c8794a" strokeWidth={3} strokeDasharray="8 5" />
      )}
    </svg>
  );
}

export default function ImportPlanModal({ onClose, mode = 'new', floorLabel = 'this floor', onAccept, onFinished }) {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [elements, setElements] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [scaleNote, setScaleNote] = useState('');
  const [drawingOpacity, setDrawingOpacity] = useState(0.35);
  const [measuring, setMeasuring] = useState(false);
  const [points, setPoints] = useState([]);
  const [lengthText, setLengthText] = useState('');
  const inputRef = useRef(null);
  const imperial = isImperial();

  useEffect(() => {
    fetch(`${API_URL}/api/plan-imports/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : { configured: false }))
      .then(d => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && step !== 'reading' && step !== 'saving') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const choose = (f) => {
    setError('');
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) { setError('Choose a PNG, JPEG, WebP or PDF.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`That file is larger than ${MAX_MB} MB.`); return; }
    setFile(f);
  };

  const read = async () => {
    if (!file) return;
    setStep('reading'); setError('');
    const body = new FormData();
    body.append('file', file);
    body.append('consent', consent ? 'true' : 'false');
    try {
      const res = await fetch(`${API_URL}/api/plan-imports`, { method: 'POST', headers: authHeaders(), body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Your session has ended. Log in again and retry.');
      if (!res.ok) throw new Error(data.detail || `The server answered ${res.status}.`);
      setResult(data);
      setElements(data.elements);
      setMatrix(data.info.image_to_plan);
      setScaleNote(SCALE_SOURCE[data.info.scale] || data.info.scale);
      setStep('review');
    } catch (e) {
      setError(e.message || 'Something went wrong reading the plan.');
      setStep('pick');
    }
  };

  const applyScale = () => {
    const raw = parseFloat(lengthText);
    if (points.length !== 2 || !(raw > 0)) return;
    const metres = imperial ? raw * 0.3048 : raw;
    const measured = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / U;
    if (measured <= 0) return;
    const f = metres / measured;
    setElements(els => scaleElements(els, f));
    setMatrix(m => scaleMatrix(m, f));
    setScaleNote(SCALE_SOURCE.given);
    setMeasuring(false); setPoints([]); setLengthText('');
  };

  const accept = async () => {
    setStep('saving'); setError('');
    try {
      const name = (file?.name || 'Imported plan').replace(/\.[^.]+$/, '').slice(0, 60) || 'Imported plan';
      const projectId = await onAccept({ elements, name });
      if (projectId) {
        // record what was accepted (kept only if the owner agreed to share it)
        await fetch(`${API_URL}/api/plan-imports/${result.id}/accept`, {
          method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: Number(projectId), elements, image_to_plan: matrix }),
        }).catch(() => {});
      }
      onFinished?.(projectId);
    } catch (e) {
      setError(e.message || 'Could not save the plan.');
      setStep('review');
    }
  };

  const counts = result ? result.info : null;
  const totalArea = elements.filter(e => e.type === 'room' && e.kind !== 'hallway').reduce((s, r) => s + (r.area || 0), 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && step === 'pick') onClose(); }}>
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl ${step === 'review' || step === 'saving' ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ScanLine className="h-4 w-4 text-indigo-300" />
            <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-400">IMPORT A FLOOR PLAN</p>
          </div>
          <button onClick={onClose} disabled={step === 'reading' || step === 'saving'} title="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-30">
            <X className="h-4 w-4" />
          </button>
        </div>

        {(step === 'pick' || step === 'reading') && (
          <div className="space-y-4 p-5">
            <p className="text-sm text-zinc-400">
              Upload a photo, scan or PDF of a floor plan. Walls, doors, windows and rooms are traced into an
              editable plan{mode === 'replace' ? <> that replaces <span className="text-zinc-200">{floorLabel}</span> (you can undo)</> : ''}.
            </p>
            {configured === false && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Plan import isn't set up on this server yet.
              </p>
            )}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={step === 'reading'}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]); }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-4 py-8 text-center transition-colors hover:border-zinc-500">
              <Upload className="h-5 w-5 text-zinc-400" />
              <span className="text-sm text-zinc-200">{file ? file.name : 'Choose a file or drop it here'}</span>
              <span className="text-[11px] text-zinc-500">PNG, JPEG, WebP or PDF (first page), up to {MAX_MB} MB</span>
            </button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-400">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-indigo-500" disabled={step === 'reading'} />
              <span>Share this drawing and the plan I accept to help improve plan reading. Off by default; when off,
                the drawing isn't kept.</span>
            </label>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            <div className="flex justify-end">
              <button onClick={read} disabled={!file || step === 'reading' || configured === false}
                className="btn-primary px-5 py-2">
                {step === 'reading' ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading the plan…</> : 'Read plan'}
              </button>
            </div>
          </div>
        )}

        {(step === 'review' || step === 'saving') && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[1fr_17rem]">
            <div className="min-h-[50vh] bg-zinc-900 p-3">
              <PlanPreview elements={elements} image={result?.image} matrix={matrix} drawingOpacity={drawingOpacity}
                measuring={measuring} points={points}
                onPoint={(p) => setPoints(ps => (ps.length >= 2 ? [p] : [...ps, p]))} />
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto border-t border-zinc-800 p-4 md:border-l md:border-t-0">
              <div>
                <p className="label-caps">FOUND</p>
                <p className="mt-1 text-sm text-zinc-200">
                  {counts.rooms} rooms · {counts.walls} walls · {counts.doors} doors · {counts.windows} windows
                </p>
                <p className="mt-1 text-xs text-zinc-500">About {formatArea(totalArea)} of rooms</p>
              </div>
              <div>
                <p className="label-caps">SCALE</p>
                <p className="mt-1 text-xs text-zinc-400">{scaleNote}</p>
                {!measuring ? (
                  <button onClick={() => { setMeasuring(true); setPoints([]); }}
                    className="btn-secondary mt-2 gap-2 px-3 py-1.5 text-xs">
                    <Ruler className="h-3.5 w-3.5" /> Measure a known length
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                    <p className="text-[11px] text-zinc-400">
                      {points.length < 2 ? `Click ${points.length === 0 ? 'the two ends' : 'the other end'} of a wall whose length you know.`
                        : `How long is that, in ${imperial ? 'feet' : 'metres'}?`}
                    </p>
                    {points.length === 2 && (
                      <div className="flex gap-2">
                        <input autoFocus type="number" min="0" step="0.1" value={lengthText}
                          onChange={(e) => setLengthText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyScale(); }}
                          className="w-full rounded bg-zinc-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        <button onClick={applyScale} className="btn-primary px-2.5 py-0 text-xs">Set</button>
                      </div>
                    )}
                    <button onClick={() => { setMeasuring(false); setPoints([]); }} className="text-[11px] text-zinc-500 hover:text-zinc-300">Cancel</button>
                  </div>
                )}
              </div>
              <div>
                <p className="label-caps">ORIGINAL DRAWING</p>
                <input type="range" min="0" max="1" step="0.05" value={drawingOpacity}
                  onChange={(e) => setDrawingOpacity(Number(e.target.value))} className="mt-2 w-full accent-indigo-500" />
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Check that the walls sit on the drawing. Anything missed or misread can be fixed in the Studio:
                rename rooms in Rooms, and redraw walls, doors and windows.
              </p>
              {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
              <div className="mt-auto flex gap-2">
                <button onClick={() => setStep('pick')} disabled={step === 'saving'}
                  className="btn-secondary flex-1 px-3 py-2 text-xs">
                  Back
                </button>
                <button onClick={accept} disabled={step === 'saving'}
                  className="btn-primary flex-[2] px-3 py-2 text-xs">
                  {step === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {mode === 'replace' ? `Use on ${floorLabel}` : 'Create project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

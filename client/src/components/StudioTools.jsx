import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, Download, ScanLine, LayoutTemplate, Image as ImageIcon, Wand2 as Wand } from 'lucide-react';
import { detectRooms } from '../utils/detectRooms';

/*
 * The Studio's tool panels: Auto Detect (label the rooms your walls enclose), AI Layout (a new plan
 * from a description) and Concept Viz (the plan as a 3D cutaway or the finished house, by AI).
 */

const KINDS = [
  ['living', 'Living room'], ['dining', 'Dining room'], ['kitchen', 'Kitchen'], ['master_bedroom', 'Master bedroom'],
  ['bedroom', 'Bedroom'], ['bathroom', 'Bathroom'], ['study', 'Study'], ['utility', 'Utility'], ['lounge', 'Lounge'],
];
const KIND_NAME = Object.fromEntries(KINDS);
const STYLE_IDS = ['modern', 'japandi', 'scandinavian', 'industrial', 'contemporary', 'indian'];
const STYLE_NAME = {
  modern: 'Modern', japandi: 'Japandi', scandinavian: 'Scandinavian', industrial: 'Industrial loft',
  contemporary: 'Warm contemporary', indian: 'Modern Indian',
};

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

function Panel({ icon: Icon, title, onClose, wide, children }) {
  return (
    <div className={`absolute top-24 right-6 z-30 flex max-h-[calc(100%-8rem)] flex-col rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl ${wide ? 'w-[min(720px,calc(100%-3rem))]' : 'w-[min(380px,calc(100%-3rem))]'}`}>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="h-4 w-4 text-zinc-400" /> {title}</h3>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="overflow-y-auto p-4 custom-scrollbar">{children}</div>
    </div>
  );
}

const ErrorLine = ({ children }) => (
  <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {children}
  </p>
);

// ------------------------------------------------------------------------------------------------
// Auto Detect
// ------------------------------------------------------------------------------------------------
export function AutoDetectPanel({ elements, setElements, onClose }) {
  const [found, setFound] = useState(() => detectRooms(elements));
  const walls = elements.filter(e => e.type === 'wall').length;

  const update = (id, patch) => setFound(f => f.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => {
    setElements(prev => [...prev, ...found]);
    onClose();
  };

  return (
    <Panel icon={ScanLine} title="Auto Detect rooms" onClose={onClose}>
      {found.length === 0 ? (
        <p className="text-sm leading-relaxed text-zinc-400">
          {walls < 3
            ? 'Draw the walls of your plan first (W). Every space the walls fully enclose becomes a room.'
            : 'No new enclosed spaces found. Make sure the walls meet at the corners (turn on Smart Snap to close them exactly), and that the space isn\'t already labelled.'}
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-400">
            Found {found.length} enclosed space{found.length > 1 ? 's' : ''}. Types are guessed from size; change any before adding.
          </p>
          <ul className="space-y-2">
            {found.map(r => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                <input
                  value={r.name}
                  onChange={e => update(r.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded bg-zinc-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={r.kind}
                  onChange={e => update(r.id, { kind: e.target.value, name: r.name.startsWith('Room ') || Object.values(KIND_NAME).includes(r.name) ? KIND_NAME[e.target.value] : r.name })}
                  className="rounded bg-zinc-950 px-1.5 py-1 text-xs text-zinc-200 focus:outline-none"
                >
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <span className="w-12 text-right font-mono text-[11px] text-zinc-500">{r.area} m²</span>
              </li>
            ))}
          </ul>
          <button onClick={add} className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Add {found.length} room{found.length > 1 ? 's' : ''} to the plan
          </button>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// AI Layout
// ------------------------------------------------------------------------------------------------
export function AiLayoutPanel({ elements, setElements, onClose, apiUrl }) {
  const [prompt, setPrompt] = useState(() => localStorage.getItem('ai_layout_prompt') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const hasPlan = elements.some(e => e.type === 'wall');

  const generate = async () => {
    setBusy(true); setError(null); setDone(false);
    try {
      localStorage.setItem('ai_layout_prompt', prompt);
      const data = await post(`${apiUrl}/api/ai/generate-plan`, { prompt: prompt.trim() || 'A modern 2 bedroom house' });
      if (!data.elements?.length) throw new Error('The generator returned an empty plan. Try describing it differently.');
      setElements(data.elements);
      setDone(true);
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? "Can't reach the server. It may be waking up; try again in a few seconds." : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={LayoutTemplate} title="AI Layout" onClose={onClose}>
      <label className="mb-1.5 block text-xs text-zinc-400" htmlFor="ai-layout-prompt">Describe the home</label>
      <textarea
        id="ai-layout-prompt"
        rows={4}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="e.g. 3 bedroom house with an open kitchen, a study and 2 bathrooms, about 1600 sq ft"
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
      />
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Mention bedrooms, bathrooms, a study, dining or a total area; anything you leave out gets a sensible default.
      </p>
      {hasPlan && <p className="mt-2 text-[11px] text-amber-300/90">This replaces the current plan. Press Ctrl+Z (⌘Z) to get it back.</p>}
      <button
        onClick={generate}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Designing the plan…</> : done ? 'Try another variation' : 'Generate plan'}
      </button>
      {done && !busy && <p className="mt-2 text-center text-[11px] text-emerald-400">New plan drawn. Each try places the rooms differently.</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Concept Viz
// ------------------------------------------------------------------------------------------------
const snapshotPlan = () => new Promise(resolve => window.dispatchEvent(new CustomEvent('plan-snapshot', { detail: { resolve } })));

export function ConceptVizPanel({ elements, projectId, onClose, apiUrl }) {
  const [mode, setMode] = useState('cutaway');
  const [style, setStyle] = useState(() => localStorage.getItem('concept_style') || 'modern');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState({});       // mode -> data URL
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // earlier concepts of this project
  useEffect(() => {
    if (!projectId) return;
    fetch(`${apiUrl}/api/projects/${projectId}/renders`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(list => setImages(Object.fromEntries(list.filter(r => r.room_key.startsWith('__concept_') && r.furnished_image)
        .map(r => [r.room_key.replace(/__concept_|__/g, ''), r.furnished_image]))))
      .catch(() => {});
  }, [projectId, apiUrl]);

  const rooms = elements.filter(e => e.type === 'room').map(r => r.name || KIND_NAME[r.kind] || r.kind);

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const snap = await snapshotPlan();
      if (!snap) throw new Error('The plan is empty. Draw or generate a layout first.');
      localStorage.setItem('concept_style', style);
      const data = await post(`${apiUrl}/api/projects/${projectId}/concept`, {
        plan_image: snap.url, aspect: snap.aspect, mode, style, prompt, rooms,
      });
      setImages(i => ({ ...i, [mode]: data.image }));
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? "Can't reach the server. It may be waking up; try again in a few seconds." : e.message);
    } finally {
      setBusy(false);
    }
  };

  const image = images[mode];
  return (
    <Panel icon={ImageIcon} title="Concept Viz" onClose={onClose} wide>
      {!projectId ? (
        <p className="text-sm text-zinc-400">Save this plan as a project first (Save Cloud), then come back to visualise it.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {image
              ? <img src={image} alt={`Concept: ${mode}`} className="h-full w-full object-contain" />
              : <p className="max-w-xs px-6 text-center text-sm text-zinc-500">
                  {mode === 'cutaway' ? 'Your floor plan as a furnished 3D cutaway of the whole house.' : 'What the finished house could look like from the outside.'}
                </p>}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/75">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
                <p className="text-xs text-zinc-300">Rendering from your plan… usually 5 to 20 seconds</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
              {[['cutaway', '3D cutaway'], ['exterior', 'Exterior']].map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)} className={`flex-1 rounded-md py-1.5 ${mode === id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>{label}</button>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] text-zinc-500">Style</p>
              <div className="flex flex-wrap gap-1">
                {STYLE_IDS.map(id => (
                  <button key={id} onClick={() => setStyle(id)} className={`rounded-full border px-2 py-0.5 text-[11px] ${style === id ? 'border-indigo-400 bg-indigo-500/15 text-white' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                    {STYLE_NAME[id]}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={mode === 'cutaway' ? 'Optional: e.g. warm evening light, lots of plants' : 'Optional: e.g. sloped roof, stone cladding, a pool'}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
            <button onClick={generate} disabled={busy} className="rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {image ? 'Render again' : 'Render concept'}
            </button>
            {image && (
              <a href={image} download={`concept-${mode}.jpg`} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
          </div>
          {error && <div className="md:col-span-2"><ErrorLine>{error}</ErrorLine></div>}
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Edit with AI: a command bar under the plan ("make this door narrower")
// ------------------------------------------------------------------------------------------------
const TYPE_LABEL = {
  wall: 'Wall', door: 'Door', window: 'Window', stairs: 'Stairs', furniture_bed: 'Bed', furniture_sofa: 'Sofa',
  furniture_table: 'Table', furniture_armchair: 'Armchair', furniture_bathtub: 'Bathtub', furniture_vanity: 'Vanity',
  furniture_kitchen: 'Kitchen counter',
};
const EXAMPLES = {
  door: ['Make this door narrower', 'Make it 1 m wide', 'Move it 50 cm to the left'],
  window: ['Make this window wider', 'Make it 1.8 m long', 'Delete this window'],
  wall: ['Extend this wall by 1 m', 'Shorten it by 50 cm', 'Add a window in the middle of it'],
  none: ['Make the kitchen door 1 m wide', 'Add a window to the living room', 'Make the master bedroom bigger'],
};

export function EditBar({ elements, setElements, selected, apiUrl }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);     // { ok, text }

  const sel = selected[0];
  const examples = EXAMPLES[sel?.type] || (sel ? EXAMPLES.door.slice(1, 2).concat(['Delete this', 'Rotate it 90 degrees']) : EXAMPLES.none);

  const run = async (instruction) => {
    const ask = (instruction ?? text).trim();
    if (!ask || busy) return;
    setBusy(true); setNote(null);
    try {
      const data = await post(`${apiUrl}/api/ai/edit-plan`, { instruction: ask, elements, selected: selected.map(s => s.id) });
      if (data.changed > 0) {
        setElements(data.elements);
        setText('');
        setNote({ ok: true, text: `${data.summary} Press Ctrl+Z (⌘Z) to undo.` });
      } else {
        setNote({ ok: false, text: data.summary });
      }
    } catch (e) {
      setNote({ ok: false, text: e.message === 'Failed to fetch' ? "Can't reach the server. It may be waking up; try again in a few seconds." : e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    // starts right of the scale box (bottom-left) and stops short of the chat button (bottom-right)
    <div className="absolute bottom-6 left-[21rem] right-24 z-20 max-w-2xl">
      {note && (
        <p className={`mb-2 rounded-lg px-3 py-2 text-xs shadow-lg ${note.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-100'}`}>
          {note.text}
        </p>
      )}
      <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Wand className="ml-1.5 h-4 w-4 shrink-0 text-indigo-300" />
          {sel && (
            <span className="shrink-0 rounded-md bg-indigo-500/15 px-2 py-1 text-[11px] text-indigo-200">
              {selected.length > 1 ? `${selected.length} selected` : `${TYPE_LABEL[sel.type] || sel.type}${sel.length ? ` · ${sel.length.toFixed(1)} m` : ''}`}
            </span>
          )}
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(); e.stopPropagation(); }}
            placeholder={sel ? `Describe a change to the selected ${(TYPE_LABEL[sel.type] || 'item').toLowerCase()}…` : 'Edit the plan with AI, e.g. "make the kitchen door 1 m wide"'}
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            disabled={busy}
          />
          <button
            onClick={() => run()}
            disabled={busy || !text.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Editing…</> : 'Apply'}
          </button>
        </div>
        {!busy && !text && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
            {examples.map(x => (
              <button key={x} onClick={() => setText(x)} className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200">{x}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, Download, ScanLine, LayoutTemplate, Image as ImageIcon, Wand2 as Wand, Home, Bookmark, Check, Wallet } from 'lucide-react';
import { detectRooms } from '../utils/detectRooms';
import InfoTip from './InfoTip';
import { formatArea, formatMoney, currencyCode, CURRENCY } from '../utils/units';
import { downloadPlanSheet } from '../utils/planSheet';

/*
 * The Studio's tool panels: Auto Detect (label the rooms your walls enclose), AI Layout (a new plan
 * from a description) and Concept Viz (the plan as a 3D cutaway or the finished house, by AI).
 */

const KINDS = [
  ['living', 'Living room'], ['dining', 'Dining room'], ['kitchen', 'Kitchen'], ['master_bedroom', 'Master bedroom'],
  ['bedroom', 'Bedroom'], ['bathroom', 'Bathroom'], ['study', 'Study'], ['utility', 'Utility'], ['closet', 'Walk-in closet'], ['lounge', 'Lounge'],
  ['hallway', 'Hallway'], ['balcony', 'Balcony'], ['patio', 'Patio'],
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

function Panel({ icon: Icon, title, info, onClose, wide, bottom, children }) {
  // most tools open on the right; AI Edit sits along the bottom of the grid, under the plan
  const place = bottom
    ? 'bottom-6 left-[21rem] right-[calc(var(--dock,1.5rem)+4.5rem)] max-w-2xl max-h-[45%]'
    : `top-24 right-[var(--dock,1.5rem)] max-h-[calc(100%-8rem)] ${wide ? 'w-[min(720px,calc(100%-3rem))]' : 'w-[min(380px,calc(100%-3rem))]'}`;
  return (
    <div className={`absolute z-30 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl ${place}`}>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-zinc-400" /> {title} {info && <InfoTip id={info} />}
        </h3>
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
    <Panel icon={ScanLine} title="Auto Detect rooms" info="detect" onClose={onClose}>
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
                <span className="w-20 text-right font-mono text-[11px] text-zinc-500">{formatArea(r.area)}</span>
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
    <Panel icon={LayoutTemplate} title="AI Layout" info="layout" onClose={onClose}>
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
  const [savedFor, setSavedFor] = useState(null);   // the image last saved, so the button shows it

  const save = async () => {
    try {
      await post(`${apiUrl}/api/photos`, {
        project_id: Number(projectId), kind: mode, style, prompt,
        title: `${mode === 'cutaway' ? '3D cutaway' : 'Exterior'} · ${STYLE_NAME[style]}`, image: images[mode],
      });
      setSavedFor(images[mode]);
    } catch (e) {
      setError(e.message);
    }
  };

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
    <Panel icon={ImageIcon} title="Concept Viz" info="concept" onClose={onClose} wide>
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
              <button onClick={save} disabled={savedFor === image} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:text-emerald-400">
                {savedFor === image ? <><Check className="h-3.5 w-3.5" /> Saved to photos</> : <><Bookmark className="h-3.5 w-3.5" /> Save to photos</>}
              </button>
            )}
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
  door: ['Make this door narrower', 'Make it 3 ft wide', 'Move it 2 ft to the left'],
  window: ['Make this window wider', 'Make it 6 ft long', 'Delete this window'],
  wall: ['Extend this wall by 3 ft', 'Shorten it by 2 ft', 'Add a window in the middle of it'],
  none: ['Make the kitchen door 3 ft wide', 'Add a window to the living room', 'Make the master bedroom bigger'],
};

export function EditPanel({ elements, setElements, selected, apiUrl, onClose }) {
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
    <Panel icon={Wand} title="AI Edit" info="edit" onClose={onClose} bottom>
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        {sel ? (
          <span className="rounded-md bg-indigo-500/15 px-2 py-1 text-indigo-200">
            Selected: {selected.length > 1 ? `${selected.length} items` : `${TYPE_LABEL[sel.type] || sel.type}${sel.length ? ` · ${sel.length.toFixed(1)} m` : ''}`}
          </span>
        ) : (
          <span className="text-zinc-500">Nothing selected. Click an item on the plan to edit "this", or name what to change.</span>
        )}
      </div>
      <div className="flex items-start gap-2">
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } e.stopPropagation(); }}
        placeholder={sel ? `Describe a change to the selected ${(TYPE_LABEL[sel.type] || 'item').toLowerCase()}…` : 'e.g. make the kitchen door 3 ft wide'}
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
        disabled={busy}
        autoFocus
      />
      <button
        onClick={() => run()}
        disabled={busy || !text.trim()}
        className="flex h-[60px] shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Editing…</> : 'Apply'}
      </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map(x => (
          <button key={x} onClick={() => setText(x)} className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200">{x}</button>
        ))}
      </div>
      {note && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${note.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-100'}`}>{note.text}</p>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Rooms: rename rooms and set their type
// ------------------------------------------------------------------------------------------------
export function RoomsPanel({ elements, setElements, onClose }) {
  const rooms = elements.filter(e => e.type === 'room');
  const [draft, setDraft] = useState(() => Object.fromEntries(rooms.map(r => [r.id, { name: r.name || '', kind: r.kind || 'living' }])));
  const changed = rooms.some(r => draft[r.id] && (draft[r.id].name.trim() !== (r.name || '') || draft[r.id].kind !== (r.kind || 'living')));
  const dupes = (() => {
    const seen = {};
    rooms.forEach(r => { const n = (draft[r.id]?.name || '').trim().toLowerCase(); if (n) seen[n] = (seen[n] || 0) + 1; });
    return new Set(Object.keys(seen).filter(n => seen[n] > 1));
  })();

  const apply = () => {
    setElements(prev => prev.map(el => {
      const d = el.type === 'room' && draft[el.id];
      if (!d) return el;
      return { ...el, name: d.name.trim() || KIND_NAME[d.kind] || 'Room', kind: d.kind };
    }));
    onClose();
  };

  return (
    <Panel icon={Home} title="Rooms" info="rooms" onClose={onClose}>
      {rooms.length === 0 ? (
        <p className="text-sm text-zinc-400">No rooms yet. Generate a layout with AI Layout, or draw walls and use Auto Detect.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {rooms.map(r => {
              const d = draft[r.id] || { name: '', kind: 'living' };
              const dup = dupes.has(d.name.trim().toLowerCase());
              return (
                <li key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={d.name}
                      onChange={e => setDraft(x => ({ ...x, [r.id]: { ...d, name: e.target.value } }))}
                      onKeyDown={e => e.stopPropagation()}
                      maxLength={40}
                      placeholder={KIND_NAME[d.kind]}
                      className={`min-w-0 flex-1 rounded bg-zinc-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 ${dup ? 'ring-1 ring-amber-500/60 focus:ring-amber-500' : 'focus:ring-indigo-500'}`}
                    />
                    <select
                      value={d.kind}
                      onChange={e => setDraft(x => ({ ...x, [r.id]: { ...d, kind: e.target.value } }))}
                      className="rounded bg-zinc-950 px-1.5 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <span className="w-20 text-right font-mono text-[11px] text-zinc-500">{formatArea(r.area)}</span>
                  </div>
                  {dup && <p className="mt-1 text-[10px] text-amber-300/90">Another room has this name; a unique name is easier to tell apart.</p>}
                </li>
              );
            })}
          </ul>
          <button onClick={apply} disabled={!changed} className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
            Save room names
          </button>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Budget Advisor: compare the live estimate with the owner's budget and find where to cut
// ------------------------------------------------------------------------------------------------
const IMPACT_STYLE = {
  low: ['Barely noticed', 'border-emerald-500/30 text-emerald-300'],
  medium: ['Some change', 'border-amber-500/30 text-amber-300'],
  high: ['Big change', 'border-rose-500/30 text-rose-300'],
};

export function BudgetPanel({ elements, setElements, costs, projectId, apiUrl, onClose }) {
  const code = currencyCode();
  const { symbol, locale } = CURRENCY[code];
  const fmt = (v) => `${symbol}${Math.round(v).toLocaleString(locale)}`;
  const short = (v) => (code === 'INR'
    ? (Math.abs(v) >= 1e7 ? `${symbol}${(v / 1e7).toFixed(2)} Cr` : `${symbol}${(v / 1e5).toFixed(1)} L`)
    : `${symbol}${Math.round(v / 1000).toLocaleString(locale)}k`);
  const key = `budget_${projectId || 'draft'}`;
  const [budget, setBudget] = useState(() => { try { return Number(localStorage.getItem(key)) || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState(new Set());

  const total = costs.total;
  const gap = budget ? total - budget : 0;
  const saved = advice ? advice.suggestions.filter((_, i) => picked.has(i)).reduce((s, x) => s + x.saving, 0) : 0;
  const after = total - saved;

  const setB = (v) => {
    const n = Math.max(0, Number(String(v).replace(/[^\d.]/g, '')) || 0);
    setBudget(n || '');
    try { localStorage.setItem(key, String(n)); } catch { /* private mode */ }
  };

  const analyse = async () => {
    setBusy(true); setError(null); setAdvice(null); setPicked(new Set()); setApplied(new Set());
    try {
      const rooms = elements.filter(e => e.type === 'room').map(r => ({ name: r.name, kind: r.kind, floor: r.floor || 1, area_sqft: Math.round((r.area || 0) * 10.7639) }));
      const data = await post(`${apiUrl}/api/ai/budget-advice`, {
        budget: Number(budget), currency_symbol: symbol, total,
        breakdown: costs.breakdown.map(b => ({ key: b.key, label: b.label, qty: b.qty, cost: b.cost })),
        rooms, floors: Math.max(1, ...elements.map(e => e.floor || 1)),
        area_sqft: rooms.reduce((s, r) => s + r.area_sqft, 0),
      });
      setAdvice(data);
      // pre-tick the gentlest cuts until the gap is covered
      let cover = 0; const pre = new Set();
      data.suggestions.forEach((s, i) => { if (cover < gap && s.impact !== 'high') { pre.add(i); cover += s.saving; } });
      setPicked(pre);
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? "Can't reach the server. It may be waking up; try again in a few seconds." : e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (s, i) => {
    setApplying(i); setError(null);
    try {
      const data = await post(`${apiUrl}/api/ai/edit-plan`, { instruction: s.edit, elements, selected: [] });
      if (data.changed > 0) {
        setElements(data.elements);
        setApplied(a => new Set(a).add(i));
      } else {
        setError(data.summary || "That change couldn't be made automatically; make it in the Studio instead.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(null);
    }
  };

  return (
    <Panel icon={Wallet} title="Budget Advisor" info="budget" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div>
          <label htmlFor="budget-input" className="mb-1.5 block text-xs text-zinc-400">Your budget</label>
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 px-3 focus-within:border-indigo-500">
            <span className="text-sm text-zinc-500">{symbol}</span>
            <input
              id="budget-input"
              inputMode="numeric"
              value={budget ? Number(budget).toLocaleString(locale) : ''}
              onChange={e => setB(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder={code === 'INR' ? '30,00,000' : '50,000'}
              className="w-full bg-transparent px-2 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          {code === 'INR' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[20e5, 30e5, 50e5, 1e7].map(v => (
                <button key={v} onClick={() => setB(v)} className="rounded-full border border-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200">{short(v)}</button>
              ))}
            </div>
          )}
        </div>

        {/* where the estimate stands against the budget */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-zinc-400">Current estimate</span>
            <span className="font-mono text-sm text-zinc-100">{fmt(total)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full rounded-full ${gap > 0 ? 'bg-amber-500/80' : 'bg-emerald-500/80'}`} style={{ width: `${budget ? Math.min(100, (total / Math.max(total, budget)) * 100) : 0}%` }} />
          </div>
          <p className={`mt-2 text-xs ${!budget ? 'text-zinc-500' : gap > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {!budget ? 'Enter a budget to compare.' : gap > 0 ? `${short(gap)} over budget` : `Within budget, ${short(-gap)} to spare`}
          </p>
        </div>
      </div>

      <button onClick={analyse} disabled={!budget || busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Looking through the plan…</> : advice ? 'Look again' : gap > 0 ? 'Find where to save' : 'Find savings anyway'}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}

      {advice && (
        <div className="mt-4">
          {advice.summary && <p className="mb-3 text-xs leading-relaxed text-zinc-400">{advice.summary}</p>}
          <ul className="space-y-2">
            {advice.suggestions.map((s, i) => {
              const [label, tone] = IMPACT_STYLE[s.impact] || IMPACT_STYLE.medium;
              return (
                <li key={i} className={`rounded-xl border p-3 transition-colors ${picked.has(i) ? 'border-indigo-500/40 bg-indigo-500/[0.06]' : 'border-zinc-800 bg-zinc-900/40'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={picked.has(i)} aria-label={`Count "${s.title}" in the plan`}
                      onChange={() => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                      className="mt-1 h-4 w-4 accent-[#c8794a]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">{s.title}</span>
                        <span className={`rounded-full border px-2 py-px text-[10px] ${tone}`}>{label}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.detail}</p>
                      {s.edit && (
                        <button onClick={() => apply(s, i)} disabled={applying !== null || applied.has(i)}
                          className="mt-2 rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-60">
                          {applied.has(i) ? <span className="flex items-center gap-1 text-emerald-300"><Check className="h-3 w-3" /> Applied to the plan</span>
                            : applying === i ? 'Changing the plan…' : 'Apply to plan'}
                        </button>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm text-emerald-300">−{short(s.saving)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
            <span className="text-zinc-400">With the ticked cuts: <span className="font-mono text-zinc-100">{fmt(after)}</span></span>
            <span className={`font-mono text-xs ${after <= budget ? 'text-emerald-300' : 'text-amber-300'}`}>
              {after <= budget ? `within budget by ${short(budget - after)}` : `still ${short(after - budget)} over`}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Savings are estimates from the live cost takeoff. "Apply to plan" changes the drawing through AI Edit; Ctrl+Z undoes it.</p>
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Vastu check: the ground floor against the usual Vastu guidelines, for any plan
// ------------------------------------------------------------------------------------------------
const NORTH = [['up', 'Top of the plan'], ['right', 'Right'], ['down', 'Bottom'], ['left', 'Left']];
const STATUS = {
  pass: ['bg-emerald-500/15 text-emerald-300', 'OK'],
  warn: ['bg-amber-500/15 text-amber-200', 'Fair'],
  fail: ['bg-rose-500/15 text-rose-200', 'Fix'],
};

export function VastuPanel({ elements, site, projectId, apiUrl, onClose }) {
  const key = `vastu_north_${projectId || 'draft'}`;
  const [north, setNorth] = useState(() => { try { return localStorage.getItem(key) || site?.north || 'up'; } catch { return 'up'; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const check = async (dir = north) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/ai/vastu-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements, north: dir }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `The server answered ${res.status}.`);
      setReport(data);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  // check when the panel opens; the owner re-checks after editing
  useEffect(() => {
    const t = setTimeout(check, 0);           // the fetch starts after this render
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickNorth = (dir) => {
    setNorth(dir);
    try { localStorage.setItem(key, dir); } catch { /* private mode */ }
    check(dir);
  };

  return (
    <Panel icon={Home} title="Vastu check" onClose={onClose}>
      <label className="block text-xs text-zinc-400">North is towards the
        <select value={north} onChange={(e) => pickNorth(e.target.value)}
          className="mt-1 w-full rounded bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none">
          {NORTH.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </label>
      {site?.plot_m && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Plot {site.plot_m[0]} × {site.plot_m[1]} m, road on the {{ N: 'north', E: 'east', S: 'south', W: 'west' }[site.facing] || site.facing}.
        </p>
      )}
      {(site?.notes || []).map((n, i) => <p key={i} className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">{n}</p>)}
      {busy && <p className="mt-4 flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
      {report && !busy && (
        <>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-3xl font-semibold text-white">{report.score}</span>
            <span className="pb-1 text-xs text-zinc-500">/ 100 on the ground floor</span>
          </div>
          <ul className="mt-3 space-y-2">
            {report.checks.map((c, i) => (
              <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-100">{c.rule}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS[c.status][0]}`}>{STATUS[c.status][1]}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-400">{c.detail}</p>
              </li>
            ))}
          </ul>
          <button onClick={() => check()} className="mt-3 w-full rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">
            Check again
          </button>
          <p className="mt-2 text-[10px] leading-snug text-zinc-600">Rooms are placed in the 3 × 3 grid of directions by their centre. Guidance only.</p>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Building rules: room sizes (NBC 2016), light and air, and the plot's limits
// ------------------------------------------------------------------------------------------------
const LIMIT_FIELDS = [['coverage_pct', 'Ground coverage %', 75], ['far', 'FAR / FSI', 1.75], ['max_floors', 'Max floors', 3]];

export function RulesPanel({ elements, site, projectId, apiUrl, onClose }) {
  const key = `rules_limits_${projectId || 'draft'}`;
  const [limits, setLimits] = useState(() => {
    try { return { ...Object.fromEntries(LIMIT_FIELDS.map(([k, , d]) => [k, d])), ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return Object.fromEntries(LIMIT_FIELDS.map(([k, , d]) => [k, d])); }
  });
  // a plot typed here when the project has none (metres)
  const [plot, setPlot] = useState({ w: '', d: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const plotSite = site?.plot_m ? site : (Number(plot.w) > 0 && Number(plot.d) > 0 ? { plot_m: [Number(plot.w), Number(plot.d)] } : null);

  const check = async () => {
    setBusy(true); setError(null);
    try { localStorage.setItem(key, JSON.stringify(limits)); } catch { /* private mode */ }
    try {
      const res = await fetch(`${apiUrl}/api/ai/building-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements, site: plotSite, limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, Number(v)])) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `The server answered ${res.status}.`);
      setReport(data);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(check, 0);           // the fetch starts after this render
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = report ? [...new Set(report.checks.map(c => c.group))] : [];
  const BADGE = { ...STATUS, info: ['bg-zinc-800 text-zinc-300', 'Info'] };
  return (
    <Panel icon={Check} title="Building rules" onClose={onClose}>
      <p className="text-[11px] leading-snug text-zinc-500">
        Room sizes follow the National Building Code of India 2016. Plot limits differ by city: set your local authority's.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {LIMIT_FIELDS.map(([k, label]) => (
          <label key={k} className="text-[10px] text-zinc-400">{label}
            <input type="number" min="0" step="0.05" value={limits[k]} onChange={(e) => setLimits(l => ({ ...l, [k]: e.target.value }))}
              className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
        ))}
      </div>
      {!site?.plot_m && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[['w', 'Plot frontage (m)'], ['d', 'Plot depth (m)']].map(([k, label]) => (
            <label key={k} className="text-[10px] text-zinc-400">{label}
              <input type="number" min="0" step="0.1" value={plot[k]} onChange={(e) => setPlot(p => ({ ...p, [k]: e.target.value }))}
                className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </label>
          ))}
        </div>
      )}
      <button onClick={check} disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-50">
        {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</> : 'Check the plan'}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}
      {report && !busy && (
        <>
          <p className="mt-4 text-sm text-zinc-200">
            {report.fails ? `${report.fails} problem${report.fails > 1 ? 's' : ''}` : 'No problems'}
            {report.warnings ? `, ${report.warnings} warning${report.warnings > 1 ? 's' : ''}` : ''}
          </p>
          {groups.map(g => (
            <div key={g} className="mt-3">
              <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">{g.toUpperCase()}</p>
              <ul className="mt-1.5 space-y-2">
                {report.checks.filter(c => c.group === g).map((c, i) => (
                  <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-100">{c.rule}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${BADGE[c.status][0]}`}>{BADGE[c.status][1]}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-400">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-3 text-[10px] leading-snug text-zinc-600">Guidance only: state and municipal bye-laws can differ. Confirm with your local authority before building.</p>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Share with a client: view-only links, their comments and approval
// ------------------------------------------------------------------------------------------------
export function SharePanel({ projectId, apiUrl, onClose }) {
  const [data, setData] = useState(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const call = async (path, opts = {}) => {
    const res = await fetch(`${apiUrl}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail || `The server answered ${res.status}.`);
    return body;
  };
  const load = () => call(`/api/projects/${projectId}/shares`).then(setData).catch(e => setError(e.message));

  useEffect(() => {
    if (!projectId) return undefined;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkOf = (token) => `${window.location.origin}/shared/${token}`;
  const create = async () => {
    setBusy(true); setError(null);
    try {
      const s = await call(`/api/projects/${projectId}/shares`, { method: 'POST', body: JSON.stringify({ label: label.trim() || null }) });
      setLabel('');
      await load();
      copy(s.token);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const copy = (token) => {
    navigator.clipboard?.writeText(linkOf(token)).then(() => { setCopied(token); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };
  const turnOff = async (id) => {
    try { await call(`/api/projects/${projectId}/shares/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); }
  };
  const resolve = async (c) => {
    try {
      await call(`/api/projects/${projectId}/comments/${c.id}`, { method: 'POST', body: JSON.stringify({ resolved: !c.resolved }) });
      await load();
    } catch (e) { setError(e.message); }
  };

  if (!projectId) {
    return <Panel icon={Bookmark} title="Share with client" onClose={onClose}><p className="text-xs text-zinc-400">Save the project first to share it.</p></Panel>;
  }
  const latest = data?.decisions?.[0];
  return (
    <Panel icon={Bookmark} title="Share with client" onClose={onClose}>
      <p className="text-[11px] leading-snug text-zinc-500">
        A view-only link: anyone with it can see the plan, comment on rooms and approve it, without an account. Turn it off any time.
      </p>
      <div className="mt-3 flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.stopPropagation()} maxLength={80}
          placeholder="Who is it for? (optional)" className="min-w-0 flex-1 rounded bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        <button onClick={create} disabled={busy} className="rounded bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'New link'}
        </button>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      {latest && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${latest.decision === 'approved' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-100'}`}>
          {latest.decision === 'approved' ? 'Approved' : 'Changes requested'} by {latest.author}
          {latest.current ? ' (this version of the plan)' : ' (the plan has changed since)'}{latest.note ? `: "${latest.note}"` : ''}
        </p>
      )}
      {data && (
        <>
          <p className="mt-4 font-mono text-[10px] tracking-[0.2em] text-zinc-500">LINKS</p>
          {data.shares.length === 0 && <p className="mt-1 text-xs text-zinc-500">No links yet.</p>}
          <ul className="mt-1.5 space-y-1.5">
            {data.shares.map(s => (
              <li key={s.id} className={`flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 ${s.active ? '' : 'opacity-50'}`}>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">{s.label || 'Link'}{s.active ? '' : ' (off)'}</span>
                {s.active && (
                  <>
                    <button onClick={() => copy(s.token)} className="text-[11px] text-indigo-300 hover:text-indigo-200">{copied === s.token ? 'Copied' : 'Copy'}</button>
                    <a href={linkOf(s.token)} target="_blank" rel="noreferrer" className="text-[11px] text-zinc-400 hover:text-zinc-200">Open</a>
                    <button onClick={() => turnOff(s.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Turn off</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[10px] tracking-[0.2em] text-zinc-500">COMMENTS</p>
          {data.comments.length === 0 && <p className="mt-1 text-xs text-zinc-500">None yet.</p>}
          <ul className="mt-1.5 space-y-1.5">
            {data.comments.map(c => (
              <li key={c.id} className={`rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 ${c.resolved ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400"><span className="text-zinc-200">{c.author}</span>{c.room_name ? ` on ${c.room_name}` : ''}</span>
                  <button onClick={() => resolve(c)} className="text-[10px] text-zinc-400 hover:text-white">{c.resolved ? 'Reopen' : 'Mark done'}</button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">{c.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Services: a first electrical and plumbing layout, its counts and a rough cost
// ------------------------------------------------------------------------------------------------
// rough installed cost per point in US dollars (shown in the chosen currency); wiring / piping only
const POINT_RATE = { light: 16, fan: 16, switch: 25, socket: 18, power: 28, ac: 40, geyser: 30, exhaust: 16, db: 160,
  supply: 40, drain: 30, stack: 150 };
const PLUMB = new Set(['supply', 'drain', 'stack']);

export function ServicesPanel({ elements, floor, projectName, site, north, apiUrl, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/ai/services-layout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `The server answered ${res.status}.`);
      setData(body);
    } catch (e) { setError(e.message); setData(null); } finally { setBusy(false); }
  };
  useEffect(() => {
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const here = data ? data.points.filter(p => p.floor === floor) : [];
  const onFloor = elements.filter(e => (e.floor || 1) === floor);
  const cost = (sys) => (data ? data.points.filter(p => (PLUMB.has(p.type) ? 'plumbing' : 'electrical') === sys)
    .reduce((s, p) => s + (POINT_RATE[p.type] || 0), 0) : 0);
  const download = () => {
    try { downloadPlanSheet(elements, { project: projectName || 'Plan', north, site, services: data }); }
    catch (e) { setError(e.message); }
  };

  return (
    <Panel icon={Wand} title="Electrical & plumbing" wide onClose={onClose}>
      {busy && <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Laying out services…</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
      {data && !busy && (
        <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
          <div className="aspect-[4/3] rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <ServicesPreview elements={onFloor} points={here} />
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">{floor === 1 ? 'GROUND FLOOR' : `FLOOR ${floor}`} · WHOLE HOUSE</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(data.counts).map(([type, n]) => (
                <li key={type} className="flex items-center justify-between text-xs">
                  <span className={PLUMB.has(type) ? 'text-sky-300' : 'text-orange-300'}>{data.labels[type] || type}</span>
                  <span className="text-zinc-300">{here.filter(p => p.type === type).length} · {n}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-zinc-900 p-2.5 text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">Electrical points</span><span className="text-zinc-100">{formatMoney(cost('electrical'))}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-zinc-400">Plumbing points</span><span className="text-zinc-100">{formatMoney(cost('plumbing'))}</span></div>
              <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">Rough wiring and piping cost per point; fittings and fixtures extra.</p>
            </div>
            <button onClick={download} className="mt-3 w-full rounded-lg bg-zinc-100 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white">
              Download drawings (PDF)
            </button>
            <button onClick={run} className="mt-2 w-full rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">Lay out again</button>
            <p className="mt-2 text-[10px] leading-snug text-zinc-600">A starting point following common practice, for your electrician and plumber to confirm.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ServicesPreview({ elements, points }) {
  const rooms = elements.filter(e => e.type === 'room');
  if (!rooms.length) return null;
  const x0 = Math.min(...rooms.map(r => r.left)), y0 = Math.min(...rooms.map(r => r.top - r.height / 2));
  const x1 = Math.max(...rooms.map(r => r.left + r.width)), y1 = Math.max(...rooms.map(r => r.top + r.height / 2));
  const pad = 20, r = Math.max(x1 - x0, y1 - y0) / 90;
  const line = (e) => { const a = ((e.angle || 0) * Math.PI) / 180; return [e.left, e.top, e.left + e.width * Math.cos(a), e.top + e.width * Math.sin(a)]; };
  const CODE = { light: 'L', fan: 'F', switch: 'SW', socket: 'S', power: 'P', ac: 'AC', geyser: 'G', exhaust: 'EX', db: 'DB', supply: 'W', drain: 'FT', stack: 'ST' };
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} className="h-full w-full">
      {rooms.map(rm => <rect key={rm.id} x={rm.left} y={rm.top - rm.height / 2} width={rm.width} height={rm.height} fill="rgba(231,226,217,0.04)" />)}
      {elements.filter(e => e.type === 'wall').map((w, i) => { const [a, b, c, d] = line(w); return <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#e7e2d9" strokeWidth={r * 0.9} strokeLinecap="square" />; })}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={r} fill={PLUMB.has(p.type) ? '#0c4a6e' : '#7c2d12'} stroke={PLUMB.has(p.type) ? '#7dd3fc' : '#fdba74'} strokeWidth={r * 0.15} />
          <text x={p.x} y={p.y + r * 0.35} fontSize={r * (CODE[p.type].length > 1 ? 0.8 : 1.05)} textAnchor="middle" fill="#fff" fontFamily="sans-serif">{CODE[p.type]}</text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Materials & schedule: what the house takes to build, what it costs and how long it takes
// ---------------------------------------------------------------------------------------------
const inr = (v) => formatMoney((Number(v) || 0) / CURRENCY.INR.rate);   // the estimate is priced in rupees
const RATE_UNIT = {
  cement: 'bag', steel: 'kg', sand: 'm³', aggregate: 'm³', bricks: 'brick', tiles: 'm²', paint: 'L', putty: 'kg',
  primer: 'L', waterproofing: 'm²', doors: 'door', windows: 'm²', wiring: 'm', pipes: 'm',
};

export function MaterialsPanel({ elements, projectName, apiUrl, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('materials');
  const [rates, setRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('archetech_rates') || '{}'); } catch { return {}; }
  });
  const [editing, setEditing] = useState(false);

  const run = async (r = rates) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/ai/quantities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements, rates: r }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `The server answered ${res.status}.`);
      setData(body);
    } catch (e) { setError(e.message); setData(null); } finally { setBusy(false); }
  };
  useEffect(() => {
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRate = (key, v) => {
    const next = { ...rates, [key]: v === '' ? undefined : Number(v) };
    setRates(next);
    try { localStorage.setItem('archetech_rates', JSON.stringify(next)); } catch { /* private mode */ }
  };
  const applyRates = () => { setEditing(false); run(rates); };
  const resetRates = () => {
    setRates({});
    try { localStorage.removeItem('archetech_rates'); } catch { /* private mode */ }
    run({});
  };

  const csv = () => {
    if (!data) return;
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [['Item', 'Quantity', 'Unit', 'Rate (INR)', 'Cost (INR)', 'Note'].join(',')];
    data.materials.forEach(m => lines.push([q(m.item), m.qty, m.unit, m.rate, m.cost, q(m.note)].join(',')));
    lines.push(['Labour', '', '', '', data.summary.labour_cost, ''].join(','));
    lines.push(['Total', '', '', '', data.total_cost, ''].join(','));
    lines.push('', ['Phase', 'Starts (day)', 'Days', 'Cost (INR)'].join(','));
    data.phases.forEach(p => lines.push([q(p.name), p.start_day, p.days, p.cost].join(',')));
    lines.push('', ['Work', 'Quantity', 'Unit'].join(','));
    data.works.forEach(w => lines.push([q(w.item), w.qty, w.unit].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(projectName || 'house').replace(/[^\w-]+/g, '_')}_materials.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const months = data ? data.total_days / 30.4 : 0;
  return (
    <Panel icon={Wallet} title="Materials & schedule" wide onClose={onClose}>
      {busy && <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out quantities…</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
      {data && !busy && (
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Built-up area', formatArea(data.summary.built_up_m2)],
              ['Materials', inr(data.summary.material_cost)],
              ['With labour', inr(data.total_cost)],
              ['Build time', `${months.toFixed(1)} months`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-zinc-900 px-3 py-2">
                <p className="text-[10px] text-zinc-500">{k}</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-100">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {inr(data.summary.cost_per_m2)} per m² ({inr(data.summary.cost_per_m2 / 10.764)} per sq ft) · {data.summary.floors} floor{data.summary.floors > 1 ? 's' : ''} · about {data.summary.columns} columns
          </p>

          <div className="mt-3 flex items-center gap-1 border-b border-zinc-800 text-xs">
            {[['materials', 'Materials'], ['schedule', 'Schedule'], ['works', 'Quantities of work']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-1.5 ${tab === id ? 'border-zinc-100 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
            ))}
            <span className="ml-auto flex gap-1.5 pb-1">
              <button onClick={() => setEditing(e => !e)} className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800">{editing ? 'Close prices' : 'My prices'}</button>
              <button onClick={csv} className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-white"><Download className="h-3 w-3" /> CSV</button>
            </span>
          </div>

          {editing && (
            <div className="mt-3 rounded-lg border border-zinc-800 p-3">
              <p className="text-[11px] text-zinc-400">Prices you pay locally, in rupees. Leave blank for the default.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.keys(RATE_UNIT).map(k => (
                  <label key={k} className="text-[10px] capitalize text-zinc-500">{k} / {RATE_UNIT[k]}
                    <input type="number" min="0" value={rates[k] ?? ''} placeholder={String(data.rates[k])} onChange={(e) => setRate(k, e.target.value)}
                      className="mt-0.5 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </label>
                ))}
                <label className="text-[10px] text-zinc-500">Labour, % of materials
                  <input type="number" min="0" max="150" value={rates.labour != null ? Math.round(rates.labour * 100) : ''} placeholder={String(Math.round(data.rates.labour * 100))}
                    onChange={(e) => setRate('labour', e.target.value === '' ? '' : Number(e.target.value) / 100)}
                    className="mt-0.5 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={applyRates} className="rounded-md bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-950">Recalculate</button>
                <button onClick={resetRates} className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300">Use defaults</button>
              </div>
            </div>
          )}

          {tab === 'materials' && (
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left text-[10px] text-zinc-500"><th className="py-1 font-normal">Material</th><th className="font-normal text-right">Quantity</th><th className="font-normal text-right">Cost</th></tr></thead>
              <tbody>
                {data.materials.map(m => (
                  <tr key={m.key} className="border-t border-zinc-900">
                    <td className="py-1.5"><span className="text-zinc-100">{m.item}</span>{m.note && <span className="block text-[10px] text-zinc-500">{m.note}</span>}</td>
                    <td className="whitespace-nowrap text-right text-zinc-200">{Number(m.qty).toLocaleString('en-IN')} {m.unit}</td>
                    <td className="whitespace-nowrap text-right text-zinc-300">{inr(m.cost)}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-800"><td className="py-1.5 text-zinc-400">Labour</td><td /><td className="text-right text-zinc-300">{inr(data.summary.labour_cost)}</td></tr>
                <tr className="border-t border-zinc-800 font-semibold"><td className="py-1.5 text-zinc-100">Total</td><td /><td className="text-right text-zinc-100">{inr(data.total_cost)}</td></tr>
              </tbody>
            </table>
          )}

          {tab === 'schedule' && <Gantt data={data} />}

          {tab === 'works' && (
            <table className="mt-2 w-full text-xs">
              <tbody>
                {data.works.map(w => (
                  <tr key={w.key} className="border-t border-zinc-900">
                    <td className={`py-1.5 ${w.item.startsWith('of which') ? 'pl-4 text-zinc-500' : 'text-zinc-100'}`}>{w.item}</td>
                    <td className="text-right text-zinc-200">{Number(w.qty).toLocaleString('en-IN')} {w.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <ul className="mt-3 space-y-0.5 text-[10px] leading-snug text-zinc-600">
            {data.assumptions.map((a, i) => <li key={i}>· {a}</li>)}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Gantt({ data }) {
  const total = Math.max(1, data.total_days);
  const months = Math.ceil(total / 30.4);
  const spent = data.phases.reduce((sum, p) => sum + p.cost, 0);
  return (
    <div className="mt-3">
      <div className="flex h-4 gap-2 text-[9px] text-zinc-500">
        <span className="w-[42%] shrink-0" />
        <span className="relative flex-1">
          {Array.from({ length: months }).map((_, m) => (
            <span key={m} className="absolute" style={{ left: `${(m * 30.4 / total) * 100}%` }}>{`M${m + 1}`}</span>
          ))}
        </span>
        <span className="w-24 shrink-0" />
      </div>
      <ul className="space-y-1">
        {data.phases.map(p => {
          return (
            <li key={p.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-[42%] shrink-0 truncate text-zinc-300" title={`${p.name} · ${p.days} days · ${inr(p.cost)}`}>{p.name}</span>
              <span className="relative h-4 flex-1 rounded bg-zinc-900">
                {Array.from({ length: months }).map((_, m) => (
                  <span key={m} className="absolute inset-y-0 w-px bg-zinc-800" style={{ left: `${(m * 30.4 / total) * 100}%` }} />
                ))}
                <span className="absolute inset-y-0.5 rounded-sm bg-gradient-to-r from-amber-500/80 to-orange-500/80"
                  style={{ left: `${(p.start_day / total) * 100}%`, width: `${Math.max(1, (p.days / total) * 100)}%` }}
                  title={`Day ${p.start_day + 1}–${p.start_day + p.days}`} />
              </span>
              <span className="w-24 shrink-0 text-right text-zinc-500">{p.cost ? inr(p.cost) : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-zinc-500">
        About {Math.round(total / 7)} weeks with one crew working steadily. Costs per phase include labour; together they come to {inr(spent)}, the rest is spread across the job.
      </p>
    </div>
  );
}

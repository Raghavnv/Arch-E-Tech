import { applyClientOps, editCatalog } from '../utils/editOps';
import OutdoorOptions, { promptWithFloors } from './OutdoorOptions';
import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, AlertTriangle, Download, ScanLine, LayoutTemplate, Image as ImageIcon, Wand2 as Wand, Home, Bookmark, Check, Wallet, Sun } from 'lucide-react';
import { detectRooms } from '../utils/detectRooms';
import InfoTip from './InfoTip';
import { formatArea, formatMoney, currencyCode, CURRENCY } from '../utils/units';
import { assessComfort, CITIES } from '../utils/comfort';
import { lakh, rupees, emiOf, loanFor, ltvCap } from '../utils/loan';
import { LANGUAGES } from '../utils/shareI18n';

/*
 * The Studio's tool panels: Auto Detect (label the rooms your walls enclose), AI Layout (a new plan
 * from a description) and Concept Viz (the plan as a 3D cutaway or the finished house, by AI).
 */

const KINDS = [
  ['living', 'Living room'], ['dining', 'Dining room'], ['kitchen', 'Kitchen'], ['master_bedroom', 'Master bedroom'],
  ['bedroom', 'Bedroom'], ['bathroom', 'Bathroom'], ['study', 'Study'], ['utility', 'Utility'], ['closet', 'Walk-in closet'], ['lounge', 'Lounge'],
  ['hallway', 'Hallway'], ['balcony', 'Balcony'], ['patio', 'Patio'], ['terrace', 'Terrace'], ['deck', 'Deck'],
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

export function Panel({ icon: Icon, title, info, onClose, wide, bottom, children }) {
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
          <button onClick={add} className="btn-primary mt-4 w-full">
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
  const [outdoor, setOutdoor] = useState({ patio: false, balcony: false, terrace: false });
  const [floors, setFloors] = useState(0);
  const hasPlan = elements.some(e => e.type === 'wall');

  const generate = async () => {
    setBusy(true); setError(null); setDone(false);
    try {
      localStorage.setItem('ai_layout_prompt', prompt);
      const data = await post(`${apiUrl}/api/ai/generate-plan`, { prompt: promptWithFloors(prompt.trim() || 'A modern 2 bedroom house', floors), outdoor });
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
      <div className="mt-3"><OutdoorOptions value={outdoor} onChange={setOutdoor} floors={floors} onFloors={setFloors} compact /></div>
      {hasPlan && <p className="mt-2 text-[11px] text-amber-300/90">This replaces the current plan. Press Ctrl+Z (⌘Z) to get it back.</p>}
      <button
        onClick={generate}
        disabled={busy}
        className="btn-primary mt-3 w-full"
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
            <button onClick={generate} disabled={busy} className="btn-primary">
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
  none: ['Make the master bedroom 1 m wider', 'Add a balcony to the master bedroom', 'Add a patio off the living room', 'Put a door between the kitchen and the dining room', 'Split the study into a study and a bathroom', 'Paint the living room sage with a teak feature wall', 'Herringbone oak floors in all bedrooms', 'Cove ceiling with a chandelier in the dining room'],
};

export function EditPanel({ elements, setElements, selected, floor = 1, apiUrl, onExterior, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);     // { ok, text }
  const catalog = useMemo(() => editCatalog(), []);

  const sel = selected[0];
  const examples = EXAMPLES[sel?.type] || (sel ? EXAMPLES.door.slice(1, 2).concat(['Delete this', 'Rotate it 90 degrees']) : EXAMPLES.none);

  const run = async (instruction) => {
    const ask = (instruction ?? text).trim();
    if (!ask || busy) return;
    setBusy(true); setNote(null);
    try {
      const data = await post(`${apiUrl}/api/ai/edit-plan`, { instruction: ask, elements, selected: selected.map(s => s.id), floor, catalog });
      if (data.changed > 0) {
        // the shape comes back from the server; paints, floors, ceilings and curtains are applied here
        const { elements: next, exterior } = applyClientOps(data.elements, data.client_ops);
        setElements(next);
        if (exterior) onExterior?.(exterior);
        setText('');
        setNote({ ok: !(data.problems || []).length, text: `${data.summary} Press Ctrl+Z (⌘Z) to undo.` });
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
          <span className="text-zinc-500">Ask for any change in plain words: room sizes, new rooms, balconies and patios, doors, windows, furniture, paint, floors, ceilings. Several at once is fine.</span>
        )}
      </div>
      <div className="flex items-start gap-2">
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } e.stopPropagation(); }}
        placeholder={sel ? `Describe a change to the selected ${(TYPE_LABEL[sel.type] || 'item').toLowerCase()}…` : 'e.g. make the master bedroom bigger and add a balcony to it'}
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
        disabled={busy}
        autoFocus
      />
      <button
        onClick={() => run()}
        disabled={busy || !text.trim()}
        className="btn-primary h-[60px] shrink-0"
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Editing…</> : 'Apply'}
      </button>
      </div>
      {note && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${note.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-100'}`}>{note.text}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.slice(0, note ? 3 : 5).map(x => (
          <button key={x} onClick={() => setText(x)} className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200">{x}</button>
        ))}
      </div>
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
          <button onClick={apply} disabled={!changed} className="btn-primary mt-4 w-full disabled:opacity-40">
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
        className="btn-primary mt-4 w-full">
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
                          className="btn-secondary mt-2 px-2.5 py-1 text-[11px]">
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
          <button onClick={() => check()} className="btn-secondary mt-3 w-full py-1.5 text-xs">
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
const LIMIT_FIELDS = [['coverage_pct', 'Coverage %'], ['far', 'FAR / FSI'], ['max_height_m', 'Height m']];
const RULE_CITIES = ['Typical (NBC)', 'Bengaluru', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Ahmedabad', 'Kolkata', 'Delhi', 'Jaipur', 'Kochi', 'Chandigarh', 'Guwahati'];

export function RulesPanel({ elements, site, projectId, apiUrl, rainwaterTank = null, onClose }) {
  const key = `rules_limits_${projectId || 'draft'}`;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })();
  const [city, setCity] = useState(saved.city || 'Typical (NBC)');
  // limits typed here override the city's (empty = the city's own)
  const [limits, setLimits] = useState(() => Object.fromEntries(LIMIT_FIELDS.map(([k]) => [k, saved.overrides?.[k] ?? ''])));
  // a plot typed here when the project has none (metres)
  const [plot, setPlot] = useState({ w: '', d: '', facing: 'S' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const plotSite = site?.plot_m ? site : (Number(plot.w) > 0 && Number(plot.d) > 0 ? { plot_m: [Number(plot.w), Number(plot.d)], facing: plot.facing } : null);

  const check = async (cityNow = city, lim = limits) => {
    setBusy(true); setError(null);
    try { localStorage.setItem(key, JSON.stringify({ city: cityNow, overrides: lim })); } catch { /* private mode */ }
    try {
      const overrides = Object.fromEntries(Object.entries(lim).filter(([, v]) => v !== '' && Number(v) > 0).map(([k, v]) => [k, Number(v)]));
      const res = await fetch(`${apiUrl}/api/ai/building-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements, site: plotSite, limits: overrides, city: cityNow, rwh_tank_l: rainwaterTank }),
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
    const t = setTimeout(() => check(), 0);           // the fetch starts after this render
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = report ? [...new Set(report.checks.map(c => c.group))] : [];
  const BADGE = { ...STATUS, info: ['bg-zinc-800 text-zinc-300', 'Info'] };
  return (
    <Panel icon={Check} title="Building rules" onClose={onClose}>
      <p className="text-[11px] leading-snug text-zinc-500">
        Room sizes follow the National Building Code of India 2016. Plot limits are each city's typical bye-laws for a small
        house plot; they change with the zone and road width, so confirm with your local authority before applying.
      </p>
      <label className="mt-3 block text-[10px] text-zinc-400">City
        <select value={city} onChange={(e) => { setCity(e.target.value); check(e.target.value); }}
          className="mt-1 w-full rounded bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          {RULE_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {LIMIT_FIELDS.map(([k, label]) => (
          <label key={k} className="text-[10px] text-zinc-400">{label}
            <input type="number" min="0" step="0.05" value={limits[k]} placeholder={report?.limits?.[k] != null ? String(report.limits[k]) : 'none'}
              onChange={(e) => setLimits(l => ({ ...l, [k]: e.target.value }))}
              className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
        ))}
      </div>
      {!site?.plot_m && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[['w', 'Frontage (m)'], ['d', 'Depth (m)']].map(([k, label]) => (
            <label key={k} className="text-[10px] text-zinc-400">{label}
              <input type="number" min="0" step="0.1" value={plot[k]} onChange={(e) => setPlot(p => ({ ...p, [k]: e.target.value }))}
                className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </label>
          ))}
          <label className="text-[10px] text-zinc-400">Road on the
            <select value={plot.facing} onChange={(e) => setPlot(p => ({ ...p, facing: e.target.value }))}
              className="mt-1 w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none">
              {[['N', 'North'], ['S', 'South'], ['E', 'East'], ['W', 'West']].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
        </div>
      )}
      <button onClick={() => check()} disabled={busy}
        className="btn-primary mt-3 w-full py-1.5 text-xs">
        {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</> : 'Check the plan'}
      </button>
      {report && !busy && (
        <div className={`mt-4 rounded-lg border p-3 ${report.fails ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <p className={`text-sm font-semibold ${report.fails ? 'text-rose-200' : 'text-emerald-200'}`}>{report.verdict}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{report.city} · {report.authority}</p>
          {report.fixes?.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-zinc-300">
              {report.fixes.map((f, i) => <li key={i} className="flex gap-1.5"><span className="text-indigo-400">›</span>{f}</li>)}
            </ul>
          )}
        </div>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      {report && !busy && (
        <>
          <p className="mt-3 text-[11px] text-zinc-500">
            {report.fails ? `${report.fails} problem${report.fails > 1 ? 's' : ''}` : 'No problems'}
            {report.warnings ? `, ${report.warnings} warning${report.warnings > 1 ? 's' : ''}` : ''}
          </p>
          {groups.map(g => (
            <div key={g} className="mt-3">
              <p className="label-caps">{g.toUpperCase()}</p>
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
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('archetech_share_link_lang') || 'en'; } catch { return 'en'; } });
  const pickLang = (l) => { setLang(l); try { localStorage.setItem('archetech_share_link_lang', l); } catch { /* private mode */ } };

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

  // the link opens in the chosen language; the reader can still switch on the page
  const linkOf = (token) => `${window.location.origin}/shared/${token}${lang !== 'en' ? `?lang=${lang}` : ''}`;
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
        <button onClick={create} disabled={busy} className="btn-primary px-3 py-0 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'New link'}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-zinc-500">Opens in</span>
        <div className="flex flex-wrap gap-1">
          {LANGUAGES.map(([code, label]) => (
            <button key={code} onClick={() => pickLang(code)} className={`${lang === code ? 'chip-on' : 'chip'} px-2 py-0.5 text-[11px]`}>{label}</button>
          ))}
        </div>
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
          <p className="mt-4 label-caps">LINKS</p>
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
          <p className="mt-4 label-caps">COMMENTS</p>
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
    import('../utils/planSheet')
      .then(m => m.downloadPlanSheet(elements, { project: projectName || 'Plan', north, site, services: data, approval: false }))
      .catch(e => setError(e.message));
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
            <p className="label-caps">{floor === 1 ? 'GROUND FLOOR' : `FLOOR ${floor}`} · WHOLE HOUSE</p>
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
            <button onClick={download} className="btn-primary mt-3 w-full py-1.5 text-xs">
              Download drawings (PDF)
            </button>
            <button onClick={run} className="btn-secondary mt-2 w-full py-1.5 text-xs">Lay out again</button>
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
              <button onClick={() => setEditing(e => !e)} className="btn-secondary px-2 py-1 text-[11px]">{editing ? 'Close prices' : 'My prices'}</button>
              <button onClick={csv} className="btn-primary gap-1 px-2 py-1 text-[11px]"><Download className="h-3 w-3" /> CSV</button>
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
                <button onClick={applyRates} className="btn-primary px-3 py-1 text-[11px]">Recalculate</button>
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
                <span className="absolute inset-y-0.5 rounded-sm bg-indigo-500/80"
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

// ---------------------------------------------------------------------------------------------
// Daylight & comfort: light, sun, heat and air room by room, with what to change
// ---------------------------------------------------------------------------------------------
const scoreTone = (s) => (s >= 75 ? '#34d399' : s >= 55 ? '#fbbf24' : '#f87171');

export function ComfortPanel({ elements, floor, north, site, onClose }) {
  const [city, setCity] = useState(() => { try { return site?.city || localStorage.getItem('comfort_city') || 'Bengaluru'; } catch { return site?.city || 'Bengaluru'; } });
  const [open, setOpen] = useState(null);
  const result = useMemo(() => assessComfort(elements, { north, city }), [elements, north, city]);
  const pick = (c) => { setCity(c); try { localStorage.setItem('comfort_city', c); } catch { /* private mode */ } };
  const onFloor = elements.filter(e => (e.floor || 1) === floor);
  const rooms = onFloor.filter(e => e.type === 'room');
  const byId = Object.fromEntries(result.rooms.map(r => [r.room.id, r]));
  const xs = rooms.flatMap(r => [r.left, r.left + r.width]), ys = rooms.flatMap(r => [r.top - r.height / 2, r.top + r.height / 2]);
  const [x0, x1, y0, y1] = rooms.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 1, 0, 1];
  const pad = 14;
  return (
    <Panel icon={Sun} title="Daylight & comfort" wide onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4" style={{ borderColor: scoreTone(result.house) }}>
              <span className="text-2xl font-semibold text-white">{result.house}</span>
              <span className="text-[9px] text-zinc-500">of 100</span>
            </div>
            <div className="text-xs text-zinc-400">
              <p>How well each room is lit by daylight, how much summer sun and heat it takes, and whether air can cross it, for a house in</p>
              <select value={city} onChange={(e) => pick(e.target.value)} className="mt-1 rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white focus:outline-none">
                {CITIES.map(([c]) => <option key={c}>{c}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-zinc-500">North is {north === 'up' ? 'up' : north} on the plan (set it in the Vastu check).</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5">
            {result.rooms.filter(r => (r.room.floor || 1) === floor || result.rooms.length < 12).map(r => (
              <li key={r.room.id} className="rounded-lg border border-zinc-800">
                <button onClick={() => setOpen(open === r.room.id ? null : r.room.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
                  <span className="w-28 shrink-0 truncate text-xs text-zinc-100">{r.room.name}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-zinc-800"><span className="block h-full rounded-full" style={{ width: `${r.score}%`, background: scoreTone(r.score) }} /></span>
                  <span className="w-7 text-right text-xs font-semibold" style={{ color: scoreTone(r.score) }}>{r.score}</span>
                </button>
                {open === r.room.id && (
                  <div className="space-y-2 border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-300">
                    <p className="text-zinc-400">
                      {r.wins.length ? <>Windows face {r.facing.join(', ')} · {Math.round(r.wfr * 100)}% of the floor in glass · sun {r.summerSun.toFixed(1)} h in June, {r.winterSun.toFixed(1)} h in December</> : 'No outside windows.'}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[['Daylight', r.parts.daylight], ['Depth', r.parts.depth], ['Air', r.parts.ventilation], ['Heat', r.parts.heat]].map(([k, v]) => (
                        <div key={k} className="rounded bg-zinc-900 py-1"><p className="text-[9px] text-zinc-500">{k}</p><p className="font-semibold" style={{ color: scoreTone(v) }}>{v}</p></div>
                      ))}
                    </div>
                    <ul className="space-y-1">{r.tips.map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-indigo-400">›</span>{t}</li>)}</ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 label-caps">{floor === 1 ? 'GROUND FLOOR' : `FLOOR ${floor}`}</p>
          <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} className="w-full rounded-lg bg-zinc-900/60">
            {rooms.map(r => {
              const c = byId[r.id];
              return (
                <g key={r.id} onClick={() => c && setOpen(r.id)} style={{ cursor: c ? 'pointer' : 'default' }}>
                  <rect x={r.left} y={r.top - r.height / 2} width={r.width} height={r.height} fill={c ? scoreTone(c.score) : '#3f3f46'} fillOpacity={c ? 0.35 : 0.15} stroke="#e4e4e7" strokeWidth={2} />
                  {c && <text x={r.left + r.width / 2} y={r.top + 4} textAnchor="middle" fontSize={11} fill="#fff" fontFamily="sans-serif">{c.score}</text>}
                </g>
              );
            })}
            {result.rooms.filter(r => (r.room.floor || 1) === floor).flatMap(r => r.wins).map((w, i) => {
              const a = ((w.el.angle || 0) * Math.PI) / 180, mx = w.el.left + (w.el.width / 2) * Math.cos(a), my = w.el.top + (w.el.width / 2) * Math.sin(a);
              const o = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[w.side];
              const hot = w.deg > 200 && w.deg < 300;
              return <line key={i} x1={mx} y1={my} x2={mx + o[0] * 12} y2={my + o[1] * 12} stroke={hot ? '#fb923c' : '#7dd3fc'} strokeWidth={3} strokeLinecap="round" />;
            })}
          </svg>
          <p className="mt-1.5 text-[10px] leading-snug text-zinc-500"><span className="text-sky-300">Blue</span> marks a window, <span className="text-orange-300">orange</span> one facing the hot afternoon sun. Green rooms are bright and airy; red ones need attention.</p>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Home loan & EMI: what the house costs each month, what a bank would lend, and how the loan is
// paid out stage by stage while it is built (interest-only "pre-EMI" until the keys)
// ------------------------------------------------------------------------------------------------

export function LoanPanel({ elements, houseCost, projectId, apiUrl, onClose }) {
  const key = `loan_${projectId || 'draft'}`;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })();
  const [f, setF] = useState(() => ({
    cost: Math.round(houseCost || 0), land: 0, savings: Math.round((houseCost || 0) * 0.25), income: 150000, other: 0,
    rate: 8.5, years: 20, ...saved,
  }));
  const [phases, setPhases] = useState(null);
  const set = (k, v) => setF(x => { const n = { ...x, [k]: v }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* private */ } return n; });

  useEffect(() => {
    let off = false;
    fetch(`${apiUrl}/api/ai/quantities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements }) })
      .then(r => (r.ok ? r.json() : null)).then(d => { if (!off && d?.phases) setPhases(d); }).catch(() => {});
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (k) => Math.max(0, Number(f[k]) || 0);
  const total = num('cost') + num('land');
  const capLoan = total * ltvCap(total);
  const asked = Math.max(0, total - num('savings'));
  const loan = Math.min(asked, capLoan);
  const shortBy = asked - loan;                                  // more savings needed to meet the bank's limit
  const rate = num('rate'), years = Math.min(30, Math.max(1, num('years')));
  const emi = emiOf(loan, rate, years);
  const totalPaid = emi * years * 12;
  const interest = totalPaid - loan;
  // banks keep all EMIs to about half the take-home pay
  const maxEmi = Math.max(0, num('income') * 0.5 - num('other'));
  const eligible = loanFor(maxEmi, rate, years);
  const afford = emi <= maxEmi + 1;

  // the loan paid out with the build: own money first, then the bank pays each stage as it is reached
  const schedule = useMemo(() => {
    if (!phases?.phases?.length || loan <= 0) return null;
    const costs = phases.phases.map(p => Math.max(0, p.cost || 0));
    const sum = costs.reduce((a, b) => a + b, 0) || 1;
    const scale = num('cost') / sum;
    let own = Math.max(0, num('savings') - num('land')), drawn = 0, pre = 0;
    const months = Math.max(1, Math.ceil(phases.total_days / 30));
    const rows = phases.phases.map((p, i) => {
      let need = costs[i] * scale;
      const fromOwn = Math.min(own, need);
      own -= fromOwn; need -= fromOwn;
      const fromLoan = Math.min(need, loan - drawn);
      drawn += fromLoan;
      const monthIn = Math.floor((p.start_day + p.days) / 30);
      // interest only, on what has been paid out, until the house is finished
      pre += fromLoan * (rate / 1200) * Math.max(0, months - monthIn);
      return { name: p.name, month: monthIn + 1, own: fromOwn, loan: fromLoan, drawn };
    }).filter(r => r.own + r.loan > 0);
    return { rows, pre, months };
  }, [phases, loan, rate, f.cost, f.savings, f.land]); // eslint-disable-line react-hooks/exhaustive-deps

  // principal and interest each year
  const years_ = useMemo(() => {
    const out = []; let bal = loan; const r = rate / 1200;
    for (let y = 1; y <= years; y++) {
      let p = 0, i = 0;
      for (let m = 0; m < 12 && bal > 0.5; m++) { const it = bal * r; const pr = Math.min(bal, emi - it); i += it; p += pr; bal -= pr; }
      out.push({ y, p, i, bal });
    }
    return out;
  }, [loan, rate, years, emi]);
  const maxYear = Math.max(1, ...years_.map(y => y.p + y.i));

  const field = (k, label, step = 1000, suffix) => (
    <label key={k} className="text-[10px] text-zinc-400">{label}
      <div className="mt-1 flex items-center rounded bg-zinc-900 focus-within:ring-1 focus-within:ring-indigo-500">
        {!suffix && <span className="pl-2 text-xs text-zinc-500">₹</span>}
        <input type="number" min="0" step={step} value={f[k]} onChange={(e) => set(k, e.target.value)}
          className="w-full bg-transparent px-2 py-1.5 text-xs text-zinc-100 focus:outline-none" />
        {suffix && <span className="pr-2 text-xs text-zinc-500">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <Panel icon={Wallet} title="Home loan & EMI" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[230px_1fr]">
        <div className="space-y-2.5">
          {field('cost', 'Cost to build (from the estimate)', 10000)}
          {field('land', 'Plot cost, if borrowing for it too', 10000)}
          {field('savings', 'Your own money (down payment)', 10000)}
          <div className="grid grid-cols-2 gap-2">
            {field('rate', 'Interest', 0.05, '%')}
            {field('years', 'Tenure', 1, 'yrs')}
          </div>
          {field('income', 'Monthly take-home pay', 5000)}
          {field('other', 'Other EMIs you pay now', 1000)}
          {Math.abs(num('cost') - (houseCost || 0)) > 1000 && houseCost > 0 && (
            <button onClick={() => set('cost', Math.round(houseCost))} className="text-[11px] text-indigo-300 hover:text-indigo-200">Use the current estimate ({lakh(houseCost)})</button>
          )}
        </div>
        <div>
          <div className="grid grid-cols-3 gap-2">
            {[['Monthly EMI', rupees(emi), afford ? 'text-white' : 'text-rose-200'], ['Loan', lakh(loan), 'text-white'], ['Total interest', lakh(interest), 'text-white']].map(([k, v, c]) => (
              <div key={k} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                <p className="label-caps">{k}</p>
                <p className={`mt-1 text-lg font-semibold ${c}`}>{v}</p>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-[11px] leading-snug text-zinc-300">
            <li className="flex gap-1.5"><span className="text-indigo-400">›</span>
              <span>Over {years} years you repay {lakh(totalPaid)}: {lakh(loan)} borrowed and {lakh(interest)} interest ({loan > 0 ? Math.round((interest / loan) * 100) : 0}% on top).</span></li>
            <li className="flex gap-1.5"><span className={afford ? 'text-emerald-400' : 'text-rose-400'}>›</span>
              <span>{afford
                ? `Banks usually keep all EMIs under half your take-home pay: you could borrow up to about ${lakh(eligible)}, so this loan fits.`
                : `This EMI is more than banks allow on ${rupees(num('income'))} a month (about ${rupees(maxEmi)} for all EMIs). You could borrow about ${lakh(eligible)}: put in more of your own money, take a longer tenure or a cheaper design.`}</span></li>
            {shortBy > 1 && (
              <li className="flex gap-1.5"><span className="text-amber-400">›</span>
                <span>Banks lend at most {Math.round(ltvCap(total) * 100)}% of {lakh(total)} (RBI's limit), so you need about {lakh(shortBy)} more of your own money; the loan above is capped.</span></li>
            )}
            {schedule && (
              <li className="flex gap-1.5"><span className="text-indigo-400">›</span>
                <span>While it is built (about {schedule.months} months), the bank pays each stage as it is reached and you pay interest only on what's been paid out: about {lakh(schedule.pre)} in all before the full EMI starts.</span></li>
            )}
            <li className="flex gap-1.5"><span className="text-indigo-400">›</span>
              <span>Under the old tax regime, interest up to ₹2 lakh a year (section 24b) and principal up to ₹1.5 lakh (80C) can be deducted for a home you live in.</span></li>
          </ul>
          <p className="label-caps mt-4">EACH YEAR</p>
          <div className="mt-2 flex h-24 items-end gap-px" role="img" aria-label="Principal and interest paid each year">
            {years_.map(y => (
              <div key={y.y} className="group relative flex flex-1 flex-col justify-end" title={`Year ${y.y}: ${lakh(y.p)} principal, ${lakh(y.i)} interest, ${lakh(y.bal)} left`}>
                <div className="bg-zinc-500/70" style={{ height: `${(y.i / maxYear) * 96}px` }} />
                <div className="bg-indigo-500" style={{ height: `${(y.p / maxYear) * 96}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>Year 1</span>
            <span className="flex items-center gap-3"><span className="flex items-center gap-1"><span className="h-2 w-2 bg-indigo-500" /> Principal</span><span className="flex items-center gap-1"><span className="h-2 w-2 bg-zinc-500/70" /> Interest</span></span>
            <span>Year {years}</span>
          </div>
          {schedule && (
            <>
              <p className="label-caps mt-4">PAID OUT WITH THE BUILD</p>
              <table className="mt-1.5 w-full text-[11px]">
                <thead><tr className="text-left text-zinc-500"><th className="py-1 font-normal">Stage</th><th className="font-normal">Month</th><th className="text-right font-normal">Your money</th><th className="text-right font-normal">Loan</th></tr></thead>
                <tbody>
                  {schedule.rows.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-800/70">
                      <td className="max-w-[220px] truncate py-1 pr-2 text-zinc-300" title={r.name}>{r.name}</td>
                      <td className="text-zinc-400">{r.month}</td>
                      <td className="text-right text-zinc-300">{r.own ? lakh(r.own) : '–'}</td>
                      <td className="text-right text-zinc-100">{r.loan ? lakh(r.loan) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="mt-3 text-[10px] leading-snug text-zinc-500">An estimate to plan with, not a loan offer: banks set the rate, fees and amount from your credit record. Check with your bank before you commit.</p>
        </div>
      </div>
    </Panel>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2, MessageSquare, RotateCcw, ThumbsUp } from 'lucide-react';
import Mark from './Mark';
import { PlanDrawing } from './Overview';
import { formatArea } from '../utils/units';

/*
 * The page behind a share link: the plan, view only, for a client or family member without an account.
 * They can comment on the whole plan or click a room to comment on it, and approve the plan or ask for
 * changes. Their name is remembered on this device so they don't retype it.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const NAME_KEY = 'archetech_reviewer_name';
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** The build so far, from the owner's construction tracker: phases and the latest site photos. */
function BuildProgress({ progress }) {
  const phases = progress.names.map(([key, name]) => ({ key, name, ...(progress.phases?.[key] || {}) }));
  const done = phases.filter(p => p.status === 'done').length, doing = phases.filter(p => p.status === 'doing').length;
  const pct = Math.round(((done + doing * 0.5) / Math.max(1, phases.length)) * 100);
  const photos = phases.flatMap(p => (p.photos || []).map(ph => ({ ...ph, phase: p.name }))).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Build progress</p>
        <p className="text-sm font-semibold text-indigo-300">{pct}%</p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {phases.map(p => (
          <li key={p.key} className="flex items-center gap-2 text-[11px]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${p.status === 'done' ? 'bg-emerald-400' : p.status === 'doing' ? 'bg-amber-400' : 'bg-zinc-700'}`} />
            <span className={p.status === 'done' ? 'text-zinc-300' : p.status === 'doing' ? 'text-amber-100' : 'text-zinc-500'}>{p.name}</span>
          </li>
        ))}
      </ul>
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map(ph => <img key={ph.id} src={ph.data} alt={ph.phase} title={`${ph.phase} · ${ph.date}`} className="h-20 w-28 rounded-lg object-cover" />)}
        </div>
      )}
    </div>
  );
}

const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);

/** The versions of the house the owner is weighing up: each with its plan and key numbers, and a vote. */
function Options({ options, name, busy, onVote }) {
  const [note, setNote] = useState('');
  const [floor, setFloor] = useState(1);
  const mine = options.votes.find(v => v.author?.toLowerCase() === name.trim().toLowerCase());
  const items = options.items.map(o => {
    const els = (o.elements || []).filter(e => e && typeof e.type === 'string');
    const rooms = els.filter(e => e.type === 'room');
    return {
      ...o, els,
      floors: [...new Set(els.map(e => e.floor || 1))],
      area: rooms.filter(r => !OUTDOOR.has(r.kind)).reduce((t, r) => t + (r.width / 20) * (r.height / 20), 0),
      beds: rooms.filter(r => r.kind === 'bedroom' || r.kind === 'master_bedroom').length,
      baths: rooms.filter(r => r.kind === 'bathroom' || r.kind === 'powder').length,
      outdoor: rooms.filter(r => OUTDOOR.has(r.kind)).map(r => r.name),
    };
  });
  const floors = [...new Set(items.flatMap(o => o.floors))].sort((a, b) => a - b);
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Which option do you prefer?</p>
          <p className="text-xs text-zinc-500">{items.length} versions of the house. Vote for one; you can change your vote any time.</p>
        </div>
        {floors.length > 1 && (
          <div className="flex gap-1.5">
            {floors.map(f => <button key={f} onClick={() => setFloor(f)} className={f === floor ? 'chip-on' : 'chip'}>{f === 1 ? 'Ground' : `Floor ${f}`}</button>)}
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map(o => {
          const chosen = mine?.option_id === o.id;
          return (
            <div key={o.id} className={`flex flex-col rounded-xl border p-3 ${chosen ? 'border-indigo-400/60 bg-indigo-500/5' : 'border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{o.name}</p>
                <span className="flex items-center gap-1 text-[11px] text-zinc-400"><ThumbsUp className="h-3 w-3" /> {o.votes}</span>
              </div>
              <div className="mt-2 aspect-[4/3] rounded-lg bg-zinc-900/50 p-2">
                <PlanDrawing elements={o.els.filter(e => (e.floor || 1) === floor)} animate={false} />
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                {formatArea(o.area)} · {o.beds} bed · {o.baths} bath{o.floors.length > 1 ? ` · ${o.floors.length} floors` : ''}{o.outdoor.length ? ` · ${o.outdoor.join(', ')}` : ''}
              </p>
              <button onClick={() => onVote(o.id, note).then(ok => ok && setNote(''))} disabled={!!busy || chosen}
                className={`mt-2.5 ${chosen ? 'chip-on justify-center py-1.5' : 'btn-primary py-1.5'} flex items-center gap-1.5 text-xs`}>
                {busy === `vote${o.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : chosen ? <Check className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                {chosen ? 'Your vote' : 'Vote for this'}
              </button>
            </div>
          );
        })}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Why? (optional, sent with your vote)"
        className="mt-3 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none" />
    </div>
  );
}

export default function SharedProject() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [floor, setFloor] = useState(1);
  const [room, setRoom] = useState(null);
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } });
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [formError, setFormError] = useState('');

  const load = () => fetch(`${API_URL}/api/shared/${token}`)
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || `The server answered ${r.status}.`); return d; })
    .then(setData)
    .catch(e => setError(e.message));

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const elements = useMemo(() => (data?.elements || []).filter(e => e && typeof e.type === 'string'), [data]);
  const floors = useMemo(() => [...new Set(elements.map(e => e.floor || 1))].sort((a, b) => a - b), [elements]);
  const onFloor = useMemo(() => elements.filter(e => (e.floor || 1) === floor), [elements, floor]);
  const rooms = onFloor.filter(e => e.type === 'room' && e.kind !== 'hallway');

  const remember = (n) => { setName(n); try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ } };

  const post = async (path, payload, kind) => {
    setFormError('');
    if (!name.trim()) { setFormError('Add your name so the owner knows who wrote this.'); return false; }
    setBusy(kind);
    try {
      const r = await fetch(`${API_URL}/api/shared/${token}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author: name.trim(), ...payload }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Please check what you wrote and try again.');
      await load();
      return true;
    } catch (e) {
      setFormError(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const sendComment = async () => {
    if (!body.trim()) return;
    if (await post('comments', { body: body.trim(), room_id: room?.id || null }, 'comment')) setBody('');
  };
  const decide = async (decision) => {
    if (await post('decision', { decision, note: note.trim() || null }, decision)) setNote('');
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-300">
        <div><Mark className="mx-auto h-10 w-10" /><p className="mt-6 text-lg text-zinc-100">This link isn't available</p><p className="mt-2 text-sm text-zinc-500">{error}</p></div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const vote = (optionId, why) => post('vote', { option_id: optionId, note: why.trim() || null }, `vote${optionId}`);
  const latest = data.decisions[0];
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Mark className="h-7 w-7" />
          <div>
            <p className="label-caps">SHARED PLAN{data.shared_by ? ` · FROM ${data.shared_by.toUpperCase()}` : ''}</p>
            <h1 className="text-lg font-semibold">{data.name || 'Untitled home'}</h1>
          </div>
        </div>
        {latest && (
          <span className={`rounded-full px-3 py-1 text-xs ${latest.decision === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
            {latest.decision === 'approved' ? 'Approved' : 'Changes requested'} by {latest.author}{latest.current ? '' : ' (an earlier version)'}
          </span>
        )}
      </header>

      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem]">
        <section>
          {floors.length > 1 && (
            <div className="mb-3 flex gap-2">
              {floors.map(f => (
                <button key={f} onClick={() => { setFloor(f); setRoom(null); }}
                  className={`rounded-full px-3 py-1 text-xs ${f === floor ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-700 text-zinc-300'}`}>
                  {f === 1 ? 'Ground floor' : `Floor ${f}`}
                </button>
              ))}
            </div>
          )}
          <div className="aspect-[4/3] rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <PlanDrawing elements={onFloor} highlight={room?.id} animate={false} onRoomClick={(r) => setRoom(cur => (cur?.id === r.id ? null : r))} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Click a room to comment on it.</p>
          {data.progress?.names?.length > 0 && <BuildProgress progress={data.progress} />}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rooms.map(r => (
              <li key={r.id}>
                <button onClick={() => setRoom(cur => (cur?.id === r.id ? null : r))}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${room?.id === r.id ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-zinc-800 hover:bg-zinc-900'}`}>
                  <span className="block text-zinc-100">{r.name}</span>
                  <span className="text-zinc-500">{formatArea(r.area)}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.options?.items?.length > 1 && <Options options={data.options} name={name} busy={busy} onVote={vote} />}
        </section>

        <aside className="space-y-5">
          <label className="block text-xs text-zinc-400">Your name
            <input value={name} onChange={(e) => remember(e.target.value)} maxLength={60}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
          </label>

          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4 text-zinc-400" /> Comment{room ? <> on <span className="text-indigo-300">{room.name}</span></> : ' on the plan'}</p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} rows={3}
              placeholder={room ? `What would you change in the ${room.name.toLowerCase()}?` : 'What do you think?'}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            <div className="mt-2 flex items-center justify-between">
              {room ? <button onClick={() => setRoom(null)} className="text-[11px] text-zinc-500 hover:text-zinc-300">Comment on the whole plan instead</button> : <span />}
              <button onClick={sendComment} disabled={!body.trim() || !!busy}
                className="btn-primary px-4 py-1.5 text-xs">
                {busy === 'comment' && <Loader2 className="h-3 w-3 animate-spin" />} Send
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-sm font-medium">Your decision</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} rows={2} placeholder="A note (optional)"
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => decide('approved')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
                {busy === 'approved' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve plan
              </button>
              <button onClick={() => decide('changes_requested')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-full border border-amber-400/50 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/10 disabled:opacity-50">
                {busy === 'changes_requested' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Ask for changes
              </button>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">Approving records this exact version of the plan.</p>
          </div>
          {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{formError}</p>}

          <div>
            <p className="label-caps">COMMENTS</p>
            {data.comments.length === 0 && <p className="mt-2 text-xs text-zinc-500">No comments yet.</p>}
            <ul className="mt-2 space-y-2">
              {[...data.comments].reverse().map(c => (
                <li key={c.id} className={`rounded-lg border border-zinc-800 p-3 ${c.resolved ? 'opacity-60' : ''}`}>
                  <p className="text-[11px] text-zinc-500">
                    <span className="text-zinc-300">{c.author}</span>{c.room_name ? <> on <span className="text-indigo-300">{c.room_name}</span></> : ''} · {when(c.created_at)}
                    {c.resolved && <span className="ml-1 text-emerald-300">· done</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{c.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

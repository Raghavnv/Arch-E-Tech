import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Pencil, Trash2, RefreshCw, X, Check, ImageOff, Loader2, Maximize2 } from 'lucide-react';

/*
 * The owner's saved photos: renders they liked from Photo Render and Concept Viz. Used on the
 * dashboard (all projects) and inside Photo Render (one project).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const KIND_LABEL = { furnished: 'Furnished', empty: 'Empty room', cutaway: '3D cutaway', exterior: 'Exterior' };
const FILTERS = [['all', 'All'], ['furnished', 'Furnished'], ['empty', 'Empty rooms'], ['concept', 'Concepts']];
const STYLE_NAME = {
  modern: 'Modern', japandi: 'Japandi', scandinavian: 'Scandinavian', industrial: 'Industrial loft',
  contemporary: 'Warm contemporary', indian: 'Modern Indian',
};

const headers = (json) => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, { method, headers: headers(!!body), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

const fullImage = (id) => call(`/api/photos/${id}`).then(p => p.image);

function when(iso) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function PhotoCard({ photo, showProject, onRename, onDelete, onOpen, onRegenerate }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(photo.title);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveTitle = async () => {
    const t = title.trim();
    if (!t || t === photo.title) { setTitle(photo.title); setEditing(false); return; }
    await onRename(photo, t);
    setEditing(false);
  };

  const download = async () => {
    setBusy(true);
    try {
      const a = document.createElement('a');
      a.href = await fullImage(photo.id);
      a.download = `${photo.title.replace(/[^\w\- ]+/g, '').trim() || 'photo'}.jpg`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  // details the title doesn't already say
  const meta = [photo.room_name, STYLE_NAME[photo.style] || photo.style, showProject && photo.project_name]
    .filter(v => v && !photo.title.toLowerCase().includes(String(v).toLowerCase())).join(' · ');

  return (
    <li className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700">
      <button onClick={() => onOpen(photo)} className="relative block aspect-[4/3] w-full overflow-hidden bg-zinc-950" aria-label={`View ${photo.title}`}>
        <img src={photo.thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{KIND_LABEL[photo.kind] || photo.kind}</span>
        <span className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"><Maximize2 className="h-3 w-3" /></span>
      </button>
      <div className="p-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={title}
              maxLength={80}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(photo.title); setEditing(false); } }}
              className="min-w-0 flex-1 rounded bg-zinc-950 px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={saveTitle} className="rounded p-1 text-emerald-400 hover:bg-zinc-800" aria-label="Save name"><Check className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="group/t flex w-full items-center gap-1.5 text-left" title="Rename">
            <span className="truncate text-sm font-medium text-white">{photo.title}</span>
            <Pencil className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover/t:opacity-100" />
          </button>
        )}
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">{meta || ' '}</p>
        <p className="text-[11px] text-zinc-600">{when(photo.created_at)}</p>

        <div className="mt-3 flex items-center gap-1 border-t border-zinc-800 pt-2">
          {photo.project_id && (
            <button onClick={() => onRegenerate(photo)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white" title="Make a different version of this">
              <RefreshCw className="h-3 w-3" /> New version
            </button>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={download} disabled={busy} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Download">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
            {confirm ? (
              <>
                <button onClick={() => onDelete(photo)} className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/10">Delete</button>
                <button onClick={() => setConfirm(false)} className="rounded-md px-1.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">Keep</button>
              </>
            ) : (
              <button onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-300" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Lightbox({ photo, onClose }) {
  const [image, setImage] = useState(null);
  useEffect(() => { fullImage(photo.id).then(setImage).catch(() => setImage(photo.thumb)); }, [photo]);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between text-sm text-white">
          <span className="truncate font-medium">{photo.title}</span>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex aspect-[4/3] max-h-[80vh] items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
          {image ? <img src={image} alt={photo.title} className="h-full w-full object-contain" /> : <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />}
        </div>
        {photo.prompt && <p className="mt-2 text-xs text-zinc-400">“{photo.prompt}”</p>}
      </div>
    </div>
  );
}

/** projectId limits it to one project; reloadKey refetches when something new was saved. */
export default function PhotoGallery({ projectId = null, reloadKey = 0 }) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [project, setProject] = useState('all');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    call(`/api/photos${projectId ? `?project_id=${projectId}` : ''}`)
      .then(setPhotos)
      .catch(e => { setError(e.message); setPhotos([]); });
  }, [projectId, reloadKey]);

  const projects = useMemo(() => {
    const m = new Map();
    (photos || []).forEach(p => { if (p.project_id && p.project_name) m.set(p.project_id, p.project_name); });
    return [...m.entries()];
  }, [photos]);

  const shown = (photos || []).filter(p =>
    (filter === 'all' || (filter === 'concept' ? ['cutaway', 'exterior'].includes(p.kind) : p.kind === filter))
    && (project === 'all' || String(p.project_id) === project));

  const rename = async (photo, title) => {
    try {
      const upd = await call(`/api/photos/${photo.id}`, { method: 'PUT', body: { title } });
      setPhotos(ps => ps.map(p => (p.id === photo.id ? { ...p, title: upd.title } : p)));
    } catch (e) { setError(e.message); }
  };
  const remove = async (photo) => {
    try {
      await call(`/api/photos/${photo.id}`, { method: 'DELETE' });
      setPhotos(ps => ps.filter(p => p.id !== photo.id));
    } catch (e) { setError(e.message); }
  };
  const regenerate = (photo) => {
    if (['cutaway', 'exterior'].includes(photo.kind)) {
      navigate(`/studio?projectId=${photo.project_id}&tool=concept`);
      return;
    }
    const q = new URLSearchParams({ projectId: photo.project_id });
    if (photo.room_key) q.set('room', photo.room_key);
    if (photo.prompt) q.set('prompt', photo.prompt);
    if (photo.style) q.set('style', photo.style);
    navigate(`/render-studio?${q}`);
  };

  if (photos === null) {
    return <div className="flex items-center gap-2 py-16 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading photos…</div>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`rounded-md px-3 py-1.5 ${filter === id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>{label}</button>
          ))}
        </div>
        {!projectId && projects.length > 1 && (
          <select value={project} onChange={e => setProject(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none">
            <option value="all">All projects</option>
            {projects.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-zinc-500">{shown.length} photo{shown.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <ImageOff className="h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">{photos.length ? 'No photos match this filter.' : 'No saved photos yet.'}</p>
          {!photos.length && <p className="max-w-sm text-xs text-zinc-500">In Photo Render or Concept Viz, press Save on any image you like and it will be kept here.</p>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map(p => (
            <PhotoCard key={p.id} photo={p} showProject={!projectId} onRename={rename} onDelete={remove} onOpen={setOpen} onRegenerate={regenerate} />
          ))}
        </ul>
      )}
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Canvas2D from './Canvas2D';
import { api, planArea, formatArea } from '../utils/api';

// read-only view of a project opened from a share link; no login needed
export default function SharedView() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [floor, setFloor] = useState(1);

  useEffect(() => {
    api(`/api/shared/${token}`).then(setProject).catch(e => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-zinc-300">
        <p>{error}</p>
        <Link to="/" className="text-sm text-white underline underline-offset-4">Go to Arch-E-Tech</Link>
      </div>
    );
  }
  if (!project) {
    return <div className="h-screen flex items-center justify-center text-sm text-zinc-500">Loading plan…</div>;
  }

  const elements = project.elements_data.filter(el => (el.floor || 1) === floor);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-zinc-800">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-sm font-semibold truncate">{project.name}</h1>
          <span className="text-xs text-zinc-500 truncate">
            {[project.owner && `by ${project.owner}`, project.locality, formatArea(planArea(project.elements_data))]
              .filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {project.floors > 1 && (
            <select
              value={floor}
              onChange={e => setFloor(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 text-xs rounded-md px-2 py-1"
            >
              {Array.from({ length: project.floors }, (_, i) => (
                <option key={i} value={i + 1}>Floor {i + 1}</option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-zinc-500 border border-zinc-800 rounded-full px-2.5 py-1">View only</span>
        </div>
      </header>
      <main className="relative flex-1">
        <Canvas2D elements={elements} drawingMode={null} setCanvasElements={() => {}} blueprintMode={false} activeTab="2D" />
      </main>
    </div>
  );
}

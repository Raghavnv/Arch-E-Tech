import { formatArea } from '../utils/units';

/*
 * A floor plan drawn as linework in SVG, walls drawing themselves in: used by the Overview, the share
 * link and Compare options. Kept apart from the 3D code so pages that only show a plan load fast.
 */
const OPEN = new Set(['living', 'dining', 'lounge']);

function lineOf(e) {
  const a = ((e.angle || 0) * Math.PI) / 180;
  return [e.left, e.top, e.left + e.width * Math.cos(a), e.top + e.width * Math.sin(a)];
}

export function PlanDrawing({ elements, highlight = null, animate = true, labels = true, onRoomClick = null, children = null }) {
  const rooms = elements.filter(e => e.type === 'room');
  if (!rooms.length) return null;
  const x0 = Math.min(...rooms.map(r => r.left)), y0 = Math.min(...rooms.map(r => r.top - r.height / 2));
  const x1 = Math.max(...rooms.map(r => r.left + r.width)), y1 = Math.max(...rooms.map(r => r.top + r.height / 2));
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const walls = elements.filter(e => e.type === 'wall');
  const sw = Math.max(x1 - x0, y1 - y0) / 150;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {rooms.map((r, i) => (
        <rect key={`r${i}`} x={r.left} y={r.top - r.height / 2} width={r.width} height={r.height}
          fill={highlight === r.id ? 'rgba(200,121,74,0.32)' : OPEN.has(r.kind) ? 'rgba(200,121,74,0.08)' : 'rgba(231,226,217,0.035)'}
          style={{ transition: 'fill .6s ease', cursor: onRoomClick ? 'pointer' : undefined }}
          onClick={onRoomClick ? () => onRoomClick(r) : undefined} />
      ))}
      {walls.map((w, i) => {
        const [ax, ay, bx, by] = lineOf(w);
        return <line key={`w${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#e7e2d9" strokeWidth={sw * 1.6} strokeLinecap="square"
          pathLength="1" className={animate ? 'draw-in' : ''} style={animate ? { animationDelay: `${(i % 24) * 0.05}s` } : undefined} />;
      })}
      {elements.filter(e => e.type === 'door' || e.type === 'window').map((o, i) => {
        const [ax, ay, bx, by] = lineOf(o);
        return <line key={`o${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={o.type === 'door' ? '#c8794a' : '#9fb7c4'} strokeWidth={sw * 1.9} />;
      })}
      {elements.filter(e => e.type === 'railing').map((o, i) => {
        const [ax, ay, bx, by] = lineOf(o);
        return <line key={`g${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#c8794a" strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 1.5}`} />;
      })}
      {elements.filter(e => e.type === 'stairs').map((st, i) => {
        const [ax, ay, bx, by] = lineOf(st);
        const vertical = Math.abs(ax - bx) < 1;
        const w = st.height;
        const box = vertical ? [ax - w / 2, ay, w, by - ay] : [ax, ay - w / 2, bx - ax, w];
        return (
          <g key={`s${i}`}>
            <rect x={box[0]} y={box[1]} width={Math.abs(box[2])} height={Math.abs(box[3])} fill="none" stroke="#a8a29a" strokeWidth={sw * 0.8} />
            {Array.from({ length: 8 }).map((_, k) => vertical
              ? <line key={k} x1={box[0]} x2={box[0] + w} y1={ay + (k + 1) * (by - ay) / 9} y2={ay + (k + 1) * (by - ay) / 9} stroke="#7b746b" strokeWidth={sw * 0.5} />
              : <line key={k} y1={box[1]} y2={box[1] + w} x1={ax + (k + 1) * (bx - ax) / 9} x2={ax + (k + 1) * (bx - ax) / 9} stroke="#7b746b" strokeWidth={sw * 0.5} />)}
          </g>
        );
      })}
      {labels && rooms.map((r, i) => {
        // each label fits its own room: long names in small rooms get smaller type
        const fs = Math.min(sw * 6, (r.width * 0.86) / Math.max(4, (r.name || '').length * 0.56), r.height * 0.22);
        return (
          <g key={`t${i}`} className="rise-in" style={{ animationDelay: animate ? '1.3s' : '0s' }} textAnchor="middle" pointerEvents="none">
            <text x={r.left + r.width / 2} y={r.top - fs * 0.25} fontSize={fs} fill="#f3f1ed" fontFamily="Inter, sans-serif" fontWeight="500">{r.name}</text>
            <text x={r.left + r.width / 2} y={r.top + fs * 1.05} fontSize={fs * 0.78} fill="#a8a29a" fontFamily="'JetBrains Mono', monospace">{formatArea(r.area, { short: true })}</text>
          </g>
        );
      })}
      {children}
    </svg>
  );
}


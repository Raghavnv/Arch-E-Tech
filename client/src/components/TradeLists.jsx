import { useEffect, useMemo, useState } from 'react';
import { HardHat, Loader2, Download, FileText } from 'lucide-react';
import { Panel } from './StudioTools';
import { openingTypes } from '../utils/approvalDrawings';
import { roomWalls } from '../utils/finishSchedule';
import { FLOOR_BY_ID } from '../utils/floorFinishes';
import { catalogItem } from '../utils/furnitureCatalog';

/*
 * Material lists for each trade: what the mason, carpenter, electrician, plumber, painter and tiler each
 * need for this house, from the quantities estimate, the electrical and plumbing layout (points room by
 * room), the door and window schedule, and the finishes on the plan. Each list downloads as a spreadsheet
 * (CSV) to send to that trade; all of them together as one PDF.
 */
const U = 20;
const OUTDOOR = new Set(['patio', 'balcony', 'terrace', 'deck']);
const SANITARY = { furniture_wc: 'WC (toilet) with cistern', furniture_vanity: 'Vanity with basin', furniture_basin: 'Wash basin, pedestal', furniture_shower: 'Shower enclosure and mixer',
  furniture_bathtub: 'Bathtub with mixer', furniture_sink_unit: 'Kitchen sink with tap', furniture_kitchen: 'Kitchen sink with tap', furniture_washing_machine: 'Washing machine inlet and outlet', furniture_dishwasher: 'Dishwasher inlet and outlet' };
const FITTED = { furniture_wardrobe2: 'Wardrobe, 2 doors', furniture_wardrobe3: 'Wardrobe, 3 doors', furniture_wardrobe_sliding: 'Sliding wardrobe', furniture_tv_unit: 'TV unit',
  furniture_kitchen: 'Kitchen counter with base cabinets', furniture_base_cabinet: 'Kitchen base cabinet, 60 cm', furniture_wall_cabinet: 'Kitchen wall cabinet, 60 cm', furniture_tall_unit: 'Tall pantry unit',
  furniture_pooja: 'Pooja unit', furniture_crockery_tall: 'Crockery cabinet', furniture_bookshelf: 'Bookshelf', furniture_shoe_rack: 'Shoe rack', furniture_vanity: 'Vanity cabinet' };

const box = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
const roomAt = (rooms, x, y, f) => rooms.find(r => (r.floor || 1) === f && (() => { const b = box(r); return x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 - 4 && y < b.y1 + 4; })());
const fmt = (n, d = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** The lists: { key: { name, intro, rows: [[item, qty, unit, where]] } } */
function buildLists(elements, q, s) {
  const rooms = elements.filter(e => e.type === 'room');
  const mat = Object.fromEntries((q?.materials || []).map(m => [m.key, m]));
  const work = Object.fromEntries((q?.works || []).map(w => [w.key, w]));
  const lists = {};
  const m = (k, label) => (mat[k] ? [label || mat[k].name || k, mat[k].qty, mat[k].unit, ''] : null);
  const wk = (k, label) => (work[k] ? [label || work[k].item, work[k].qty, work[k].unit, ''] : null);

  lists.mason = { name: 'Mason', intro: 'Excavation, concrete, brickwork, plastering and waterproofing.', rows: [
    wk('excavation', 'Excavation for footings'), wk('pcc', 'Plain concrete bed (PCC 1:4:8)'), wk('footings', 'RCC footings (M20)'), wk('columns', 'RCC columns (M20)'),
    wk('beams', 'RCC beams and plinth beam (M20)'), wk('slabs', 'RCC slabs (M20)'), wk('brickwork', 'Brickwork (230 mm outside, 115 mm inside)'), wk('plaster', 'Plastering inside and out'),
    m('waterproofing', 'Waterproofing (roof and bathrooms)'), m('cement', 'Cement (OPC 53 / PPC)'), m('sand', 'Sand (M-sand for concrete, P-sand for plaster)'),
    m('aggregate', 'Aggregate (20 mm and 12 mm)'), m('bricks', 'Bricks'), m('steel', 'Steel TMT Fe500 (for the bar bender)'),
    q?.summary?.columns ? ['Columns', q.summary.columns, 'nos', 'see the structural drawings'] : null,
  ].filter(Boolean) };

  const { types } = openingTypes(elements);
  const fitted = new Map();
  elements.filter(e => FITTED[e.type]).forEach(p => {
    const r = roomAt(rooms, p.left, p.top, p.floor || 1);
    const k = p.type;
    const cur = fitted.get(k) || { n: 0, where: new Set() };
    cur.n += 1; if (r) cur.where.add(r.name || r.kind);
    fitted.set(k, cur);
  });
  lists.carpenter = { name: 'Carpenter', intro: 'Door frames and shutters, window frames, and fitted joinery.', rows: [
    ...types.map(t => [`${t.mark} ${t.kind.toLowerCase()} ${t.w.toFixed(2)} × ${t.h.toFixed(2)} m, ${t.frame}`, t.ids.length, 'nos', [...t.where.keys()].join(', ')]),
    ...[...fitted.entries()].map(([k, v]) => [FITTED[k], v.n, 'nos', [...v.where].join(', ')]),
  ] };

  // electrician and plumber: points room by room
  const byRoom = (system) => {
    const map = new Map();
    (s?.points || []).filter(p => p.system === system).forEach(p => {
      const key = `${p.floor > 1 ? `F${p.floor} ` : ''}${p.room || 'General'}`;
      const cur = map.get(key) || {};
      cur[p.type] = (cur[p.type] || 0) + 1;
      map.set(key, cur);
    });
    return map;
  };
  const labels = s?.labels || {};
  const eRows = [];
  byRoom('electrical').forEach((c, room) => Object.entries(c).forEach(([t, n]) => eRows.push([labels[t] || t, n, 'points', room])));
  lists.electrician = { name: 'Electrician', intro: 'Points room by room, then the wiring and the board.', rows: [
    ...eRows, m('wiring', 'Wiring (FR copper, 1.5 / 2.5 / 4 mm²)'),
    s?.counts ? ['Distribution board with MCBs', 1 + Math.max(0, [...new Set((s.points || []).map(p => p.floor))].length - 1), 'nos', 'one per floor'] : null,
    s?.counts?.switch ? ['Modular switch plates', s.counts.switch, 'nos', ''] : null,
  ].filter(Boolean) };

  const pRows = [];
  byRoom('plumbing').forEach((c, room) => Object.entries(c).forEach(([t, n]) => pRows.push([labels[t] || t, n, 'points', room])));
  const sanitary = new Map();
  elements.filter(e => SANITARY[e.type]).forEach(p => {
    const r = roomAt(rooms, p.left, p.top, p.floor || 1);
    const cur = sanitary.get(p.type) || { n: 0, where: new Set() };
    cur.n += 1; if (r) cur.where.add(r.name || r.kind);
    sanitary.set(p.type, cur);
  });
  lists.plumber = { name: 'Plumber', intro: 'Supply and drain points, pipes, and the fixtures to fit.', rows: [
    ...pRows, m('pipes', 'Pipes (CPVC supply, uPVC / SWR drainage)'),
    ...[...sanitary.entries()].map(([k, v]) => [SANITARY[k], v.n, 'nos', [...v.where].join(', ')]),
    s?.counts?.geyser ? ['Geyser', s.counts.geyser, 'nos', 'bathrooms'] : null,
  ].filter(Boolean) };

  // painter: each room's colours and areas
  const paintRows = [];
  rooms.filter(r => !OUTDOOR.has(r.kind)).forEach(r => {
    roomWalls(r, elements).filter(w => w.kind === 'paint' && w.m2 > 0.5).forEach(w => paintRows.push([`Paint: ${w.name}`, Math.round(w.m2), 'm²', `${r.name || r.kind}${(r.floor || 1) > 1 ? ` (F${r.floor})` : ''}`]));
  });
  lists.painter = { name: 'Painter', intro: 'Putty, primer and two coats; colours room by room (walls with no colour chosen: standard white).', rows: [
    wk('painting', 'Painting area in all'), m('putty', 'Wall putty'), m('primer', 'Primer'), m('paint', 'Paint (interior and exterior emulsion)'), ...paintRows,
  ].filter(Boolean) };

  // tiler: floors by finish, with skirting
  const floors = new Map();
  rooms.forEach(r => {
    const f = FLOOR_BY_ID[r.flooring];
    const name = f ? f.name : r.kind === 'bathroom' ? 'Anti-skid bathroom tile' : 'Vitrified tile (standard)';
    const a = (r.width / U) * (r.height / U);
    const cur = floors.get(name) || { a: 0, rft: 0, where: [] };
    cur.a += a; cur.rft += (2 * (r.width + r.height) / U) * 3.28; cur.where.push(r.name || r.kind);
    floors.set(name, cur);
  });
  const wetWall = rooms.filter(r => r.kind === 'bathroom').reduce((s2, r) => s2 + (2 * (r.width + r.height) / U) * 2.1, 0)
    + rooms.filter(r => r.kind === 'kitchen').reduce((s2, r) => s2 + ((r.width + r.height) / U) * 0.6, 0);
  lists.tiler = { name: 'Tiler', intro: 'Floor finishes room by room, with 7 % extra for cutting; bathroom walls to 2.1 m and kitchen dado.', rows: [
    ...[...floors.entries()].map(([name, v]) => [name, Math.round(v.a * 1.07 * 10) / 10, 'm²', v.where.join(', ')]),
    ['Skirting', Math.round([...floors.values()].reduce((s2, v) => s2 + v.rft, 0)), 'rft', 'all rooms'],
    wetWall ? ['Wall tiles (bathrooms to 2.1 m, kitchen dado)', Math.round(wetWall * 1.07), 'm²', 'bathrooms and kitchen'] : null,
  ].filter(Boolean) };
  return lists;
}

export default function TradeLists({ elements, projectName, apiUrl, onClose }) {
  const [q, setQ] = useState(null);
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('mason');

  useEffect(() => {
    let off = false;
    const post = (path) => fetch(`${apiUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elements }) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`The server answered ${r.status}.`))));
    Promise.all([post('/api/ai/quantities'), post('/api/ai/services-layout')])
      .then(([a, b]) => { if (!off) { setQ(a); setS(b); } })
      .catch(e => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = useMemo(() => (q ? buildLists(elements, q, s) : null), [elements, q, s]);
  const safe = (projectName || 'house').replace(/[^\w-]+/g, '_');

  const csv = (key) => {
    const L = lists[key];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const text = [['Item', 'Quantity', 'Unit', 'Where'], ...L.rows].map(r => r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = `${safe}_${L.name.toLowerCase()}_list.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const pdfAll = async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    Object.values(lists).forEach((L, i) => {
      if (i) pdf.addPage();
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(`${L.name}`, 16, 22);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110); pdf.text(`${projectName || 'House'} · ${L.intro}`, 16, 28, { maxWidth: 178 });
      pdf.setTextColor(30);
      let y = 38;
      pdf.setFontSize(7); pdf.setTextColor(110); pdf.text('ITEM', 16, y); pdf.text('QTY', 128, y, { align: 'right' }); pdf.text('UNIT', 132, y); pdf.text('WHERE', 148, y); pdf.setTextColor(30); y += 5;
      pdf.setFontSize(8);
      L.rows.forEach(r => {
        const item = pdf.splitTextToSize(String(r[0]), 104), where = pdf.splitTextToSize(String(r[3] || ''), 46);
        const h = Math.max(item.length, where.length) * 3.6 + 1.5;
        if (y + h > 285) { pdf.addPage(); y = 20; }
        pdf.text(item, 16, y); pdf.text(fmt(r[1], 1), 128, y, { align: 'right' }); pdf.text(String(r[2]), 132, y); pdf.text(where, 148, y);
        y += h;
      });
      pdf.setFontSize(6.5); pdf.setTextColor(130);
      pdf.text('Quantities estimated from the plan with typical wastage. The site engineer confirms before ordering.', 16, 290);
      pdf.setTextColor(30);
    });
    pdf.save(`${safe}_trade_lists.pdf`);
  };

  return (
    <Panel icon={HardHat} title="Lists for each trade" onClose={onClose} wide>
      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {!lists && !error && <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out the quantities…</p>}
      {lists && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(lists).map(([k, L]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? 'chip-on' : 'chip'}>{L.name} · {L.rows.length}</button>)}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">{lists[tab].intro}</p>
          <div className="mt-2 max-h-[52vh] overflow-y-auto rounded-lg border border-zinc-800 custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950"><tr className="text-left text-[10px] text-zinc-500"><th className="px-3 py-1.5 font-normal">Item</th><th className="px-2 font-normal text-right">Qty</th><th className="px-2 font-normal">Unit</th><th className="px-2 font-normal">Where</th></tr></thead>
              <tbody>
                {lists[tab].rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-800/70 align-top">
                    <td className="px-3 py-1.5 text-zinc-200">{r[0]}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-100">{fmt(r[1], 1)}</td>
                    <td className="px-2 py-1.5 text-zinc-400">{r[2]}</td>
                    <td className="px-2 py-1.5 text-[11px] text-zinc-500">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => csv(tab)} className="btn-secondary px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> {lists[tab].name}'s list (spreadsheet)</button>
            <button onClick={pdfAll} className="btn-primary px-3 py-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> All trades (PDF)</button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">Estimated from the plan with typical wastage; the site engineer confirms quantities before ordering.</p>
        </>
      )}
    </Panel>
  );
}

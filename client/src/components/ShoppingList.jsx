import { useMemo, useState } from 'react';
import { ShoppingBag, Download, ExternalLink, Check } from 'lucide-react';
import { Panel } from './StudioTools';
import { catalogItem } from '../utils/furnitureCatalog';
import { formatMoney, currencyCode } from '../utils/units';

/*
 * Shopping list: every piece of furniture and decor in the plan, room by room, with an estimated price
 * and links that search real shops for it (Pepperfry, Urban Ladder, IKEA and Amazon in India; IKEA,
 * Wayfair and Amazon elsewhere). Prices are the catalogue's estimates, not quotes; ticking a piece off
 * as bought is remembered on this device. Downloads as a spreadsheet (CSV).
 */
const U = 20;
const SHOPS = {
  INR: [['Pepperfry', q => `https://www.pepperfry.com/site_product/search?q=${q}`], ['Urban Ladder', q => `https://www.urbanladder.com/products?q=${q}`],
    ['IKEA', q => `https://www.ikea.com/in/en/search/?q=${q}`], ['Amazon', q => `https://www.amazon.in/s?k=${q}`]],
  USD: [['IKEA', q => `https://www.ikea.com/us/en/search/?q=${q}`], ['Wayfair', q => `https://www.wayfair.com/keyword.php?keyword=${q}`], ['Amazon', q => `https://www.amazon.com/s?k=${q}`]],
  EUR: [['IKEA', q => `https://www.ikea.com/de/en/search/?q=${q}`], ['Amazon', q => `https://www.amazon.de/s?k=${q}`]],
};
// pieces the builder fits rather than the owner buys
const FITTED = new Set(['furniture_kitchen', 'furniture_base_cabinet', 'furniture_sink_unit', 'furniture_hob_unit', 'furniture_wall_cabinet', 'furniture_tall_unit',
  'furniture_oven_tower', 'furniture_island', 'furniture_wc', 'furniture_vanity', 'furniture_basin', 'furniture_shower', 'furniture_bathtub', 'furniture_wardrobe_sliding']);
const SEARCH = {
  furniture_sofa: '3 seater sofa', furniture_sofa2: '2 seater sofa', furniture_sectional: 'L shaped sofa', furniture_dining4: '4 seater dining table',
  furniture_table: '6 seater dining table', furniture_dining8: '8 seater dining table', furniture_tv: '55 inch TV', furniture_bed: 'king size bed',
  furniture_bed_queen: 'queen size bed', furniture_bed_single: 'single bed', furniture_wardrobe2: '2 door wardrobe', furniture_wardrobe3: '3 door wardrobe',
  furniture_kitchen: 'modular kitchen', furniture_wc: 'western toilet', furniture_fridge: 'double door refrigerator', furniture_fridge_single: 'single door refrigerator',
  furniture_pooja: 'pooja mandir', furniture_swing: 'swing jhula', furniture_diwan: 'diwan', furniture_plant: 'indoor plant with pot',
};
// "Sofa, 3-seater" -> "3-seater sofa"
const searchFor = (type, name) => SEARCH[type] || (name.includes(',') ? name.split(',').map(s => s.trim()).reverse().join(' ') : name).replace(/[()"/]/g, ' ').replace(/\s+/g, ' ').trim();

const boxOf = (r) => ({ x0: r.left, x1: r.left + r.width, y0: r.top - r.height / 2, y1: r.top + r.height / 2 });
/** The room a piece stands in: its middle is a little way in from its back, which `angle` names. */
function roomOf(p, rooms) {
  const d = (p.height || 20) / 2;
  const step = { 0: [0, d], 90: [-d, 0], 180: [0, -d], 270: [d, 0] }[((Math.round(p.angle || 0) % 360) + 360) % 360] || [0, 0];
  const tries = [[p.left + step[0], p.top + step[1]], [p.left, p.top], [p.left, p.top + d], [p.left, p.top - d], [p.left + d, p.top], [p.left - d, p.top]];
  const here = rooms.filter(r => (r.floor || 1) === (p.floor || 1));
  for (const [x, y] of tries) {
    const hit = here.filter(r => { const b = boxOf(r); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; })
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    if (hit) return hit;
  }
  return null;
}

export default function ShoppingList({ elements, projectId, projectName, onClose }) {
  const key = `shop_${projectId || 'draft'}`;
  const [bought, setBought] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } });
  const [fitted, setFitted] = useState(false);
  const shops = SHOPS[currencyCode()] || SHOPS.USD;

  const groups = useMemo(() => {
    const rooms = elements.filter(e => e.type === 'room');
    const byRoom = new Map();
    elements.filter(e => typeof e.type === 'string' && e.type.startsWith('furniture_')).forEach(p => {
      const item = catalogItem(p.type);
      if (!item || (!fitted && FITTED.has(p.type))) return;
      const room = roomOf(p, rooms);
      const rk = room?.id || 'none';
      if (!byRoom.has(rk)) byRoom.set(rk, { room, items: new Map() });
      const g = byRoom.get(rk).items;
      const line = g.get(p.type) || { type: p.type, name: item.name, price: item.price, qty: 0, size: `${item.w} × ${item.d} m`, fitted: FITTED.has(p.type) };
      line.qty += 1;
      g.set(p.type, line);
    });
    return [...byRoom.values()].map(g => ({ ...g, items: [...g.items.values()].sort((a, b) => b.price * b.qty - a.price * a.qty) }))
      .sort((a, b) => ((a.room?.floor || 1) - (b.room?.floor || 1)) || (a.room ? 0 : 1) - (b.room ? 0 : 1) || (a.room?.name || '').localeCompare(b.room?.name || ''));
  }, [elements, fitted]);

  const lineKey = (g, it) => `${g.room?.id || 'none'}:${it.type}`;
  const all = groups.flatMap(g => g.items.map(it => ({ ...it, k: lineKey(g, it), room: g.room?.name || 'Not in a room' })));
  const total = all.reduce((s, it) => s + it.price * it.qty, 0);
  const left = all.filter(it => !bought.has(it.k)).reduce((s, it) => s + it.price * it.qty, 0);
  const toggle = (k) => setBought(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  });

  const csv = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Room', 'Item', 'Size', 'Quantity', 'Price each (estimate)', 'Total (estimate)', 'Bought', 'Search'],
      ...all.map(it => [it.room, it.name, it.size, it.qty, formatMoney(it.price), formatMoney(it.price * it.qty), bought.has(it.k) ? 'yes' : '', shops[0][1](encodeURIComponent(searchFor(it.type, it.name)))])];
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(projectName || 'house').replace(/[^\w-]+/g, '_')}_shopping_list.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Panel icon={ShoppingBag} title="Shopping list" onClose={onClose} wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Estimated total</p>
          <p className="text-xl font-semibold text-white">{formatMoney(total)}</p>
          <p className="text-[11px] text-zinc-500">{all.length ? `${formatMoney(left)} still to buy · ${all.filter(it => bought.has(it.k)).length} of ${all.length} lines bought` : 'No furniture in the plan yet.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <input type="checkbox" checked={fitted} onChange={(e) => setFitted(e.target.checked)} className="accent-indigo-500" /> Include fitted kitchen & bathroom
          </label>
          <button onClick={csv} disabled={!all.length} className="btn-secondary px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Spreadsheet</button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map(g => (
          <section key={g.room?.id || 'none'}>
            <p className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-zinc-200">{g.room?.name || 'Not in a room'}{(g.room?.floor || 1) > 1 ? <span className="ml-1 font-normal text-zinc-500">floor {g.room.floor}</span> : null}</span>
              <span className="text-[11px] text-zinc-500">{formatMoney(g.items.reduce((s, it) => s + it.price * it.qty, 0))}</span>
            </p>
            <ul className="divide-y divide-zinc-800/70 rounded-lg border border-zinc-800">
              {g.items.map(it => {
                const k = lineKey(g, it), q = encodeURIComponent(searchFor(it.type, it.name)), done = bought.has(k);
                return (
                  <li key={k} className={`flex items-center gap-2.5 px-3 py-2 ${done ? 'opacity-50' : ''}`}>
                    <button onClick={() => toggle(k)} aria-pressed={done} title={done ? 'Bought' : 'Mark as bought'}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${done ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-zinc-600 hover:border-zinc-400'}`}>
                      {done && <Check className="h-3 w-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs text-zinc-100 ${done ? 'line-through' : ''}`}>{it.qty > 1 ? `${it.qty} × ` : ''}{it.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500">
                        <span>{it.size}</span>
                        {shops.map(([shop, url]) => (
                          <a key={shop} href={url(q)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 text-indigo-300 hover:text-indigo-200">
                            {shop}<ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-300">{formatMoney(it.price * it.qty)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-4 text-[10px] leading-snug text-zinc-600">
        Estimated prices, not quotes. Ticks stay on this device.
      </p>
    </Panel>
  );
}

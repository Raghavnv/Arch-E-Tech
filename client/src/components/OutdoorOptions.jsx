import { Armchair, Fence, Layers, Sun } from 'lucide-react';

/*
 * Floors and outdoor spaces for AI plan generation. Balconies and terraces belong to upper floors, so
 * ticking one on a single-storey house suggests two floors. `withFloors` adds the storey picker; the
 * prompt can still say "on 2 floors" itself.
 */
export const OUTDOOR_CHOICES = [
  ['patio', 'Patio', 'A paved sit-out off the living room, opening onto the garden', Armchair],
  ['balcony', 'Balcony', 'Off the master bedroom upstairs, with railings', Fence],
  ['terrace', 'Terrace', 'An open roof terrace on the top floor', Sun],
];

export const promptWithFloors = (prompt, floors) => {
  if (!floors || /\b(\d|one|two|three|single|double)[- ]?(floor|storey|story|level)s?\b|\bduplex\b|\btriplex\b|\bg\s*\+\s*\d/i.test(prompt)) return prompt;
  return `${prompt.trim()}${prompt.trim() ? ', ' : ''}${floors === 1 ? 'single floor' : `on ${floors} floors`}`;
};

export default function OutdoorOptions({ value, onChange, floors, onFloors, withFloors = true, compact = false }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  const upper = value.balcony || value.terrace;
  return (
    <div>
      {withFloors && (
        <div className="mb-2.5">
          <p className="label-caps mb-1.5 flex items-center gap-1.5"><Layers className="h-3 w-3" /> Floors</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[[0, 'From prompt'], [1, '1'], [2, '2'], [3, '3']].map(([n, label]) => (
              <button key={n} type="button" onClick={() => onFloors(n)} className={floors === n ? 'chip-on text-center' : 'chip text-center'}>{label}</button>
            ))}
          </div>
        </div>
      )}
      <p className="label-caps mb-1.5">Outdoor spaces</p>
      <div className={`grid gap-1.5 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {OUTDOOR_CHOICES.map(([k, label, desc, Icon]) => (
          <button key={k} type="button" onClick={() => toggle(k)} title={desc} aria-pressed={!!value[k]}
            className={`${value[k] ? 'chip-on' : 'chip'} flex items-start gap-2 py-2`}>
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${value[k] ? 'text-indigo-300' : 'text-zinc-500'}`} />
            <span>
              <span className="block font-medium">{label}</span>
              {!compact && <span className="block text-[10px] leading-snug text-zinc-500">{desc}</span>}
            </span>
          </button>
        ))}
      </div>
      {upper && floors === 1 && (
        <p className="mt-1.5 text-[11px] text-amber-300/90">
          A balcony or terrace needs an upper floor.{' '}
          <button type="button" onClick={() => onFloors(2)} className="underline underline-offset-2 hover:text-amber-200">Make it 2 floors</button>
        </p>
      )}
    </div>
  );
}

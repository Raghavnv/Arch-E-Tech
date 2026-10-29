import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

// what each feature does, shown behind its (i) before people use it
export const FEATURE_INFO = {
  detect: {
    title: 'Auto Detect',
    what: 'Finds every space your walls fully enclose and turns it into a labelled room with its area.',
    how: 'Draw the walls first, then open Auto Detect, check the room types it guessed and add them.',
  },
  snap: {
    title: 'Smart Snap',
    what: 'Helps you draw accurately. Wall ends lock onto other wall ends so corners close, doors and windows sit on the nearest wall, and moved items line up on a 25 cm grid.',
    how: 'Click to turn it on or off. It stays the way you left it.',
  },
  layout: {
    title: 'AI Layout',
    what: 'Designs a complete floor plan from a description, with the bedrooms spread around the house.',
    how: 'Describe bedrooms, bathrooms, a study or total area. It replaces the current plan; Ctrl+Z brings the old one back.',
  },
  edit: {
    title: 'AI Edit',
    what: 'Changes the plan from a sentence: resize a door, extend a wall, add a window, move furniture.',
    how: 'Select an item to talk about "this", or name it ("the kitchen door"). Every edit can be undone with Ctrl+Z.',
  },
  rooms: {
    title: 'Rooms',
    what: 'Lists every room in the plan so you can rename it and set its type.',
    how: 'Names show on the plan, in reports and in Photo Render, so clear names make projects easier to follow.',
  },
  concept: {
    title: 'Concept Viz',
    what: 'Turns the floor plan into an AI image: a furnished 3D cutaway of the whole house, or its exterior.',
    how: 'Pick a view and a style, add any notes, then render. You can save results to your photos.',
  },
  render: {
    title: 'Photo Render',
    what: 'Shows each room of your plan as a realistic photo: first empty, then furnished the way you describe.',
    how: 'All rooms share one house style so they look like the same home. Save the photos you like to your gallery.',
  },
  roof: {
    title: 'Roof & lights',
    what: 'Puts a roof on the house, flat with a parapet or pitched, and turns on a warm light in every room.',
    how: 'Lights glow brightest when the sun slider is set to evening. Turn the roof off to look inside from above.',
  },
  railing: {
    title: 'Railing',
    what: 'Draws a railing for a balcony, terrace, patio or stair landing, about 1 m high with glass panels in 3D.',
    how: 'Press R or click Railing, then drag along the open edge. Name the space Balcony or Patio in Rooms.',
  },
  floors: {
    title: 'Floors',
    what: 'Each floor is drawn separately; the 3D view stacks them into one house.',
    how: 'Pick the floor to edit here. In 3D, "All floors" shows the whole house, or just the floor you picked.',
  },
  walkthrough: {
    title: 'Walkthrough',
    what: 'Walk through the house in first person, at eye level, in the 3D view.',
    how: 'Click the view to look around, use W A S D or the arrow keys to move, and press Esc to stop.',
  },
  immersive: {
    title: 'Immersive View',
    what: 'Shows the finished house standing in a setting: a forest, a city at sunset, a park, at night or in rain and snow.',
    how: 'Opens full screen; pick an environment and weather at the bottom, and drag to look around.',
  },
  furniture: {
    title: 'Furniture',
    what: 'Adds beds, sofas, tables, bathroom fittings and kitchen counters at real sizes.',
    how: 'Click an item to place it in the middle of the view, then drag it where you want it.',
  },
  painter: {
    title: 'Material Painter',
    what: 'Paints walls in the 3D view with brick, wood, stone, plaster and other finishes.',
    how: 'Pick a material, then click walls, or use "Apply to all walls". Pick Plain to remove paint.',
  },
};

/** A small (i) that explains a feature on hover or click. */
export default function InfoTip({ id, align = 'left', className = '' }) {
  const info = FEATURE_INFO[id];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (!info) return null;
  return (
    <span
      ref={ref}
      // callers may pin it absolutely (e.g. a tile's corner); otherwise it anchors its own popover
      className={`${/\babsolute\b/.test(className) ? '' : 'relative'} inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`About ${info.title}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 focus:text-zinc-200 focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-full z-[60] mt-2 w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left shadow-2xl ${align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}
        >
          <span className="block text-xs font-semibold text-white">{info.title}</span>
          <span className="mt-1 block text-[11px] leading-snug text-zinc-300">{info.what}</span>
          <span className="mt-1.5 block text-[11px] leading-snug text-zinc-500">{info.how}</span>
        </span>
      )}
    </span>
  );
}

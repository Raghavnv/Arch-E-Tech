// the studio mark: a room in plan with its door swing
export default function Mark({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="25" height="25" fill="none" stroke="#e7e2d9" strokeWidth="1.5" />
      <path d="M1.5 26.5 V14 A12.5 12.5 0 0 1 14 26.5" fill="none" stroke="#c8794a" strokeWidth="1.5" />
    </svg>
  );
}

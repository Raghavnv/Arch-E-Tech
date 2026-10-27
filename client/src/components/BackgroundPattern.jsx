export default function BackgroundPattern() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#09090b] overflow-hidden">
      {/* Drifting aurora light */}
      <div className="animate-aurora-a absolute -top-[25%] -left-[10%] w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="animate-aurora-b absolute top-[30%] -right-[15%] w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="animate-aurora-a absolute -bottom-[30%] left-[25%] w-[45vw] h-[45vw] max-w-[700px] max-h-[700px] rounded-full bg-violet-600/10 blur-[140px]" />

      {/* Architectural drafting grid, faded toward the edges */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]"
        style={{ maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 100%)' }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />
    </div>
  );
}

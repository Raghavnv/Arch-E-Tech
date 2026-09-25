export default function BackgroundPattern() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#020617]">
      {/* Dynamic Ambient Lighting (Bolder Colors) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-cyan-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
      <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen"></div>
      
      {/* High-Tech Architectural Grid (Cyan tinted instead of white) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.15)_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      
      {/* Deep Vignette Overlay (focuses attention to the center) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_100%)] opacity-80"></div>
    </div>
  );
}

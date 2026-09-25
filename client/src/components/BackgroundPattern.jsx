export default function BackgroundPattern() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen opacity-30"></div>
    </div>
  );
}

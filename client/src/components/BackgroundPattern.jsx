export default function BackgroundPattern() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen opacity-70"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
    </div>
  );
}

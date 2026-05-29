export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-neon-purple/30 blur-[120px] animate-float-slow" />
      <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-neon-blue/25 blur-[140px] animate-float-slow" style={{ animationDelay: "-4s" }} />
      <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-neon-cyan/20 blur-[120px] animate-float-slow" style={{ animationDelay: "-8s" }} />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
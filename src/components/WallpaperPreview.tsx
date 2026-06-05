import { useStore, motivationalQuotes, todayStr } from "@/lib/store";
import { useMemo } from "react";

const THEME_STYLES: Record<string, string> = {
  neon: "#06060a",
  cyberpunk: "#05000a",
  minimal: "#000000",
  glass: "#0a0614",
  anime: "#140a14",
  workspace: "#0f111a",
};

const ACCENT: Record<string, string> = {
  purple: "#c084fc", blue: "#60a5fa", cyan: "#22d3ee", pink: "#f472b6",
};

const GLOW: Record<string, string> = {
  purple: "rgba(192,132,252,0.4)", blue: "rgba(96,165,250,0.4)",
  cyan: "rgba(34,211,238,0.4)", pink: "rgba(244,114,182,0.4)",
};

export function WallpaperPreview({ scale = 1 }: { scale?: number }) {
  const { tasks, habits, wallpaper, streakCount, userName, level, xp } = useStore();
  
  const quote = useMemo(() => motivationalQuotes[new Date().getDay() % motivationalQuotes.length], []);
  const today = todayStr();
  const todaysTasks = tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate === today)).slice(0, 5);
  const todaysHabits = habits.slice(0, 5);
  
  const completedToday = tasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(today)).length;
  const totalToday = tasks.filter(t => t.dueDate === today || !t.dueDate).length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const accent = ACCENT[wallpaper.accent] || ACCENT.purple;
  const glow = GLOW[wallpaper.accent] || GLOW.purple;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const fontFamily = wallpaper.font === "mono" ? "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace"
    : wallpaper.font === "serif" ? "Georgia, 'Times New Roman', serif"
    : "'Inter', 'Segoe UI', -apple-system, sans-serif";

  const glassCard = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)",
    backdropFilter: "blur(20px) saturate(150%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: `${1.5 * scale * 10}px`,
    padding: `${2 * scale * 10}px`,
    boxShadow: `0 ${3 * scale * 10}px ${6 * scale * 10}px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`,
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "16/10",
        background: THEME_STYLES[wallpaper.theme] || THEME_STYLES.neon,
        fontFamily, color: "#fff",
        opacity: wallpaper.opacity,
      }}
    >
      <style>{`
        @keyframes slow-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
      
      {/* Ambient Orbs */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow}, transparent 60%)`, filter: "blur(40px)", opacity: 0.7, mixBlendMode: "screen",
        animation: "slow-spin 40s linear infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-30%", right: "-15%", width: "70%", height: "70%", borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}40, transparent 65%)`, filter: "blur(50px)", opacity: 0.6, mixBlendMode: "screen",
        animation: "slow-spin 50s reverse linear infinite",
      }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
        backgroundSize: `${3 * scale * 10}px ${3 * scale * 10}px`,
        maskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
      }} />

      {/* UI Container */}
      <div className="relative z-10 w-full h-full flex justify-between items-center box-border" style={{ padding: `${5 * scale * 10}px ${4 * scale * 10}px` }}>
        
        {/* Left Column */}
        <div className="flex flex-col gap-6" style={{ width: "26%" }}>
          <div>
            <div style={{ fontSize: `${1.2 * scale * 10}px`, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, marginBottom: "4px" }} suppressHydrationWarning>
              {dateStr}
            </div>
            <div style={{ fontSize: `${2.5 * scale * 10}px`, fontWeight: 300, lineHeight: 1.2 }} suppressHydrationWarning>
              {greeting},<br/>
              <span style={{ color: accent, fontWeight: 600 }}>{userName}</span>
              <span style={{ marginLeft: "4px", fontSize: `${2 * scale * 10}px` }}>✨</span>
            </div>
          </div>

          {wallpaper.showTasks && (
            <div style={glassCard}>
              <div style={{ fontSize: `${1.1 * scale * 10}px`, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: `${0.4 * scale * 10}px`, height: `${0.4 * scale * 10}px`, borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                Today's Focus
              </div>
              <div className="flex flex-col gap-2">
                {todaysTasks.length === 0 ? (
                  <div style={{ opacity: 0.4, fontSize: `${1 * scale * 10}px`, padding: "4px 0" }}>All clear. Great job.</div>
                ) : todaysTasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: `${1 * scale * 10}px`, height: `${1 * scale * 10}px`, borderRadius: "50%", border: `1px solid ${accent}60`, flexShrink: 0 }} />
                    <span style={{ fontSize: `${1.05 * scale * 10}px`, opacity: 0.9, lineHeight: 1.3 }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center Time */}
        <div className="flex flex-col items-center relative" style={{ top: "-10%" }}>
          <div suppressHydrationWarning style={{
            fontSize: `${14 * scale * 10}px`, fontWeight: 700, letterSpacing: "-0.04em",
            lineHeight: 1, textShadow: `0 10px 40px ${accent}40`,
            background: `linear-gradient(180deg, #ffffff 30%, rgba(255,255,255,0.4))`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {timeStr}
          </div>
          {wallpaper.showQuote && (
            <div suppressHydrationWarning style={{
              fontSize: `${1.1 * scale * 10}px`, opacity: 0.5, fontStyle: "italic",
              fontWeight: 300, letterSpacing: "0.05em", marginTop: "12px",
              textAlign: "center", maxWidth: "80%"
            }}>
              "{quote}"
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 items-end" style={{ width: "24%" }}>
          {wallpaper.showStats && (
            <div style={{ ...glassCard, width: "100%", textAlign: "right" }}>
              <div style={{ fontSize: `${0.9 * scale * 10}px`, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "4px" }}>
                Operator Level {level}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "4px", marginBottom: "12px" }}>
                <span style={{
                  fontSize: `${3 * scale * 10}px`, fontWeight: 700,
                  background: `linear-gradient(135deg, #fff, ${accent})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  textShadow: `0 0 20px ${accent}40`
                }}>{xp.toLocaleString()}</span>
                <span style={{ fontSize: `${1.1 * scale * 10}px`, opacity: 0.6, fontWeight: 500 }}>XP</span>
              </div>
              
              {wallpaper.showStreak && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: "rgba(255,255,255,0.05)", borderRadius: `${1 * scale * 10}px`, padding: `${0.6 * scale * 10}px ${1 * scale * 10}px`,
                  border: "1px solid rgba(255,255,255,0.05)", marginBottom: "16px"
                }}>
                  <span style={{ fontSize: `${1.2 * scale * 10}px`, filter: "drop-shadow(0 0 5px rgba(255,100,0,0.5))" }}>🔥</span>
                  <span style={{ fontSize: `${1.1 * scale * 10}px`, fontWeight: 600 }}>{streakCount} Day Streak</span>
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${0.8 * scale * 10}px`, opacity: 0.5, marginBottom: "4px" }}>
                  <span>Daily Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div style={{ width: "100%", height: `${0.3 * scale * 10}px`, background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{
                    width: `${progressPct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${accent}, #fff)`,
                    borderRadius: "4px", boxShadow: `0 0 5px ${accent}`
                  }} />
                </div>
              </div>
            </div>
          )}

          {wallpaper.showTasks && (
            <div style={{ ...glassCard, width: "100%" }}>
              <div style={{ fontSize: `${1.1 * scale * 10}px`, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: `${0.4 * scale * 10}px`, height: `${0.4 * scale * 10}px`, borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                Daily Habits
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {todaysHabits.map((h) => {
                  const done = h.history[today];
                  return (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: `${0.7 * scale * 10}px ${1 * scale * 10}px`, borderRadius: `${1 * scale * 10}px`,
                      background: done ? `linear-gradient(90deg, ${accent}15, transparent)` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${done ? accent + "30" : "rgba(255,255,255,0.03)"}`,
                      borderLeft: `2px solid ${done ? accent : "transparent"}`,
                    }}>
                      <span style={{ fontSize: `${1.3 * scale * 10}px`, filter: done ? `drop-shadow(0 0 5px ${accent}40)` : "none" }}>{h.emoji}</span>
                      <span style={{ fontSize: `${1.05 * scale * 10}px`, opacity: done ? 1 : 0.6, fontWeight: done ? 500 : 400 }}>{h.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    backdropFilter: "blur(40px) saturate(150%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1.5cqi",
    padding: "2cqi",
    boxShadow: "0 3cqi 6cqi rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "16/10",
        background: THEME_STYLES[wallpaper.theme] || THEME_STYLES.neon,
        fontFamily, color: "#fff",
        opacity: wallpaper.opacity,
        containerType: "inline-size"
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
        position: "absolute", top: "-20%", left: "-10%", width: "60cqi", height: "60cqi", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow}, transparent 60%)`, filter: "blur(8cqi)", opacity: 0.7, mixBlendMode: "screen",
        animation: "slow-spin 40s linear infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-30%", right: "-15%", width: "70cqi", height: "70cqi", borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}40, transparent 65%)`, filter: "blur(10cqi)", opacity: 0.6, mixBlendMode: "screen",
        animation: "slow-spin 50s reverse linear infinite",
      }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
        backgroundSize: "3cqi 3cqi",
        maskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
      }} />

      {/* UI Container */}
      <div className="relative z-10 w-full h-full flex justify-between items-center box-border" style={{ padding: "3cqi 4cqi" }}>
        
        {/* Left Column */}
        <div className="flex flex-col gap-[3cqi]" style={{ width: "24cqi" }}>
          <div>
            <div style={{ fontSize: "1.2cqi", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, marginBottom: "1cqi" }} suppressHydrationWarning>
              {dateStr}
            </div>
            <div style={{ fontSize: "2.5cqi", fontWeight: 300, lineHeight: 1.2 }} suppressHydrationWarning>
              {greeting},<br/>
              <span style={{ color: accent, fontWeight: 600 }}>{userName}</span>
              <span style={{ marginLeft: "0.5cqi", fontSize: "2cqi" }}>✨</span>
            </div>
          </div>

          {wallpaper.showTasks && (
            <div style={glassCard}>
              <div style={{ fontSize: "1.1cqi", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1.5cqi", display: "flex", alignItems: "center", gap: "0.5cqi" }}>
                <span style={{ width: "0.4cqi", height: "0.4cqi", borderRadius: "50%", background: accent, boxShadow: `0 0 1cqi ${accent}` }} />
                Today's Focus
              </div>
              <div className="flex flex-col gap-[1.2cqi]">
                {todaysTasks.length === 0 ? (
                  <div style={{ opacity: 0.4, fontSize: "1cqi", padding: "1cqi 0" }}>All clear. Great job.</div>
                ) : todaysTasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.8cqi" }}>
                    <div style={{ width: "1cqi", height: "1cqi", borderRadius: "50%", border: `1px solid ${accent}60`, flexShrink: 0 }} />
                    <span style={{ fontSize: "1.05cqi", opacity: 0.9, lineHeight: 1.3 }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center Time */}
        <div className="flex flex-col items-center relative" style={{ top: "-5cqi" }}>
          <div suppressHydrationWarning style={{
            fontSize: "12cqi", fontWeight: 700, letterSpacing: "-0.04em",
            lineHeight: 1, textShadow: `0 2cqi 6cqi ${accent}40`,
            background: `linear-gradient(180deg, #ffffff 30%, rgba(255,255,255,0.4))`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {timeStr}
          </div>
          {wallpaper.showQuote && (
            <div suppressHydrationWarning style={{
              fontSize: "1.1cqi", opacity: 0.5, fontStyle: "italic",
              fontWeight: 300, letterSpacing: "0.05em", marginTop: "2cqi",
              textAlign: "center", maxWidth: "35cqi"
            }}>
              "{quote}"
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-[3cqi] items-end" style={{ width: "22cqi" }}>
          {wallpaper.showStats && (
            <div style={{ ...glassCard, width: "100%", textAlign: "right" }}>
              <div style={{ fontSize: "0.9cqi", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5cqi" }}>
                Operator Level {level}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "0.4cqi", marginBottom: "1.5cqi" }}>
                <span style={{
                  fontSize: "3cqi", fontWeight: 700,
                  background: `linear-gradient(135deg, #fff, ${accent})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  textShadow: `0 0 2cqi ${accent}40`
                }}>{xp.toLocaleString()}</span>
                <span style={{ fontSize: "1.1cqi", opacity: 0.6, fontWeight: 500 }}>FP</span>
              </div>
              
              {wallpaper.showStreak && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "0.6cqi",
                  background: "rgba(255,255,255,0.05)", borderRadius: "1cqi", padding: "0.6cqi 1cqi",
                  border: "1px solid rgba(255,255,255,0.05)", marginBottom: "2cqi"
                }}>
                  <span style={{ fontSize: "1.2cqi", filter: "drop-shadow(0 0 0.5cqi rgba(255,100,0,0.5))" }}>🔥</span>
                  <span style={{ fontSize: "1.1cqi", fontWeight: 600 }}>{streakCount} Day Streak</span>
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8cqi", opacity: 0.5, marginBottom: "0.5cqi" }}>
                  <span>Daily Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div style={{ width: "100%", height: "0.3cqi", background: "rgba(255,255,255,0.06)", borderRadius: "1cqi", overflow: "hidden" }}>
                  <div style={{
                    width: `${progressPct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${accent}, #fff)`,
                    borderRadius: "1cqi", boxShadow: `0 0 0.5cqi ${accent}`
                  }} />
                </div>
              </div>
            </div>
          )}

          {wallpaper.showTasks && (
            <div style={{ ...glassCard, width: "100%" }}>
              <div style={{ fontSize: "1.1cqi", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1.5cqi", display: "flex", alignItems: "center", gap: "0.5cqi" }}>
                <span style={{ width: "0.4cqi", height: "0.4cqi", borderRadius: "50%", background: accent, boxShadow: `0 0 1cqi ${accent}` }} />
                Daily Habits
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1cqi" }}>
                {todaysHabits.map((h) => {
                  const done = h.history[today];
                  return (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: "0.8cqi",
                      padding: "0.7cqi 1cqi", borderRadius: "1cqi",
                      background: done ? `linear-gradient(90deg, ${accent}15, transparent)` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${done ? accent + "30" : "rgba(255,255,255,0.03)"}`,
                      borderLeft: `2px solid ${done ? accent : "transparent"}`,
                    }}>
                      <span style={{ fontSize: "1.3cqi", filter: done ? `drop-shadow(0 0 1cqi ${accent}40)` : "none" }}>{h.emoji}</span>
                      <span style={{ fontSize: "1.05cqi", opacity: done ? 1 : 0.6, fontWeight: done ? 500 : 400 }}>{h.name}</span>
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

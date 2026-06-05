import React, { useEffect, useState } from "react";
import { useStore, motivationalQuotes } from "@/lib/store";
import { formatLocalDate } from "@/lib/date";

const THEME_STYLES: Record<string, React.CSSProperties> = {
  neon: { background: "#06060a" },
  cyberpunk: { background: "#05000a" },
  minimal: { background: "#000000" },
  glass: { background: "#0a0614" },
  anime: { background: "#140a14" },
  workspace: { background: "#0f111a" },
};

const ACCENT: Record<string, string> = {
  purple: "#c084fc", blue: "#60a5fa", cyan: "#22d3ee", pink: "#f472b6",
};

const GLOW: Record<string, string> = {
  purple: "rgba(192,132,252,0.4)", blue: "rgba(96,165,250,0.4)",
  cyan: "rgba(34,211,238,0.4)", pink: "rgba(244,114,182,0.4)",
};

export function WallpaperDashboard() {
  const store = useStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.getInitialState().then((s: any) => {
        if (s) useStore.setState(s);
      });
      (window as any).electronAPI.onSyncState((s: any) => {
        if (s) useStore.setState(s);
      });
    }
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cfg = store.wallpaper;
  const accent = ACCENT[cfg.accent] || ACCENT.purple;
  const glow = GLOW[cfg.accent] || GLOW.purple;
  const todayStr = formatLocalDate(new Date());
  const tasks = store.tasks.filter(t => !t.completed && (t.dueDate === todayStr || !t.dueDate)).slice(0, 5);
  const habits = store.habits.slice(0, 5);
  const quote = motivationalQuotes[new Date().getDate() % motivationalQuotes.length];
  const completedToday = store.tasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(todayStr)).length;
  const totalToday = store.tasks.filter(t => t.dueDate === todayStr || !t.dueDate).length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const fontFamily = cfg.font === "mono" ? "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace"
    : cfg.font === "serif" ? "Georgia, 'Times New Roman', serif"
    : "'Inter', 'Segoe UI', -apple-system, sans-serif";

  // Shared glassmorphism card style
  const glassCard: React.CSSProperties = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)",
    backdropFilter: "blur(40px) saturate(150%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1.5vw",
    padding: "2vw",
    boxShadow: "0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      fontFamily, color: "#fff", position: "relative",
      ...THEME_STYLES[cfg.theme] || THEME_STYLES.neon,
    }}>
      <style>{`
        @keyframes slow-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes float-1 {
          0% { transform: translate(0, 0); }
          33% { transform: translate(3vw, -4vh); }
          66% { transform: translate(-2vw, 2vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes float-2 {
          0% { transform: translate(0, 0); }
          33% { transform: translate(-4vw, 3vh); }
          66% { transform: translate(2vw, -3vh); }
          100% { transform: translate(0, 0); }
        }
        .orb-1 {
          position: absolute; top: -20%; left: -10%; width: 60vw; height: 60vw; border-radius: 50%;
          background: radial-gradient(circle, ${glow}, transparent 60%);
          filter: blur(80px); opacity: 0.7; mix-blend-mode: screen; pointer-events: none;
          animation: slow-spin 40s linear infinite, float-1 20s ease-in-out infinite;
        }
        .orb-2 {
          position: absolute; bottom: -30%; right: -15%; width: 70vw; height: 70vw; border-radius: 50%;
          background: radial-gradient(circle, ${accent}40, transparent 65%);
          filter: blur(100px); opacity: 0.6; mix-blend-mode: screen; pointer-events: none;
          animation: slow-spin 50s reverse linear infinite, float-2 25s ease-in-out infinite;
        }
        .orb-3 {
          position: absolute; top: 30%; left: 40%; width: 40vw; height: 40vw; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.03), transparent 70%);
          filter: blur(60px); pointer-events: none;
        }
      `}</style>
      
      {/* Dynamic Ambient Background */}
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />
      
      {/* Subtle Grid overlay for texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
        backgroundSize: "3vw 3vw",
        maskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, transparent 20%, black 100%)",
      }} />

      {/* Main UI Container */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", height: "100%",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5vh 4vw", boxSizing: "border-box", opacity: cfg.opacity,
      }}>
        
        {/* Left Column: Greeting & Tasks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3vh", width: "24vw" }}>
          <div>
            <div style={{ fontSize: "1.2vw", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, marginBottom: "1vh" }}>
              {dateStr}
            </div>
            <div style={{ fontSize: "2.5vw", fontWeight: 300, lineHeight: 1.2 }}>
              {greeting},<br/>
              <span style={{ color: accent, fontWeight: 600 }}>{store.userName}</span>
              <span style={{ marginLeft: "0.5vw", fontSize: "2vw" }}>✨</span>
            </div>
          </div>

          {cfg.showTasks && (
            <div style={glassCard}>
              <div style={{ fontSize: "1.1vw", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1.5vh", display: "flex", alignItems: "center", gap: "0.5vw" }}>
                <span style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                Today's Focus
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
                {tasks.length === 0 ? (
                  <div style={{ opacity: 0.4, fontSize: "1vw", padding: "1vh 0" }}>All clear. Great job.</div>
                ) : tasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.8vw" }}>
                    <div style={{ width: "1vw", height: "1vw", borderRadius: "50%", border: `2px solid ${accent}60`, flexShrink: 0 }} />
                    <span style={{ fontSize: "1.05vw", opacity: 0.9, lineHeight: 1.3 }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center Column: Huge Time Display */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", top: "-5vh" }}>
          <div style={{
            fontSize: "12vw", fontWeight: 700, letterSpacing: "-0.04em",
            lineHeight: 1, textShadow: `0 20px 60px ${accent}40`,
            background: `linear-gradient(180deg, #ffffff 30%, rgba(255,255,255,0.4))`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {timeStr}
          </div>
          {cfg.showQuote && (
            <div style={{
              fontSize: "1.1vw", opacity: 0.5, fontStyle: "italic",
              fontWeight: 300, letterSpacing: "0.05em", marginTop: "2vh",
              textAlign: "center", maxWidth: "35vw"
            }}>
              "{quote}"
            </div>
          )}
        </div>

        {/* Right Column: Status & Habits */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3vh", width: "22vw", alignItems: "flex-end" }}>
          
          {cfg.showStats && (
            <div style={{ ...glassCard, width: "100%", textAlign: "right" }}>
              <div style={{ fontSize: "0.9vw", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5vh" }}>
                Operator Level {store.level}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "0.4vw", marginBottom: "1.5vh" }}>
                <span style={{
                  fontSize: "3vw", fontWeight: 700,
                  background: `linear-gradient(135deg, #fff, ${accent})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  textShadow: `0 0 30px ${accent}40`
                }}>{store.xp.toLocaleString()}</span>
                <span style={{ fontSize: "1.1vw", opacity: 0.6, fontWeight: 500 }}>FP</span>
              </div>
              
              {cfg.showStreak && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "0.6vw",
                  background: "rgba(255,255,255,0.05)", borderRadius: "1vw", padding: "0.6vw 1vw",
                  border: "1px solid rgba(255,255,255,0.05)", marginBottom: "2vh"
                }}>
                  <span style={{ fontSize: "1.2vw", filter: "drop-shadow(0 0 10px rgba(255,100,0,0.5))" }}>🔥</span>
                  <span style={{ fontSize: "1.1vw", fontWeight: 600 }}>{store.streakCount} Day Streak</span>
                </div>
              )}

              {/* Minimal Progress Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8vw", opacity: 0.5, marginBottom: "0.5vh" }}>
                  <span>Daily Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div style={{ width: "100%", height: "0.3vw", background: "rgba(255,255,255,0.06)", borderRadius: "1vw", overflow: "hidden" }}>
                  <div style={{
                    width: `${progressPct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${accent}, #fff)`,
                    borderRadius: "1vw", boxShadow: `0 0 10px ${accent}`
                  }} />
                </div>
              </div>
            </div>
          )}

          {cfg.showTasks && (
            <div style={{ ...glassCard, width: "100%" }}>
              <div style={{ fontSize: "1.1vw", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1.5vh", display: "flex", alignItems: "center", gap: "0.5vw" }}>
                <span style={{ width: "0.4vw", height: "0.4vw", borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                Daily Habits
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
                {habits.map((h) => {
                  const done = h.history[todayStr];
                  return (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: "0.8vw",
                      padding: "0.7vw 1vw", borderRadius: "1vw",
                      background: done ? `linear-gradient(90deg, ${accent}15, transparent)` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${done ? accent + "30" : "rgba(255,255,255,0.03)"}`,
                      borderLeft: `2px solid ${done ? accent : "transparent"}`,
                      transition: "all 0.3s ease"
                    }}>
                      <span style={{ fontSize: "1.3vw", filter: done ? `drop-shadow(0 0 10px ${accent}40)` : "none" }}>{h.emoji}</span>
                      <span style={{ fontSize: "1.05vw", opacity: done ? 1 : 0.6, fontWeight: done ? 500 : 400 }}>{h.name}</span>
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

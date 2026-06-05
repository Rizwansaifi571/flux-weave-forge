import React, { useEffect, useState } from "react";
import { useStore, motivationalQuotes } from "@/lib/store";
import { formatLocalDate } from "@/lib/date";

const THEME_STYLES: Record<string, React.CSSProperties> = {
  neon: { background: "linear-gradient(135deg, #0b0524 0%, #1a0a3a 40%, #001a3a 100%)" },
  cyberpunk: { background: "linear-gradient(135deg, #0a0014 0%, #1a0033 50%, #2d0047 100%)" },
  minimal: { background: "linear-gradient(135deg, #0a0a0f 0%, #14141f 100%)" },
  glass: { background: "linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #6a3093 100%)" },
  anime: { background: "linear-gradient(135deg, #2d1b4e 0%, #4a1942 50%, #1a1a2e 100%)" },
  workspace: { background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" },
};

const ACCENT: Record<string, string> = {
  purple: "#c084fc", blue: "#60a5fa", cyan: "#22d3ee", pink: "#f472b6",
};

const GLOW: Record<string, string> = {
  purple: "rgba(192,132,252,0.15)", blue: "rgba(96,165,250,0.15)",
  cyan: "rgba(34,211,238,0.15)", pink: "rgba(244,114,182,0.15)",
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
  const tasks = store.tasks.filter(t => !t.completed && (t.dueDate === todayStr || !t.dueDate)).slice(0, 6);
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

  // Shared card styles
  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "1.4vw",
    padding: "2vw 2.5vw",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      fontFamily, color: "#fff", position: "relative",
      ...THEME_STYLES[cfg.theme] || THEME_STYLES.neon,
    }}>
      {/* Ambient glow orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "55vw", height: "55vw", borderRadius: "50%", background: `radial-gradient(circle, ${glow}, transparent 70%)`, filter: "blur(100px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-25%", right: "-8%", width: "50vw", height: "50vw", borderRadius: "50%", background: `radial-gradient(circle, ${glow}, transparent 65%)`, filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", width: "30vw", height: "30vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)", filter: "blur(80px)", pointerEvents: "none" }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "4.5vh 4.5vw", boxSizing: "border-box",
        opacity: cfg.opacity,
      }}>
        {/* ═══ TOP ROW ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontSize: "7.5vw", fontWeight: 700, letterSpacing: "-0.05em",
              lineHeight: 1, textShadow: `0 0 120px ${accent}30`,
              background: `linear-gradient(180deg, #ffffff 40%, rgba(255,255,255,0.6))`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {timeStr}
            </div>
            <div style={{
              fontSize: "1.3vw", marginTop: "1vh", opacity: 0.55,
              textTransform: "uppercase", letterSpacing: "0.25em", fontWeight: 500,
            }}>
              {dateStr}
            </div>
            <div style={{ fontSize: "2.4vw", marginTop: "3.5vh", fontWeight: 300 }}>
              {greeting},{" "}
              <span style={{ color: accent, fontWeight: 600 }}>{store.userName}</span>
              <span style={{ marginLeft: "0.5vw", fontSize: "2vw" }}>✨</span>
            </div>
          </div>

          {/* Stats panel */}
          {cfg.showStats && (
            <div style={{ ...card, textAlign: "right", minWidth: "18vw" }}>
              <div style={{ fontSize: "0.85vw", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600, marginBottom: "0.5vh" }}>
                Operator Status
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "0.4vw" }}>
                <span style={{
                  fontSize: "3.2vw", fontWeight: 700,
                  background: `linear-gradient(135deg, #fff, ${accent})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>{store.xp.toLocaleString()}</span>
                <span style={{ fontSize: "1.2vw", opacity: 0.6 }}>XP</span>
              </div>
              <div style={{ fontSize: "0.9vw", opacity: 0.5, marginTop: "0.3vh" }}>Level {store.level}</div>

              {cfg.showStreak && (
                <div style={{
                  marginTop: "1.5vh", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5vw",
                  background: "rgba(255,255,255,0.04)", borderRadius: "0.8vw", padding: "0.7vw 1.2vw",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ fontSize: "1.3vw" }}>🔥</span>
                  <span style={{ fontSize: "1.2vw", fontWeight: 600 }}>{store.streakCount} Day Streak</span>
                </div>
              )}

              {/* Progress bar */}
              <div style={{ marginTop: "1.5vh" }}>
                <div style={{ fontSize: "0.75vw", opacity: 0.4, textAlign: "right", marginBottom: "0.4vh" }}>
                  {completedToday}/{totalToday} tasks · {progressPct}%
                </div>
                <div style={{ width: "100%", height: "0.35vw", background: "rgba(255,255,255,0.08)", borderRadius: "1vw", overflow: "hidden" }}>
                  <div style={{
                    width: `${progressPct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                    borderRadius: "1vw",
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ BOTTOM CARDS ═══ */}
        <div style={{ display: "flex", gap: "2vw" }}>
          {cfg.showTasks && (
            <div style={{ ...card, flex: 1 }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "2vh", display: "flex", alignItems: "center", gap: "0.7vw" }}>
                <span style={{ width: "0.25vw", height: "1.6vw", background: accent, borderRadius: "2px", display: "inline-block" }} />
                <span>Today's Focus</span>
                <span style={{ fontSize: "0.85vw", opacity: 0.4, marginLeft: "auto" }}>{tasks.length} remaining</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
                {tasks.length === 0 ? (
                  <div style={{ opacity: 0.35, fontSize: "1.1vw", padding: "1vw 0" }}>All caught up! Great work today. ✨</div>
                ) : (
                  tasks.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.9vw" }}>
                      <div style={{
                        width: "1.3vw", height: "1.3vw", borderRadius: "50%",
                        border: `2px solid ${accent}50`, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "1.15vw", opacity: 0.85 }}>{t.title}</span>
                      {t.priority === "high" && (
                        <span style={{
                          fontSize: "0.65vw", padding: "0.15vw 0.5vw",
                          background: "rgba(239,68,68,0.15)", color: "#f87171",
                          borderRadius: "0.4vw", fontWeight: 600, textTransform: "uppercase",
                          letterSpacing: "0.08em", marginLeft: "auto",
                        }}>HIGH</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {cfg.showTasks && (
            <div style={{ ...card, flex: 1 }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "2vh", display: "flex", alignItems: "center", gap: "0.7vw" }}>
                <span style={{ width: "0.25vw", height: "1.6vw", background: accent, borderRadius: "2px", display: "inline-block" }} />
                <span>Daily Habits</span>
                <span style={{ fontSize: "0.85vw", opacity: 0.4, marginLeft: "auto" }}>{habits.length} tracked</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
                {habits.map((h) => {
                  const done = h.history[todayStr];
                  return (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: "0.9vw",
                      padding: "0.6vw 1vw", borderRadius: "0.8vw",
                      background: done ? `${accent}10` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${done ? accent + "25" : "rgba(255,255,255,0.04)"}`,
                    }}>
                      <span style={{ fontSize: "1.5vw" }}>{h.emoji}</span>
                      <span style={{ fontSize: "1.15vw", opacity: done ? 1 : 0.8 }}>{h.name}</span>
                      {done && <span style={{ marginLeft: "auto", fontSize: "1vw", color: accent }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ FOOTER QUOTE ═══ */}
        {cfg.showQuote && (
          <div style={{ textAlign: "center", padding: "0 10vw" }}>
            <div style={{
              fontSize: "1.15vw", opacity: 0.4, fontStyle: "italic",
              fontWeight: 300, letterSpacing: "0.03em",
            }}>
              "{quote}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

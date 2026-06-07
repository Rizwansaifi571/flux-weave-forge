import { useStore, motivationalQuotes, todayStr } from "@/lib/store";
import { type WallpaperConfig } from "../lib/store";
import { getThemeBg, getAccentDetails } from "../lib/wallpaper-themes";
import { useMemo } from "react";

export function WallpaperPreview({ scale = 1 }: { scale?: number }) {
  const { tasks, habits, wallpaper, streakCount, userName, level, xp } = useStore();
  
  const {
    maxTasksCount = 3,
    showTaskCategory = false,
    showTaskTime = true,
    showTaskPriority = true,
    showClock = true,
    showDate = true,
    showDailyHabits = true,
    showTasks = true,
    showStreak = true,
    showStats = true,
    showTaskDate = false,
  } = wallpaper;

  const quote = useMemo(() => motivationalQuotes[new Date().getDay() % motivationalQuotes.length], []);
  const today = todayStr();
  const todaysTasks = tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate === today)).slice(0, maxTasksCount);
  const remainingTasksCount = tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate === today)).length;
  const todaysHabits = habits.slice(0, 5);
  
  const completedToday = tasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(today)).length;
  const totalToday = tasks.filter(t => t.dueDate === today || !t.dueDate).length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const { hex: accent } = getAccentDetails(wallpaper.accent, wallpaper.customAccentColor);
  
  const now = new Date();
  const hours12 = now.getHours() % 12 || 12;
  const mins = String(now.getMinutes()).padStart(2, "0");
  const timeHHMM = `${hours12}:${mins}`;
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const fontFamily = wallpaper.font === "mono" ? "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace"
    : wallpaper.font === "serif" ? "Georgia, 'Times New Roman', serif"
    : "'Inter', 'Segoe UI', -apple-system, sans-serif";

  // Circular progress helper for preview
  const circleRadius = 2.5; // cqi
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (progressPct / 100) * circleCircumference;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "16/10",
        background: getThemeBg(wallpaper.theme, wallpaper.customThemeBackground),
        fontFamily, color: "#fff",
        opacity: wallpaper.opacity,
        containerType: "inline-size"
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2%); }
        }
      `}</style>
      
      {/* Background Glow */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%",
        width: "70cqi", height: "70cqi", borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)`,
        mixBlendMode: "screen",
      }} />
      <div style={{
        position: "absolute", bottom: "-30%", left: "-10%",
        width: "60cqi", height: "60cqi", borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}15 0%, transparent 60%)`,
        mixBlendMode: "screen",
      }} />

      {/* Top Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "3cqi 4cqi", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        zIndex: 10,
      }}>
        <div>
          {showClock && (
            <div suppressHydrationWarning style={{ fontSize: "5cqi", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
              {timeHHMM}
            </div>
          )}
          {showDate && (
            <div suppressHydrationWarning style={{ fontSize: "1.5cqi", fontWeight: 400, opacity: 0.6, marginTop: "0.5cqi", letterSpacing: "-0.01em" }}>
              {dateStr}
            </div>
          )}
        </div>

        {(showStreak || showStats) && (
          <div style={{ display: "flex", gap: "2cqi", alignItems: "center" }}>
            {showStreak && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.8cqi" }}>
                <span style={{ fontSize: "2.5cqi", filter: "drop-shadow(0 0 0.5cqi rgba(255,100,0,0.5))" }}>🔥</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.8cqi", opacity: 0.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Streak</span>
                  <span style={{ fontSize: "1.8cqi", fontWeight: 700, lineHeight: 1 }}>{streakCount ?? 0}</span>
                </div>
              </div>
            )}
            
            {showStreak && showStats && (
              <div style={{ width: "2px", height: "3cqi", background: "rgba(255,255,255,0.1)" }} />
            )}
            
            {showStats && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "0.8cqi", color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Level {level ?? 1}
                </span>
                <span style={{ fontSize: "1.8cqi", fontWeight: 700, lineHeight: 1 }}>
                  {(xp ?? 0).toLocaleString()} <span style={{ fontSize: "1cqi", opacity: 0.5 }}>XP</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div style={{
        position: "absolute", top: "18cqi", left: "4cqi", right: "4cqi", bottom: "3cqi",
        display: "grid", gridTemplateColumns: showDailyHabits && showTasks ? "1.2fr 1fr" : "1fr",
        gap: "6cqi", zIndex: 10, justifyContent: "center"
      }}>
        
        {showTasks && (
          <div style={{ display: "flex", flexDirection: "column", maxWidth: showDailyHabits ? "none" : "60cqi", margin: showDailyHabits ? "0" : "0 auto", width: "100%" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "1.5cqi", marginBottom: "3cqi", height: "6cqi" }}>
              <div style={{ position: "relative", width: "6cqi", height: "6cqi" }}>
                <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="94.248" strokeDashoffset={94.248 - (progressPct/100)*94.248} strokeLinecap="round" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2cqi", fontWeight: 700 }}>
                  {progressPct}%
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: "2.8cqi", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.1 }}>Today's Mission</h1>
                <p style={{ fontSize: "1.3cqi", opacity: 0.5, fontWeight: 400, margin: 0, marginTop: "0.3cqi" }}>
                  {remainingTasksCount === 0 ? "You're all caught up for today." : `You have ${remainingTasksCount} tasks remaining.`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.2cqi", overflow: "hidden" }}>
              {todaysTasks.map((t) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: "1.5cqi",
                  padding: "1.5cqi 2cqi", background: "rgba(255,255,255,0.03)",
                  borderRadius: "1.2cqi", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ width: "2cqi", height: "2cqi", borderRadius: "0.5cqi", border: "0.2cqi solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4cqi", flex: 1, overflow: "hidden" }}>
                    <span style={{ fontSize: "1.5cqi", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", opacity: 0.95 }}>
                      {t.title}
                    </span>
                    <div style={{ display: "flex", gap: "1cqi", alignItems: "center" }}>
                      {showTaskCategory && t.category && (
                        <span style={{ fontSize: "0.9cqi", opacity: 0.5, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.category}</span>
                      )}
                      {showTaskDate && t.dueDate && (
                        <span style={{ fontSize: "0.9cqi", opacity: 0.7, fontWeight: 500 }}>{t.dueDate === today ? "Today" : t.dueDate}</span>
                      )}
                      {showTaskTime && t.dueTime && (
                        <span style={{ fontSize: "0.9cqi", color: accent, fontWeight: 600, letterSpacing: "0.02em" }}>{t.dueTime}</span>
                      )}
                    </div>
                  </div>
                  {showTaskPriority && t.priority === "high" && (
                    <div style={{ padding: "0.4cqi 0.8cqi", background: "rgba(255,42,109,0.15)", color: "#ff2a6d", borderRadius: "100px", fontSize: "0.9cqi", fontWeight: 700 }}>
                      HIGH
                    </div>
                  )}
                  {showTaskPriority && t.priority === "medium" && (
                    <div style={{ padding: "0.4cqi 0.8cqi", background: "rgba(255,165,0,0.15)", color: "#ffa500", borderRadius: "100px", fontSize: "0.9cqi", fontWeight: 700 }}>
                      MEDIUM
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showDailyHabits && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", height: "6cqi", marginBottom: "3cqi" }}>
              <h2 style={{ fontSize: "2.2cqi", fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "1cqi", margin: 0 }}>
                <span style={{ color: accent }}>◎</span> Daily Habits
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.2cqi" }}>
              {todaysHabits.map((h) => {
                const done = Boolean(h.history[today]);
                return (
                  <div key={h.id} style={{
                    padding: "1.5cqi",
                    background: done ? `linear-gradient(135deg, ${accent}40, ${accent}10)` : "rgba(255,255,255,0.03)",
                    border: done ? `1px solid ${accent}50` : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "1.5cqi", display: "flex", flexDirection: "column", gap: "1.2cqi", alignItems: "flex-start",
                  }}>
                    <div style={{ 
                      width: "3cqi", height: "3cqi", borderRadius: "0.8cqi", 
                      background: done ? accent : "rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5cqi",
                    }}>
                      {done ? "✓" : h.emoji}
                    </div>
                    <span style={{ fontSize: "1.2cqi", fontWeight: 600, opacity: done ? 1 : 0.7 }}>{h.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

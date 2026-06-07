import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatLocalDate } from "@/lib/date";

// ─── Accent palette ──────────────────────────────────────────────────────────
const ACCENT_MAP: Record<string, { hex: string; glow: string; rgb: string }> = {
  purple: { hex: "#8a2be2", glow: "rgba(138,43,226,0.35)", rgb: "138,43,226" },
  blue:   { hex: "#007aff", glow: "rgba(0,122,255,0.35)",  rgb: "0,122,255"  },
  cyan:   { hex: "#00e5cc", glow: "rgba(0,229,204,0.35)",   rgb: "0,229,204"   },
  pink:   { hex: "#ff2a6d", glow: "rgba(255,42,109,0.35)", rgb: "255,42,109" },
};

// ─── Task sanitisation ────────────────────────────────────────────────────────
function isValidTaskTitle(title: unknown): boolean {
  if (typeof title !== "string") return false;
  const t = title.trim();
  if (!t || t === "true" || t === "false" || t === "null" || t === "undefined") return false;
  if (/^now playing$/i.test(t)) return false;
  if (/^\d+:\d{2}(:\d{2})?$/.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.length < 3) return false;
  return true;
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
const CheckIcon = ({ size = 20, color = "#fff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FlameIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ff9040" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-3-10-3-14" />
    <path d="M12 12c0 3-2 4-2 7a2 2 0 0 0 4 0c0-3-2-4-2-7" />
  </svg>
);

const TargetIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

// ─── CSS animation keyframes ──────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }

  @keyframes float {
    0%   { transform: translate(0,0) scale(1); }
    50%  { transform: translate(2vw,-2vh) scale(1.02); }
    100% { transform: translate(0,0) scale(1); }
  }
  @keyframes slideUp {
    0%   { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    0%   { opacity: 0; }
    100% { opacity: 1; }
  }
  .task-item {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .task-item:hover {
    transform: translateX(10px);
    background: rgba(255,255,255,0.05);
  }
`;

// ─── Circular Progress SVG Component ──────────────────────────────────────────
const CircularProgress = ({ pct, accent, size = 120, strokeWidth = 8 }: { pct: number, accent: string, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={accent} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        fontSize: size * 0.22 + "px",
        fontWeight: 700,
        letterSpacing: "-0.05em",
        fontFamily: "'Outfit', sans-serif"
      }}>
        {pct}<span style={{ fontSize: "0.6em", opacity: 0.5 }}>%</span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function WallpaperDashboard() {
  const store = useStore();
  const [time, setTime] = useState(new Date());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.getInitialState().then((s: any) => {
        if (s) useStore.setState(s);
        setIsHydrated(true);
      });
      (window as any).electronAPI.onSyncState((s: any) => {
        if (s) useStore.setState(s);
        setIsHydrated(true);
      });
    } else {
      setIsHydrated(true);
    }
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cfg = store.wallpaper;
  const ac = ACCENT_MAP[cfg.accent] || ACCENT_MAP.purple;
  const todayStr = formatLocalDate(new Date());

  // Time logic
  const hours12  = time.getHours() % 12 || 12;
  const mins     = String(time.getMinutes()).padStart(2, "0");
  const timeHHMM = `${hours12}:${mins}`;

  // Date
  const dateStr = time.toLocaleDateString('en-US', {
    weekday: "long", month: "long", day: "numeric"
  });

  // Calculate actual total remaining (before slice)
  const remainingTasksCount = useMemo(() => {
    return store.tasks.filter((t) => !t.completed && isValidTaskTitle(t.title) && (t.dueDate === todayStr || !t.dueDate)).length;
  }, [store.tasks, todayStr]);

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
  } = cfg;

  // Tasks
  const tasks = useMemo(() => {
    return store.tasks
      .filter((t) => !t.completed && isValidTaskTitle(t.title) && (t.dueDate === todayStr || !t.dueDate))
      .slice(0, maxTasksCount);
  }, [store.tasks, todayStr, maxTasksCount]);

  const habits = store.habits.slice(0, 5); // Habits can be slightly more since they are grid items

  // Stats
  const completedToday = store.tasks.filter((t) => t.completed && t.completedAt && t.completedAt.startsWith(todayStr)).length;
  const totalToday = store.tasks.filter((t) => t.dueDate === todayStr || !t.dueDate).length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  if (!isHydrated) {
    return <div style={{ width: "100vw", height: "100vh", background: "#030303" }} />;
  }

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      fontFamily: "'Outfit', sans-serif", color: "#fff",
      position: "relative",
      background: "#030303",
      WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale",
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Background: Pure, Clean, Premium Glow ──────────────────────── */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%",
        width: "70vw", height: "70vw", borderRadius: "50%",
        background: `radial-gradient(circle, ${ac.hex}22 0%, transparent 60%)`,
        pointerEvents: "none", mixBlendMode: "screen",
        animation: "float 20s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-30%", left: "-10%",
        width: "60vw", height: "60vw", borderRadius: "50%",
        background: `radial-gradient(circle, ${ac.hex}15 0%, transparent 60%)`,
        pointerEvents: "none", mixBlendMode: "screen",
      }} />

      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "40px 60px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        zIndex: 10,
        animation: "fadeIn 1s ease",
      }}>
        {/* Left: Clock & Date */}
        <div>
          {showClock && (
            <div style={{ fontSize: "64px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
              {timeHHMM}
            </div>
          )}
          {showDate && (
            <div style={{ fontSize: "20px", fontWeight: 400, opacity: 0.6, marginTop: "8px", letterSpacing: "-0.01em" }}>
              {dateStr}
            </div>
          )}
        </div>

        {/* Right: Gamification Status */}
        {(showStreak || showStats) && (
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {/* Streak */}
            {showStreak && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FlameIcon />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "12px", opacity: 0.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Streak</span>
                  <span style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1 }}>{store.streakCount ?? 0}</span>
                </div>
              </div>
            )}
            
            {/* Divider */}
            {showStreak && showStats && (
              <div style={{ width: "2px", height: "30px", background: "rgba(255,255,255,0.1)" }} />
            )}
            
            {/* XP & Level */}
            {showStats && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "12px", color: ac.hex, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Level {store.level ?? 1}
                </span>
                <span style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1 }}>
                  {(store.xp ?? 0).toLocaleString()} <span style={{ fontSize: "14px", opacity: 0.5 }}>XP</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "160px", left: "60px", right: "60px", bottom: "40px",
        display: "grid",
        gridTemplateColumns: showDailyHabits && showTasks ? "1.2fr 1fr" : "1fr",
        gap: "80px",
        zIndex: 10,
        justifyContent: "center",
      }}>
        
        {/* ── Left Column: Today's Mission (Tasks) ──────────────────────── */}
        {showTasks && (
          <div style={{ display: "flex", flexDirection: "column", maxWidth: showDailyHabits ? "none" : "800px", margin: showDailyHabits ? "0" : "0 auto", width: "100%" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px", animation: "slideUp 0.8s ease both" }}>
              <CircularProgress pct={progressPct} accent={ac.hex} size={70} strokeWidth={6} />
              <div>
                <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em" }}>Today's Mission</h1>
                <p style={{ fontSize: "18px", opacity: 0.5, fontWeight: 400 }}>
                  {remainingTasksCount === 0 ? "You're all caught up for today." : `You have ${remainingTasksCount} tasks remaining.`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflow: "hidden" }}>
              {tasks.map((t, i) => (
                <div key={t.id} className="task-item" style={{
                  display: "flex", alignItems: "center", gap: "20px",
                  padding: "20px 24px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  animation: `slideUp ${0.8 + (i * 0.1)}s ease both`,
                }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "8px",
                    border: "2px solid rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflow: "hidden" }}>
                    <span style={{ 
                      fontSize: "20px", 
                      fontWeight: 600, 
                      lineHeight: 1.3,
                      letterSpacing: "-0.01em", 
                      opacity: 0.95,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                      {t.title}
                    </span>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {showTaskCategory && t.category && (
                        <span style={{ fontSize: "13px", opacity: 0.5, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          {t.category}
                        </span>
                      )}
                      {showTaskDate && t.dueDate && (
                        <span style={{ fontSize: "13px", opacity: 0.7, fontWeight: 500 }}>
                          {t.dueDate === todayStr ? "Today" : t.dueDate}
                        </span>
                      )}
                      {showTaskTime && t.dueTime && (
                        <span style={{ fontSize: "13px", color: ac.hex, fontWeight: 600, letterSpacing: "0.02em" }}>
                          {t.dueTime}
                        </span>
                      )}
                    </div>
                  </div>
                  {showTaskPriority && t.priority === "high" && (
                    <div style={{ padding: "6px 12px", background: "rgba(255,42,109,0.15)", color: "#ff2a6d", borderRadius: "100px", fontSize: "12px", fontWeight: 700 }}>
                      HIGH
                    </div>
                  )}
                  {showTaskPriority && t.priority === "medium" && (
                    <div style={{ padding: "6px 12px", background: "rgba(255,165,0,0.15)", color: "#ffa500", borderRadius: "100px", fontSize: "12px", fontWeight: 700 }}>
                      MEDIUM
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ── Right Column: Daily Habits ─────────────────────────────────── */}
        {showDailyHabits && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            
            <div style={{ marginBottom: "40px", animation: "slideUp 0.9s ease both" }}>
              <h2 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "12px" }}>
                <TargetIcon /> Daily Habits
              </h2>
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
              gap: "16px" 
            }}>
              {habits.map((h, i) => {
                const done = Boolean(h.history[todayStr]);
                return (
                  <div key={h.id} style={{
                    padding: "20px",
                    background: done ? `linear-gradient(135deg, ${ac.hex}40, ${ac.hex}10)` : "rgba(255,255,255,0.03)",
                    border: done ? `1px solid ${ac.hex}50` : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "20px",
                    display: "flex", flexDirection: "column", gap: "16px",
                    alignItems: "flex-start",
                    animation: `slideUp ${1.0 + (i * 0.1)}s ease both`,
                  }}>
                    <div style={{ 
                      width: "40px", height: "40px", borderRadius: "12px", 
                      background: done ? ac.hex : "rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "20px",
                    }}>
                      {done ? <CheckIcon /> : h.emoji}
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 600, opacity: done ? 1 : 0.7 }}>
                      {h.name}
                    </span>
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
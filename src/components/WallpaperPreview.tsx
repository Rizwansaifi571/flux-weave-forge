import { useStore, motivationalQuotes, todayStr } from "@/lib/store";
import { Flame, CheckCircle2, Clock, Target } from "lucide-react";
import { useMemo } from "react";

const themeBg: Record<string, string> = {
  cyberpunk: "linear-gradient(135deg, #0a0014 0%, #1a0033 40%, #ff006e 100%)",
  minimal: "linear-gradient(135deg, #0a0a0f 0%, #14141f 100%)",
  neon: "linear-gradient(135deg, #0b0524 0%, #1a0a3a 50%, #001a3a 100%)",
  glass: "linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #6a3093 100%)",
  anime: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 30%, #a18cd1 100%)",
  workspace: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
};

const accentColor: Record<string, string> = {
  purple: "#c084fc",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  pink: "#f472b6",
};

export function WallpaperPreview({ scale = 1 }: { scale?: number }) {
  const { tasks, wallpaper, streakCount, focusSessions, userName } = useStore();
  const quote = useMemo(() => motivationalQuotes[new Date().getDay() % motivationalQuotes.length], []);
  const today = todayStr();
  const todays = tasks.filter((t) => !t.dueDate || t.dueDate === today);
  const done = todays.filter((t) => t.completed).length;
  const pct = todays.length ? Math.round((done / todays.length) * 100) : 0;
  const focusToday = focusSessions.find((f) => f.date === today)?.minutes ?? 0;
  const accent = accentColor[wallpaper.accent];

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        aspectRatio: "16/10",
        background: themeBg[wallpaper.theme],
        opacity: wallpaper.opacity,
        fontFamily: wallpaper.font === "mono" ? "ui-monospace, monospace" : wallpaper.font === "serif" ? "Georgia, serif" : "inherit",
      }}
    >
      <div className="absolute inset-0" style={{
        background: `radial-gradient(circle at 20% 30%, ${accent}40, transparent 50%), radial-gradient(circle at 80% 80%, ${accent}30, transparent 50%)`,
      }} />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative h-full w-full text-white" style={{ padding: `${24 * scale}px` }}>
        <div className="flex justify-between items-start">
          <div>
            <div style={{ fontSize: `${14 * scale}px`, opacity: 0.7 }} suppressHydrationWarning>
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <div style={{ fontSize: `${42 * scale}px`, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }} suppressHydrationWarning>
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ fontSize: `${12 * scale}px`, opacity: 0.6, marginTop: 4 }}>Hello, {userName}.</div>
          </div>
          {wallpaper.showStreak && (
            <div className="flex items-center gap-1.5 rounded-full" style={{ padding: `${4 * scale}px ${10 * scale}px`, background: "rgba(255,255,255,.1)", backdropFilter: "blur(10px)" }}>
              <Flame size={12 * scale} color={accent} />
              <span style={{ fontSize: `${11 * scale}px`, fontWeight: 600 }}>{streakCount} day streak</span>
            </div>
          )}
        </div>

        {wallpaper.showStats && (
          <div className="absolute" style={{ top: `${100 * scale}px`, right: `${24 * scale}px` }}>
            <div className="relative grid place-items-center" style={{ width: `${90 * scale}px`, height: `${90 * scale}px` }}>
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,.1)" strokeWidth="6" fill="none" />
                <circle cx="50" cy="50" r="42" stroke={accent} strokeWidth="6" fill="none" strokeDasharray={`${(pct / 100) * 264} 264`} strokeLinecap="round" />
              </svg>
              <div className="text-center">
                <div style={{ fontSize: `${20 * scale}px`, fontWeight: 700 }}>{pct}%</div>
                <div style={{ fontSize: `${8 * scale}px`, opacity: 0.6 }}>TODAY</div>
              </div>
            </div>
          </div>
        )}

        {wallpaper.showTasks && (
          <div className="absolute" style={{ left: `${24 * scale}px`, bottom: `${100 * scale}px`, maxWidth: "55%" }}>
            <div style={{ fontSize: `${10 * scale}px`, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: `${8 * scale}px` }}>
              Today's Mission
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: `${6 * scale}px` }}>
              {todays.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg" style={{ padding: `${6 * scale}px ${10 * scale}px`, background: "rgba(255,255,255,.07)", backdropFilter: "blur(10px)" }}>
                  <CheckCircle2 size={12 * scale} color={t.completed ? accent : "rgba(255,255,255,.4)"} />
                  <span style={{ fontSize: `${11 * scale}px`, textDecoration: t.completed ? "line-through" : "none", opacity: t.completed ? 0.5 : 1 }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {wallpaper.showStats && (
          <div className="absolute flex gap-2" style={{ left: `${24 * scale}px`, bottom: `${24 * scale}px` }}>
            <Stat icon={<Clock size={12 * scale} color={accent} />} label="Focus" value={`${focusToday}m`} scale={scale} />
            <Stat icon={<Target size={12 * scale} color={accent} />} label="Done" value={`${done}/${todays.length}`} scale={scale} />
          </div>
        )}

        {wallpaper.showQuote && (
          <div className="absolute" style={{ right: `${24 * scale}px`, bottom: `${24 * scale}px`, maxWidth: "40%", textAlign: "right" }}>
            <div style={{ fontSize: `${11 * scale}px`, fontStyle: "italic", opacity: 0.7 }} suppressHydrationWarning>"{quote}"</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, scale }: { icon: React.ReactNode; label: string; value: string; scale: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md" style={{ padding: `${4 * scale}px ${8 * scale}px`, background: "rgba(255,255,255,.07)", backdropFilter: "blur(10px)" }}>
      {icon}
      <span style={{ fontSize: `${10 * scale}px`, opacity: 0.6 }}>{label}</span>
      <span style={{ fontSize: `${11 * scale}px`, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

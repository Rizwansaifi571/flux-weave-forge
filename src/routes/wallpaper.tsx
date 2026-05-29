import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { WallpaperPreview } from "@/components/WallpaperPreview";
import { useStore, type WallpaperConfig } from "@/lib/store";
import { motion } from "framer-motion";
import { Download, Wand2 } from "lucide-react";

export const Route = createFileRoute("/wallpaper")({ component: WallpaperPage });

const themes: { id: WallpaperConfig["theme"]; label: string; preview: string }[] = [
  { id: "neon", label: "Neon Productivity", preview: "linear-gradient(135deg,#0b0524,#1a0a3a,#001a3a)" },
  { id: "cyberpunk", label: "Cyberpunk", preview: "linear-gradient(135deg,#0a0014,#1a0033,#ff006e)" },
  { id: "minimal", label: "Minimal Dark", preview: "linear-gradient(135deg,#0a0a0f,#14141f)" },
  { id: "glass", label: "Glassmorphism", preview: "linear-gradient(135deg,#1a1a2e,#2d1b69,#6a3093)" },
  { id: "anime", label: "Anime", preview: "linear-gradient(135deg,#ff9a9e,#fad0c4,#a18cd1)" },
  { id: "workspace", label: "Workspace", preview: "linear-gradient(135deg,#1e293b,#334155)" },
];

const accents: { id: WallpaperConfig["accent"]; color: string }[] = [
  { id: "purple", color: "#c084fc" },
  { id: "blue", color: "#60a5fa" },
  { id: "cyan", color: "#22d3ee" },
  { id: "pink", color: "#f472b6" },
];

function WallpaperPage() {
  const { wallpaper, setWallpaper } = useStore();

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Live Wallpaper Studio"
          subtitle="Your productivity, painted onto your desktop. Updates in real-time."
          action={
            <button className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-medium text-white flex items-center gap-2 glow-soft hover:opacity-90 transition">
              <Download className="h-3.5 w-3.5" /> Export Wallpaper
            </button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <GlassCard className="!p-3">
              <WallpaperPreview scale={1.2} />
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="h-4 w-4 text-neon-purple" />
                <h3 className="font-semibold">Themes</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {themes.map((t) => (
                  <motion.button
                    key={t.id}
                    whileHover={{ y: -2 }}
                    onClick={() => setWallpaper({ theme: t.id })}
                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition ${wallpaper.theme === t.id ? "border-neon-purple glow-soft" : "border-white/5"}`}
                  >
                    <div className="absolute inset-0" style={{ background: t.preview }} />
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-xs font-medium text-white text-left" style={{ background: "linear-gradient(to top, rgba(0,0,0,.7), transparent)" }}>
                      {t.label}
                    </div>
                  </motion.button>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard>
              <h3 className="font-semibold mb-4">Accent</h3>
              <div className="flex gap-3">
                {accents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setWallpaper({ accent: a.id })}
                    className={`h-10 w-10 rounded-full transition ${wallpaper.accent === a.id ? "ring-2 ring-white/50 scale-110" : ""}`}
                    style={{ background: a.color, boxShadow: `0 0 20px ${a.color}80` }}
                  />
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="font-semibold mb-4">Widgets</h3>
              <div className="space-y-3">
                <Toggle label="Today's tasks" value={wallpaper.showTasks} onChange={(v) => setWallpaper({ showTasks: v })} />
                <Toggle label="Streak counter" value={wallpaper.showStreak} onChange={(v) => setWallpaper({ showStreak: v })} />
                <Toggle label="Motivational quote" value={wallpaper.showQuote} onChange={(v) => setWallpaper({ showQuote: v })} />
                <Toggle label="Stats & progress" value={wallpaper.showStats} onChange={(v) => setWallpaper({ showStats: v })} />
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="font-semibold mb-4">Style</h3>
              <label className="text-xs text-muted-foreground">Opacity</label>
              <input
                type="range" min={0.4} max={1} step={0.05}
                value={wallpaper.opacity}
                onChange={(e) => setWallpaper({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-neon-purple my-2"
              />
              <label className="text-xs text-muted-foreground mt-3 block">Font</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["geist", "mono", "serif"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setWallpaper({ font: f })}
                    className={`py-1.5 rounded-lg text-xs capitalize transition ${wallpaper.font === f ? "bg-gradient-primary text-white" : "glass text-muted-foreground"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-gradient-primary glow-soft" : "bg-white/10"}`}
      >
        <motion.div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg"
          animate={{ left: value ? "22px" : "2px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
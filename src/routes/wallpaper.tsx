import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { WallpaperPreview } from "@/components/WallpaperPreview";
import { useStore, type WallpaperConfig } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Wand2, RefreshCw, Check, Palette, Layout, Type } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

export const Route = createFileRoute("/wallpaper")({ component: WallpaperPage });

// --- Constants ---
const THEMES: readonly { id: WallpaperConfig["theme"]; label: string; preview: string; gradient: string }[] = [
  { id: "neon", label: "Neon Productivity", preview: "linear-gradient(135deg,#0b0524,#1a0a3a,#001a3a)", gradient: "from-purple-900/40 via-blue-900/20 to-cyan-900/40" },
  { id: "cyberpunk", label: "Cyberpunk", preview: "linear-gradient(135deg,#0a0014,#1a0033,#ff006e)", gradient: "from-pink-900/40 via-purple-900/20 to-black" },
  { id: "minimal", label: "Minimal Dark", preview: "linear-gradient(135deg,#0a0a0f,#14141f)", gradient: "from-slate-900 to-zinc-900" },
  { id: "glass", label: "Glassmorphism", preview: "linear-gradient(135deg,#1a1a2e,#2d1b69,#6a3093)", gradient: "from-indigo-900/40 via-purple-800/30 to-fuchsia-900/40" },
  { id: "anime", label: "Anime", preview: "linear-gradient(135deg,#ff9a9e,#fad0c4,#a18cd1)", gradient: "from-rose-400/30 via-orange-300/20 to-purple-400/30" },
  { id: "workspace", label: "Workspace", preview: "linear-gradient(135deg,#1e293b,#334155)", gradient: "from-slate-800 to-slate-700" },
] as const;

const ACCENTS: readonly { id: WallpaperConfig["accent"]; color: string; ringColor: string }[] = [
  { id: "purple", color: "#c084fc", ringColor: "ring-purple-400" },
  { id: "blue", color: "#60a5fa", ringColor: "ring-blue-400" },
  { id: "cyan", color: "#22d3ee", ringColor: "ring-cyan-400" },
  { id: "pink", color: "#f472b6", ringColor: "ring-pink-400" },
] as const;

const FONTS: readonly { id: WallpaperConfig["font"]; label: string; className: string }[] = [
  { id: "geist", label: "Geist", className: "font-sans" },
  { id: "mono", label: "Mono", className: "font-mono" },
  { id: "serif", label: "Serif", className: "font-serif" },
] as const;

// --- Helper Components ---
const Toggle = ({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => {
  const id = useMemo(() => `toggle-${label.replace(/\s/g, '-')}`, [label]);
  
  return (
    <div className="flex items-center justify-between group">
      <label htmlFor={id} className="text-sm cursor-pointer group-hover:text-white transition-colors">
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`
          relative h-6 w-11 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50
          ${value ? "bg-gradient-primary glow-soft" : "bg-white/10 hover:bg-white/20"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <motion.div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md"
          animate={{ left: value ? "22px" : "2px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
};

const ThemeButton = ({ theme, isActive, onClick }: { theme: typeof THEMES[number]; isActive: boolean; onClick: () => void }) => (
  <motion.button
    whileHover={{ y: -2, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`
      relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500
      ${isActive ? "border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]" : "border-white/10 hover:border-white/30"}
    `}
    aria-label={`Apply ${theme.label} theme`}
    aria-pressed={isActive}
  >
    <div className="absolute inset-0" style={{ background: theme.preview }} />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-xs font-medium text-white text-left">
      {theme.label}
      {isActive && <Check className="inline-block ml-1 h-3 w-3" />}
    </div>
  </motion.button>
);

const AccentButton = ({ accent, isActive, onClick }: { accent: typeof ACCENTS[number]; isActive: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`
      h-10 w-10 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50
      ${isActive ? `ring-2 ${accent.ringColor} scale-110 shadow-lg` : "scale-100 hover:scale-105"}
    `}
    style={{ background: accent.color, boxShadow: isActive ? `0 0 20px ${accent.color}80` : undefined }}
    aria-label={`Set ${accent.id} accent color`}
    aria-pressed={isActive}
  />
);

// --- Main Component ---
function WallpaperPage() {
  const { wallpaper, setWallpaper } = useStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Memoized handlers
  const handleThemeChange = useCallback((theme: WallpaperConfig["theme"]) => {
    setWallpaper({ theme });
  }, [setWallpaper]);

  const handleAccentChange = useCallback((accent: WallpaperConfig["accent"]) => {
    setWallpaper({ accent });
  }, [setWallpaper]);

  const handleFontChange = useCallback((font: WallpaperConfig["font"]) => {
    setWallpaper({ font });
  }, [setWallpaper]);

  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWallpaper({ opacity: parseFloat(e.target.value) });
  }, [setWallpaper]);

  const handleToggle = useCallback((key: keyof Pick<WallpaperConfig, "showTasks" | "showStreak" | "showQuote" | "showStats">) => (value: boolean) => {
    setWallpaper({ [key]: value });
  }, [setWallpaper]);

  const handleReset = useCallback(() => {
    setWallpaper({
      theme: "neon",
      accent: "purple",
      showTasks: true,
      showStreak: true,
      showQuote: true,
      showStats: true,
      opacity: 0.9,
      font: "geist",
    });
  }, [setWallpaper]);

  const handleExport = useCallback(async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    setExportError(null);
    
    try {
      const dataUrl = await toPng(previewRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#0a0a0f",
      });
      
      const link = document.createElement("a");
      link.download = `wallpaper-${wallpaper.theme}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      setExportError("Failed to export wallpaper. Please try again.");
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  }, [wallpaper.theme]);

  // Compute active font details for display
  const activeFont = useMemo(() => FONTS.find(f => f.id === wallpaper.font) || FONTS[0], [wallpaper.font]);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Live Wallpaper Studio"
          subtitle="Turn your desktop into a live productivity dashboard. Download the Companion App to sync tasks and habits in real-time."
          action={
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={handleReset}
                className="rounded-lg glass px-4 py-2 text-xs font-medium text-white flex items-center gap-2 hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Reset to default settings"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </button>
              
              <a
                href="https://github.com/Rizwansaifi571/flux-weave-forge/releases/latest/download/WallTask-Companion-Setup.exe"
                download
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-gradient-to-r from-neon-purple to-neon-blue px-4 py-2 text-xs font-medium text-white flex items-center gap-2 shadow-[0_0_15px_rgba(192,132,252,0.5)] hover:shadow-[0_0_25px_rgba(192,132,252,0.8)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <Download className="h-3.5 w-3.5" /> Download for Windows
              </a>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`
                  rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white flex items-center gap-2 shadow-sm
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50
                  ${isExporting ? "cursor-wait" : "hover:bg-white/20 active:scale-95"}
                `}
                aria-label="Export wallpaper as PNG"
              >
                {isExporting ? "Exporting..." : "Export PNG"}
              </button>
            </div>
          }
        />

        {/* Export error toast */}
        <AnimatePresence>
          {exportError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg text-sm"
            >
              {exportError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left Column - Preview */}
          <div className="space-y-4">
            <GlassCard className="!p-3 overflow-hidden">
              <div ref={previewRef} className="rounded-lg overflow-hidden">
                <WallpaperPreview scale={1.2} config={wallpaper} />
              </div>
            </GlassCard>

            {/* Themes Section */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h3 className="font-semibold">Themes</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEMES.map((theme) => (
                  <ThemeButton
                    key={theme.id}
                    theme={theme}
                    isActive={wallpaper.theme === theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                  />
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-4">
            {/* Accent Color */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h3 className="font-semibold">Accent Color</h3>
              </div>
              <div className="flex gap-3 flex-wrap">
                {ACCENTS.map((accent) => (
                  <AccentButton
                    key={accent.id}
                    accent={accent}
                    isActive={wallpaper.accent === accent.id}
                    onClick={() => handleAccentChange(accent.id)}
                  />
                ))}
              </div>
            </GlassCard>

            {/* Widgets Toggles */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Layout className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h3 className="font-semibold">Widgets</h3>
              </div>
              <div className="space-y-3">
                <Toggle label="Today's tasks" value={wallpaper.showTasks} onChange={handleToggle("showTasks")} />
                <Toggle label="Streak counter" value={wallpaper.showStreak} onChange={handleToggle("showStreak")} />
                <Toggle label="Motivational quote" value={wallpaper.showQuote} onChange={handleToggle("showQuote")} />
                <Toggle label="Stats & progress" value={wallpaper.showStats} onChange={handleToggle("showStats")} />
              </div>
            </GlassCard>

            {/* Style Settings */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Type className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h3 className="font-semibold">Style</h3>
              </div>
              
              {/* Opacity Slider */}
              <div className="mb-4">
                <label htmlFor="opacity-slider" className="text-xs text-muted-foreground block mb-1">
                  Opacity: {Math.round(wallpaper.opacity * 100)}%
                </label>
                <input
                  id="opacity-slider"
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={wallpaper.opacity}
                  onChange={handleOpacityChange}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/20 accent-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ background: `linear-gradient(to right, #c084fc 0%, #c084fc ${(wallpaper.opacity - 0.4) / 0.6 * 100}%, rgba(255,255,255,0.2) ${(wallpaper.opacity - 0.4) / 0.6 * 100}%)` }}
                  aria-label="Wallpaper opacity"
                />
              </div>

              {/* Font Selection */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Font Family</label>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((font) => (
                    <button
                      key={font.id}
                      onClick={() => handleFontChange(font.id)}
                      className={`
                        py-1.5 rounded-lg text-xs capitalize transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500
                        ${wallpaper.font === font.id 
                          ? "bg-gradient-primary text-white shadow-md" 
                          : "glass text-muted-foreground hover:text-white hover:bg-white/10"}
                      `}
                      aria-label={`Set ${font.label} font`}
                      aria-pressed={wallpaper.font === font.id}
                    >
                      <span className={font.className}>{font.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2 italic">
                  Active: <span className={activeFont.className}>{activeFont.label}</span>
                </p>
              </div>
            </GlassCard>

            {/* Live preview hint */}
            <div className="text-center text-xs text-muted-foreground/60">
              Changes are applied in real-time • Use "Export Wallpaper" to save as PNG
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
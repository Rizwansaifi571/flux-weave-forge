export const WALLPAPER_THEMES = [
  { id: "minimal", label: "Minimal Dark", preview: "linear-gradient(135deg,#0a0a0f,#14141f)", bg: "#030303" },
  { id: "midnight", label: "Midnight Blue", preview: "linear-gradient(135deg,#070b19,#0a192f)", bg: "#0a192f" },
  { id: "neon", label: "Neon Productivity", preview: "linear-gradient(135deg,#0b0524,#1a0a3a)", bg: "#0d0221" },
  { id: "cyberpunk", label: "Cyberpunk", preview: "linear-gradient(135deg,#0a0014,#1a0033)", bg: "#1a0033" },
  { id: "glass", label: "Glassmorphism", preview: "linear-gradient(135deg,#1a1a2e,#2d1b69)", bg: "#1a1a2e" },
  { id: "anime", label: "Anime Sunset", preview: "linear-gradient(135deg,#2b1055,#7597de)", bg: "#2b1055" },
  { id: "workspace", label: "Slate Workspace", preview: "linear-gradient(135deg,#1e293b,#0f172a)", bg: "#0f172a" },
  { id: "forest", label: "Deep Forest", preview: "linear-gradient(135deg,#061711,#0a2f1d)", bg: "#061711" },
  { id: "coffee", label: "Dark Roast", preview: "linear-gradient(135deg,#1a0f0a,#3e2723)", bg: "#1a0f0a" },
  { id: "dracula", label: "Dracula", preview: "linear-gradient(135deg,#282a36,#44475a)", bg: "#282a36" },
  { id: "custom", label: "Custom Theme", preview: "linear-gradient(135deg,#333,#666)", bg: "var(--custom-bg)" },
] as const;

export const WALLPAPER_ACCENTS = [
  { id: "purple", color: "#c084fc", ringColor: "ring-purple-400" },
  { id: "blue", color: "#60a5fa", ringColor: "ring-blue-400" },
  { id: "cyan", color: "#22d3ee", ringColor: "ring-cyan-400" },
  { id: "teal", color: "#2dd4bf", ringColor: "ring-teal-400" },
  { id: "emerald", color: "#34d399", ringColor: "ring-emerald-400" },
  { id: "green", color: "#4ade80", ringColor: "ring-green-400" },
  { id: "lime", color: "#a3e635", ringColor: "ring-lime-400" },
  { id: "yellow", color: "#facc15", ringColor: "ring-yellow-400" },
  { id: "amber", color: "#fbbf24", ringColor: "ring-amber-400" },
  { id: "orange", color: "#fb923c", ringColor: "ring-orange-400" },
  { id: "red", color: "#f87171", ringColor: "ring-red-400" },
  { id: "rose", color: "#fb7185", ringColor: "ring-rose-400" },
  { id: "pink", color: "#f472b6", ringColor: "ring-pink-400" },
  { id: "indigo", color: "#818cf8", ringColor: "ring-indigo-400" },
  { id: "custom", color: "var(--custom-accent)", ringColor: "ring-white" },
] as const;

export function getThemeBg(themeId: string, customBg?: string) {
  if (themeId === "custom" && customBg) return customBg;
  const theme = WALLPAPER_THEMES.find(t => t.id === themeId);
  return theme ? theme.bg : "#030303";
}

export function getAccentDetails(accentId: string, customHex?: string) {
  let hex = "#c084fc";
  if (accentId === "custom" && customHex) {
    hex = customHex;
  } else {
    const accent = WALLPAPER_ACCENTS.find(a => a.id === accentId);
    if (accent && !accent.color.startsWith("var")) {
      hex = accent.color;
    }
  }

  // Convert hex to rgb for glow effects
  const r = parseInt(hex.slice(1, 3), 16) || 192;
  const g = parseInt(hex.slice(3, 5), 16) || 132;
  const b = parseInt(hex.slice(5, 7), 16) || 252;

  return {
    hex,
    rgb: `${r},${g},${b}`,
    glow: `rgba(${r},${g},${b},0.35)`
  };
}

import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LayoutDashboard, ListTodo, Timer, Flame, Wand2, Sparkles, Settings, Zap } from "lucide-react";
import { AmbientBackground } from "./AmbientBackground";
import { useStore } from "@/lib/store";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/focus", icon: Timer, label: "Focus" },
  { to: "/habits", icon: Flame, label: "Habits" },
  { to: "/wallpaper", icon: Wand2, label: "Wallpaper Studio" },
  { to: "/assistant", icon: Sparkles, label: "AI Assistant" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { xp, level, streakCount } = useStore();
  const xpInLevel = xp % 500;
  return (
    <div className="dark min-h-screen text-foreground">
      <AmbientBackground />
      <div className="flex min-h-screen">
        <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-white/5 glass-strong p-5 flex flex-col">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <div className="font-semibold tracking-tight">WallTask <span className="text-gradient">AI</span></div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Productivity OS</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className="block">
                  <motion.div
                    whileHover={{ x: 3 }}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active ? "glass-strong text-foreground glow-soft" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    {active && (
                      <motion.div layoutId="activeNav" className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-gradient-primary" />
                    )}
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          <div className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Level {level}</span>
              <span className="text-gradient font-semibold">{xp} XP</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(xpInLevel / 500) * 100}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-neon-pink" />
              <span>{streakCount}-day streak</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
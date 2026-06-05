import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, ListTodo, Timer, Flame, Wand2, BarChart3, Settings, Zap, Menu, X } from "lucide-react";
import { AmbientBackground } from "./AmbientBackground";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/focus", icon: Timer, label: "Focus" },
  { to: "/habits", icon: Flame, label: "Habits" },
  { to: "/wallpaper", icon: Wand2, label: "Wallpaper Studio" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { xp, level, streakCount } = useStore();
  const xpInLevel = xp % 500;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Defer persisted state hydration until after the server HTML has mounted.
    void useStore.persist.rehydrate();
  }, []);

  // Focus lock state (disabled navigation when true)
  const [focusLock, setFocusLock] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent<{ active: boolean }>) => {
      setFocusLock(e.detail.active);
    };
    window.addEventListener("focus-mode", handler as EventListener);
    return () => {
      window.removeEventListener("focus-mode", handler as EventListener);
    };
  }, []);

  // Close mobile menu on path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

  const navLinks = nav.map((item) => {
    const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`block transition ${
          focusLock ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={focusLock}
        onClick={() => setMobileMenuOpen(false)}
      >
        <motion.div
          whileHover={focusLock ? {} : { x: 3 }}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            active
              ? "glass-strong text-foreground glow-soft"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          {active && (
            <motion.div
              layoutId="activeNav"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-gradient-primary"
            />
          )}
          <item.icon className="h-4 w-4" />
          {item.label}
        </motion.div>
      </Link>
    );
  });

  const levelProgressCard = (
    <div className="glass rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Level {level}</span>
        <span className="text-gradient font-semibold">{xp} FP</span>
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
  );

  return (
    <div className="dark min-h-screen text-foreground">
      <AmbientBackground />
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Mobile Top Navigation Header */}
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-md px-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight leading-none">
                WallTask <span className="text-gradient">AI</span>
              </div>
              <div className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
                Productivity OS
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="glass rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-neon-cyan border border-neon-cyan/20">
              Lvl {level}
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-1.5 hover:bg-white/5 transition text-foreground"
              aria-label="Open Menu"
              disabled={focusLock}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Desktop Sidebar (visible on screen sizes lg and up) */}
        <aside className="hidden lg:flex sticky top-0 h-screen w-64 shrink-0 border-r border-white/5 glass-strong p-5 flex-col z-30">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <div className="font-semibold tracking-tight">
                WallTask <span className="text-gradient">AI</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Productivity OS
              </div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1">
            {navLinks}
          </nav>

          {levelProgressCard}
        </aside>

        {/* Mobile Slide-out Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/5 glass-strong p-5 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileMenuOpen(false)}>
                    <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm tracking-tight leading-none">
                        WallTask <span className="text-gradient">AI</span>
                      </div>
                      <div className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
                        Productivity OS
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-white/5 transition"
                    aria-label="Close Menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1">
                  {navLinks}
                </nav>

                <div className="mt-auto">
                  {levelProgressCard}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

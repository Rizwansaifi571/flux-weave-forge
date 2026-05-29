import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, RotateCcw, Coffee, Brain, Bell, Volume2, VolumeX, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/focus")({ component: FocusPage });

const MODES = {
  focus: { label: "Deep Focus", minutes: 50, icon: Brain, nextMode: "break" as const },
  pomodoro: { label: "Pomodoro", minutes: 25, icon: Brain, nextMode: "break" as const },
  break: { label: "Break", minutes: 5, icon: Coffee, nextMode: "focus" as const },
} as const;

function FocusPage() {
  const { tasks, focusSessions, logFocus } = useStore();
  const [mode, setMode] = useState<keyof typeof MODES>("focus");
  const [remaining, setRemaining] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [showWarning, setShowWarning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const total = MODES[mode].minutes * 60;
  const today = todayStr();
  const todayFocus = focusSessions.find(s => s.date === today)?.minutes ?? 0;

  // Beep sound
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.8);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      if (window.navigator?.vibrate) window.navigator.vibrate(200);
    }
  }, [soundEnabled]);

  // Timer logic – calls logFocus when a focus/pomodoro session completes
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            setRunning(false);
            if (mode !== "break") {
              // This correctly adds minutes to today's total
              logFocus(MODES[mode].minutes);
            }
            playBeep();
            if (autoSwitch) {
              const nextMode = MODES[mode].nextMode;
              setMode(nextMode);
              setRemaining(MODES[nextMode].minutes * 60);
            } else {
              setRemaining(0);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, logFocus, playBeep, autoSwitch]);

  // Reset remaining when mode changes (if not running)
  useEffect(() => {
    if (!running) setRemaining(MODES[mode].minutes * 60);
  }, [mode, running]);

  // Cleanup audio
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  // Restrict tab switching & disable sidebar
  useEffect(() => {
    if (!running) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Focus session in progress! Leave now?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleVisibilityChange = () => {
      if (document.hidden && running) {
        setRunning(false);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.dispatchEvent(new CustomEvent("focus-mode", { detail: { active: true } }));

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.dispatchEvent(new CustomEvent("focus-mode", { detail: { active: false } }));
    };
  }, [running]);

  const handlePlayPause = async () => {
    if (!running && audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    setRunning(prev => !prev);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(total);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percent = ((total - remaining) / total) * 100;

  const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === "high").slice(0, 3);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader title="Focus Mode" subtitle="Lock in. Distraction-free deep work." />

        {showWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neon-pink/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
            <ShieldAlert className="h-4 w-4" /> Focus paused – don't switch tabs!
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timer Card */}
          <GlassCard className="lg:col-span-2 grid place-items-center py-12">
            <div className="flex gap-2 mb-8 flex-wrap justify-center">
              {Object.entries(MODES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => { if (!running) { setMode(key as keyof typeof MODES); setRunning(false); } }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    mode === key ? "bg-gradient-primary text-white glow-soft" : "glass text-muted-foreground"
                  } ${running ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={running}
                >
                  <value.icon className="h-3.5 w-3.5" />
                  {value.label}
                </button>
              ))}
            </div>

            <div className="relative grid place-items-center w-[340px] h-[340px]">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" stroke="oklch(1 0 0 / 0.06)" strokeWidth="2" fill="none" />
                <motion.circle
                  cx="50" cy="50" r="46"
                  stroke="url(#timerGrad)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  animate={{ strokeDasharray: `${(percent / 100) * 289} 289` }}
                  transition={{ duration: 0.2 }}
                  style={{ filter: "drop-shadow(0 0 8px oklch(0.7 0.24 305 / 0.6))" }}
                />
              </svg>
              <div className="text-center">
                <div className="text-7xl font-bold tracking-tighter tabular-nums">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
                  {MODES[mode].label}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handlePlayPause}
                className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center glow-primary hover:scale-105 transition"
                aria-label={running ? "Pause" : "Play"}
              >
                {running ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
              </button>
              <button
                onClick={handleReset}
                className="h-14 w-14 rounded-full glass grid place-items-center hover:bg-white/10 transition"
                aria-label="Reset"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-4 mt-6 text-xs text-muted-foreground">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center gap-1 glass rounded-full px-3 py-1 hover:bg-white/10"
              >
                {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                {soundEnabled ? "Sound on" : "Sound off"}
              </button>
              <button
                onClick={() => setAutoSwitch(!autoSwitch)}
                className={`flex items-center gap-1 glass rounded-full px-3 py-1 ${autoSwitch ? "text-neon-cyan" : ""}`}
              >
                <Bell className="h-3 w-3" />
                Auto-switch {autoSwitch ? "ON" : "OFF"}
              </button>
            </div>
          </GlassCard>

          {/* Side Panel */}
          <div className="space-y-4">
            <GlassCard>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Today's Focus</h3>
              <div className="text-2xl font-bold">{todayFocus} min</div>
              <div className="text-xs text-muted-foreground mt-1">Goal: 120 min</div>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div className="bg-neon-cyan h-1.5 rounded-full" style={{ width: `${Math.min(100, (todayFocus / 120) * 100)}%` }} />
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Top Priorities</h3>
              <div className="space-y-2">
                {highPriorityTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No high-priority tasks.</p>
                )}
                <AnimatePresence>
                  {highPriorityTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 rounded-lg glass-strong"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-neon-pink animate-pulse" />
                        <div className="text-sm font-medium">{task.title}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{task.focusMinutes}m estimated</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Focus Lock</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {running ? (
                  <span className="text-neon-pink">🔒 Focus active – sidebar navigation disabled. Switch tabs pauses timer.</span>
                ) : (
                  "▶️ Start a session to lock in. Timer pauses if you leave this tab."
                )}
              </p>
            </GlassCard>
          </div>
        </div>
      </div>

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.24 305)" />
            <stop offset="50%" stopColor="oklch(0.72 0.2 250)" />
            <stop offset="100%" stopColor="oklch(0.85 0.16 195)" />
          </linearGradient>
        </defs>
      </svg>
    </AppShell>
  );
}
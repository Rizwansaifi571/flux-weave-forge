import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldAlert,
  Minimize2,
  Maximize2,
  Headphones,
  Activity,
  Flame,
  CheckCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Trophy,
  AlertTriangle,
  Lock,
  CornerDownRight
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/focus")({ component: FocusPage });

// ========== WEB AUDIO SYNTHESIZER ENGINE ==========
class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private nodes: {
    osc1?: OscillatorNode;
    osc2?: OscillatorNode;
    noise?: AudioBufferSourceNode;
    filter?: BiquadFilterNode;
    gain?: GainNode;
  } = {};

  start(type: "rain" | "waves" | "binaural" | "brown", volume: number) {
    this.stop();
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = this.ctx;

      const masterGain = ctx.createGain();
      // Scale down to a comfortable, non-piercing baseline
      masterGain.gain.setValueAtTime(volume * 0.15, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.nodes.gain = masterGain;

      if (type === "binaural") {
        // Binaural beats: 100Hz left ear, 106Hz right ear (6Hz Theta waves for deep focus/creativity)
        const merger = ctx.createChannelMerger(2);

        const osc1 = ctx.createOscillator();
        osc1.frequency.value = 100;
        const gain1 = ctx.createGain();
        gain1.gain.value = 0.5;
        osc1.connect(gain1).connect(merger, 0, 0);

        const osc2 = ctx.createOscillator();
        osc2.frequency.value = 106;
        const gain2 = ctx.createGain();
        gain2.gain.value = 0.5;
        osc2.connect(gain2).connect(merger, 0, 1);

        merger.connect(masterGain);
        osc1.start();
        osc2.start();
        this.nodes.osc1 = osc1;
        this.nodes.osc2 = osc2;
      } else if (type === "rain") {
        // Soft Rain: bandpass filtered white noise
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 400;
        filter.Q.value = 0.7;

        noise.connect(filter).connect(masterGain);
        noise.start();

        this.nodes.noise = noise;
        this.nodes.filter = filter;
      } else if (type === "waves") {
        // Ocean Waves: modulated lowpass brown noise
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 250;

        // LFO to slowly sweep filter cutoff (ocean wave cycle)
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08; // 12.5s wave cycle
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 160;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noise.connect(filter).connect(masterGain);
        noise.start();
        lfo.start();

        this.nodes.noise = noise;
        this.nodes.osc1 = lfo;
      } else if (type === "brown") {
        // Pure Brownian Noise (deep, soothing rumble)
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // Compensate volume loss
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 400;

        noise.connect(lowpass).connect(masterGain);
        noise.start();

        this.nodes.noise = noise;
        this.nodes.filter = lowpass;
      }
    } catch (e) {
      console.warn("[audio] Sound synthesizers initialization failed:", e);
    }
  }

  setVolume(volume: number) {
    if (this.nodes.gain && this.ctx) {
      this.nodes.gain.gain.setValueAtTime(volume * 0.15, this.ctx.currentTime);
    }
  }

  stop() {
    try {
      if (this.nodes.osc1) this.nodes.osc1.stop();
      if (this.nodes.osc2) this.nodes.osc2.stop();
      if (this.nodes.noise) this.nodes.noise.stop();
    } catch {}
    this.nodes = {};
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

const audio = new ZenAudioEngine();

// Breathing cycle stages
type BreathPhase = "in" | "hold1" | "out" | "hold2";

function FocusPage() {
  const { tasks, focusSessions, logFocus, toggleTask, streakCount } = useStore();

  // Setup options
  const [selectedPreset, setSelectedPreset] = useState<"25" | "50" | "90" | "custom">("25");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [strictMode, setStrictMode] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // Ambient Sound settings
  const [ambientSound, setAmbientSound] = useState<"silence" | "rain" | "waves" | "binaural" | "brown">("silence");
  const [soundVolume, setSoundVolume] = useState(0.5);

  // Focus flow state variables
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [flowCompleted, setFlowCompleted] = useState(false);
  const [earnedFp, setEarnedFp] = useState(0);

  // Lockdown warning screen state
  const [flowBroken, setFlowBroken] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hold-to-cancel trigger variables
  const [holdProgress, setHoldProgress] = useState(0);
  const cancelHoldRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Breathing Coach states
  const [breathPhase, setBreathPhase] = useState<BreathPhase>("in");
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(4);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const today = todayStr();
  const todayFocus = focusSessions.find((s) => s.date === today)?.minutes ?? 0;

  // Preset time values
  const total = (() => {
    if (selectedPreset === "25") return 25 * 60;
    if (selectedPreset === "50") return 50 * 60;
    if (selectedPreset === "90") return 90 * 60;
    return (durationHours * 60 + durationMinutes) * 60;
  })();

  // Synchronize remaining time on presets
  useEffect(() => {
    if (!running && !flowCompleted) {
      setRemaining(total);
    }
  }, [selectedPreset, durationHours, durationMinutes, running, flowCompleted]);

  // Handle ambient sound engine activation
  useEffect(() => {
    if (running && !flowBroken && ambientSound !== "silence") {
      audio.start(ambientSound, soundVolume);
    } else {
      audio.stop();
    }
    return () => audio.stop();
  }, [running, flowBroken, ambientSound]);

  // Handle ambient volume change live
  useEffect(() => {
    audio.setVolume(soundVolume);
  }, [soundVolume]);

  // Breathing Coach Loop (Saves calm mind and rhythm)
  useEffect(() => {
    if (running && !flowBroken) {
      breathTimerRef.current = setInterval(() => {
        setBreathSecondsLeft((prev) => {
          if (prev <= 1) {
            // Transition to next breathing stage
            setBreathPhase((curr) => {
              if (curr === "in") {
                setBreathSecondsLeft(4); // Hold for 4s
                return "hold1";
              }
              if (curr === "hold1") {
                setBreathSecondsLeft(4); // Exhale for 4s
                return "out";
              }
              if (curr === "out") {
                setBreathSecondsLeft(2); // Hold empty for 2s
                return "hold2";
              }
              // Return to inhale
              setBreathSecondsLeft(4);
              return "in";
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    }
    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, [running, flowBroken]);

  // Timer Core logic
  useEffect(() => {
    if (running && !flowBroken) {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            // Successfully finished!
            setRunning(false);
            setFlowCompleted(true);
            const mins = Math.max(1, Math.round(total / 60));
            const calculatedFp = mins * 2;
            setEarnedFp(calculatedFp);
            logFocus(mins);

            // Exit fullscreen if active
            if (document.fullscreenElement) {
              void document.exitFullscreen();
            }

            // Play Zen Chime sound
            try {
              const ch = new AudioContext();
              const osc = ch.createOscillator();
              const gain = ch.createGain();
              osc.connect(gain).connect(ch.destination);
              osc.frequency.value = 520;
              gain.gain.setValueAtTime(0.35, ch.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ch.currentTime + 1.5);
              osc.start();
              osc.stop(ch.currentTime + 1.5);
            } catch {}

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, flowBroken, total, logFocus]);

  // Strict Lock / Tab switches trap
  useEffect(() => {
    if (!running || flowCompleted) return;

    // 1. Ask confirmation before tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Focus session in progress! Leaving breaks your lock streak.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 2. Strict Alt-Tab Trap: Trigger Flow Broken if user switches away
    const handleVisibilityChange = () => {
      if (document.hidden && running) {
        setFlowBroken(true);
        setWarningMessage("Zen Focus interrupted! Switched browser tab or minimized.");
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [running, flowCompleted]);

  // Fullscreen detection trap to monitor strict mode escape
  useEffect(() => {
    const handleFsChange = () => {
      const activeFs = document.fullscreenElement !== null;
      setIsFullscreen(activeFs);
      if (running && strictMode && !activeFs && !flowCompleted && !flowBroken) {
        // Exited fullscreen manually
        setFlowBroken(true);
        setWarningMessage("Flow broken! Strict focus requires keeping fullscreen lockdown active.");
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [running, strictMode, flowCompleted, flowBroken]);

  const handleStart = async () => {
    if (total === 0) return;
    setFlowCompleted(false);
    setFlowBroken(false);
    setRemaining(total);
    setBreathPhase("in");
    setBreathSecondsLeft(4);

    if (strictMode) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn("Fullscreen permission rejected:", err);
      }
    }
    setRunning(true);
  };

  const handleResume = async () => {
    setFlowBroken(false);
    if (strictMode) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen resume rejected:", err);
      }
    }
    setRunning(true);
  };

  // Terminate flow reset
  const handleReset = () => {
    setRunning(false);
    setFlowBroken(false);
    setRemaining(total);
    setHoldProgress(0);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  };

  // Hold-to-cancel button listeners
  const startCancelHold = () => {
    if (cancelHoldRef.current) clearInterval(cancelHoldRef.current);
    cancelHoldRef.current = setInterval(() => {
      setHoldProgress((p) => {
        if (p >= 100) {
          clearInterval(cancelHoldRef.current!);
          handleReset();
          return 0;
        }
        return p + 2.5; // Fills in exactly 1.2s of holding
      });
    }, 30);
  };

  const stopCancelHold = () => {
    if (cancelHoldRef.current) {
      clearInterval(cancelHoldRef.current);
      cancelHoldRef.current = null;
    }
    // Slowly reset progress to 0
    const decay = setInterval(() => {
      setHoldProgress((p) => {
        if (p <= 0) {
          clearInterval(decay);
          return 0;
        }
        return Math.max(0, p - 6);
      });
    }, 15);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const timerPercent = total > 0 ? ((total - remaining) / total) * 100 : 0;

  // Breathing Coach label configuration
  const getBreathingLabel = () => {
    switch (breathPhase) {
      case "in":
        return "Breathe In";
      case "hold1":
        return "Hold";
      case "out":
        return "Exhale";
      case "hold2":
        return "Rest";
    }
  };

  const getBreathingMessage = () => {
    switch (breathPhase) {
      case "in":
        return "Inhale deep prana and expand your chest";
      case "hold1":
        return "Lock the energy inside your center";
      case "out":
        return "Release tension and slowly breathe out";
      case "hold2":
        return "Relax before the next expansion cycle";
    }
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Zen Space"
          subtitle="Isolate from distractions, synchronize your breathing pattern, and lock deep concentration."
        />

        {/* 1. SETUP SPACE STATE */}
        {!running && !flowCompleted && !flowBroken && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Options Form Panel */}
            <div className="lg:col-span-2 space-y-6">
              <GlassCard className="p-6 space-y-6">
                <div className="space-y-1 border-b border-white/5 pb-3">
                  <h3 className="text-base font-semibold text-white">1. Select Preset Duration</h3>
                  <p className="text-xs text-muted-foreground">Select a recommended target block or customize one.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: "25", name: "Pomodoro", desc: "25 min Focus", color: "from-neon-cyan/20 to-neon-cyan/5", border: "border-neon-cyan/20" },
                    { key: "50", name: "Deep Study", desc: "50 min Block", color: "from-neon-purple/20 to-neon-purple/5", border: "border-neon-purple/20" },
                    { key: "90", name: "Flow State", desc: "90 min Core", color: "from-neon-pink/20 to-neon-pink/5", border: "border-neon-pink/20" },
                    { key: "custom", name: "Custom Time", desc: "Adjust Slider", color: "from-white/10 to-white/5", border: "border-white/10" }
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setSelectedPreset(preset.key as any)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition group relative ${
                        selectedPreset === preset.key
                          ? "bg-gradient-to-br bg-white/5 border-white/30 glow-soft scale-[1.02]"
                          : "bg-white/5 border-white/5 hover:border-white/15"
                      }`}
                    >
                      <Clock className="h-4.5 w-4.5 text-muted-foreground mb-4 group-hover:text-white transition-colors" />
                      <div>
                        <div className="text-xs font-bold text-white">{preset.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Time slider option */}
                {selectedPreset === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 pt-2 border-t border-white/5"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Hours</span>
                          <span className="font-semibold text-white">{durationHours}h</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          value={durationHours}
                          onChange={(e) => setDurationHours(Number(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-purple"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Minutes</span>
                          <span className="font-semibold text-white">{durationMinutes}m</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={59}
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </GlassCard>

              {/* Task locking section */}
              <GlassCard className="p-6 space-y-4">
                <div className="space-y-1 border-b border-white/5 pb-3">
                  <h3 className="text-base font-semibold text-white">2. Set Session Quest Target (Optional)</h3>
                  <p className="text-xs text-muted-foreground">Select a specific task to lock as your goal during this timer.</p>
                </div>

                <div className="max-h-[220px] overflow-y-auto scrollbar-thin space-y-2.5 pr-1">
                  {tasks.filter((t) => !t.completed).length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-3 text-center">No incomplete tasks available. You can focus on pure mind serenity.</div>
                  ) : (
                    tasks
                      .filter((t) => !t.completed)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTaskId(selectedTaskId === t.id ? null : t.id)}
                          className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                            selectedTaskId === t.id
                              ? "bg-neon-purple/10 border-neon-purple/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          }`}
                        >
                          <div
                            className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                              selectedTaskId === t.id
                                ? "bg-neon-purple border-neon-purple text-white"
                                : "border-white/20"
                            }`}
                          >
                            {selectedTaskId === t.id && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{t.title}</div>
                            {t.category && <div className="text-[10px] text-muted-foreground mt-0.5">{t.category}</div>}
                          </div>
                          {t.priority === "high" && (
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-neon-pink/15 text-neon-pink border border-neon-pink/20 uppercase tracking-wider">
                              HIGH
                            </span>
                          )}
                        </button>
                      ))
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Right Ambient Space controls */}
            <div className="space-y-6">
              {/* Sounds Selector */}
              <GlassCard className="p-6 space-y-4">
                <div className="space-y-1 border-b border-white/5 pb-3">
                  <h3 className="text-base font-semibold text-white">3. Ambient Audio</h3>
                  <p className="text-xs text-muted-foreground">Select local synthesizer waves to play during focus.</p>
                </div>

                <div className="space-y-2">
                  {[
                    { key: "silence", name: "Pure Silence", desc: "No background sounds" },
                    { key: "rain", name: "Soft Rain", desc: "Filtered white noise" },
                    { key: "waves", name: "Deep Ocean Waves", desc: "Swaying brownian frequency" },
                    { key: "binaural", name: "Binaural Theta Beats", desc: "6Hz waves for brain stimulation" },
                    { key: "brown", name: "Brown Space Noise", desc: "Deep soothing cosmic rumble" }
                  ].map((sound) => (
                    <button
                      key={sound.key}
                      onClick={() => setAmbientSound(sound.key as any)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                        ambientSound === sound.key
                          ? "bg-neon-cyan/10 border-neon-cyan/40"
                          : "bg-white/5 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{sound.name}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{sound.desc}</div>
                      </div>
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          ambientSound === sound.key ? "bg-neon-cyan animate-pulse" : "bg-white/10"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {ambientSound !== "silence" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1.5 pt-3 border-t border-white/5"
                  >
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Volume</span>
                      <span>{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                    />
                  </motion.div>
                )}
              </GlassCard>

              {/* Strict Mode Checklist details */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-neon-pink" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lockdown rules</h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-neon-purple focus:ring-neon-purple cursor-pointer"
                  />
                </div>

                <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
                  <div className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-pink mt-1.5 flex-shrink-0" />
                    <p>Enters full immersive overlay covering all browser windows.</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-cyan mt-1.5 flex-shrink-0" />
                    <p>Tab switching or app minimizing automatically breaks flow and pauses progress.</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-neon-purple mt-1.5 flex-shrink-0" />
                    <p>Requires holding cancel for 3s to break the session manually.</p>
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  className="w-full h-12 rounded-xl bg-gradient-primary text-sm font-semibold text-white glow-primary flex items-center justify-center gap-2 hover:scale-[1.01] transition duration-200 mt-2"
                >
                  <Play className="h-4 w-4 fill-white" /> Initiate Serenity Flow ({Math.round(total / 60)}m)
                </button>
              </GlassCard>
            </div>
          </div>
        )}

        {/* 2. FULLSCREEN IMMERSIVE LOCKDOWN OVERLAY */}
        {running && !flowBroken && (
          <div className="fixed inset-0 z-[150] bg-[#07060e] flex flex-col justify-between p-6 sm:p-12 overflow-hidden text-white select-none">
            {/* Immersive animated mesh gradients in background */}
            <div className="absolute inset-0 bg-radial-gradient from-neon-purple/8 to-transparent pointer-events-none opacity-40 animate-pulse duration-[6000ms]" />
            <div className="absolute top-1/4 left-1/4 w-[35vw] h-[35vw] rounded-full bg-neon-cyan/5 filter blur-[100px] animate-pulse duration-[8000ms]" />
            <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-neon-pink/4 filter blur-[110px] animate-pulse duration-[5000ms]" />

            {/* Glowing stars canvas background simulation */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-[10%] left-[20%] w-1 h-1 bg-white rounded-full animate-ping" />
              <div className="absolute top-[40%] left-[80%] w-1.5 h-1.5 bg-white rounded-full opacity-60" />
              <div className="absolute top-[75%] left-[35%] w-1 h-1 bg-white rounded-full opacity-40" />
              <div className="absolute top-[60%] left-[15%] w-2 h-2 bg-white rounded-full opacity-35" />
              <div className="absolute top-[25%] left-[70%] w-1 h-1 bg-white rounded-full opacity-70" />
            </div>

            {/* Top Navigation HUD Header */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neon-cyan animate-pulse">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Lockdown active</div>
                  <h4 className="text-xs font-semibold text-white/95">Zen Serenity Space</h4>
                </div>
              </div>

              {selectedTask && (
                <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 border-neon-cyan/20 max-w-sm">
                  <div className="h-2 w-2 rounded-full bg-neon-cyan animate-ping" />
                  <span className="text-[10px] text-muted-foreground truncate">Quest: <span className="font-semibold text-white">{selectedTask.title}</span></span>
                </div>
              )}
            </div>

            {/* Center Area: Timer & Breathing Trainer */}
            <div className="flex flex-col items-center justify-center flex-grow py-8 z-10">
              {/* Circular coach ring wrapper */}
              <div className="relative grid place-items-center w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] mb-8">
                
                {/* Expansive Breathing Circle ring controlled by animation phase */}
                <motion.div
                  animate={{
                    scale:
                      breathPhase === "in" ? [1, 1.25] :
                      breathPhase === "hold1" ? 1.25 :
                      breathPhase === "out" ? [1.25, 0.95] : 0.95,
                  }}
                  transition={{
                    duration: breathPhase === "in" ? 4 : breathPhase === "out" ? 4 : 2,
                    ease: "easeInOut",
                  }}
                  className={`absolute inset-0 rounded-full border opacity-30 filter blur-sm transition-colors duration-[1000ms] ${
                    breathPhase === "in" ? "border-neon-cyan bg-neon-cyan/5" :
                    breathPhase === "hold1" ? "border-neon-purple bg-neon-purple/5" :
                    breathPhase === "out" ? "border-neon-pink bg-neon-pink/5" : "border-slate-500 bg-slate-500/5"
                  }`}
                />

                {/* Second background helper wave */}
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="absolute inset-[10px] rounded-full border border-white/5 bg-white/2"
                />

                {/* SVG Timer circle indicator */}
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.03)" strokeWidth="2.2" fill="none" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="url(#timerGradActive)"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                    animate={{ strokeDasharray: `${(timerPercent / 100) * 289} 289` }}
                    transition={{ duration: 0.5, ease: "linear" }}
                  />
                </svg>

                {/* Clock numbers block */}
                <div className="text-center space-y-1 z-20">
                  <div className="text-5xl sm:text-6xl font-bold tracking-tighter tabular-nums text-white text-shadow-glow">
                    {formatTime(remaining)}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Remaining
                  </div>
                  
                  {/* Breathing label text */}
                  <div className="pt-4 flex flex-col items-center">
                    <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-[800ms] ${
                      breathPhase === "in" ? "text-neon-cyan" :
                      breathPhase === "hold1" ? "text-neon-purple" :
                      breathPhase === "out" ? "text-neon-pink" : "text-slate-400"
                    }`}>
                      {getBreathingLabel()} ({breathSecondsLeft}s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Breathe instructions */}
              <p className="text-xs text-muted-foreground text-center max-w-xs h-6 animate-pulse">
                {getBreathingMessage()}
              </p>
            </div>

            {/* Bottom Actions Area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 z-10 border-t border-white/5 pt-6">
              
              {/* Sounds Controls overlay */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
                  <Headphones className="h-4 w-4 text-neon-cyan" />
                  <span className="text-[10px] text-muted-foreground capitalize">Sound: <span className="font-semibold text-white">{ambientSound === "silence" ? "None" : ambientSound}</span></span>
                </div>

                {ambientSound !== "silence" && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
                    <button
                      onClick={() => setSoundVolume((v) => (v === 0 ? 0.5 : 0))}
                      className="text-muted-foreground hover:text-white"
                    >
                      {soundVolume === 0 ? <VolumeX className="h-4 w-4 text-neon-pink" /> : <Volume2 className="h-4 w-4 text-neon-cyan" />}
                    </button>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(Number(e.target.value))}
                      className="w-16 h-0.5 bg-white/10 rounded-lg appearance-none accent-neon-cyan"
                    />
                  </div>
                )}
              </div>

              {/* Active Audio Visualizer bars */}
              {ambientSound !== "silence" && (
                <div className="flex items-end gap-1.5 h-6 opacity-60">
                  {[0.7, 0.4, 0.9, 0.5, 0.8, 0.3, 0.6].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [`${h * 8}px`, `${h * 24}px`, `${h * 8}px`] }}
                      transition={{ repeat: Infinity, duration: 0.8 + i * 0.15, ease: "easeInOut" }}
                      className="w-1 rounded-full bg-neon-cyan"
                    />
                  ))}
                </div>
              )}

              {/* Hold to Exit button with progressive indicator ring */}
              <div className="relative group">
                <button
                  onMouseDown={startCancelHold}
                  onMouseUp={stopCancelHold}
                  onMouseLeave={stopCancelHold}
                  onTouchStart={startCancelHold}
                  onTouchEnd={stopCancelHold}
                  className="relative h-11 px-6 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-neon-pink hover:bg-white/10 active:scale-95 transition overflow-hidden flex items-center justify-center gap-2"
                >
                  {/* Cancel progress fill overlay */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-neon-pink/15 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                  
                  <span className="z-10">Hold for 3s to Break Flow</span>
                </button>
              </div>
            </div>

            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id="timerGradActive" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}

        {/* 3. LOCKDOWN INTERRUPTED STATE OVERLAY */}
        {flowBroken && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full glass-strong p-8 rounded-3xl border border-neon-pink/30 space-y-6 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            >
              <div className="h-16 w-16 rounded-2xl bg-neon-pink/15 border border-neon-pink/30 flex items-center justify-center text-neon-pink mx-auto">
                <ShieldAlert className="h-8 w-8 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Focus Lock Compromised</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {warningMessage || "The strict focus sandbox was exited. Timer has been paused to protect integrity."}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleResume}
                  className="flex-1 h-11 rounded-xl bg-gradient-primary text-xs font-semibold text-white glow-soft hover:scale-[1.01] transition"
                >
                  Re-lock & Resume
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-muted-foreground hover:bg-white/10 transition"
                >
                  Abandon Quest
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 4. SUCCESS CELEBRATION VIEW */}
        {flowCompleted && (
          <div className="max-w-2xl mx-auto py-12">
            <GlassCard className="p-8 space-y-8 text-center border-neon-cyan/20 bg-gradient-to-b from-neon-cyan/5 to-transparent relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-neon-cyan/10 filter blur-[50px]" />
              
              <div className="space-y-4 relative z-10">
                <div className="h-16 w-16 rounded-2xl bg-neon-cyan/15 border border-neon-cyan/35 flex items-center justify-center text-neon-cyan mx-auto shadow-inner">
                  <Trophy className="h-8 w-8 text-shadow-glow" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neon-cyan uppercase tracking-widest">Session Accomplished</span>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Flow Serenity Reached</h2>
                  <p className="text-xs text-muted-foreground">
                    Congratulations! You protected your concentration block without interruption.
                  </p>
                </div>
              </div>

              {/* Flow reward card stat */}
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto z-10 relative">
                <div className="glass p-4 rounded-2xl text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Flow Points (FP)</div>
                  <div className="text-2xl font-bold text-neon-cyan mt-1">+{earnedFp}</div>
                </div>
                <div className="glass p-4 rounded-2xl text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Active Streak</div>
                  <div className="text-2xl font-bold text-neon-pink mt-1 flex items-center justify-center gap-1">
                    <Flame className="h-5 w-5 text-neon-pink" />
                    <span>{streakCount} Days</span>
                  </div>
                </div>
              </div>

              {/* Task completion prompt */}
              {selectedTask && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left max-w-md mx-auto space-y-3 z-10 relative">
                  <div className="flex items-start gap-3">
                    <div className="h-4.5 w-4.5 rounded-full border border-neon-cyan/30 flex items-center justify-center bg-neon-cyan/10 text-neon-cyan flex-shrink-0 mt-0.5">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Reward quest task unlocked</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        Would you like to resolve and close the selected task target now?
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pl-7.5">
                    <button
                      onClick={() => {
                        toggleTask(selectedTask.id);
                        setSelectedTaskId(null); // Clear selected
                      }}
                      className="px-4 py-2 rounded-lg bg-neon-cyan text-[10px] font-bold text-[#0c0b16] hover:bg-neon-cyan/90 transition flex items-center gap-1.5"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Mark Task Completed
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => {
                    setFlowCompleted(false);
                    setSelectedTaskId(null);
                  }}
                  className="h-11 px-8 rounded-xl bg-gradient-primary text-xs font-semibold text-white glow-soft hover:scale-[1.01] transition"
                >
                  Return to Serenity Setup
                </button>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { userName, setUserName, xp, level, streakCount } = useStore();

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <PageHeader title="Settings" subtitle="Tune your workspace." />

        <div className="space-y-4">
          <GlassCard>
            <h3 className="font-semibold mb-3">Profile</h3>
            <label className="text-xs text-muted-foreground">Display name</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full mt-1 glass rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </GlassCard>

          <GlassCard>
            <h3 className="font-semibold mb-3">Gamification</h3>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Level" value={level} />
              <Stat label="XP" value={xp} />
              <Stat label="Streak" value={streakCount} />
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="font-semibold mb-2">Data</h3>
            <p className="text-xs text-muted-foreground mb-3">All data is stored locally in your browser. Clearing storage will reset the app.</p>
            <button
              onClick={() => { if (confirm("Reset all data?")) { localStorage.removeItem("walltask-ai-store"); location.reload(); } }}
              className="rounded-lg glass-strong px-4 py-2 text-xs text-neon-pink hover:bg-white/10"
            >
              Reset all data
            </button>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-2xl font-semibold text-gradient">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
import { GlassCard } from "@/components/GlassCard";
import { TrendingUp, AlertCircle, Lightbulb, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface AiCoachCardProps {
  completionRate: number;
  mostProductiveHour?: string;
  weakArea?: string;
  suggestion?: string;
  tasksCompletedThisWeek?: number;
  streakCount?: number;
}

export function AiCoachCard({
  completionRate,
  mostProductiveHour,
  weakArea,
  suggestion,
  tasksCompletedThisWeek = 0,
  streakCount = 0,
}: AiCoachCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="mb-6 p-6 border border-neon-purple/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink glow-soft">
            <span className="text-lg">🤖</span>
          </div>
          <h3 className="text-lg font-semibold text-white">AI Coach</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-neon-cyan/20">
            <CheckCircle2 className="h-5 w-5 text-neon-cyan flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">This week's completion</p>
              <p className="text-sm font-semibold text-white">{completionRate}% of planned work</p>
            </div>
          </div>

          {mostProductiveHour && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-neon-cyan/20">
              <TrendingUp className="h-5 w-5 text-neon-cyan flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Peak productivity</p>
                <p className="text-sm font-semibold text-white">{mostProductiveHour}</p>
              </div>
            </div>
          )}

          {weakArea && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-neon-pink/20">
              <AlertCircle className="h-5 w-5 text-neon-pink flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Needs attention</p>
                <p className="text-sm font-semibold text-white">{weakArea}</p>
              </div>
            </div>
          )}

          {suggestion && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-neon-cyan/10 to-transparent border border-neon-cyan/30">
              <Lightbulb className="h-5 w-5 text-neon-cyan flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-neon-cyan uppercase">Suggestion</p>
                <p className="text-sm text-foreground mt-1">{suggestion}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-xs text-muted-foreground">Tasks Done</p>
              <p className="text-lg font-bold text-neon-cyan">{tasksCompletedThisWeek}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="text-lg font-bold text-neon-purple">
                {streakCount > 0 ? `${streakCount} day${streakCount === 1 ? "" : "s"}` : "Build one today"}
              </p>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

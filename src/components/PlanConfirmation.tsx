import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

export interface GeneratedPlan {
  title: string;
  description?: string;
  duration?: string;
  items: PlanItem[];
  estimatedCommitment?: string;
  totalTasks?: number;
}

export interface PlanItem {
  phase: string;
  description?: string;
  taskCount?: number;
}

interface PlanConfirmationProps {
  plan: GeneratedPlan | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onAdjust?: () => void;
}

export function PlanConfirmation({
  plan,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
  onAdjust,
}: PlanConfirmationProps) {
  return (
    <AnimatePresence>
      {isOpen && plan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <GlassCard className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 grid place-items-center rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple glow-soft">
                      📊
                    </div>
                    <h2 className="text-2xl font-bold text-white">{plan.title}</h2>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground ml-13">{plan.description}</p>
                  )}
                </div>
                <button
                  onClick={onCancel}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Plan Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">Plan Breakdown</h3>
                <div className="space-y-2">
                  {plan.items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-neon-cyan/20 hover:border-neon-cyan/50 transition"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple grid place-items-center text-xs font-bold text-white flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-white">{item.phase}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        )}
                      </div>
                      {item.taskCount && (
                        <span className="text-xs font-semibold text-neon-cyan px-2 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex-shrink-0">
                          {item.taskCount} tasks
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {plan.totalTasks && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-muted-foreground">Total Tasks</p>
                    <p className="text-xl font-bold text-neon-cyan">{plan.totalTasks}</p>
                  </div>
                )}
                {plan.duration && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-xl font-bold text-neon-purple">{plan.duration}</p>
                  </div>
                )}
                {plan.estimatedCommitment && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-muted-foreground">Daily Commitment</p>
                    <p className="text-xl font-bold text-neon-pink">{plan.estimatedCommitment}</p>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-neon-pink/10 border border-neon-pink/30">
                <AlertCircle className="h-5 w-5 text-neon-pink flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  This will create multiple tasks and potentially reorganize your schedule. You can always
                  adjust later.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-foreground hover:bg-white/5 transition font-medium text-sm"
                >
                  Cancel
                </button>
                {onAdjust && (
                  <button
                    onClick={onAdjust}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-neon-cyan/30 text-neon-cyan hover:bg-white/20 transition font-medium text-sm"
                  >
                    Adjust Plan
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-purple text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm glow-soft flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm & Generate
                    </>
                  )}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface AiQuickActionsProps {
  onAction: (action: string) => void;
  isLoading?: boolean;
}

const QUICK_ACTIONS = [
  { id: "plan-day", label: "Plan Day", icon: "📅" },
  { id: "plan-week", label: "Plan Week", icon: "📊" },
  { id: "create", label: "Create Tasks", icon: "✨" },
  { id: "edit", label: "Edit Task", icon: "✏️" },
  { id: "reschedule", label: "Reschedule", icon: "🔄" },
  { id: "prioritize", label: "Prioritize", icon: "⚡" },
  { id: "analyze", label: "Coach Me", icon: "📈" },
];

export function AiQuickActions({ onAction, isLoading = false }: AiQuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mb-6 flex flex-wrap gap-2"
    >
      {QUICK_ACTIONS.map((action, idx) => (
        <motion.button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={isLoading}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: idx * 0.05 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-white/5 to-transparent border border-neon-cyan/20 hover:border-neon-cyan/50 text-xs font-medium text-foreground hover:text-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <span className="text-sm group-hover:scale-110 transition">{action.icon}</span>
          <span>{action.label}</span>
          <Sparkles className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
        </motion.button>
      ))}
    </motion.div>
  );
}

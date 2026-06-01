import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface AiCommandPanelProps {
  onSubmit: (command: string) => Promise<void>;
  isLoading?: boolean;
}

const SUGGESTED_COMMANDS = [
  "Complete 25 DSA videos in 10 days",
  "Build an Employee Management System",
  "Plan my week",
  "Reschedule my overdue tasks",
  "I have 3 hours today",
];

export function AiCommandPanel({ onSubmit, isLoading = false }: AiCommandPanelProps) {
  const [command, setCommand] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, text?: string) => {
    e.preventDefault();
    const finalCommand = text || command.trim();
    if (!finalCommand) return;

    await onSubmit(finalCommand);
    setCommand("");
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCommand(suggestion);
    setShowSuggestions(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="mb-6 p-6 border-2 border-neon-cyan/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple glow-soft">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">Ask Jarvis</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Tell me what you want to accomplish..."
              className="w-full bg-black/40 border border-neon-cyan/20 rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition resize-none min-h-[80px]"
            />
            <button
              type="submit"
              disabled={!command.trim() || isLoading}
              className="absolute bottom-3 right-3 flex items-center gap-2 bg-gradient-to-r from-neon-cyan to-neon-purple px-4 py-2 rounded-lg text-xs font-medium text-white glow-soft hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Plan
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {showSuggestions && !command && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 space-y-2"
          >
            <p className="text-xs text-muted-foreground">Try these commands:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_COMMANDS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left px-3 py-2 rounded-lg bg-white/5 border border-neon-cyan/20 hover:border-neon-cyan/50 hover:bg-white/10 text-xs text-foreground transition group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-neon-cyan/60 group-hover:text-neon-cyan transition">
                      →
                    </span>
                    <span>{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}

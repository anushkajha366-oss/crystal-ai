import React from "react";
import { Mountains, BookOpen, Lightning, Moon } from "@phosphor-icons/react";
import { useMood } from "@/contexts/MoodContext";
import { motion } from "framer-motion";

const ICONS = {
  deep: Mountains,
  review: BookOpen,
  grind: Lightning,
  drained: Moon,
};

const ORDER = ["deep", "review", "grind", "drained"];

export default function MoodSelector({ compact = false }) {
  const { mood, setMood, moods } = useMood();
  return (
    <div className="flex items-center gap-1.5" data-testid="mood-selector">
      {ORDER.map((key) => {
        const Icon = ICONS[key];
        const cfg = moods[key];
        const active = mood === key;
        return (
          <motion.button
            key={key}
            data-testid={`mood-${key}-btn`}
            onClick={() => setMood(key)}
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            className={`group relative flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-300 ${
              active
                ? "bg-white/10 border border-white/20"
                : "bg-white/[0.02] border border-white/5 opacity-50 hover:opacity-90"
            }`}
            style={
              active
                ? {
                    boxShadow: `0 0 18px ${cfg.palette.primary}40, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }
                : {}
            }
          >
            <Icon
              size={14}
              weight={active ? "fill" : "regular"}
              color={active ? cfg.palette.primary : "#ffffff"}
            />
            {!compact && (
              <span className="mood-label" style={{ color: active ? cfg.palette.primary : "#ffffff99" }}>
                {cfg.label}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

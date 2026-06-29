import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

const MoodContext = createContext(null);

const MOOD_CONFIG = {
  deep: {
    label: "Deep",
    palette: { primary: "#d4af37", secondary: "#f5e6a8" },
    bloom: 0.45,
    swirl: 0.39,
    particleCount: 220,
    speedMultiplier: 0.8,
  },
  review: {
    label: "Review",
    palette: { primary: "#c0c0c0", secondary: "#e8e8e8" },
    bloom: 0.55,
    swirl: 0.6,
    particleCount: 300,
    speedMultiplier: 1.0,
  },
  grind: {
    label: "Grind",
    palette: { primary: "#ffd700", secondary: "#ffaa00" },
    bloom: 1.0,
    swirl: 1.4,
    particleCount: 380,
    speedMultiplier: 1.4,
  },
  drained: {
    label: "Drained",
    palette: { primary: "#9a8d7a", secondary: "#c9c0b0" },
    bloom: 0.2,
    swirl: 0.2,
    particleCount: 160,
    speedMultiplier: 0.6,
  },
};

export function MoodProvider({ children }) {
  const [mood, setMood] = useState(() => localStorage.getItem("crystal_mood") || "review");
  const [confidence, setConfidence] = useState(0.6); // 0-1, drives bloom
  const [burstCount, setBurstCount] = useState(0);
  const [burstColor, setBurstColor] = useState("#2bf0ff");

  useEffect(() => {
    localStorage.setItem("crystal_mood", mood);
    document.documentElement.setAttribute("data-mood", mood);
    const weights = { deep: 600, review: 500, grind: 800, drained: 300 };
    document.documentElement.style.setProperty("--mood-weight", weights[mood] || 500);
    document.documentElement.style.setProperty("--mood-speed", mood === "grind" ? "0.15s" : mood === "drained" ? "0.6s" : "0.35s");
  }, [mood]);

  const triggerBurst = (color) => {
    if (color) setBurstColor(color);
    setBurstCount((c) => c + 1);
  };

  const value = useMemo(() => ({
    mood,
    setMood,
    confidence,
    setConfidence,
    config: MOOD_CONFIG[mood],
    moods: MOOD_CONFIG,
    burstCount,
    burstColor,
    triggerBurst,
  }), [mood, confidence, burstCount, burstColor]);

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error("useMood must be inside MoodProvider");
  return ctx;
}

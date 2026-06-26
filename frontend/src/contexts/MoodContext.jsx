import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

const MoodContext = createContext(null);

const MOOD_CONFIG = {
  deep: {
    label: "Deep",
    palette: { primary: "#7a3cff", secondary: "#2bf0ff" },
    bloom: 0.22,
    swirl: 0.39,
    particleCount: 220,
    speedMultiplier: 0.8,
  },
  review: {
    label: "Review",
    palette: { primary: "#2bf0ff", secondary: "#8fe6ff" },
    bloom: 0.5,
    swirl: 0.6,
    particleCount: 300,
    speedMultiplier: 1.0,
  },
  grind: {
    label: "Grind",
    palette: { primary: "#e8a0d8", secondary: "#7a3cff" },
    bloom: 0.9,
    swirl: 1.4,
    particleCount: 380,
    speedMultiplier: 1.4,
  },
  drained: {
    label: "Drained",
    palette: { primary: "#4db89f", secondary: "#8fe6ff" },
    bloom: 0.15,
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

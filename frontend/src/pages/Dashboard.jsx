import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import {
  Sparkle, Target, Cards, ChatCircleText, TrendUp, Lightning, ArrowRight
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useMood } from "@/contexts/MoodContext";

function Stat({ label, value, hint, accent }) {
  return (
    <div
      className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-all"
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)` }}
    >
      <div className="mood-label text-white/40 mb-2">{label}</div>
      <div className="font-mono text-3xl md:text-4xl tracking-tight" style={{ color: accent }}>
        {value}
      </div>
      {hint && <div className="text-xs text-white/45 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { config, setConfidence } = useMood();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [streak, setStreak] = useState(null);
  const [confHistory, setConfHistory] = useState([]);

  useEffect(() => {
    api.get("/analytics/summary").then((r) => {
      setSummary(r.data);
      if (r.data.accuracy) setConfidence(Math.min(1, r.data.accuracy / 100));
    }).catch(() => {});
    api.get("/analytics/streak").then((r) => setStreak(r.data)).catch(() => {});
    api.get("/confidence/history").then((r) => setConfHistory(r.data.map((h, i) => ({ i, value: h.value })))).catch(() => {});
  }, []); // eslint-disable-line

  const quickActions = [
    { label: "Adaptive Quiz", icon: Target, to: "/quiz", desc: "Smart difficulty matched to you" },
    { label: "Flashcards", icon: Cards, to: "/flashcards", desc: "Spaced repetition mastery" },
    { label: "AI Chat Quiz", icon: ChatCircleText, to: "/chat", desc: "Socratic dialogue with Crystal" },
    { label: "20-80 Focus", icon: Lightning, to: "/rule2080", desc: "The 20% that drives 80% of marks" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <div className="mood-label text-white/40 mb-2" data-testid="mode-tag">
          Mode · {config.label}
        </div>
        <h1 className="font-display text-4xl md:text-6xl tracking-tighter">
          Welcome back<span style={{ color: config.palette.primary }}>.</span>
        </h1>
        <p className="text-white/55 max-w-xl mt-3">
          Your crystal is tuned to {config.label.toLowerCase()} mode. Every answer reshapes the light.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Accuracy"
          value={summary ? `${summary.accuracy}%` : "—"}
          hint={summary ? `${summary.correct}/${summary.total_attempts} correct` : ""}
          accent={config.palette.primary}
        />
        <Stat
          label="Avg Confidence"
          value={summary ? `${summary.avg_confidence}/5` : "—"}
          hint="self-rated"
          accent={config.palette.secondary}
        />
        <Stat
          label="Attempts"
          value={summary ? summary.total_attempts : "0"}
          hint="all time"
          accent="#8fe6ff"
        />
        <Stat
          label="Topics Touched"
          value={summary ? summary.topics_touched : "0"}
          hint="diversity score"
          accent="#4db89f"
        />
      </div>

      {streak && (streak.daily_streak > 0 || streak.best_correct_run > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5" data-testid="daily-streak">
            <div className="mood-label text-white/40 mb-1">Daily streak</div>
            <div className="font-mono text-3xl flex items-baseline gap-2" style={{ color: config.palette.primary }}>
              {streak.daily_streak}
              <span className="text-xs text-white/40">days</span>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="mood-label text-white/40 mb-1">Best run</div>
            <div className="font-mono text-3xl flex items-baseline gap-2" style={{ color: config.palette.secondary }}>
              {streak.best_correct_run}
              <span className="text-xs text-white/40">in a row</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-2xl mb-4 flex items-center gap-3">
          <Sparkle weight="fill" color={config.palette.primary} size={20} />
          Quick start
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <motion.button
              key={a.label}
              whileHover={{ y: -3 }}
              onClick={() => navigate(a.to)}
              data-testid={`quick-${a.to.replace('/', '')}`}
              className="glass rounded-2xl p-5 text-left group transition-all"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <a.icon size={26} weight="duotone" color={config.palette.primary} />
                <ArrowRight size={16} className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="font-display text-lg">{a.label}</div>
              <div className="text-xs text-white/45 mt-1">{a.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {confHistory.length > 1 && (
        <div className="glass-strong rounded-3xl p-6" data-testid="confidence-sparkline">
          <div className="flex justify-between mb-2">
            <div>
              <div className="mood-label text-white/40">✨ Confidence over time</div>
              <div className="font-display text-xl gold-text">Your crystal is brightening</div>
            </div>
            <div className="font-mono text-3xl gold-text">{confHistory[confHistory.length-1].value}/10</div>
          </div>
          <div style={{ height: 80 }}>
            <ResponsiveContainer>
              <LineChart data={confHistory}>
                <RTooltip contentStyle={{ background: "rgba(10,10,10,0.9)", border: `1px solid ${config.palette.primary}40`, borderRadius: 12, color: "#fff" }} />
                <Line type="monotone" dataKey="value" stroke={config.palette.primary} strokeWidth={2.5} dot={{ r: 3, fill: config.palette.primary }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {summary?.weak_topics?.length > 0 && (
        <div className="glass rounded-3xl p-7">
          <h2 className="font-display text-2xl mb-1 flex items-center gap-2">
            <TrendUp weight="duotone" color={config.palette.secondary} />
            Focus zones
          </h2>
          <p className="text-white/50 text-sm mb-5">Topics where the crystal dims — strengthen these.</p>
          <div className="space-y-2">
            {summary.weak_topics.map((t) => (
              <div
                key={t.topic}
                className="flex items-center justify-between glass rounded-xl px-4 py-3"
              >
                <div>
                  <div className="text-sm">{t.topic}</div>
                  <div className="text-xs text-white/40 font-mono">{t.attempts} attempts</div>
                </div>
                <div className="font-mono text-lg" style={{ color: config.palette.primary }}>
                  {t.accuracy}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

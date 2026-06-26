import React, { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function Analytics() {
  const { config } = useMood();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    api.get("/analytics/summary").then((r) => setSummary(r.data));
    api.get("/analytics/trend").then((r) => setTrend(r.data));
  }, []);

  if (!summary) return <div className="text-white/50 font-mono text-sm">LOADING…</div>;

  const tooltipStyle = {
    background: "rgba(24,10,58,0.9)",
    border: `1px solid ${config.palette.primary}40`,
    borderRadius: 12,
    color: "#fff",
    backdropFilter: "blur(12px)",
    padding: "8px 12px",
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">Performance</div>
        <h1 className="font-display text-4xl md:text-5xl">The crystal remembers.</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-1">Accuracy</div>
          <div className="font-mono text-3xl" style={{ color: config.palette.primary }}>{summary.accuracy}%</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-1">Attempts</div>
          <div className="font-mono text-3xl">{summary.total_attempts}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-1">Avg Confidence</div>
          <div className="font-mono text-3xl text-white/90">{summary.avg_confidence}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-1">Topics</div>
          <div className="font-mono text-3xl">{summary.topics_touched}</div>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-6">
        <div className="font-display text-xl mb-4">Accuracy trend</div>
        {trend.length === 0 ? (
          <div className="text-white/40 text-sm font-mono py-8">Answer some questions to build a trend.</div>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="accuracy" stroke={config.palette.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="glass-strong rounded-3xl p-6">
        <div className="font-display text-xl mb-4">Accuracy by topic</div>
        {summary.topic_accuracy.length === 0 ? (
          <div className="text-white/40 text-sm font-mono py-8">No topic data yet.</div>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={summary.topic_accuracy} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis type="category" dataKey="topic" stroke="rgba(255,255,255,0.5)" fontSize={10} width={150} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="accuracy" fill={config.palette.secondary} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-3">Weak topics</div>
          {summary.weak_topics.length === 0 ? (
            <div className="text-white/40 text-sm">None yet.</div>
          ) : summary.weak_topics.map((t) => (
            <div key={t.topic} className="flex justify-between py-1.5 text-sm">
              <span>{t.topic}</span>
              <span className="font-mono text-red-300">{t.accuracy}%</span>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mood-label text-white/40 mb-3">Strong topics</div>
          {summary.strong_topics.length === 0 ? (
            <div className="text-white/40 text-sm">None yet.</div>
          ) : summary.strong_topics.map((t) => (
            <div key={t.topic} className="flex justify-between py-1.5 text-sm">
              <span>{t.topic}</span>
              <span className="font-mono text-emerald-300">{t.accuracy}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

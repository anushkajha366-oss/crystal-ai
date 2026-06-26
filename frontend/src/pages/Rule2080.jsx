import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lightning, Target } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function Rule2080() {
  const { config } = useMood();
  const [exam, setExam] = useState("JEE");
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/rule2080", { params: { exam } }).then((r) => setRows(r.data));
  }, [exam]);

  const high = rows.filter((r) => r.high_impact);

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">20-80 Rule</div>
        <h1 className="font-display text-4xl md:text-5xl flex items-center gap-3">
          The vital few
          <Lightning weight="fill" color={config.palette.primary} />
        </h1>
        <p className="text-white/55 mt-2">Topics that deliver outsized exam impact.</p>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          data-testid="rule-exam-select"
          className="bg-white/5 rounded-xl px-3 py-2 text-sm border border-white/10"
        >
          <option>JEE</option><option>NEET</option><option>GATE-CS</option>
        </select>
        <button
          onClick={() => navigate("/quiz")}
          data-testid="focus-mode-btn"
          className="rounded-full px-4 py-2 text-sm text-black flex items-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})`,
            boxShadow: `0 0 18px ${config.palette.primary}40`,
          }}
        >
          <Target weight="fill" size={14} /> Enter focus mode
        </button>
      </div>

      <div className="space-y-2" data-testid="rule-list">
        {rows.map((r, i) => (
          <div
            key={r.topic}
            className="glass rounded-2xl p-4 relative overflow-hidden"
            style={r.high_impact ? { boxShadow: `inset 0 0 0 1px ${config.palette.primary}50` } : {}}
          >
            <div
              className="absolute inset-y-0 left-0 opacity-15"
              style={{
                width: `${r.share * 4}%`,
                background: `linear-gradient(90deg, ${config.palette.primary}, transparent)`,
              }}
            />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="font-mono text-xs text-white/40 w-6">#{i + 1}</div>
                <div>
                  <div className="font-display text-base">{r.topic}</div>
                  <div className="text-xs text-white/40 font-mono">
                    cumulative {r.cumulative}%
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl" style={{ color: r.high_impact ? config.palette.primary : "#ffffff80" }}>
                  {r.share}%
                </div>
                {r.high_impact && (
                  <div className="mood-label" style={{ color: config.palette.primary }}>HIGH IMPACT</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-5">
        <div className="mood-label text-white/40 mb-2">Smart time allocation</div>
        <div className="text-white/70 text-sm leading-relaxed">
          Spend approximately <span className="font-mono" style={{ color: config.palette.primary }}>80%</span> of
          your remaining prep time on the {high.length} high-impact topics above.
          Touch the remaining topics only after the vital few are stable.
        </div>
      </div>
    </div>
  );
}

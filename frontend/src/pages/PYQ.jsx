import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function PYQ() {
  const { config } = useMood();
  const [rows, setRows] = useState([]);
  const [exam, setExam] = useState("JEE");
  const [year, setYear] = useState("");

  useEffect(() => {
    const params = { exam };
    if (year) params.year = parseInt(year);
    api.get("/pyq", { params }).then((r) => setRows(r.data));
  }, [exam, year]);

  const maxFreq = Math.max(...rows.map((r) => r.frequency), 1);

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">PYQ Analyzer</div>
        <h1 className="font-display text-4xl md:text-5xl">Patterns in the past.</h1>
        <p className="text-white/55 mt-2">Frequency heatmap across previous year questions.</p>
      </div>

      <div className="flex flex-wrap gap-3 glass rounded-2xl p-5">
        <select
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          data-testid="exam-select"
          className="bg-white/5 rounded-xl px-3 py-2 text-sm border border-white/10"
        >
          <option>JEE</option><option>NEET</option><option>GATE-CS</option>
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          data-testid="year-select"
          className="bg-white/5 rounded-xl px-3 py-2 text-sm border border-white/10"
        >
          <option value="">All years</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="pyq-grid">
        {rows.map((r, i) => {
          const intensity = r.frequency / maxFreq;
          return (
            <div
              key={i}
              className="glass rounded-2xl p-5 relative overflow-hidden"
              style={{
                boxShadow: `inset 0 0 0 1px ${config.palette.primary}${Math.round(intensity * 50).toString(16).padStart(2, "0")}`,
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 80% 20%, ${config.palette.primary}${Math.round(intensity * 80).toString(16).padStart(2, "0")}, transparent 60%)`,
                }}
              />
              <div className="relative">
                <div className="mood-label text-white/40 mb-1">{r.exam} · {r.year}</div>
                <div className="font-display text-lg mb-3">{r.topic}</div>
                <div className="flex justify-between text-xs font-mono">
                  <div>
                    <div className="text-white/40">Frequency</div>
                    <div className="text-white">{r.frequency}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Weight</div>
                    <div style={{ color: config.palette.primary }}>{r.weight}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

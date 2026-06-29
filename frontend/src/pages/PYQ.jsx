import React, { useState } from "react";
import { motion } from "framer-motion";
import { UploadSimple, FileText, Sparkle, X, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function PYQ() {
  const { config } = useMood();
  const [files, setFiles] = useState([]);
  const [syllabus, setSyllabus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles((f) => [...f, ...picked].slice(0, 6));
    e.target.value = "";
  };
  const removeFile = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const analyze = async () => {
    if (files.length < 2) return toast.error("Upload at least 2 PYQ papers");
    if (!syllabus.trim()) return toast.error("Paste your syllabus first");
    setAnalyzing(true);
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("syllabus", syllabus);
      const r = await fetch(`${API}/pyq/analyze`, { method: "POST", credentials: "include", body: form });
      if (!r.ok) throw new Error((await r.json()).detail || "Failed");
      const data = await r.json();
      setResult(data);
      toast.success("Analysis ready 📊");
    } catch (e) {
      toast.error(e.message);
    } finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">📜 PYQ Analyzer</div>
        <h1 className="font-display text-4xl md:text-5xl gold-text">Patterns in the past.</h1>
        <p className="text-white/55 mt-2 max-w-2xl">Upload 2+ past-year papers and paste your syllabus. Crystal cross-references them and ranks topics by frequency, section-by-section.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-5">
        <div>
          <div className="mood-label text-white/40 mb-2">Step 1 · PYQ Papers (min 2, max 6)</div>
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-full px-4 py-2 border" style={{ borderColor: `${config.palette.primary}50` }}>
            <UploadSimple size={16} /> Add papers
            <input type="file" multiple accept=".pdf,.docx,.txt" onChange={addFiles} className="hidden" data-testid="pyq-files" />
          </label>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-sm">
                  <FileText size={14} color={config.palette.primary} />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mood-label text-white/40 mb-2">Step 2 · Syllabus</div>
          <textarea
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            rows={5}
            placeholder="Paste the official syllabus — sections, units, topics…"
            data-testid="pyq-syllabus"
            className="w-full"
          />
        </div>
        <button
          onClick={analyze}
          disabled={analyzing}
          data-testid="pyq-analyze-btn"
          className="rounded-full px-5 py-3 text-black font-medium flex items-center gap-2 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})` }}
        >
          {analyzing ? <><CircleNotch className="animate-spin" size={16} /> Analyzing…</> : <><Sparkle weight="fill" size={16} /> Run section-wise analysis</>}
        </button>
      </div>

      {result?.sections?.map((sec, si) => (
        <motion.div key={si} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6">
          <div className="font-display text-xl mb-3 gold-text">{sec.name}</div>
          <div className="space-y-2">
            {sec.topics?.sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((t, ti) => (
              <div key={ti} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm">{t.topic}</div>
                  <div className="text-xs text-white/40 font-mono">freq {t.frequency} · {(t.papers || []).length} paper(s)</div>
                </div>
                <div className="font-mono text-lg" style={{ color: config.palette.primary }}>{t.weight}%</div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {result?.recommendations?.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <div className="font-display text-xl mb-3">💡 Recommendations</div>
          <ul className="space-y-2 text-sm text-white/75">
            {result.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

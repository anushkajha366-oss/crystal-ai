import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ArrowRight, Sparkle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function Quiz() {
  const { config, setConfidence } = useMood();
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState(null);
  const [selected, setSelected] = useState(null);
  const [conf, setConf] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => { api.get("/quiz/topics").then((r) => setTopics(r.data)); }, []);

  const loadQuestion = async (useAi = false) => {
    setLoading(true);
    setResult(null);
    setSelected(null);
    setStartTime(Date.now());
    try {
      let r;
      if (useAi && topic) {
        r = await api.post("/quiz/generate", { topic, difficulty: 3 });
      } else {
        r = await api.get("/quiz/next", { params: topic ? { topic } : {} });
      }
      setQ(r.data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadQuestion(); }, []); // eslint-disable-line

  const submit = async () => {
    if (selected === null) return;
    const r = await api.post("/quiz/answer", {
      question_id: q.id,
      selected_index: selected,
      confidence: conf,
      time_ms: Date.now() - startTime,
    });
    setResult(r.data);
    const next = { correct: score.correct + (r.data.correct ? 1 : 0), total: score.total + 1 };
    setScore(next);
    setConfidence(Math.min(1, (next.correct / Math.max(1, next.total))));
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <div className="mood-label text-white/40 mb-2">Adaptive Quiz</div>
        <h1 className="font-display text-4xl md:text-5xl">Tune the crystal.</h1>
        <p className="text-white/55 mt-2">Difficulty adapts to your recent accuracy.</p>
      </div>

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          data-testid="topic-select"
          className="bg-white/5 rounded-xl px-3 py-2 text-sm border border-white/10"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.topic} value={t.topic}>{t.topic}</option>
          ))}
        </select>
        <button
          onClick={() => loadQuestion(false)}
          data-testid="new-question-btn"
          className="rounded-full px-4 py-2 text-sm border border-white/15 hover:border-white/30 transition"
        >
          New question
        </button>
        <button
          onClick={() => loadQuestion(true)}
          disabled={!topic}
          data-testid="ai-generate-btn"
          className="rounded-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 transition"
          style={{
            background: `linear-gradient(135deg, ${config.palette.primary}30, ${config.palette.secondary}30)`,
            border: `1px solid ${config.palette.primary}50`,
          }}
        >
          <Sparkle size={14} weight="fill" /> AI-generate
        </button>
        <div className="ml-auto font-mono text-sm text-white/50" data-testid="score">
          {score.correct}/{score.total}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-white/50 py-12 font-mono text-sm">
            CALIBRATING…
          </motion.div>
        ) : q ? (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="glass-strong rounded-3xl p-8"
            data-testid="quiz-card"
          >
            <div className="mood-label mb-4" style={{ color: config.palette.primary }}>
              {q.topic} · Difficulty {q.difficulty}/5
            </div>
            <div className="font-display text-2xl md:text-3xl leading-snug mb-6" data-testid="quiz-question">
              {q.question}
            </div>

            <div className="space-y-2.5 mb-6">
              {q.options.map((opt, i) => {
                const isSel = selected === i;
                const isCorrect = result && i === result.correct_index;
                const isWrong = result && isSel && !result.correct;
                return (
                  <motion.button
                    key={i}
                    whileHover={!result ? { x: 4 } : {}}
                    onClick={() => !result && setSelected(i)}
                    data-testid={`option-${i}`}
                    disabled={!!result}
                    className={`w-full text-left rounded-xl px-4 py-3.5 border transition-all ${
                      isCorrect
                        ? "bg-emerald-400/10 border-emerald-400/40"
                        : isWrong
                        ? "bg-red-400/10 border-red-400/40"
                        : isSel
                        ? "bg-white/8 border-white/30"
                        : "bg-white/[0.02] border-white/8 hover:border-white/20"
                    }`}
                  >
                    <span className="font-mono text-xs text-white/40 mr-3">{String.fromCharCode(65 + i)}</span>
                    <span className="text-sm">{opt}</span>
                    {isCorrect && <CheckCircle className="inline ml-2" weight="fill" color="#4db89f" size={16} />}
                    {isWrong && <XCircle className="inline ml-2" weight="fill" color="#ff7777" size={16} />}
                  </motion.button>
                );
              })}
            </div>

            <div className="mb-6">
              <div className="flex justify-between mood-label text-white/40 mb-2">
                <span>Confidence</span><span className="font-mono">{conf}/5</span>
              </div>
              <input
                type="range"
                min="1" max="5" value={conf}
                onChange={(e) => setConf(parseInt(e.target.value))}
                data-testid="confidence-slider"
                className="w-full accent-cyan-300"
                disabled={!!result}
                style={{ accentColor: config.palette.primary }}
              />
            </div>

            {!result ? (
              <button
                onClick={submit}
                disabled={selected === null}
                data-testid="submit-answer"
                className="w-full rounded-full py-3.5 font-medium text-black transition disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})`,
                  boxShadow: `0 0 24px ${config.palette.primary}40`,
                }}
              >
                Submit answer
              </button>
            ) : (
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-4 ${result.correct ? "bg-emerald-400/10 border border-emerald-400/30" : "bg-red-400/10 border border-red-400/30"}`}
                  data-testid="result-banner"
                >
                  <div className="font-display text-lg mb-1">
                    {result.correct ? "Crystal sharpens." : "The crystal dims."}
                  </div>
                  <div className="text-sm text-white/70">{result.explanation}</div>
                </div>
                <button
                  onClick={() => loadQuestion(false)}
                  data-testid="next-question-btn"
                  className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 border border-white/15 hover:border-white/40 transition"
                >
                  Next question <ArrowRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

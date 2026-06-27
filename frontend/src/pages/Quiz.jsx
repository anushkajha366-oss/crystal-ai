import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ArrowRight, Sparkle, BookmarkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function Quiz() {
  const { config, setConfidence, triggerBurst } = useMood();
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState("");
  const [hasDocs, setHasDocs] = useState(false);
  const [q, setQ] = useState(null);
  const [selected, setSelected] = useState(null);
  const [conf, setConf] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(Date.now());
  const [streak, setStreak] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkSet, setBookmarkSet] = useState(new Set());
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);

  const MILESTONES = [3, 5, 10, 25, 50];

  useEffect(() => {
    api.get("/quiz/topics").then((r) => setTopics(r.data));
    api.get("/bookmarks").then((r) => setBookmarkSet(new Set(r.data.map((b) => b.question_id))));
    api.get("/documents").then((r) => setHasDocs(r.data.some((d) => d.status === "processed")));
  }, []);

  const loadQuestion = async (useAi = false) => {
    setLoading(true);
    setResult(null);
    setSelected(null);
    setStartTime(Date.now());
    try {
      let r;
      if (reviewMode) {
        if (reviewQueue.length === 0) {
          const rq = await api.get("/quiz/review-queue");
          if (rq.data.length === 0) {
            toast.info("Review queue is empty — bookmark some questions or get a few wrong first.");
            setReviewMode(false);
            setLoading(false);
            return;
          }
          setReviewQueue(rq.data);
          setQ(rq.data[0]);
          setBookmarked(bookmarkSet.has(rq.data[0].id));
          setLoading(false);
          return;
        }
        const next = reviewQueue[Math.floor(Math.random() * reviewQueue.length)];
        setQ(next);
        setBookmarked(bookmarkSet.has(next.id));
        setLoading(false);
        return;
      }
      if (useAi) {
        const useTopic = topic || (topics.length > 0 ? topics[Math.floor(Math.random() * topics.length)].topic : "General");
        r = await api.post("/quiz/generate", { topic: useTopic, difficulty: 3 });
        toast.success("Generated a fresh question via Gemini");
      } else {
        r = await api.get("/quiz/next", { params: topic ? { topic } : {} });
      }
      setQ(r.data);
      setBookmarked(bookmarkSet.has(r.data.id));
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadQuestion(); /* eslint-disable-line */ }, [reviewMode]);

  const toggleBookmark = async () => {
    if (!q) return;
    if (bookmarked) {
      await api.delete(`/bookmarks/${q.id}`);
      setBookmarked(false);
      setBookmarkSet((s) => { const n = new Set(s); n.delete(q.id); return n; });
      toast("Bookmark removed");
    } else {
      await api.post("/bookmarks", { question_id: q.id });
      setBookmarked(true);
      setBookmarkSet((s) => new Set(s).add(q.id));
      toast.success("Bookmarked for review");
    }
  };

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

    if (r.data.correct) {
      triggerBurst("#4db89f");
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (MILESTONES.includes(newStreak)) {
        toast.success(`${newStreak} in a row!`, {
          description: "The crystal sharpens. Keep going.",
        });
      }
      // also check daily streak milestones via backend
      api.get("/analytics/streak").then((s) => {
        const ds = s.data.daily_streak;
        if (ds > 0 && [2, 3, 7, 14, 30].includes(ds)) {
          toast.success(`${ds}-day streak!`, { description: "Consistency unlocks mastery." });
        }
      }).catch(() => {});
    } else {
      triggerBurst("#ff7777");
      setStreak(0);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <div className="mood-label text-white/40 mb-2 flex items-center gap-3">
          <span>Adaptive Quiz</span>
          {streak > 0 && (
            <span className="font-mono normal-case" style={{ color: config.palette.primary }}>
              · streak {streak}
            </span>
          )}
        </div>
        <h1 className="font-display text-4xl md:text-5xl">Tune the crystal.</h1>
        <p className="text-white/55 mt-2">
          {reviewMode ? "Review queue: bookmarked + previously wrong." : "Difficulty adapts to your recent accuracy."}
        </p>
      </div>

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          data-testid="topic-select"
          disabled={reviewMode}
          className="bg-white/5 rounded-xl px-3 py-2 text-sm border border-white/10 disabled:opacity-40"
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
          {reviewMode ? "Next from queue" : "New question"}
        </button>
        <button
          onClick={() => loadQuestion(true)}
          disabled={reviewMode || (!topic && !hasDocs && topics.length === 0)}
          data-testid="ai-generate-btn"
          className="rounded-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 transition"
          style={{
            background: `linear-gradient(135deg, ${config.palette.primary}30, ${config.palette.secondary}30)`,
            border: `1px solid ${config.palette.primary}50`,
          }}
        >
          <Sparkle size={14} weight="fill" /> AI-generate
        </button>
        <button
          onClick={() => { setReviewQueue([]); setReviewMode(!reviewMode); }}
          data-testid="review-mode-toggle"
          className={`rounded-full px-4 py-2 text-sm border transition ${
            reviewMode ? "border-white/40 bg-white/10" : "border-white/15"
          }`}
        >
          {reviewMode ? "Exit review" : "Review queue"}
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
            <div className="flex items-start justify-between mb-4">
              <div className="mood-label" style={{ color: config.palette.primary }}>
                {q.topic} · Difficulty {q.difficulty}/5
              </div>
              <button
                onClick={toggleBookmark}
                data-testid="bookmark-btn"
                className="text-white/40 hover:text-white transition"
                title={bookmarked ? "Bookmarked" : "Bookmark"}
              >
                <BookmarkSimple
                  size={20}
                  weight={bookmarked ? "fill" : "regular"}
                  color={bookmarked ? config.palette.primary : "currentColor"}
                />
              </button>
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
                className="w-full"
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

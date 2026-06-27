import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash, ArrowsLeftRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

function Card({ card, onReview, onDelete, onAdvance, accent }) {
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);

  const rate = async (n) => {
    setRating(true);
    try {
      await onReview(card.id, n);
      setFlipped(false);
      onAdvance?.(card.id);
    } finally { setRating(false); }
  };

  return (
    <div className="relative preserve-3d" style={{ perspective: 1000 }}>
      <motion.div
        onClick={() => !rating && setFlipped(!flipped)}
        data-testid={`flashcard-${card.id}`}
        className="cursor-pointer relative w-full aspect-[4/3] rounded-2xl preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
      >
        <div
          className="absolute inset-0 backface-hidden glass-strong rounded-2xl p-6 flex flex-col"
          style={{ boxShadow: `inset 0 0 0 1px ${accent}25` }}
        >
          <div className="mood-label text-white/40 mb-3">{card.topic}</div>
          <div className="flex-1 flex items-center justify-center text-center font-display text-2xl">
            {card.front}
          </div>
          <div className="text-xs text-white/35 font-mono flex items-center gap-1.5">
            <ArrowsLeftRight size={12} /> tap to flip
          </div>
        </div>
        <div
          className="absolute inset-0 backface-hidden glass-strong rounded-2xl p-6 flex flex-col"
          style={{ transform: "rotateY(180deg)", boxShadow: `inset 0 0 0 1px ${accent}45` }}
        >
          <div className="mood-label mb-3" style={{ color: accent }}>Answer</div>
          <div className="flex-1 flex items-center justify-center text-center text-lg leading-snug text-white/90">
            {card.back}
          </div>
        </div>
      </motion.div>

      {flipped && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1.5" data-testid={`review-${card.id}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={(e) => { e.stopPropagation(); rate(n); }}
                disabled={rating}
                data-testid={`rate-${card.id}-${n}`}
                className="w-9 h-9 rounded-lg text-xs font-mono border border-white/10 hover:border-white/40 transition disabled:opacity-40"
                style={n === card.confidence ? { background: `${accent}30`, borderColor: `${accent}80` } : {}}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
            className="text-white/40 hover:text-red-300 p-2"
          >
            <Trash size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Flashcards() {
  const { config } = useMood();
  const [cards, setCards] = useState([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topic, setTopic] = useState("General");

  const load = async () => {
    const r = await api.get("/flashcards");
    setCards(r.data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!front || !back) return;
    await api.post("/flashcards", { front, back, topic });
    setFront(""); setBack("");
    load();
  };

  const review = async (id, n) => {
    const r = await api.post("/flashcards/review", { card_id: id, confidence: n });
    const days = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 }[n] || 1;
    toast.success(`Rated ${n}/5`, { description: `Next review in ${days} day${days > 1 ? "s" : ""}.` });
    load();
    return r;
  };

  const advance = (id) => {
    // Scroll to next un-rated card after a brief delay
    setTimeout(() => {
      const cardEls = document.querySelectorAll('[data-testid^="flashcard-"]');
      const idx = Array.from(cardEls).findIndex((el) => el.getAttribute("data-testid") === `flashcard-${id}`);
      const nextEl = cardEls[idx + 1];
      if (nextEl) nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
  };

  const remove = async (id) => {
    await api.delete(`/flashcards/${id}`);
    load();
  };

  const due = cards.filter((c) => !c.next_review || new Date(c.next_review) <= new Date()).length;
  const mastered = cards.filter((c) => c.confidence >= 4).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">Flashcards</div>
        <h1 className="font-display text-4xl md:text-5xl">Etched in memory.</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="mood-label text-white/40 mb-1">Total</div>
          <div className="font-mono text-2xl">{cards.length}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="mood-label text-white/40 mb-1">Due</div>
          <div className="font-mono text-2xl" style={{ color: config.palette.primary }}>{due}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="mood-label text-white/40 mb-1">Mastered</div>
          <div className="font-mono text-2xl text-emerald-300">{mastered}</div>
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-5 space-y-3" data-testid="new-card-form">
        <div className="mood-label text-white/40">New card</div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic"
          data-testid="card-topic"
        />
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Front (question / prompt)"
          data-testid="card-front"
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Back (answer)"
          rows={2}
          data-testid="card-back"
        />
        <button
          onClick={create}
          data-testid="create-card-btn"
          className="rounded-full px-5 py-2.5 text-sm font-medium text-black flex items-center gap-2"
          style={{ background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})` }}
        >
          <Plus weight="bold" size={16} /> Create card
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="flashcards-grid">
        {cards.map((c) => (
          <Card key={c.id} card={c} onReview={review} onDelete={remove} onAdvance={advance} accent={config.palette.primary} />
        ))}
        {cards.length === 0 && (
          <div className="col-span-full text-center text-white/40 py-12 font-mono text-sm">
            CRYSTAL AWAITS · CREATE YOUR FIRST CARD
          </div>
        )}
      </div>
    </div>
  );
}

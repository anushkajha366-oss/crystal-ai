import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function ChatQuiz() {
  const { config } = useMood();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get("/chat/history").then((r) => {
      setMessages(r.data);
      if (r.data.length) setSessionId(r.data[0].session_id);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, _local: true }]);
    setSending(true);
    // placeholder assistant bubble that we'll fill via streaming
    let assistantIdx;
    setMessages((m) => {
      assistantIdx = m.length;
      return [...m, { role: "assistant", content: "", _local: true, _streaming: true }];
    });

    try {
      const r = await api.post("/chat/quiz", { message: text, session_id: sessionId });
      if (!sessionId && r.data.session_id) setSessionId(r.data.session_id);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: r.data.reply, _local: true };
        return copy;
      });
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "The crystal flickered. Try again.", _local: true };
        return copy;
      });
    } finally { setSending(false); }
  };

  const suggestions = [
    "Quiz me on Newton's laws",
    "Test my calculus integration",
    "Ask hard cellular biology questions",
    "Drill me on data structures",
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <div className="mood-label text-white/40 mb-2">AI Chat Quiz</div>
        <h1 className="font-display text-4xl md:text-5xl flex items-center gap-3">
          Speak to Crystal
          <Sparkle weight="fill" color={config.palette.primary} size={26} />
        </h1>
        <p className="text-white/55 mt-2">Socratic dialogue, powered by Gemini.</p>
      </div>

      <div
        ref={scrollRef}
        className="glass-strong rounded-3xl p-6 h-[55vh] overflow-y-auto space-y-3"
        data-testid="chat-history"
      >
        {messages.length === 0 && !sending && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-white/40 mb-6 font-mono text-sm">SEND A MESSAGE TO BEGIN</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  data-testid={`suggestion-${suggestions.indexOf(s)}`}
                  className="text-xs rounded-full px-3 py-1.5 border border-white/10 hover:border-white/30 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "assistant" && !m.content) return null;
          return (
          <motion.div
            key={i}
            initial={m._local ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-white/8 rounded-tr-sm" : "bg-white/[0.02] rounded-tl-sm"
              }`}
              style={
                m.role === "assistant"
                  ? { border: `1px solid ${config.palette.secondary}30` }
                  : {}
              }
            >
              {m.content}
              {m._streaming && (
                <span className="inline-block w-1.5 h-4 ml-1 align-middle animate-pulse" style={{ background: config.palette.primary }} />
              )}
            </div>
          </motion.div>
          );
        })}

        {sending && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm bg-white/[0.02] border border-white/10 font-mono text-white/40">
              crystal thinking…
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-end">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Ask Crystal anything…"
          data-testid="chat-input"
          className="flex-1 resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          data-testid="chat-send"
          className="rounded-full w-12 h-12 flex items-center justify-center disabled:opacity-40 transition"
          style={{
            background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})`,
            boxShadow: `0 0 18px ${config.palette.primary}40`,
            color: "#0a0524",
          }}
        >
          <PaperPlaneTilt weight="fill" size={18} />
        </button>
      </div>
    </div>
  );
}

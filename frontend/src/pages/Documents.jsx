import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadSimple, FileText, Sparkle, Trash, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, API } from "@/lib/api";
import { useMood } from "@/contexts/MoodContext";

export default function Documents() {
  const { config, triggerBurst } = useMood();
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const r = await api.get("/documents");
    setDocs(r.data);
  };
  useEffect(() => { load(); }, []);

  const onPick = () => fileRef.current?.click();

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/documents/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await r.json();
      toast.success(`Uploaded ${data.filename}`, { description: `${data.char_count.toLocaleString()} chars extracted. Processing next…` });
      await load();
      // auto-process
      await process(data.doc_id);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const process = async (docId) => {
    setProcessingId(docId);
    try {
      const r = await api.post(`/documents/${docId}/process`);
      toast.success("Document processed", {
        description: `${r.data.questions_generated} questions, ${r.data.flashcards_generated} flashcards, ${r.data.topics.length} topics extracted.`,
      });
      triggerBurst(config.palette.primary);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Processing failed");
    } finally { setProcessingId(null); }
  };

  const remove = async (docId) => {
    await api.delete(`/documents/${docId}`);
    toast("Document removed");
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mood-label text-white/40 mb-2">Source material</div>
        <h1 className="font-display text-4xl md:text-5xl">Feed the crystal.</h1>
        <p className="text-white/55 mt-2 max-w-2xl">
          Upload a PDF, DOCX, or TXT. Crystal extracts topics, generates quizzes &amp; flashcards, and weights them for the 20-80 dashboard — all from your own material.
        </p>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onUpload} className="hidden" data-testid="file-input" />
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onPick}
        disabled={uploading}
        data-testid="upload-btn"
        className="w-full glass-strong rounded-3xl p-10 flex flex-col items-center justify-center gap-3 transition-all disabled:opacity-60"
        style={{
          border: `1.5px dashed ${config.palette.primary}50`,
          boxShadow: `inset 0 0 32px ${config.palette.primary}10`,
        }}
      >
        {uploading ? (
          <CircleNotch size={36} className="animate-spin" color={config.palette.primary} />
        ) : (
          <UploadSimple size={36} color={config.palette.primary} weight="duotone" />
        )}
        <div className="font-display text-xl">
          {uploading ? "Uploading…" : "Drop a study document"}
        </div>
        <div className="text-xs text-white/40 font-mono">PDF · DOCX · TXT · max 8 MB</div>
      </motion.button>

      <div className="space-y-3" data-testid="documents-list">
        {docs.length === 0 && !uploading && (
          <div className="text-center text-white/40 py-8 font-mono text-sm">
            NO DOCUMENTS YET · UPLOAD ONE TO PERSONALIZE EVERYTHING
          </div>
        )}
        {docs.map((d) => (
          <div key={d.doc_id} className="glass rounded-2xl p-5" data-testid={`doc-${d.doc_id}`}>
            <div className="flex items-start gap-4">
              <FileText size={28} color={config.palette.primary} weight="duotone" />
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg truncate">{d.filename}</div>
                <div className="text-xs text-white/40 font-mono mt-0.5">
                  {(d.size / 1024).toFixed(1)} KB · {d.char_count?.toLocaleString() || 0} chars
                  {d.status === "processed" && (
                    <span className="ml-2 text-emerald-300">
                      · {d.question_count || 0} Qs · {d.flashcard_count || 0} cards
                    </span>
                  )}
                </div>
                {d.topics?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {d.topics.map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] rounded-full px-2.5 py-0.5 font-mono"
                        style={{
                          background: `${config.palette.primary}15`,
                          border: `1px solid ${config.palette.primary}30`,
                          color: "#fff",
                        }}
                      >
                        {t.name} <span className="text-white/40">· {t.weight}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {d.status === "processed" ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-mono">
                    <CheckCircle size={14} weight="fill" /> READY
                  </div>
                ) : (
                  <button
                    onClick={() => process(d.doc_id)}
                    disabled={processingId === d.doc_id}
                    data-testid={`process-${d.doc_id}`}
                    className="rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 text-black"
                    style={{
                      background: `linear-gradient(135deg, ${config.palette.primary}, ${config.palette.secondary})`,
                    }}
                  >
                    {processingId === d.doc_id ? (
                      <><CircleNotch size={12} className="animate-spin" /> Processing</>
                    ) : (
                      <><Sparkle size={12} weight="fill" /> Process</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => remove(d.doc_id)}
                  data-testid={`delete-${d.doc_id}`}
                  className="text-white/40 hover:text-red-300 p-1.5"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

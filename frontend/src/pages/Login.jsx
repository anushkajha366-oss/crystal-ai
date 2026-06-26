import React from "react";
import { FcGoogle } from "react-icons/fc";
import { motion } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react";

export default function Login() {
  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-strong rounded-3xl p-10 md:p-14 max-w-md w-full text-center relative overflow-hidden"
        style={{ boxShadow: "0 0 64px rgba(43, 240, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)" }}
      >
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #2bf0ff, transparent)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #7a3cff, transparent)" }}
        />

        <div className="relative">
          <div className="mood-label text-white/40 mb-4">Crystal · AI</div>
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "conic-gradient(from 45deg, #2bf0ff, #7a3cff, #e8a0d8, #2bf0ff)",
                boxShadow: "0 0 32px rgba(43,240,255,0.5)",
              }}
            >
              <Sparkle size={28} weight="fill" color="#0a0524" />
            </div>
          </div>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-3">
            Light refracts<br />through clarity
          </h1>
          <p className="text-white/60 text-sm mb-10 leading-relaxed">
            Intelligent exam prep with adaptive AI, immersive 3D, and four learning moods.
          </p>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            data-testid="google-login-btn"
            className="w-full flex items-center justify-center gap-3 rounded-full bg-white text-black font-medium py-3.5 px-6 transition"
            style={{ boxShadow: "0 0 24px rgba(255,255,255,0.18)" }}
          >
            <FcGoogle size={22} />
            <span>Continue with Google</span>
          </motion.button>

          <div className="mt-8 mood-label text-white/30">
            Premium · Private · Adaptive
          </div>
        </div>
      </motion.div>
    </div>
  );
}

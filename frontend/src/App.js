import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "@/App.css";
import { Toaster } from "sonner";

import { MoodProvider } from "@/contexts/MoodContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import CrystalTunnel from "@/components/CrystalTunnel";
import AppShell from "@/components/AppShell";
import AuthCallback from "@/components/AuthCallback";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import Quiz from "@/pages/Quiz";
import Flashcards from "@/pages/Flashcards";
import ChatQuiz from "@/pages/ChatQuiz";
import PYQ from "@/pages/PYQ";
import Analytics from "@/pages/Analytics";
import Rule2080 from "@/pages/Rule2080";

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50 font-mono text-sm tracking-widest">
        TUNING CRYSTAL…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return (
    <AppShell />
  );
}

function AppRouter() {
  const location = useLocation();
  // CRITICAL: process session_id synchronously before normal routes
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/chat" element={<ChatQuiz />} />
        <Route path="/pyq" element={<PYQ />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/rule2080" element={<Rule2080 />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MoodProvider>
      <AuthProvider>
        <CrystalTunnel />
        <BrowserRouter>
          <AppRouter />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(24,10,58,0.9)",
                color: "#fff",
                border: "1px solid rgba(43,240,255,0.3)",
                backdropFilter: "blur(20px)",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </MoodProvider>
  );
}

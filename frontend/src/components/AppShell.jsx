import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  House, Target, Cards, ChatCircleText, ChartBar, ListNumbers,
  Sparkle, SignOut, List as ListIcon, X
} from "@phosphor-icons/react";
import MoodSelector from "@/components/MoodSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useMood } from "@/contexts/MoodContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: House, key: "dashboard" },
  { to: "/quiz", label: "Adaptive Quiz", icon: Target, key: "quiz" },
  { to: "/flashcards", label: "Flashcards", icon: Cards, key: "flashcards" },
  { to: "/chat", label: "AI Chat Quiz", icon: ChatCircleText, key: "chat" },
  { to: "/pyq", label: "PYQ Analyzer", icon: ListNumbers, key: "pyq" },
  { to: "/analytics", label: "Analytics", icon: ChartBar, key: "analytics" },
  { to: "/rule2080", label: "20-80 Rule", icon: Sparkle, key: "rule2080" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { config } = useMood();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white relative">
      {/* Header */}
      <header
        data-testid="app-header"
        className="fixed top-0 inset-x-0 z-40 glass-strong"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 px-4 md:px-8 h-16">
          <button
            data-testid="sidebar-toggle"
            className="md:hidden text-white/80 p-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X size={20} /> : <ListIcon size={20} />}
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            data-testid="logo-btn"
            className="flex items-center gap-2.5 group"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: `conic-gradient(from 45deg, ${config.palette.primary}, ${config.palette.secondary}, ${config.palette.primary})`,
                boxShadow: `0 0 18px ${config.palette.primary}50`,
              }}
            >
              <Sparkle size={16} weight="fill" color="#0a0524" />
            </div>
            <div className="font-display text-lg tracking-tight">
              Crystal<span className="text-white/40">.AI</span>
            </div>
          </button>

          <div className="flex-1" />

          <div className="hidden md:block">
            <MoodSelector />
          </div>

          {user && (
            <div className="flex items-center gap-3 ml-4">
              <div className="hidden lg:flex flex-col items-end">
                <div className="text-xs text-white/50 font-mono">{user.email}</div>
                <div className="text-sm text-white">{user.name}</div>
              </div>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-9 h-9 rounded-full border border-white/15"
                  data-testid="user-avatar"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm">
                  {user.name?.[0]}
                </div>
              )}
              <button
                onClick={logout}
                data-testid="logout-btn"
                className="text-white/60 hover:text-white p-2 transition"
                title="Sign out"
              >
                <SignOut size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="md:hidden px-4 pb-3">
          <MoodSelector compact />
        </div>
      </header>

      {/* Sidebar */}
      <aside
        data-testid="app-sidebar"
        className={`fixed left-0 top-16 bottom-0 z-30 w-60 glass-strong transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        <nav className="p-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.key}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-white/8 text-white border border-white/10"
                    : "text-white/55 hover:text-white hover:bg-white/5 border border-transparent"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { boxShadow: `inset 0 0 0 1px ${config.palette.primary}30, 0 0 14px ${config.palette.primary}15` }
                  : {}
              }
            >
              <item.icon size={18} weight="duotone" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-3">
          <div className="mood-label text-white/40 mb-1">Current Mode</div>
          <div className="font-display text-lg" style={{ color: config.palette.primary }}>
            {config.label}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="pt-16 md:pl-60 min-h-screen relative z-10">
        <motion.div
          key={window.location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-6 md:p-10 max-w-7xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}

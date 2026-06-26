# Crystal AI — Product Requirements & Status

## Problem statement
A premium AI-powered exam prep platform that pairs adaptive learning with an immersive 3D crystal tunnel hero. Four learning moods (Deep / Review / Grind / Drained) reshape colors, pacing, particle density and bloom across the entire experience. Core metaphor: "Light refracting through a crystal — clarity, precision, and beauty emerging from complexity."

## Stack (actual)
- React 19 + Tailwind + Framer Motion + Three.js (custom shader tunnel)
- FastAPI + MongoDB + Motor
- Gemini 3 Flash via Emergent Universal LLM key
- Emergent-managed Google OAuth

## User personas
- Exam aspirant (JEE / NEET / GATE) wanting smart prep
- Visual-learner who responds to ambient feedback (crystal glow ≈ confidence)
- Self-paced student who switches mental modes (deep focus vs grind sessions)

## Core requirements (static)
1. Adaptive quizzing with difficulty adjusting on recent accuracy
2. Flashcards with spaced repetition
3. AI chatbot quiz (Gemini-powered Socratic dialogue)
4. PYQ analyzer with frequency heatmap
5. 20-80 rule dashboard
6. Confidence scoring on every answer (1-5)
7. Performance analytics (trend + topic breakdown)
8. Mood-based personalization (4 modes mutating crystal + UI)
9. Three.js wormhole tunnel as global background
10. Emergent Google OAuth login

## Implemented (2026-02)
- Three.js crystal tunnel (custom shader, additive points, 300 drifting motes, mouse banking, scroll-driven depth, mood-driven color/bloom)
- Mood context shared globally between React UI and tunnel uniforms
- Glassmorphism design system with Syne / Outfit / JetBrains Mono
- Login screen with Emergent Google OAuth, AuthCallback session exchange, cookie + Bearer support
- Protected app shell: header (logo, mood selector, user menu, logout) + collapsible sidebar
- Dashboard: stats, quick actions, focus zones
- Adaptive Quiz: topic filter, AI-generate via Gemini, confidence slider, correctness explanation, score
- Flashcards: create/review/delete, 3D card flip, spaced repetition (1/2/4/7/14 days)
- AI Chat Quiz: Gemini Socratic chat with persistent history, suggestion chips, fallback model
- PYQ Analyzer: exam/year filter, frequency heatmap cards
- Analytics: line trend + horizontal bar topic accuracy + weak/strong topics (Recharts)
- 20-80 Rule: ranked topics, cumulative %, high-impact flag, focus-mode CTA
- 15 seeded questions across Physics / Math / CS / Chem / Bio
- All endpoints protected with cookie or Bearer auth

## Backlog (P0/P1/P2)
- P1: Streaming chat responses (SSE) so Gemini tokens render live
- P1: Voice input (mic icon currently visual) for chat quiz
- P1: Question bookmarks & review queue
- P2: Study streaks & milestone badges
- P2: Multiplayer / shared quiz rooms via realtime
- P2: Topic-aware AI explanations after wrong answers
- P2: Onboarding tutorial overlay introducing crystal + moods

## Next actions
- Wire crystal "burst" particle effect on correct answers
- Add real toast notifications on milestones
- Hook bookmark/star button into Quiz page

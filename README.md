# Crystal AI

An exam prep platform I'm building to actually look and feel premium — not another generic SaaS dashboard with a chatbot bolted on.

The whole thing is built around one idea: **light refracting through a crystal**. Clarity and precision emerging out of complexity. That's the vibe I want both the visuals and the studying experience to have — dark, a little luxe, no default blue/purple gradient nonsense.

It's part real study tool, part portfolio piece, so I'm not cutting corners on polish just to ship faster.

> **Where it's at:** First pass came out of Emergent Agent, and I'm now going through it feature by feature, fixing what's broken and rebuilding the parts that don't feel right yet. See the roadmap below for the honest state of things.

---

## What it does (or will do)

| Feature | What it is |
|---|---|
| **Adaptive Quizzing** | Serves questions by topic/difficulty, tracks how you're doing over time |
| **Flashcards** | Spaced-repetition cards you rate your confidence on as you review |
| **AI Chatbot Quiz** | An AI that quizzes you conversationally and answers your questions back |
| **PYQ Analyzer** | Upload past exam papers, get a read on patterns and which topics show up most |
| **20-80 Rule** | Surfaces the ~20% of topics that'll probably get you ~80% of the marks |
| **Confidence Scoring** | Rate how sure you are on each question/card, feeds into your analytics |
| **Performance Analytics** | Trends, streaks, the usual "how am I actually doing" dashboard |
| **Mood-Based Personalization** | Four modes — **Deep, Review, Grind, Drained** — that change the whole feel of the app depending on how you're showing up that day |

The centerpiece is a Three.js crystal tunnel scene (`CrystalTunnel.jsx`) — particles, mouse/scroll interaction, the works — that's meant to tie the mood system into something you actually see and feel, not just a toggle in a corner.

---

## Built with

**Frontend**
- React 19 + CRACO
- Tailwind + shadcn/ui (Radix underneath)
- Three.js for the crystal scene
- Framer Motion
- React Router, TanStack Query, Recharts

**Backend**
- FastAPI
- MongoDB via Motor
- Cookie-based sessions through Emergent's OAuth exchange
- `emergentintegrations` for the LLM chat (Gemini Flash), `pypdf`/`python-docx` for parsing uploaded documents

**Where it'll live**
- Vercel for the frontend
- Supabase, eventually, alongside or instead of Mongo

---

## Poking around the repo

```
crystal-ai/
├── backend/
│   ├── server.py           # auth, quiz, flashcards, chat, analytics, PYQ, documents — it's all in here
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CrystalTunnel.jsx   # the Three.js hero scene
│   │   │   ├── MoodSelector.jsx    # Deep / Review / Grind / Drained toggle
│   │   │   ├── AppShell.jsx
│   │   │   └── ui/                 # shadcn components
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── MoodContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Quiz.jsx
│   │   │   ├── Flashcards.jsx
│   │   │   ├── ChatQuiz.jsx
│   │   │   ├── PYQ.jsx
│   │   │   ├── Rule2080.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Documents.jsx
│   │   └── lib/api.js       # axios client, reads REACT_APP_BACKEND_URL
│   └── package.json
├── design_guidelines.json   # design tokens — palette, type scale, spacing
├── memory/PRD.md            # product requirements doc
└── test_reports/            # test logs from the Emergent iterations
```

---

## Running it locally

### You'll need
- Node 18+ and Yarn
- Python 3.10+
- A MongoDB instance somewhere (local's fine, Atlas works too)

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Drop a `.env` in `backend/`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=crystal_ai
EMERGENT_LLM_KEY=your_llm_key_here
CORS_ORIGINS=http://localhost:3000
```

Then:

```bash
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
yarn install
```

Drop a `.env` in `frontend/`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Then:

```bash
yarn start
```

Frontend talks to the backend under `/api` — see `lib/api.js` if you're curious how.

---

## The look I'm going for

- **Palette:** black base, silver, rose gold, emerald. No blue/purple galaxy gradients — that's the one thing I'm firm on.
- **Type:** `Syne` for headlines, `Outfit` for body text, `JetBrains Mono` for anything data-ish.
- **The tunnel:** a crystal refracting light, rendered in Three.js with bloom and particles — this is the visual anchor for the whole app.
- **Mood system:** whatever mood you're in should actually change how the app *feels* — color, pacing, tone — not just swap an icon.

One honest caveat: `design_guidelines.json` in the repo right now still has the old blue/purple palette from the Emergent build. Haven't replaced it yet. It's on the list below, not a mistake.

---

## Roadmap (a.k.a. what's actually broken right now)

**🔴 Fix first**
- [ ] AI chat doesn't work yet
- [ ] Quiz "Generate" button does nothing
- [ ] Flashcard confidence buttons (1–5) don't do anything

**🎨 Design pass**
- [ ] Swap in the real palette (black/silver/rose gold/emerald)
- [ ] Actually build the Three.js crystal tunnel with mood-driven theming
- [ ] Make the mood selector do something to the UI, not just sit there
- [ ] Analytics pages need to not look bland

**🧠 Feature logic still missing**
- [ ] "Bomb session" flow for uploaded PDFs
- [ ] Confidence meter pop-up
- [ ] Flashcard count selector
- [ ] Proper PYQ Analyzer upload flow with syllabus input
- [ ] 20-80 Focus Mode with actual priority ordering
- [ ] Manual flashcard creation (parking this for post-v1)

---

## License

Copyright © 2026 Anushka Jha.

All rights reserved.

Haven't decided yet.

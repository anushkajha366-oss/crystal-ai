from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, Header, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from pypdf import PdfReader
from docx import Document as DocxDocument
import io
import json as jsonlib
import re as relib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Crystal AI API")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    difficulty: int = 1  # 1-5
    source: str = "seed"  # seed | ai


class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    question_id: str
    topic: str
    correct: bool
    confidence: int  # 1-5
    time_ms: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Flashcard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    front: str
    back: str
    topic: str
    confidence: int = 1  # 1-5
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------- Auth Helpers ----------
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ---------- Auth Routes ----------
class SessionBody(BaseModel):
    session_id: str


@api_router.post("/auth/session")
async def auth_session(body: SessionBody, response: Response):
    """Exchange Emergent session_id for our session_token cookie."""
    async with httpx.AsyncClient(timeout=10) as hx:
        r = await hx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()

    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@api_router.get("/auth/me")
async def auth_me(request: Request, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    return user.model_dump()


@api_router.post("/auth/logout")
async def auth_logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Seed Questions ----------
SEED_QUESTIONS = [
    {"topic": "Physics - Electromagnetism", "question": "What is the SI unit of magnetic flux?", "options": ["Tesla", "Weber", "Henry", "Gauss"], "correct_index": 1, "explanation": "Weber (Wb) is the SI unit of magnetic flux. Tesla is the unit of magnetic flux density.", "difficulty": 2},
    {"topic": "Physics - Electromagnetism", "question": "Lenz's law is a consequence of conservation of:", "options": ["Charge", "Mass", "Energy", "Momentum"], "correct_index": 2, "explanation": "Lenz's law follows from conservation of energy — induced current opposes the change causing it.", "difficulty": 3},
    {"topic": "Physics - Mechanics", "question": "A body in uniform circular motion has constant:", "options": ["Velocity", "Acceleration", "Speed", "Force"], "correct_index": 2, "explanation": "Speed is constant; velocity and acceleration change direction continuously.", "difficulty": 1},
    {"topic": "Physics - Optics", "question": "Total internal reflection occurs when light moves:", "options": ["Denser to rarer medium beyond critical angle", "Rarer to denser medium", "Through vacuum", "Through identical media"], "correct_index": 0, "explanation": "TIR requires light moving denser→rarer at angle greater than critical angle.", "difficulty": 2},
    {"topic": "Math - Calculus", "question": "Derivative of sin(x²) with respect to x is:", "options": ["cos(x²)", "2x·cos(x²)", "2x·sin(x²)", "-cos(x²)"], "correct_index": 1, "explanation": "Chain rule: d/dx[sin(u)] = cos(u)·du/dx where u = x².", "difficulty": 2},
    {"topic": "Math - Calculus", "question": "∫(1/x) dx equals:", "options": ["x + C", "ln|x| + C", "-1/x² + C", "1/x² + C"], "correct_index": 1, "explanation": "The antiderivative of 1/x is ln|x| + C.", "difficulty": 1},
    {"topic": "Math - Algebra", "question": "If x² - 5x + 6 = 0, the roots are:", "options": ["1, 6", "2, 3", "-2, -3", "1, -6"], "correct_index": 1, "explanation": "Factoring: (x-2)(x-3) = 0, so x = 2 or 3.", "difficulty": 1},
    {"topic": "CS - Data Structures", "question": "Time complexity of binary search on a sorted array:", "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"], "correct_index": 1, "explanation": "Binary search halves the search space each step → O(log n).", "difficulty": 1},
    {"topic": "CS - Data Structures", "question": "Which structure uses LIFO order?", "options": ["Queue", "Stack", "Heap", "Tree"], "correct_index": 1, "explanation": "Stacks use Last-In-First-Out ordering.", "difficulty": 1},
    {"topic": "CS - Algorithms", "question": "Worst case of quicksort is:", "options": ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], "correct_index": 2, "explanation": "Worst case occurs with a poor pivot choice on sorted input → O(n²).", "difficulty": 2},
    {"topic": "Chemistry - Periodic Table", "question": "Element with atomic number 6 is:", "options": ["Nitrogen", "Carbon", "Oxygen", "Boron"], "correct_index": 1, "explanation": "Carbon has atomic number 6.", "difficulty": 1},
    {"topic": "Chemistry - Periodic Table", "question": "Which is a noble gas?", "options": ["Chlorine", "Argon", "Sodium", "Iron"], "correct_index": 1, "explanation": "Argon (Group 18) is a noble gas.", "difficulty": 1},
    {"topic": "Biology - Cell", "question": "Powerhouse of the cell is:", "options": ["Nucleus", "Mitochondrion", "Ribosome", "Lysosome"], "correct_index": 1, "explanation": "Mitochondria produce ATP — the cell's energy currency.", "difficulty": 1},
    {"topic": "Biology - Genetics", "question": "DNA replication is:", "options": ["Conservative", "Semi-conservative", "Dispersive", "Random"], "correct_index": 1, "explanation": "Meselson-Stahl experiment proved DNA replication is semi-conservative.", "difficulty": 2},
    {"topic": "Physics - Modern", "question": "Photoelectric effect was explained by:", "options": ["Newton", "Einstein", "Bohr", "Rutherford"], "correct_index": 1, "explanation": "Einstein's 1905 paper on light quanta explained the photoelectric effect.", "difficulty": 2},
]


@app.on_event("startup")
async def seed_db():
    count = await db.questions.count_documents({})
    if count == 0:
        docs = []
        for q in SEED_QUESTIONS:
            qobj = QuizQuestion(**q)
            docs.append(qobj.model_dump())
        await db.questions.insert_many(docs)
        logger.info(f"Seeded {len(docs)} questions")


# ---------- Quiz Routes ----------
@api_router.get("/quiz/topics")
async def list_topics():
    pipeline = [
        {"$group": {"_id": "$topic", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    topics = []
    async for doc in db.questions.aggregate(pipeline):
        topics.append({"topic": doc["_id"], "count": doc["count"]})
    return topics


@api_router.get("/quiz/next")
async def next_question(
    request: Request,
    topic: Optional[str] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    # Adaptive: pick difficulty based on user's recent accuracy
    recent = await db.attempts.find({"user_id": user.user_id}).sort("created_at", -1).limit(10).to_list(10)
    if recent:
        correct = sum(1 for r in recent if r.get("correct"))
        ratio = correct / len(recent)
        if ratio > 0.75:
            target_diff = [3, 4, 5]
        elif ratio < 0.4:
            target_diff = [1, 2]
        else:
            target_diff = [2, 3]
    else:
        target_diff = [1, 2, 3]

    query: Dict[str, Any] = {"difficulty": {"$in": target_diff}}
    if topic:
        query["topic"] = topic
    # Prefer questions sourced from user's own documents
    user_doc_ids = await db.documents.distinct("doc_id", {"user_id": user.user_id, "status": "processed"})
    if user_doc_ids:
        doc_sources = [f"doc:{d}" for d in user_doc_ids]
        doc_query = {**query, "source": {"$in": doc_sources}}
        docs = await db.questions.find(doc_query, {"_id": 0}).to_list(200)
        if not docs:
            docs = await db.questions.find({"source": {"$in": doc_sources}}, {"_id": 0}).to_list(200)
    else:
        docs = await db.questions.find(query, {"_id": 0}).to_list(200)
    if not docs:
        docs = await db.questions.find({}, {"_id": 0}).to_list(200)
    if not docs:
        raise HTTPException(404, "No questions available")
    q = random.choice(docs)
    # Don't reveal correct_index to client until they answer
    return {
        "id": q["id"],
        "topic": q["topic"],
        "question": q["question"],
        "options": q["options"],
        "difficulty": q["difficulty"],
    }


class AnswerBody(BaseModel):
    question_id: str
    selected_index: int
    confidence: int = 3
    time_ms: int = 0


@api_router.post("/quiz/answer")
async def submit_answer(
    body: AnswerBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    q = await db.questions.find_one({"id": body.question_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Question not found")
    correct = body.selected_index == q["correct_index"]
    attempt = QuizAttempt(
        user_id=user.user_id,
        question_id=body.question_id,
        topic=q["topic"],
        correct=correct,
        confidence=body.confidence,
        time_ms=body.time_ms,
    )
    doc = attempt.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.attempts.insert_one(doc)
    return {
        "correct": correct,
        "correct_index": q["correct_index"],
        "explanation": q["explanation"],
    }


@api_router.post("/quiz/generate")
async def ai_generate(
    request: Request,
    body: Dict[str, Any],
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Generate a fresh question via Gemini for a given topic."""
    user = await get_current_user(request, session_token, authorization)
    topic = body.get("topic", "General Knowledge")
    difficulty = int(body.get("difficulty", 2))

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"genq-{user.user_id}",
        system_message=(
            "You are an exam question generator. Output ONLY valid JSON with keys: "
            "question (string), options (array of 4 strings), correct_index (0-3), "
            "explanation (string). No markdown, no extra text."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    prompt = f"Generate one multiple choice question on '{topic}' at difficulty {difficulty}/5."
    msg = UserMessage(text=prompt)
    raw = await chat.send_message(msg)

    import json, re
    text = raw if isinstance(raw, str) else str(raw)
    text = re.sub(r"^```json|```$", "", text.strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise HTTPException(500, "AI generation failed")
    try:
        parsed = json.loads(m.group(0))
    except Exception as e:
        raise HTTPException(500, f"AI parse failed: {e}")

    qobj = QuizQuestion(
        topic=topic,
        question=parsed["question"],
        options=parsed["options"][:4],
        correct_index=int(parsed["correct_index"]),
        explanation=parsed.get("explanation", ""),
        difficulty=difficulty,
        source="ai",
    )
    await db.questions.insert_one(qobj.model_dump())
    return {
        "id": qobj.id,
        "topic": qobj.topic,
        "question": qobj.question,
        "options": qobj.options,
        "difficulty": qobj.difficulty,
    }


# ---------- Flashcards ----------
class FlashcardCreate(BaseModel):
    front: str
    back: str
    topic: str = "General"


@api_router.get("/flashcards")
async def list_flashcards(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    docs = await db.flashcards.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    return docs


@api_router.post("/flashcards")
async def create_flashcard(
    body: FlashcardCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    card = Flashcard(user_id=user.user_id, front=body.front, back=body.back, topic=body.topic)
    doc = card.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.flashcards.insert_one(doc)
    doc.pop("_id", None)
    return doc


class FlashcardReview(BaseModel):
    card_id: str
    confidence: int  # 1-5


@api_router.post("/flashcards/review")
async def review_flashcard(
    body: FlashcardReview,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    # spaced repetition: next_review = now + days based on confidence
    days = {1: 1, 2: 2, 3: 4, 4: 7, 5: 14}.get(body.confidence, 1)
    now = datetime.now(timezone.utc)
    next_review = now + timedelta(days=days)
    await db.flashcards.update_one(
        {"id": body.card_id, "user_id": user.user_id},
        {"$set": {
            "confidence": body.confidence,
            "last_reviewed": now.isoformat(),
            "next_review": next_review.isoformat(),
        }},
    )
    return {"ok": True, "next_review": next_review.isoformat()}


@api_router.delete("/flashcards/{card_id}")
async def delete_flashcard(
    card_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    await db.flashcards.delete_one({"id": card_id, "user_id": user.user_id})
    return {"ok": True}


# ---------- AI Chat ----------
class ChatBody(BaseModel):
    message: str
    session_id: Optional[str] = None


@api_router.post("/chat/quiz")
async def chat_quiz(
    body: ChatBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    sid = body.session_id or f"chat-{user.user_id}-{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=sid,
        system_message=(
            "You are Crystal, an AI exam tutor. Engage learners in a Socratic quiz. "
            "Ask one focused question at a time, give concise explanations after they answer, "
            "and progressively raise the difficulty. Keep replies under 120 words. "
            "Use plain language. Never use markdown headers."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        logger.error(f"chat send failed: {e}")
        # fallback to gemini-2.5-flash
        chat2 = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{sid}-fallback",
            system_message="You are Crystal, an AI exam tutor. Ask one focused question at a time. Keep replies under 120 words.",
        ).with_model("gemini", "gemini-2.5-flash")
        reply = await chat2.send_message(UserMessage(text=body.message))
    # persist
    await db.chat_messages.insert_one({
        "user_id": user.user_id,
        "session_id": sid,
        "role": "user",
        "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.chat_messages.insert_one({
        "user_id": user.user_id,
        "session_id": sid,
        "role": "assistant",
        "content": reply if isinstance(reply, str) else str(reply),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"reply": reply if isinstance(reply, str) else str(reply), "session_id": sid}


@api_router.get("/chat/history")
async def chat_history(
    request: Request,
    session_id: Optional[str] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    query: Dict[str, Any] = {"user_id": user.user_id}
    if session_id:
        query["session_id"] = session_id
    docs = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


# ---------- Analytics ----------
@api_router.get("/analytics/summary")
async def analytics_summary(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    attempts = await db.attempts.find({"user_id": user.user_id}, {"_id": 0}).to_list(5000)
    total = len(attempts)
    correct = sum(1 for a in attempts if a.get("correct"))
    avg_conf = round(sum(a.get("confidence", 3) for a in attempts) / total, 2) if total else 0
    topics_set = set(a["topic"] for a in attempts)

    # accuracy by topic
    by_topic: Dict[str, Dict[str, int]] = {}
    for a in attempts:
        t = a["topic"]
        by_topic.setdefault(t, {"correct": 0, "total": 0})
        by_topic[t]["total"] += 1
        if a.get("correct"):
            by_topic[t]["correct"] += 1
    topic_accuracy = [
        {
            "topic": t,
            "accuracy": round(v["correct"] / v["total"] * 100, 1),
            "attempts": v["total"],
        }
        for t, v in by_topic.items()
    ]
    topic_accuracy.sort(key=lambda x: x["accuracy"])

    # confidence/correctness daily
    return {
        "total_attempts": total,
        "correct": correct,
        "accuracy": round(correct / total * 100, 1) if total else 0,
        "avg_confidence": avg_conf,
        "topics_touched": len(topics_set),
        "topic_accuracy": topic_accuracy,
        "weak_topics": topic_accuracy[:3],
        "strong_topics": list(reversed(topic_accuracy[-3:])),
    }


@api_router.get("/analytics/trend")
async def analytics_trend(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    attempts = await db.attempts.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    # group by day
    by_day: Dict[str, Dict[str, int]] = {}
    for a in attempts:
        ts = a.get("created_at")
        if isinstance(ts, str):
            day = ts[:10]
        else:
            day = ts.isoformat()[:10]
        by_day.setdefault(day, {"correct": 0, "total": 0, "conf_sum": 0})
        by_day[day]["total"] += 1
        if a.get("correct"):
            by_day[day]["correct"] += 1
        by_day[day]["conf_sum"] += a.get("confidence", 3)
    series = [
        {
            "day": d,
            "accuracy": round(v["correct"] / v["total"] * 100, 1),
            "attempts": v["total"],
            "avg_conf": round(v["conf_sum"] / v["total"], 2),
        }
        for d, v in sorted(by_day.items())
    ]
    return series


# ---------- PYQ / 20-80 ----------
PYQ_DATA = [
    {"exam": "JEE", "year": 2023, "topic": "Physics - Electromagnetism", "frequency": 8, "weight": 12},
    {"exam": "JEE", "year": 2022, "topic": "Physics - Electromagnetism", "frequency": 7, "weight": 11},
    {"exam": "JEE", "year": 2023, "topic": "Math - Calculus", "frequency": 9, "weight": 14},
    {"exam": "JEE", "year": 2022, "topic": "Math - Calculus", "frequency": 8, "weight": 13},
    {"exam": "JEE", "year": 2023, "topic": "Chemistry - Periodic Table", "frequency": 4, "weight": 6},
    {"exam": "JEE", "year": 2023, "topic": "Physics - Mechanics", "frequency": 6, "weight": 9},
    {"exam": "JEE", "year": 2023, "topic": "Physics - Optics", "frequency": 3, "weight": 4},
    {"exam": "JEE", "year": 2023, "topic": "Math - Algebra", "frequency": 5, "weight": 7},
    {"exam": "JEE", "year": 2023, "topic": "Physics - Modern", "frequency": 4, "weight": 6},
    {"exam": "NEET", "year": 2023, "topic": "Biology - Cell", "frequency": 7, "weight": 10},
    {"exam": "NEET", "year": 2023, "topic": "Biology - Genetics", "frequency": 8, "weight": 12},
    {"exam": "NEET", "year": 2023, "topic": "Chemistry - Periodic Table", "frequency": 5, "weight": 7},
    {"exam": "GATE-CS", "year": 2023, "topic": "CS - Data Structures", "frequency": 9, "weight": 14},
    {"exam": "GATE-CS", "year": 2023, "topic": "CS - Algorithms", "frequency": 8, "weight": 12},
]


@api_router.get("/pyq")
async def pyq_analyzer(
    request: Request,
    exam: Optional[str] = None,
    year: Optional[int] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    # If user has uploaded documents, return their topic frequencies as PYQ-style data
    try:
        user = await get_current_user(request, session_token, authorization)
        docs = await _user_doc_topics(user.user_id)
    except HTTPException:
        docs = []

    if docs:
        rows = []
        for d in docs:
            for t in d.get("topics", []):
                rows.append({
                    "exam": d.get("filename", "Document")[:40],
                    "year": "—",
                    "topic": t["name"],
                    "frequency": max(1, round(t.get("weight", 0) / 10)),
                    "weight": t.get("weight", 0),
                })
        return rows

    rows = PYQ_DATA
    if exam:
        rows = [r for r in rows if r["exam"] == exam]
    if year:
        rows = [r for r in rows if r["year"] == year]
    return rows


@api_router.get("/rule2080")
async def rule_20_80(
    request: Request,
    exam: Optional[str] = "JEE",
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    # Prefer user-uploaded document topics if present
    try:
        user = await get_current_user(request, session_token, authorization)
        docs = await _user_doc_topics(user.user_id)
    except HTTPException:
        docs = []

    if docs:
        agg: Dict[str, float] = {}
        for d in docs:
            for t in d.get("topics", []):
                agg[t["name"]] = agg.get(t["name"], 0) + t.get("weight", 0)
        total_weight = sum(agg.values()) or 1
        items = [{"topic": t, "weight": round(w, 1), "share": round(w / total_weight * 100, 1)} for t, w in agg.items()]
    else:
        rows = [r for r in PYQ_DATA if r["exam"] == exam]
        agg2: Dict[str, int] = {}
        for r in rows:
            agg2[r["topic"]] = agg2.get(r["topic"], 0) + r["weight"]
        total_weight = sum(agg2.values()) or 1
        items = [{"topic": t, "weight": w, "share": round(w / total_weight * 100, 1)} for t, w in agg2.items()]

    items.sort(key=lambda x: x["share"], reverse=True)
    cumulative = 0.0
    for it in items:
        cumulative += it["share"]
        it["cumulative"] = round(cumulative, 1)
    cut = max(1, int(len(items) * 0.2))
    for i, it in enumerate(items):
        it["high_impact"] = i < cut or it["cumulative"] <= 80
    return items


# ---------- Documents (PDF/DOCX upload + AI processing) ----------
def extract_text(filename: str, raw: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n\n".join((p.extract_text() or "") for p in reader.pages)
    if name.endswith(".docx"):
        doc = DocxDocument(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)
    if name.endswith(".txt") or name.endswith(".md"):
        return raw.decode("utf-8", errors="ignore")
    raise HTTPException(400, "Unsupported file type. Use PDF, DOCX, TXT, or MD.")


def _strip_json(text: str) -> str:
    text = text.strip()
    text = relib.sub(r"^```(?:json)?", "", text)
    text = relib.sub(r"```$", "", text)
    m = relib.search(r"[\[{].*[\]}]", text, relib.DOTALL)
    return m.group(0) if m else text


@api_router.post("/documents/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "Max file size is 8 MB.")
    text = extract_text(file.filename, raw)
    if not text.strip():
        raise HTTPException(400, "No extractable text in document.")

    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    snippet = text[:16000]  # cap context for LLM
    await db.documents.insert_one({
        "doc_id": doc_id,
        "user_id": user.user_id,
        "filename": file.filename,
        "size": len(raw),
        "text": snippet,
        "char_count": len(text),
        "status": "uploaded",
        "topics": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"doc_id": doc_id, "filename": file.filename, "char_count": len(text), "status": "uploaded"}


@api_router.get("/documents")
async def list_documents(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    docs = await db.documents.find(
        {"user_id": user.user_id}, {"_id": 0, "text": 0}
    ).sort("created_at", -1).to_list(100)
    return docs


@api_router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    await db.documents.delete_one({"doc_id": doc_id, "user_id": user.user_id})
    await db.questions.delete_many({"source": f"doc:{doc_id}"})
    await db.flashcards.delete_many({"doc_id": doc_id})
    return {"ok": True}


@api_router.post("/documents/{doc_id}/process")
async def process_document(
    doc_id: str,
    request: Request,
    count: int = 20,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    doc = await db.documents.find_one({"doc_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    text = doc["text"]
    sid = f"docproc-{doc_id}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=sid,
        system_message=(
            "You analyze study material and produce structured JSON ONLY. "
            "No markdown, no commentary."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    target_count = max(5, min(50, int(count)))
    prompt = f"""From the study material below, produce JSON with this exact shape:
{{
  "topics": [{{"name": "Topic name", "weight": 0-100, "summary": "one sentence"}}],
  "questions": [{{"topic": "Topic name", "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "...", "difficulty": 1-5}}],
  "flashcards": [{{"topic": "Topic name", "front": "concept/question", "back": "definition/answer"}}]
}}

Rules:
- Identify 4-8 distinct topics covered.
- Weight reflects rough relative importance/coverage in the material; weights should sum to ~100.
- Generate {max(8, target_count // 2)} quality MCQ questions across topics with mixed difficulty (1-5).
- Generate EXACTLY {target_count} flashcards covering key facts/definitions.
- Output JSON ONLY.

Material:
\"\"\"
{text[:14000]}
\"\"\"
"""
    raw = await chat.send_message(UserMessage(text=prompt))
    text_resp = raw if isinstance(raw, str) else str(raw)
    try:
        parsed = jsonlib.loads(_strip_json(text_resp))
    except Exception as e:
        raise HTTPException(500, f"AI returned invalid JSON: {e}")

    topics = parsed.get("topics", [])[:8]
    # normalize weights to sum to 100
    total_w = sum(t.get("weight", 0) for t in topics) or 1
    for t in topics:
        t["weight"] = round(t.get("weight", 0) / total_w * 100, 1)
        t["name"] = str(t.get("name", "Untitled"))[:80]

    # save questions
    q_docs = []
    for q in parsed.get("questions", [])[:15]:
        try:
            qobj = QuizQuestion(
                topic=str(q.get("topic", "General")),
                question=str(q["question"]),
                options=[str(o) for o in q["options"]][:4],
                correct_index=int(q["correct_index"]),
                explanation=str(q.get("explanation", "")),
                difficulty=max(1, min(5, int(q.get("difficulty", 2)))),
                source=f"doc:{doc_id}",
            )
            q_docs.append(qobj.model_dump())
        except Exception:
            continue
    if q_docs:
        await db.questions.insert_many(q_docs)

    # save flashcards
    fc_docs = []
    for f in parsed.get("flashcards", [])[:target_count]:
        try:
            card = Flashcard(
                user_id=user.user_id,
                front=str(f["front"]),
                back=str(f["back"]),
                topic=str(f.get("topic", "General")),
            )
            d = card.model_dump()
            d["created_at"] = d["created_at"].isoformat()
            d["doc_id"] = doc_id
            fc_docs.append(d)
        except Exception:
            continue
    if fc_docs:
        await db.flashcards.insert_many(fc_docs)

    await db.documents.update_one(
        {"doc_id": doc_id, "user_id": user.user_id},
        {"$set": {
            "status": "processed",
            "topics": topics,
            "question_count": len(q_docs),
            "flashcard_count": len(fc_docs),
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {
        "doc_id": doc_id,
        "topics": topics,
        "questions_generated": len(q_docs),
        "flashcards_generated": len(fc_docs),
    }


async def _user_doc_topics(user_id: str) -> List[Dict[str, Any]]:
    docs = await db.documents.find(
        {"user_id": user_id, "status": "processed"}, {"_id": 0, "topics": 1, "filename": 1, "doc_id": 1}
    ).to_list(100)
    return docs


# ---------- Bookmarks & Review Queue ----------
class BookmarkBody(BaseModel):
    question_id: str


@api_router.post("/bookmarks")
async def add_bookmark(
    body: BookmarkBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    q = await db.questions.find_one({"id": body.question_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Question not found")
    await db.bookmarks.update_one(
        {"user_id": user.user_id, "question_id": body.question_id},
        {"$set": {
            "user_id": user.user_id,
            "question_id": body.question_id,
            "topic": q["topic"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/bookmarks/{question_id}")
async def remove_bookmark(
    question_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    await db.bookmarks.delete_one({"user_id": user.user_id, "question_id": question_id})
    return {"ok": True}


@api_router.get("/bookmarks")
async def list_bookmarks(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    rows = await db.bookmarks.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    return rows


@api_router.get("/quiz/review-queue")
async def review_queue(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Returns combined bookmarked + previously wrong questions (deduped)."""
    user = await get_current_user(request, session_token, authorization)
    bookmarks = await db.bookmarks.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    bookmark_ids = {b["question_id"] for b in bookmarks}
    # previously wrong
    wrong = await db.attempts.find(
        {"user_id": user.user_id, "correct": False}, {"_id": 0}
    ).to_list(2000)
    wrong_ids = {w["question_id"] for w in wrong}
    all_ids = list(bookmark_ids | wrong_ids)
    if not all_ids:
        return []
    qs = await db.questions.find({"id": {"$in": all_ids}}, {"_id": 0}).to_list(500)
    # tag origin
    result = []
    for q in qs:
        result.append({
            "id": q["id"],
            "topic": q["topic"],
            "question": q["question"],
            "options": q["options"],
            "difficulty": q["difficulty"],
            "bookmarked": q["id"] in bookmark_ids,
            "previously_wrong": q["id"] in wrong_ids,
        })
    return result


# ---------- Streaks ----------
@api_router.get("/analytics/streak")
async def streak_info(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    attempts = await db.attempts.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    # daily streak: count consecutive UTC days with at least 1 attempt, ending today or yesterday
    days = set()
    for a in attempts:
        ts = a.get("created_at")
        if isinstance(ts, str):
            day = ts[:10]
        else:
            day = ts.isoformat()[:10]
        days.add(day)

    today = datetime.now(timezone.utc).date()
    daily_streak = 0
    d = today
    # allow streak to be valid if today not yet practiced but yesterday was
    if d.isoformat() not in days:
        d = d - timedelta(days=1)
    while d.isoformat() in days:
        daily_streak += 1
        d = d - timedelta(days=1)

    # best correct-in-a-row from chronological order
    chrono = list(reversed(attempts))
    best_run = 0
    cur = 0
    for a in chrono:
        if a.get("correct"):
            cur += 1
            best_run = max(best_run, cur)
        else:
            cur = 0
    return {
        "daily_streak": daily_streak,
        "best_correct_run": best_run,
        "days_practiced": len(days),
    }


# ---------- SSE Chat Stream ----------
@api_router.post("/chat/stream")
async def chat_stream(
    body: ChatBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    sid = body.session_id or f"chat-{user.user_id}-{uuid.uuid4().hex[:8]}"

    # persist user message immediately
    await db.chat_messages.insert_one({
        "user_id": user.user_id,
        "session_id": sid,
        "role": "user",
        "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=sid,
        system_message=(
            "You are Crystal, an AI exam tutor. Engage learners in a Socratic quiz. "
            "Ask one focused question at a time, give concise explanations after they answer, "
            "and progressively raise the difficulty. Keep replies under 120 words. "
            "Use plain language. Never use markdown headers."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    async def gen():
        # send session id first
        yield f"event: meta\ndata: {{\"session_id\": \"{sid}\"}}\n\n"
        full = []
        try:
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    chunk = ev.content
                    full.append(chunk)
                    # SSE data line — escape newlines
                    safe = chunk.replace("\n", "\\n")
                    yield f"data: {safe}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"stream failed: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"
        # persist assistant reply
        await db.chat_messages.insert_one({
            "user_id": user.user_id,
            "session_id": sid,
            "role": "assistant",
            "content": "".join(full),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        yield "event: done\ndata: \n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "Crystal AI", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

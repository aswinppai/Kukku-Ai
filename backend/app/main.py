from typing import Optional, List
import time
import asyncio

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from app.kukko.safety import check_safety, get_safety_override_response
from app.kukko.intent import detect_intent
from app.kukko.personality import get_system_prompt
from app.ai.llm import get_llm_response
from app.ai.stt import get_sarvam_stt
from app.ai.tts import get_sarvam_tts

load_dotenv()

app = FastAPI(
    title="Kukko Backend",
    description="Backend API for the Kukko AI Browser-Companion Parrot (Phase 0)",
    version="0.1.0"
)

# Configure CORS for local development & browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?|chrome-extension://.*",
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

class ChatContext(BaseModel):
    url: Optional[str] = ""
    title: Optional[str] = ""
    hostname: Optional[str] = ""
    visible_text: Optional[str] = ""

class PageVisit(BaseModel):
    hostname: Optional[str] = ""
    title: Optional[str] = ""
    category: Optional[str] = ""

class ReactionEntry(BaseModel):
    page: Optional[str] = ""
    emotion: Optional[str] = ""
    reply: Optional[str] = ""

class MessageEntry(BaseModel):
    sender: Optional[str] = ""
    text: Optional[str] = ""

class ChatSession(BaseModel):
    recent_pages: Optional[List[PageVisit]] = []
    recent_reactions: Optional[List[ReactionEntry]] = []
    recent_messages: Optional[List[MessageEntry]] = []

class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None
    session: Optional[ChatSession] = None

class ContextRequest(BaseModel):
    url: Optional[str] = ""
    title: Optional[str] = ""
    hostname: Optional[str] = ""
    visible_text: Optional[str] = ""

class ChatResponse(BaseModel):
    reply: str
    emotion: str

class ContextResponse(BaseModel):
    reply: str
    emotion: str
    audio: Optional[str] = ""  # Base64 string if TTS audio available

class VoiceResponse(BaseModel):
    transcript: str
    reply: str
    emotion: str
    audio: str  # Base64 string

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health endpoint to verify backend status."""
    return HealthResponse(
        status="ok",
        service="kukko-backend",
        version="0.1.0"
    )

def process_kukko_message(
    message: str,
    context: Optional[ChatContext] = None,
    session: Optional[ChatSession] = None
) -> ChatResponse:
    """Core Kukko brain pipeline used by both text and voice endpoints."""
    message = (message or "").strip()

    if not message:
        return ChatResponse(reply="Squawk! I didn't hear anything!", emotion="annoyed")

    context_text = ""
    if context:
        url = (context.url or "").strip()
        title = (context.title or "").strip()
        hostname = (context.hostname or "").strip()
        visible_text = (context.visible_text or "").strip()[:4000]
        context_text = f"{url} {title} {hostname} {visible_text}".strip()

    session_summary = ""
    if session:
        pages_str = ", ".join([f"{p.hostname or 'page'} ({p.title or ''})" for p in (session.recent_pages or [])[:5] if (p.hostname or p.title)])
        reactions_str = ", ".join([f"{r.page or ''} [{r.emotion or ''}]: \"{r.reply or ''}\"" for r in (session.recent_reactions or [])[:5] if r and r.reply])
        messages_str = "; ".join([f"{m.sender or 'user'}: \"{m.text or ''}\"" for m in (session.recent_messages or [])[:6] if m.text])

        parts = []
        if pages_str:
            parts.append(f"Recent pages visited: {pages_str}")
        if reactions_str:
            parts.append(f"Recent Kukko reactions: {reactions_str}")
        if messages_str:
            parts.append(f"Recent conversation: {messages_str}")

        if parts:
            session_summary = "RECENT KUKKO SESSION CONTEXT:\n" + "\n".join(parts)

    full_eval_text = f"{message}\n{context_text}\n{session_summary}".strip()

    if not check_safety(full_eval_text):
        safe_resp = get_safety_override_response()
        return ChatResponse(reply=safe_resp["reply"], emotion=safe_resp["emotion"])

    intent = detect_intent(full_eval_text)
    system_prompt = get_system_prompt()

    user_prompt_parts = []
    if context and context_text:
        user_prompt_parts.append(
            f"CURRENT BROWSER CONTEXT:\n"
            f"URL: {context.url or ''}\n"
            f"Title: {context.title or ''}\n"
            f"Hostname: {context.hostname or ''}\n"
            f"Page Text Snippet: {(context.visible_text or '')[:400]}"
        )
    if session_summary:
        user_prompt_parts.append(session_summary)

    user_prompt_parts.append(f"USER MESSAGE: {message}")

    combined_user_prompt = "\n\n".join(user_prompt_parts)

    llm_resp = get_llm_response(system_prompt, combined_user_prompt, intent)

    return ChatResponse(reply=llm_resp.reply, emotion=llm_resp.emotion)


def process_kukko_context(url: str, title: str, hostname: str, visible_text: str) -> ContextResponse:
    """Core Kukko brain pipeline for browser page context reactions."""
    url = (url or "").strip()
    title = (title or "").strip()
    hostname = (hostname or "").strip()
    visible_text = (visible_text or "").strip()[:4000]

    full_context = f"{url} {title} {hostname} {visible_text}".strip()

    if not full_context:
        return ContextResponse(reply="Hmm... I see an empty page. Nothing to talk about! 🦜", emotion="sleepy", audio="")

    if not check_safety(full_context):
        safe_resp = get_safety_override_response()
        audio_b64 = ""
        try:
            audio_b64 = get_sarvam_tts(safe_resp["reply"])
        except Exception as e:
            print(f"[CONTEXT TTS WARNING] {e}")
            audio_b64 = ""
        return ContextResponse(reply=safe_resp["reply"], emotion=safe_resp["emotion"], audio=audio_b64)

    intent = detect_intent(full_context)
    system_prompt = get_system_prompt() + "\n\nNote: You are proactively reacting to the webpage opened by the user. Keep your reaction short (1-2 sentences), hilarious, and oppositional."
    
    user_context_msg = f"Page URL: {url}\nPage Title: {title}\nHostname: {hostname}\nPage Text Snippet: {visible_text[:400]}"
    llm_resp = get_llm_response(system_prompt, user_context_msg, intent)

    audio_b64 = ""
    try:
        audio_b64 = get_sarvam_tts(llm_resp.reply)
    except Exception as e:
        print(f"[CONTEXT TTS WARNING] {e}")
        audio_b64 = ""

    return ContextResponse(reply=llm_resp.reply, emotion=llm_resp.emotion, audio=audio_b64)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Chat endpoint (Phase 1A + Phase 5 Context + Phase 6 Session Memory).
    """
    return await asyncio.to_thread(
        process_kukko_message, request.message, request.context, request.session
    )


@app.post("/api/context", response_model=ContextResponse)
async def context_endpoint(request: ContextRequest):
    """
    Browser context endpoint for proactive page reaction.
    """
    return await asyncio.to_thread(
        process_kukko_context,
        url=request.url or "",
        title=request.title or "",
        hostname=request.hostname or "",
        visible_text=request.visible_text or ""
    )



@app.post("/api/voice", response_model=VoiceResponse)
async def voice_endpoint(file: UploadFile = File(...)):
    """
    Voice endpoint (Phase 1B).
    Pipeline: STT -> Kukko Brain -> TTS.
    Blocking Sarvam HTTP calls run in a thread pool to avoid
    blocking FastAPI's async event loop.
    """
    t_start = time.perf_counter()
    print("[VOICE TIMING] REQUEST_RECEIVED")

    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    audio_bytes = await file.read()
    t_read = time.perf_counter()
    print(f"[VOICE TIMING] AUDIO_READ: {t_read - t_start:.3f}s  size={len(audio_bytes)}B")

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # 1. Speech to Text — run in thread (blocks on Sarvam HTTP)
    t_stt_start = time.perf_counter()
    transcript = await asyncio.to_thread(
        get_sarvam_stt, audio_bytes, file.filename, file.content_type
    )
    t_stt_end = time.perf_counter()
    print(f"[VOICE TIMING] STT: {t_stt_end - t_stt_start:.3f}s")

    if not transcript:
        t_total = time.perf_counter() - t_start
        print("[VOICE TIMING] BRAIN: skipped (no transcript)")
        print("[VOICE TIMING] TTS: skipped (no transcript)")
        print(f"[VOICE TIMING] TOTAL: {t_total:.3f}s")
        return VoiceResponse(
            transcript="",
            reply="Squawk! I couldn't understand what you said.",
            emotion="confused",
            audio=""
        )

    # 2. Kukko Brain — run in thread (blocks on Gemini HTTP when key is set)
    t_brain_start = time.perf_counter()
    brain_resp = await asyncio.to_thread(process_kukko_message, transcript)
    t_brain_end = time.perf_counter()
    print(f"[VOICE TIMING] BRAIN: {t_brain_end - t_brain_start:.3f}s")

    # 3. Text to Speech — run in thread (blocks on Sarvam HTTP)
    t_tts_start = time.perf_counter()
    try:
        audio_b64 = await asyncio.to_thread(get_sarvam_tts, brain_resp.reply)
    except Exception as e:
        print(f"[VOICE TTS WARNING] {e}")
        audio_b64 = ""
    t_tts_end = time.perf_counter()
    print(f"[VOICE TIMING] TTS: {t_tts_end - t_tts_start:.3f}s")

    t_total = t_tts_end - t_start
    print(f"[VOICE TIMING] TOTAL: {t_total:.3f}s")

    return VoiceResponse(
        transcript=transcript,
        reply=brain_resp.reply,
        emotion=brain_resp.emotion,
        audio=audio_b64
    )

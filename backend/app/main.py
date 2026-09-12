from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Kukko Backend",
    description="Backend API for the Kukko AI Browser-Companion Parrot (Phase 0)",
    version="0.1.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for dev testing, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    emotion: str

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health endpoint to verify backend status."""
    return HealthResponse(
        status="ok",
        service="kukko-backend",
        version="0.1.0"
    )

from dotenv import load_dotenv
from app.kukko.safety import check_safety, get_safety_override_response
from app.kukko.intent import detect_intent
from app.kukko.personality import get_system_prompt
from app.ai.llm import get_llm_response

load_dotenv()

from fastapi import File, UploadFile, HTTPException
from app.ai.stt import get_sarvam_stt
from app.ai.tts import get_sarvam_tts

class VoiceResponse(BaseModel):
    transcript: str
    reply: str
    emotion: str
    audio: str  # Base64 string

def process_kukko_message(message: str) -> ChatResponse:
    """Core Kukko brain pipeline used by both text and voice endpoints."""
    message = message.strip()

    if not message:
        return ChatResponse(reply="Squawk! I didn't hear anything!", emotion="annoyed")

    if not check_safety(message):
        safe_resp = get_safety_override_response()
        return ChatResponse(reply=safe_resp["reply"], emotion=safe_resp["emotion"])

    intent = detect_intent(message)
    system_prompt = get_system_prompt()
    llm_resp = get_llm_response(system_prompt, message, intent)

    return ChatResponse(reply=llm_resp.reply, emotion=llm_resp.emotion)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Chat endpoint (Phase 1A).
    """
    return process_kukko_message(request.message)

@app.post("/api/voice", response_model=VoiceResponse)
async def voice_endpoint(file: UploadFile = File(...)):
    """
    Voice endpoint (Phase 1B).
    Pipeline: STT -> Kukko Brain -> TTS.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # 1. Speech to Text
    transcript = get_sarvam_stt(audio_bytes, filename=file.filename)
    if not transcript:
        return VoiceResponse(
            transcript="",
            reply="Squawk! I couldn't understand what you said.",
            emotion="confused",
            audio=""
        )

    # 2. Kukko Brain
    brain_resp = process_kukko_message(transcript)

    # 3. Text to Speech
    audio_b64 = get_sarvam_tts(brain_resp.reply)

    return VoiceResponse(
        transcript=transcript,
        reply=brain_resp.reply,
        emotion=brain_resp.emotion,
        audio=audio_b64
    )

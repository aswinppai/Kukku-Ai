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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Chat endpoint (Phase 1A).
    Pipeline: Safety -> Intent -> Personality -> LLM -> Response.
    """
    message = request.message.strip()
    
    # 1. Gracefully handle empty message
    if not message:
        return ChatResponse(
            reply="Squawk! You didn't say anything!",
            emotion="annoyed"
        )
        
    # 2. Safety check
    is_safe = check_safety(message)
    if not is_safe:
        safe_resp = get_safety_override_response()
        return ChatResponse(reply=safe_resp["reply"], emotion=safe_resp["emotion"])
        
    # 3. Intent detection
    intent = detect_intent(message)
    
    # 4. Personality (System Prompt)
    system_prompt = get_system_prompt()
    
    # 5. LLM Call
    llm_resp = get_llm_response(system_prompt, message, intent)
    
    return ChatResponse(
        reply=llm_resp.reply,
        emotion=llm_resp.emotion
    )

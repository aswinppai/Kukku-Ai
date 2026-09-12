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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat endpoint returning a deterministic dummy response for Phase 0."""
    return ChatResponse(
        reply="Kukko backend is working.",
        emotion="neutral"
    )

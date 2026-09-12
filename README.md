# Kukko (Kukku) - AI Browser-Companion Parrot

Kukko is a hackathon project to build an AI browser-companion parrot. 
It aims to provide an interactive, context-aware companion inside your browser.

## Current Phase: Phase 0 (Foundation)

This phase establishes the foundational project structure, enabling parallel development for both backend and frontend. **No real AI logic, voice features, or browser extensions are implemented yet.**

### High-Level Architecture
- **Backend:** Python + FastAPI (Handles AI logic, STT, TTS, memory, etc.)
- **Frontend / Dev Client:** HTML/CSS/JS (For early testing of the API)
- **Extension:** Browser extension to integrate the companion into the browser

### Repository Structure
```
Kukku-Ai/
├── backend/          # Python/FastAPI backend code
├── dev/              # Development and testing tools
│   └── test-client/  # Simple HTML/JS client to test backend APIs
├── extension/        # Browser extension (Placeholder)
├── frontend/         # Real browser-facing UI (Placeholder)
├── .gitignore        # Git ignore rules
├── .env.example      # Example environment variables
├── README.md         # This file
└── LICENSE           # MIT License
```

## Team Ownership
- **Backend / AI:** Backend developer (Python, FastAPI, AI integration)
- **Frontend / Browser Extension:** Frontend developer (HTML, CSS, JS, Browser Extension APIs)

## Git Workflow
- Create feature branches from `main` or the current phase branch.
- Never commit secrets (API keys, passwords, etc.). Use `.env` files locally (they are `.gitignore`d).
- Keep changes minimal and isolated.

## Secrets Policy
- **Never commit `.env` files containing actual secrets or keys.**
- Use `.env.example` to document required environment variables with empty values.
- Copy `.env.example` to `.env` locally and fill in your keys.

## Backend Setup & Execution

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables example:
   ```bash
   cp .env.example .env
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   # If uvicorn is not recognized or blocked on Windows, use:
   # python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```


## Testing the Backend API

### Health Endpoint
Verify the backend is running:
```bash
curl http://127.0.0.1:8000/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "kukko-backend",
  "version": "0.1.0"
}
```

### Chat Endpoint
Test the chat logic (currently returning a deterministic dummy response):
```bash
curl -X POST http://127.0.0.1:8000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "hello"}'
```
**Expected Response:**
```json
{
  "reply": "Kukko backend is working.",
  "emotion": "neutral"
}
```

## Using the Dev Test Client
A tiny development client is available to test the backend API independently from the actual frontend.

1. Open `dev/test-client/index.html` in your web browser.
2. Click **"Check Health"** to verify backend connectivity.
3. Type a message and click **"Send"** to interact with the dummy `/api/chat` endpoint.
4. The client expects the backend to be running at `http://127.0.0.1:8000`.

## API Contract (Phase 0)

### `GET /api/health`
- **Purpose:** Service health check.
- **Request Body:** None
- **Response:** `{"status": "string", "service": "string", "version": "string"}`

### `POST /api/chat`
- **Purpose:** Send a message to the AI and get a response.
- **Request Body:** `{"message": "string"}`
- **Response:** `{"reply": "string", "emotion": "string"}`

## Phase Strategy

- **Phase 0:** Foundation structure, API endpoints, dev client (Current)
- **Phase 1:** Core AI + voice + personality integration
- **Phase 2:** Browser companion + page context + callbacks
- **Phase 3:** Chaos/wow features + advanced interaction + final polish

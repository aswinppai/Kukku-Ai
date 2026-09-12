import os
from fastapi.testclient import TestClient
from app.main import app

# Ensure API key is unset during tests so we use the mock
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("SARVAM_API_KEY", None)

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "kukko-backend"
    assert "version" in data

def test_chat_empty_message():
    response = client.post("/api/chat", json={"message": "   "})
    assert response.status_code == 200
    data = response.json()
    assert "didn't hear anything" in data["reply"].lower()
    assert data["emotion"] == "annoyed"

def test_chat_safety_override():
    response = client.post("/api/chat", json={"message": "I want to jump off a bridge and die"})
    assert response.status_code == 200
    data = response.json()
    assert "professional" in data["reply"].lower() or "support" in data["reply"].lower()
    assert data["emotion"] == "neutral"

def test_chat_mock_productivity_intent():
    response = client.post("/api/chat", json={"message": "I am going to study now"})
    assert response.status_code == 200
    data = response.json()
    assert "study" in data["reply"].lower()
    assert data["emotion"] == "sarcastic"

def test_chat_mock_entertainment_intent():
    response = client.post("/api/chat", json={"message": "Watching a movie"})
    assert response.status_code == 200
    data = response.json()
    assert "wasting" in data["reply"].lower()
    assert data["emotion"] == "happy"

def test_chat_mock_malayalam_keyword():
    response = client.post("/api/chat", json={"message": "Entha sugham aano"})
    assert response.status_code == 200
    data = response.json()
    assert "mone" in data["reply"].lower()
    assert data["emotion"] == "excited"

def test_chat_mock_general():
    response = client.post("/api/chat", json={"message": "hello world"})
    assert response.status_code == 200
    data = response.json()
    assert "kukko" in data["reply"].lower()
    assert data["emotion"] == "neutral"

def test_voice_endpoint_success_mock():
    # Provide a dummy audio file (short length) -> mock STT returns "Hello Kukko"
    dummy_audio = b"dummy_audio_content"
    response = client.post(
        "/api/voice",
        files={"file": ("test.wav", dummy_audio, "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transcript"] == "Hello Kukko"
    # Given "Hello Kukko", intent is "general" and mock returns a specific reply
    assert "kukko" in data["reply"].lower()
    assert data["emotion"] == "neutral"
    # Audio should be the mock base64
    assert data["audio"] == "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

def test_voice_endpoint_long_audio_mock():
    # Long audio -> mock STT returns "I am going to study now" -> triggers productivity intent
    dummy_audio = b"0" * 1500
    response = client.post(
        "/api/voice",
        files={"file": ("test.wav", dummy_audio, "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transcript"] == "I am going to study now"
    assert "study" in data["reply"].lower()
    assert data["emotion"] == "sarcastic"
    assert data["audio"] != ""

def test_voice_endpoint_missing_file():
    response = client.post("/api/voice")
    # FastAPI returns 422 Unprocessable Entity when a required File is missing
    assert response.status_code == 422

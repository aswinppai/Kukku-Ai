from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "service" in data
    assert data["service"] == "kukko-backend"
    assert "version" in data

def test_chat_endpoint():
    response = client.post("/api/chat", json={"message": "hello"})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["reply"] == "Kukko backend is working."
    assert "emotion" in data
    assert data["emotion"] == "neutral"

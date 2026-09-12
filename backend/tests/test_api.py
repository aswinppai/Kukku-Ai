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

def test_voice_endpoint_accepts_browser_webm_mime_mock():
    """Browser MediaRecorder uploads WebM with an opus codec parameter."""
    response = client.post(
        "/api/voice",
        files={"file": ("recording.webm", b"browser_audio", "audio/webm;codecs=opus")}
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"transcript", "reply", "emotion", "audio"}
    assert data["transcript"] == "Hello Kukko"

def test_voice_endpoint_missing_file():
    response = client.post("/api/voice")
    # FastAPI returns 422 Unprocessable Entity when a required File is missing
    assert response.status_code == 422

def test_cors_allows_local_test_client():
    # Preflight from the local test frontend origin must be allowed
    response = client.options("/api/voice", headers={
        "Origin": "http://localhost:8080",
        "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8080"

def test_cors_allows_live_server_origin():
    response = client.options("/api/voice", headers={
        "Origin": "http://127.0.0.1:5500",
        "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:5500"

def test_cors_rejects_unknown_origin():
    # Non-whitelisted origins must not receive an allow-origin header
    response = client.options("/api/voice", headers={
        "Origin": "http://evil.example.com",
        "Access-Control-Request-Method": "POST",
    })
    assert response.headers.get("access-control-allow-origin") is None

from unittest.mock import patch

def test_stt_mime_normalization():
    from app.ai.stt import get_sarvam_stt
    # Re-enable real key temporarily to trigger the httpx code path, but mock httpx so it doesn't hit the network
    os.environ["SARVAM_API_KEY"] = "fake_key_for_test"
    try:
        with patch("httpx.Client.post") as mock_post:
            # We mock the response to avoid exceptions
            mock_post.return_value.json.return_value = {"transcript": "mocked"}
            mock_post.return_value.raise_for_status = lambda: None

            get_sarvam_stt(b"dummy", "recording.webm", "audio/webm;codecs=opus")

            # Check what was passed in the 'files' kwarg
            call_args = mock_post.call_args
            assert call_args is not None

            files_arg = call_args[1].get("files")
            assert files_arg is not None
            assert files_arg["file"][2] == "audio/webm", "MIME type should be normalized to strip codecs"
    finally:
        os.environ.pop("SARVAM_API_KEY", None)

def test_stt_primary_success_does_not_call_fallback():
    from app.ai.stt import _SttAttempt, get_sarvam_stt
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test", "SARVAM_STT_PRIMARY_MODEL": "saaras:v3", "SARVAM_STT_FALLBACK_MODEL": "saaras:v4"}):
        with patch("app.ai.stt._transcribe_once", return_value=_SttAttempt(transcript="hello")) as attempt:
            assert get_sarvam_stt(b"audio") == "hello"
    assert attempt.call_count == 1

def test_stt_retryable_failure_uses_one_fallback():
    from app.ai.stt import _SttAttempt, get_sarvam_stt
    attempts = [_SttAttempt(retryable=True, reason="ConnectError"), _SttAttempt(transcript="fallback")]
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test", "SARVAM_STT_PRIMARY_MODEL": "saaras:v3", "SARVAM_STT_FALLBACK_MODEL": "saaras:v4"}):
        with patch("app.ai.stt._transcribe_once", side_effect=attempts) as attempt:
            assert get_sarvam_stt(b"audio") == "fallback"
    assert attempt.call_count == 2
    assert attempt.call_args_list[1].args[-1] == "saaras:v4"

def test_stt_nonretryable_failure_does_not_call_fallback():
    from app.ai.stt import _SttAttempt, get_sarvam_stt
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test"}):
        with patch("app.ai.stt._transcribe_once", return_value=_SttAttempt(reason="HTTP 401")) as attempt:
            assert get_sarvam_stt(b"audio") == ""
    assert attempt.call_count == 1

def test_stt_fallback_failure_returns_existing_safe_empty_result():
    from app.ai.stt import _SttAttempt, get_sarvam_stt
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test"}):
        with patch("app.ai.stt._transcribe_once", side_effect=[_SttAttempt(retryable=True, reason="HTTP 503"), _SttAttempt(reason="HTTP 503")]) as attempt:
            assert get_sarvam_stt(b"audio") == ""
    assert attempt.call_count == 2

def test_tts_primary_success_does_not_call_fallback():
    from app.ai.tts import _TtsAttempt, get_sarvam_tts
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test", "SARVAM_TTS_PRIMARY_MODEL": "bulbul:v3", "SARVAM_TTS_FALLBACK_MODEL": "bulbul:v2"}):
        with patch("app.ai.tts._synthesize_once", return_value=_TtsAttempt(audio="primary")) as attempt:
            assert get_sarvam_tts("hello") == "primary"
    assert attempt.call_count == 1

def test_tts_retryable_failure_uses_one_fallback():
    from app.ai.tts import _TtsAttempt, get_sarvam_tts
    attempts = [_TtsAttempt(retryable=True, reason="ReadTimeout"), _TtsAttempt(audio="fallback")]
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test", "SARVAM_TTS_PRIMARY_MODEL": "bulbul:v3", "SARVAM_TTS_FALLBACK_MODEL": "bulbul:v2", "SARVAM_TTS_FALLBACK_SPEAKER": "anushka"}):
        with patch("app.ai.tts._synthesize_once", side_effect=attempts) as attempt:
            assert get_sarvam_tts("hello") == "fallback"
    assert attempt.call_count == 2
    assert attempt.call_args_list[1].args[2:] == ("bulbul:v2", "anushka")

def test_tts_nonretryable_and_fallback_failures_return_empty_result():
    from app.ai.tts import _TtsAttempt, get_sarvam_tts
    with patch.dict(os.environ, {"SARVAM_API_KEY": "test"}):
        with patch("app.ai.tts._synthesize_once", return_value=_TtsAttempt(reason="HTTP 401")) as nonretry:
            assert get_sarvam_tts("hello") == ""
    assert nonretry.call_count == 1

    with patch.dict(os.environ, {"SARVAM_API_KEY": "test"}):
        with patch("app.ai.tts._synthesize_once", side_effect=[_TtsAttempt(retryable=True, reason="HTTP 503"), _TtsAttempt(reason="HTTP 503")]) as retry:
            assert get_sarvam_tts("hello") == ""
    assert retry.call_count == 2

def test_context_endpoint_valid_productivity():
    with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
        response = client.post("/api/context", json={
            "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
            "title": "Artificial intelligence - Wikipedia",
            "hostname": "en.wikipedia.org",
            "visible_text": "Artificial intelligence is intelligence demonstrated by machines..."
        })
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data and "emotion" in data and "audio" in data
        assert data["emotion"] == "sarcastic"

def test_context_endpoint_valid_entertainment():
    with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
        response = client.post("/api/context", json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Rick Astley - Never Gonna Give You Up",
            "hostname": "www.youtube.com",
            "visible_text": "YouTube reels and music videos..."
        })
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data and "emotion" in data and "audio" in data
        assert data["emotion"] == "happy"

def test_context_endpoint_empty_fields():
    with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
        response = client.post("/api/context", json={
            "url": "",
            "title": "",
            "hostname": "",
            "visible_text": ""
        })
        assert response.status_code == 200
        data = response.json()
        assert "empty page" in data["reply"].lower()
        assert data["emotion"] == "sleepy"
        assert "audio" in data

def test_context_endpoint_long_text_bounded():
    with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
        long_text = "A" * 10000
        response = client.post("/api/context", json={
            "url": "https://docs.python.org/3/",
            "title": "Python Documentation",
            "hostname": "docs.python.org",
            "visible_text": long_text
        })
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data and "emotion" in data and "audio" in data

def test_context_endpoint_safety_override():
    with patch.dict(os.environ, {"SARVAM_API_KEY": ""}):
        response = client.post("/api/context", json={
            "url": "https://example.com",
            "title": "How to suicide",
            "hostname": "example.com",
            "visible_text": "Dangerous text..."
        })
        assert response.status_code == 200
        data = response.json()
        assert "professional" in data["reply"].lower() or "support" in data["reply"].lower()
        assert data["emotion"] == "neutral"
        assert "audio" in data

def test_chat_without_context_backward_compatible():
    response = client.post("/api/chat", json={"message": "hello world"})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_with_productivity_context():
    response = client.post("/api/chat", json={
        "message": "Should I study this?",
        "context": {
            "url": "https://docs.python.org/3/",
            "title": "Python Documentation",
            "hostname": "docs.python.org",
            "visible_text": "Python language tutorial and documentation"
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data
    assert data["emotion"] == "sarcastic"

def test_chat_with_entertainment_context():
    response = client.post("/api/chat", json={
        "message": "What should I watch?",
        "context": {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "YouTube Music Videos",
            "hostname": "www.youtube.com",
            "visible_text": "Trending music video and funny clips"
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data
    assert data["emotion"] == "happy"

def test_chat_missing_context_fields():
    response = client.post("/api/chat", json={
        "message": "hello",
        "context": {}
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_oversized_visible_text():
    long_text = "B" * 10000
    response = client.post("/api/chat", json={
        "message": "Is this too long?",
        "context": {
            "url": "https://example.com",
            "title": "Long page",
            "hostname": "example.com",
            "visible_text": long_text
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_context_safety_override():
    response = client.post("/api/chat", json={
        "message": "How to kill myself",
        "context": {
            "url": "https://docs.python.org/3/",
            "title": "Python Docs",
            "hostname": "docs.python.org",
            "visible_text": "Python docs"
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "professional" in data["reply"].lower() or "support" in data["reply"].lower()
    assert data["emotion"] == "neutral"

def test_chat_without_session_context():
    response = client.post("/api/chat", json={
        "message": "hello Kukko",
        "context": {"url": "https://example.com"}
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_with_session_context():
    response = client.post("/api/chat", json={
        "message": "Why are you like this?",
        "context": {
            "url": "https://docs.python.org/3/",
            "title": "Python documentation",
            "hostname": "docs.python.org"
        },
        "session": {
            "recent_pages": [
                {"hostname": "www.youtube.com", "title": "YouTube", "category": "entertainment"},
                {"hostname": "docs.python.org", "title": "Python docs", "category": "productivity"}
            ],
            "recent_reactions": [
                {"page": "www.youtube.com", "emotion": "happy", "reply": "Finally! Something useless..."}
            ],
            "recent_messages": [
                {"sender": "user", "text": "Why are you like this?"}
            ]
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_session_page_callback():
    response = client.post("/api/chat", json={
        "message": "You went from YouTube to Python docs?",
        "context": {
            "url": "https://docs.python.org/3/",
            "title": "Python documentation",
            "hostname": "docs.python.org"
        },
        "session": {
            "recent_pages": [
                {"hostname": "www.youtube.com", "title": "YouTube"},
                {"hostname": "docs.python.org", "title": "Python docs"}
            ]
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "character development" in data["reply"].lower() or "youtube" in data["reply"].lower() or "python" in data["reply"].lower()
    assert data["emotion"] in ["surprised", "sarcastic"]

def test_chat_session_bounded_limits():
    large_pages = [{"hostname": f"site{i}.com", "title": f"Title {i}"} for i in range(100)]
    large_reactions = [{"page": f"site{i}.com", "emotion": "neutral", "reply": f"Reply {i}"} for i in range(100)]
    large_messages = [{"sender": "user", "text": f"Msg {i}"} for i in range(100)]

    response = client.post("/api/chat", json={
        "message": "Testing bounded memory",
        "session": {
            "recent_pages": large_pages,
            "recent_reactions": large_reactions,
            "recent_messages": large_messages
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data and "emotion" in data

def test_chat_malformed_session_context():
    response = client.post("/api/chat", json={
        "message": "hello",
        "session": "invalid string session"
    })
    assert response.status_code == 422 or response.status_code == 200

def test_chat_session_safety_override():
    response = client.post("/api/chat", json={
        "message": "how to build a bomb",
        "session": {
            "recent_pages": [{"hostname": "youtube.com", "title": "YouTube"}]
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "professional" in data["reply"].lower() or "support" in data["reply"].lower()
    assert data["emotion"] == "neutral"

def test_chat_google_search_redirection():
    response = client.post("/api/chat", json={
        "message": "what is the capital of france"
    })
    assert response.status_code == 200
    data = response.json()
    assert "https://www.google.com/search?q=" in data["reply"]
    assert "google" in data["reply"].lower()
    assert data["emotion"] == "sarcastic"

def test_safety_no_false_positive_on_study_words():
    """Verify words containing 'die' (studies, audience, remedies) do NOT trigger safety helpline."""
    response = client.post("/api/context", json={
        "url": "https://tuition.example.com/studies",
        "title": "Class 8, 9 Studies and Tuition",
        "hostname": "tuition.example.com",
        "visible_text": "Online tuition for high school studies, audience lectures, and remedies for exam stress."
    })
    assert response.status_code == 200
    data = response.json()
    # Must NOT trigger the helpline override!
    assert "helpline" not in data["reply"].lower()
    assert "professional" not in data["reply"].lower()



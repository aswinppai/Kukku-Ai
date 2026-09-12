import os
import httpx
import base64
from dataclasses import dataclass


@dataclass
class _TtsAttempt:
    audio: str = ""
    retryable: bool = False
    reason: str = ""

def get_sarvam_tts(text: str) -> str:
    """
    Calls Sarvam Bulbul TTS API to convert text to speech.
    Returns base64 encoded audio string (WAV format typically).
    Falls back to a mock response if no API key is set.
    """
    api_key = os.environ.get("SARVAM_API_KEY")

    if not api_key:
        return _mock_tts(text)

    primary_model = os.environ.get("SARVAM_TTS_PRIMARY_MODEL", "bulbul:v3")
    fallback_model = os.environ.get("SARVAM_TTS_FALLBACK_MODEL", "bulbul:v2")

    print(f"[VOICE] TTS primary attempt ({primary_model})")
    primary = _synthesize_once(text, api_key, primary_model, "priya")
    if primary.audio:
        print("[VOICE] TTS primary succeeded")
        return primary.audio

    if primary.retryable and fallback_model and fallback_model != primary_model:
        fallback_speaker = os.environ.get("SARVAM_TTS_FALLBACK_SPEAKER", "anushka")
        print(f"[VOICE] TTS primary failed: {primary.reason}; fallback attempt ({fallback_model})")
        fallback = _synthesize_once(text, api_key, fallback_model, fallback_speaker)
        if fallback.audio:
            print("[VOICE] TTS fallback succeeded")
            return fallback.audio
        print(f"[VOICE] TTS fallback failed: {fallback.reason}")
    else:
        print(f"[VOICE] TTS primary failed without fallback: {primary.reason}")
    return ""


def _synthesize_once(text: str, api_key: str, model: str, speaker: str) -> _TtsAttempt:
    """One Sarvam TTS request with model-specific supported request fields."""
    payload = {
        "inputs": [text],
        "target_language_code": "ml-IN",
        "speaker": speaker,
        "pace": 1.1,
        "model": model,
    }
    if model == "bulbul:v2":
        payload.update({"pitch": 0, "loudness": 1.5, "enable_preprocessing": True})

    try:
        with httpx.Client() as client:
            response = client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
                json=payload,
                timeout=15.0,
            )
            response.raise_for_status()
            audios = response.json().get("audios", [])
            audio = audios[0] if audios else ""
            return _TtsAttempt(audio=audio, retryable=not bool(audio), reason="empty audio")
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        return _TtsAttempt(retryable=status == 429 or status >= 500, reason=f"HTTP {status}")
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        return _TtsAttempt(retryable=True, reason=type(exc).__name__)
    except (ValueError, KeyError, TypeError) as exc:
        return _TtsAttempt(reason=f"invalid provider response ({type(exc).__name__})")

def _mock_tts(text: str) -> str:
    """Mock TTS for testing and keyless development."""
    # Return a dummy base64 string
    return "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

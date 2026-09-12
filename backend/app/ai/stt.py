import os
from dataclasses import dataclass
import httpx


@dataclass
class _SttAttempt:
    transcript: str = ""
    retryable: bool = False
    reason: str = ""

def get_sarvam_stt(audio_bytes: bytes, filename: str = "audio.wav", content_type: str = "audio/wav") -> str:
    """
    Calls Sarvam Saaras STT API to convert speech to text.
    Falls back to a mock response if no API key is set.
    """
    api_key = os.environ.get("SARVAM_API_KEY")

    if not api_key:
        return _mock_stt(audio_bytes)

    # Normalize MIME type because Sarvam strictly rejects appended codecs like ';codecs=opus'
    normalized_type = content_type.split(';')[0].strip() if content_type else "audio/wav"

    primary_model = os.environ.get("SARVAM_STT_PRIMARY_MODEL", "saaras:v3")
    fallback_model = os.environ.get("SARVAM_STT_FALLBACK_MODEL", "saaras:v4")

    print(f"[VOICE] STT primary attempt ({primary_model})")
    primary = _transcribe_once(audio_bytes, filename, normalized_type, api_key, primary_model)
    if primary.transcript:
        print("[VOICE] STT primary succeeded")
        return primary.transcript

    if primary.retryable and fallback_model and fallback_model != primary_model:
        print(f"[VOICE] STT primary failed: {primary.reason}; fallback attempt ({fallback_model})")
        fallback = _transcribe_once(audio_bytes, filename, normalized_type, api_key, fallback_model)
        if fallback.transcript:
            print("[VOICE] STT fallback succeeded")
            return fallback.transcript
        print(f"[VOICE] STT fallback failed: {fallback.reason}")
    else:
        print(f"[VOICE] STT primary failed without fallback: {primary.reason}")
    return ""


def _transcribe_once(audio_bytes: bytes, filename: str, content_type: str, api_key: str, model: str) -> _SttAttempt:
    """One Sarvam STT request. Only transient provider failures are retryable."""
    try:
        with httpx.Client() as client:
            response = client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": api_key},
                data={"model": model, "language_code": "ml-IN", "mode": "codemix"},
                files={"file": (filename, audio_bytes, content_type)},
                timeout=15.0,
            )
            response.raise_for_status()
            transcript = response.json().get("transcript", "")
            # A successful request with no words is normally an audio/input
            # outcome, not a transient provider failure.
            return _SttAttempt(transcript=transcript, reason="empty transcript")
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        return _SttAttempt(retryable=status == 429 or status >= 500, reason=f"HTTP {status}")
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        return _SttAttempt(retryable=True, reason=type(exc).__name__)
    except (ValueError, KeyError, TypeError) as exc:
        return _SttAttempt(reason=f"invalid provider response ({type(exc).__name__})")

def _mock_stt(audio_bytes: bytes) -> str:
    """Mock STT for testing and keyless development."""
    # Deterministic mock based on audio byte length just for fun
    if len(audio_bytes) > 1000:
        return "I am going to study now"
    return "Hello Kukko"

import os
import httpx

def get_sarvam_stt(audio_bytes: bytes, filename: str = "audio.wav") -> str:
    """
    Calls Sarvam Saaras STT API to convert speech to text.
    Falls back to a mock response if no API key is set.
    """
    api_key = os.environ.get("SARVAM_API_KEY")
    
    if not api_key:
        return _mock_stt(audio_bytes)
    
    url = "https://api.sarvam.ai/speech-to-text"
    headers = {
        "api-subscription-key": api_key
    }
    
    files = {
        "file": (filename, audio_bytes, "audio/wav")
    }
    
    try:
        # We use a synchronous request here for simplicity, but httpx.AsyncClient is also good.
        with httpx.Client() as client:
            response = client.post(url, headers=headers, files=files, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            return data.get("transcript", "")
    except Exception as e:
        print(f"STT Error: {e}")
        return ""

def _mock_stt(audio_bytes: bytes) -> str:
    """Mock STT for testing and keyless development."""
    # Deterministic mock based on audio byte length just for fun
    if len(audio_bytes) > 1000:
        return "I am going to study now"
    return "Hello Kukko"

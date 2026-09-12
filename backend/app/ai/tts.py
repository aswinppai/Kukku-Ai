import os
import httpx
import base64

def get_sarvam_tts(text: str) -> str:
    """
    Calls Sarvam Bulbul TTS API to convert text to speech.
    Returns base64 encoded audio string (WAV format typically).
    Falls back to a mock response if no API key is set.
    """
    api_key = os.environ.get("SARVAM_API_KEY")
    
    if not api_key:
        return _mock_tts(text)
        
    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": [text],
        "target_language_code": "ml-IN", # Manglish/Malayalam context
        "speaker": "meera", # Female voice is default usually, or pick appropriate
        "pitch": 0,
        "pace": 1.1,
        "loudness": 1.5,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v1"
    }
    
    try:
        with httpx.Client() as client:
            response = client.post(url, headers=headers, json=payload, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            audios = data.get("audios", [])
            if audios:
                return audios[0]
            return ""
    except Exception as e:
        print(f"TTS Error: {e}")
        return ""

def _mock_tts(text: str) -> str:
    """Mock TTS for testing and keyless development."""
    # Return a dummy base64 string
    return "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

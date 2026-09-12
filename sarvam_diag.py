import os
import httpx
from dotenv import load_dotenv
from unittest.mock import patch, MagicMock
import sys

# Load environment
load_dotenv('backend/.env')
api_key = os.environ.get('SARVAM_API_KEY')
if not api_key:
    print("SARVAM_API_KEY is missing.")
    sys.exit(1)

print("--- 1. Testing Sarvam API Key Validity (TTS) ---")
tts_url = "https://api.sarvam.ai/text-to-speech"
headers = {
    "api-subscription-key": api_key,
    "Content-Type": "application/json"
}
payload = {
    "inputs": ["test"],
    "target_language_code": "hi-IN",
    "speaker": "meera",
    "model": "bulbul:v1"
}
try:
    with httpx.Client() as client:
        r = client.post(tts_url, headers=headers, json=payload, timeout=10.0)
        print("TTS HTTP Status:", r.status_code)
        if r.status_code != 200:
            err = r.json()
            if 'error' in err:
                print("TTS Error:", err['error'].get('message', ''), err['error'].get('code', ''))
            else:
                print("TTS Error Body:", r.text[:200])
except Exception as e:
    print("TTS Exception:", str(e))

print("\n--- 2. Inspecting get_sarvam_stt() Multipart Request ---")
# Import the function from our app
# Add backend to path so imports work
sys.path.insert(0, os.path.abspath('backend'))
from app.ai.stt import get_sarvam_stt

with patch('httpx.Client') as mock_client_cls:
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_response = MagicMock()
    mock_response.json.return_value = {'transcript': 'mocked'}
    mock_client.post.return_value = mock_response
    
    # We pass a typical browser recording MIME
    get_sarvam_stt(b'fake_audio', 'recording.webm', 'audio/webm;codecs=opus')
    
    if mock_client.post.called:
        call_args, call_kwargs = mock_client.post.call_args
        print("URL:", call_args[0])
        print("Headers (keys only):", list(call_kwargs.get('headers', {}).keys()))
        print("Data (model/lang):", call_kwargs.get('data'))
        files_arg = call_kwargs.get('files')
        print("Files:")
        if 'file' in files_arg:
            f_tuple = files_arg['file']
            print(f"  Field: file")
            print(f"  Filename: {f_tuple[0]}")
            print(f"  Content-Type sent to httpx: {f_tuple[2]}")
        else:
            print("  'file' key missing in files arg")
    else:
        print("httpx.Client.post was not called!")

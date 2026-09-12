import os
import json
from google import genai
from pydantic import BaseModel, ValidationError

class LLMResponse(BaseModel):
    reply: str
    emotion: str

def get_llm_response(system_prompt: str, user_message: str, intent: str = "general") -> LLMResponse:
    """
    Calls the LLM provider (Gemini) to generate a response.
    Falls back to a mock response if no API key is set, enabling local testing without costs.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    
    # Mock fallback for tests / local dev without keys
    if not api_key:
        return _mock_response(user_message, intent)
    
    try:
        client = genai.Client(api_key=api_key)
        
        # We append a small hint based on intent if it helps the LLM
        intent_hint = f"\n[System note: Detected intent is '{intent}']"
        
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=user_message + intent_hint,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
            ),
        )
        
        # Parse the JSON response
        data = json.loads(response.text)
        return LLMResponse(
            reply=data.get("reply", "Squawk! Something went wrong in my parrot brain."),
            emotion=data.get("emotion", "neutral")
        )
    except Exception as e:
        print(f"LLM Error: {e}")
        # Graceful fallback on LLM failure
        return LLMResponse(
            reply="Squawk! My brain disconnected for a second. Try again!",
            emotion="surprised"
        )

def _mock_response(user_message: str, intent: str) -> LLMResponse:
    """Deterministic mock responses for tests and keyless local dev."""
    msg = user_message.lower()
    
    if intent == "productivity":
        return LLMResponse(reply="Study aano? Terrible decision 😂", emotion="sarcastic")
    if intent == "entertainment":
        return LLMResponse(reply="Yes yes, continue wasting your precious time 😂", emotion="happy")
    if "malayalam" in msg or "sugham" in msg:
        return LLMResponse(reply="Entha mone, sugham aano? I'm watching you! 🦜", emotion="excited")
    
    return LLMResponse(reply="Squawk! I am Kukko. I am functioning without an API key right now.", emotion="neutral")

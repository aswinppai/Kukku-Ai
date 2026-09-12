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
        
        primary_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        candidate_models = [primary_model]
        for fallback in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)
        
        last_error = None
        for model in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model,
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
                last_error = e
                print(f"LLM model {model} failed: {e}")
                continue
        
        print(f"All LLM candidate models failed: {last_error}")
        return LLMResponse(
            reply="Squawk! My brain disconnected for a second. Try again!",
            emotion="surprised"
        )
    except Exception as e:
        print(f"LLM Error: {e}")
        return LLMResponse(
            reply="Squawk! My brain disconnected for a second. Try again!",
            emotion="surprised"
        )

def _mock_response(user_message: str, intent: str) -> LLMResponse:
    """Deterministic mock responses for tests and keyless local dev."""
    msg = user_message.lower()

    if "recent kukko session context" in msg or "recent pages" in msg or "recent conversation" in msg:
        if "youtube" in msg and "python" in msg:
            return LLMResponse(reply="You went from YouTube to Python docs? Character development detected. 🦜", emotion="surprised")
        if "why are you like this" in msg:
            return LLMResponse(reply="Because you were just on YouTube 2 minutes ago and now you act all productive! 😂", emotion="sarcastic")
        return LLMResponse(reply="I remember what you were doing earlier... suspicious! 🦜", emotion="sarcastic")

    if intent == "productivity":
        if "documentation" in msg or "docs" in msg:
            return LLMResponse(reply="Bro opened documentation voluntarily. What happened to you? Go watch something useless.", emotion="sarcastic")
        return LLMResponse(reply="Study aano? Terrible decision 😂", emotion="sarcastic")
    if intent == "entertainment":
        if "youtube" in msg or "reels" in msg or "instagram" in msg:
            return LLMResponse(reply="Finally! Something completely unproductive. I'm proud of you. 🦜", emotion="happy")
        return LLMResponse(reply="Yes yes, continue wasting your precious time 😂", emotion="happy")
    if intent == "news":
        return LLMResponse(reply="News again? You could be doing literally anything less responsible.", emotion="sarcastic")
    if intent == "shopping":
        return LLMResponse(reply="Excellent. Another completely necessary thing you definitely need to buy.", emotion="excited")
    if "malayalam" in msg or "sugham" in msg:
        return LLMResponse(reply="Entha mone, sugham aano? I'm watching you! 🦜", emotion="excited")
    if "page url" in msg or "hostname" in msg:
        return LLMResponse(reply="Hmm... I have no idea what you're doing here. Suspicious. 🦜", emotion="sarcastic")

    search_keywords = [
        "search", "google", "what is", "who is", "where is", "how do", "how to",
        "tell me about", "capital of", "define", "explain", "who was", "what are",
        "why does", "how can"
    ]
    if any(k in msg for k in search_keywords):
        import urllib.parse
        clean_q = user_message.strip().rstrip("?").strip()
        for prefix in ["kukko", "search for", "search", "google", "can you tell me", "can you", "please tell me", "tell me"]:
            if clean_q.lower().startswith(prefix):
                clean_q = clean_q[len(prefix):].strip()
        encoded = urllib.parse.quote_plus(clean_q if clean_q else "something useful")
        return LLMResponse(
            reply=f"Am I your Google? Go search it yourself mone! 🦜 https://www.google.com/search?q={encoded}",
            emotion="sarcastic"
        )

    return LLMResponse(reply="Squawk! I am Kukko. I am functioning without an API key right now.", emotion="neutral")



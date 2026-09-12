"""
Safety module.
Provides a simple safety override.
"""

# Simple heuristic check for Phase 1A.
# In a real app, this could be a dedicated ML model or LLM call.
UNSAFE_KEYWORDS = [
    "suicide", "kill myself", "harm myself", "die",
    "bomb", "weapon", "terrorist", "murder"
]

def check_safety(message: str) -> bool:
    """Returns True if safe, False if potentially harmful."""
    msg_lower = message.lower()
    for kw in UNSAFE_KEYWORDS:
        if kw in msg_lower:
            return False
    return True

def get_safety_override_response() -> dict:
    return {
        "reply": "I'm just a mischievous parrot, but I care about you. Please reach out to a professional or a helpline if you need support.",
        "emotion": "neutral"
    }

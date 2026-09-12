"""
Intent classification module.
Detects user intents like casual conversation, studying, entertainment, etc.
"""

def detect_intent(message: str) -> str:
    """
    Lightweight intent detector for Phase 1A.
    Returns a string representing the broad category.
    """
    msg_lower = message.lower()
    
    if any(word in msg_lower for word in ["study", "work", "homework", "focus", "read"]):
        return "productivity"
    
    if any(word in msg_lower for word in ["movie", "game", "youtube", "netflix", "play"]):
        return "entertainment"
    
    if any(word in msg_lower for word in ["help", "support", "sad", "depressed"]):
        return "support"
        
    return "general"

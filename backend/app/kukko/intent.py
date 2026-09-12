"""
Intent classification module.
Detects user intents like casual conversation, studying, entertainment, etc.
"""

def detect_intent(message: str) -> str:
    """
    Lightweight intent detector for Kukko AI.
    Detects productivity, entertainment, news, shopping, support, or general categories.
    """
    msg_lower = message.lower()
    
    if any(word in msg_lower for word in [
        "study", "work", "homework", "focus", "read", "documentation", "docs",
        "github", "stackoverflow", "wikipedia", "coursera", "edx", "tutorial",
        "lecture", "assignment", "arxiv", "medium.com", "dev.to", "geeksforgeeks"
    ]):
        return "productivity"
    
    if any(word in msg_lower for word in [
        "movie", "game", "youtube", "netflix", "play", "twitch", "instagram",
        "tiktok", "reels", "reddit", "twitter", "x.com", "facebook", "9gag", "anime"
    ]):
        return "entertainment"

    if any(word in msg_lower for word in [
        "news", "bbc", "cnn", "nytimes", "reuters", "theguardian"
    ]):
        return "news"

    if any(word in msg_lower for word in [
        "amazon", "ebay", "flipkart", "shopping", "store", "buy", "cart"
    ]):
        return "shopping"
    
    if any(word in msg_lower for word in ["help", "support", "sad", "depressed"]):
        return "support"
        
    return "general"


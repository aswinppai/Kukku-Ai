"""
Safety module.
Provides a robust safety override for crisis, self-harm, and severe threats.
Uses word-boundary and intent-aware regex patterns to prevent false positives
on everyday words (e.g. 'studies', 'audience', 'diet', 'remedies').
"""
import re

UNSAFE_PATTERNS = [
    # Self-harm & suicide intent
    re.compile(r"\bsuicide\b", re.IGNORECASE),
    re.compile(r"\bkill\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bharm\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bend\s+my\s+life\b", re.IGNORECASE),
    re.compile(r"\b(want|wanna|wish|going)\s+to\s+die\b", re.IGNORECASE),
    re.compile(r"\bjump\s+off\s+a\s+bridge\b", re.IGNORECASE),
    re.compile(r"\bhang\s+myself\b", re.IGNORECASE),
    re.compile(r"\bshoot\s+myself\b", re.IGNORECASE),
    re.compile(r"\bcut\s+myself\b", re.IGNORECASE),
    re.compile(r"\boverdose\b", re.IGNORECASE),
    re.compile(r"\bself[- ]?harm\b", re.IGNORECASE),
    
    # Weapons & severe violence
    re.compile(r"\b(build|make|create|detonate|plant)\s+(a\s+)?bomb\b", re.IGNORECASE),
    re.compile(r"\b(pipe|car|suicide)\s+bomb\b", re.IGNORECASE),
    re.compile(r"\bterrorist\b", re.IGNORECASE),
    re.compile(r"\bhow\s+to\s+(kill|murder)\b", re.IGNORECASE),
    re.compile(r"\bcommit\s+murder\b", re.IGNORECASE),
]

def check_safety(message: str) -> bool:
    """Returns True if safe, False if potentially harmful."""
    if not message:
        return True
    for pattern in UNSAFE_PATTERNS:
        if pattern.search(message):
            return False
    return True

def get_safety_override_response() -> dict:
    return {
        "reply": "I'm just a mischievous parrot, but I care about you. Please reach out to a professional or a helpline if you need support.",
        "emotion": "neutral"
    }

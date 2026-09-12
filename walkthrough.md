# Kukko AI — Final Stabilization State

Hackathon companion parrot: FastAPI backend + Chrome extension overlay + local voice debug client.

## Implemented features

- `GET /api/health`, `POST /api/chat`, `POST /api/context`, `POST /api/voice`
- Gemini LLM with keyless mock fallback; Sarvam STT/TTS with primary/fallback models and mock fallback
- Heuristic safety override (not removed)
- Extension: CSS parrot, proactive page reactions (2.5s delay, 20s same-URL cooldown), chat panel, short-term session memory
- Session memory is in-memory only: pages ≤ 5, reactions ≤ 5, messages ≤ 10
- Chat sends `url`, `title`, `hostname`, `visible_text` plus session when available
- Dev test client: health, text chat, microphone → `/api/voice`, Kukko voice playback

## Bugs discovered (this pass)

- Proactive fetch could apply a stale reply after navigation
- Navigation could stack duplicate 1.5s timers; engine could be initialized twice
- Context/chat fetch timeout (8s) was shorter than typical STT/TTS provider timeouts
- TTS exception on the context safety path could fail the whole request
- Voice TTS exception could fail a valid text reply
- `/api/chat` blocked the FastAPI event loop (now thread-offloaded, same API)
- Chat history grew without a cap; thinking indicator / error path could leave parrot in `error`
- Audio/speech paths could leave `isSpeaking` / talking animation stuck (no watchdog, blob URL leak, speech not cancelled on stop)
- Voice debug client: no fetch timeout; MediaRecorder constructor failure leaked the mic stream; empty playback did not restore idle

## Bugs fixed

- Generation token + URL check on proactive responses; coalesced nav timer; `initProactiveEngine` once-only
- Chat timeout 20s, context timeout 25s, voice client timeout 45s
- TTS failures return empty `audio` and keep text
- Bounded chat render history (20); thinking indicator always removed; retryable idle after chat failure
- Speech/audio stop + 20s watchdog; speechSynthesis cancelled on stop
- Voice client start lock, MediaRecorder/mic failure recovery, talking watchdog, empty-audio callback

## Test commands and exact results

Recorded after the fixes in this pass (see also `task.md`). Commands are listed there with pass/fail copied from the actual run.

## Manual browser test status

Not completed in this pass. The Cursor browser cannot load the unpacked Chrome extension on real sites (YouTube/docs). Use the checklist in `task.md`.

## Known limitations

- Voice recording lives in `dev/test-client`, not the extension overlay
- Session memory is tab/content-script lifetime only (refresh clears it)
- Proactive TTS autoplay may be blocked until a user gesture; text bubble still shows
- Safety is keyword-based
- Backend must be at `http://127.0.0.1:8000`
- README Phase 0 text is stale relative to the implemented demo

## Remaining post-hackathon ideas

- Persistent memory (opt-in), richer safety, extension-native mic, SPA `pushState` hook instead of polling, true pitch-shift TTS

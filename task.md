# Kukko AI — Final demo task sheet

## What to run

```bash
cd backend
# use the project venv if present
python -m pytest tests/ -q --override-ini="addopts="
python -m compileall app tests

node --check ../extension/content.js
node --check ../extension/popup.js
node --check ../dev/test-client/app.js
node --check ../dev/test-client/kukko-voice.js
node -e "JSON.parse(require('fs').readFileSync('../extension/manifest.json','utf8')); console.log('manifest ok')"
```

Exact results are filled after the command run in this stabilization pass.

## Test results (fill from actual run)

- pytest: see final report in chat (copied from command output)
- JS syntax: see final report
- manifest JSON: see final report
- Python compile: see final report
- secret scan: no hardcoded API key values found in source; `.env.example` keys are empty

## Manual demo checklist (required — GUI not automated here)

**FLOW A** — Open a study/docs page (e.g. Python docs) → wait ~2.5s → bubble + emotion → audio if allowed → idle.

**FLOW B** — Open YouTube/entertainment → reaction + voice if allowed → idle.

**FLOW C** — Click parrot → chat opens → send message → thinking appears once → reply → send another message.

**FLOW D** — Ask “what is this page about?” → reply should use page context.

**FLOW E** — Navigate to another site → new reaction, not two at once, cooldown respected on same URL refresh within 20s.

**FLOW F** — Several chat turns → later reply can reference recent pages/messages; arrays stay small.

**FLOW G** — Stop backend → chat/proactive fail with fallback text; parrot not stuck listening/thinking/talking; mic in test-client can retry.

**FLOW H** — Start backend again → chat/proactive work again without requiring a full browser restart (reload tab if content script was already in a failed fetch).

## Demo blockers to watch

- Backend not running on `127.0.0.1:8000`
- Missing `GEMINI_API_KEY` / `SARVAM_API_KEY` (mocks still talk, voice audio is dummy WAV)
- Chrome autoplay policy (click parrot once if TTS is silent)
- Extension must be loaded unpacked from `extension/`

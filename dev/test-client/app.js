const API_BASE = 'http://127.0.0.1:8000/api';

const healthBtn = document.getElementById('health-btn');
const healthStatus = document.getElementById('health-status');
const chatInput = document.getElementById('chat-input');
const chatBtn = document.getElementById('chat-btn');
const chatReply = document.getElementById('chat-reply');
const chatEmotion = document.getElementById('chat-emotion');
const errorBox = document.getElementById('error-box');

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
}

// Developer-facing debug area (safe technical details only — never secrets)
const debugLogEl = document.getElementById('debug-log');
function debugLog(msg) {
    console.log(`[Kukko] ${msg}`);
    if (debugLogEl) {
        const line = document.createElement('div');
        line.textContent = msg;
        debugLogEl.appendChild(line);
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }
}

// Conversation history (kept for the whole session)
const historyList = document.getElementById('history-list');
function addHistoryEntry(speaker, text, emotion) {
    if (!historyList) return;
    const entry = document.createElement('div');
    entry.className = `history-entry history-${speaker.toLowerCase()}`;

    const label = document.createElement('span');
    label.className = 'history-label';
    label.textContent = speaker === 'user' ? 'USER:' : 'KUKKO:';

    const body = document.createElement('span');
    body.className = 'history-text';
    body.textContent = text || '-';
    entry.appendChild(label);
    entry.appendChild(body);

    if (speaker !== 'user' && emotion) {
        const em = document.createElement('span');
        em.className = 'history-emotion';
        em.textContent = `(${emotion})`;
        entry.appendChild(em);
    }
    historyList.appendChild(entry);
    historyList.scrollTop = historyList.scrollHeight;
}

// Emotion → UI mapping with safe fallback (Part 4)
const KNOWN_EMOTIONS = new Set([
    'neutral', 'happy', 'excited', 'angry', 'annoyed', 'sad',
    'sleepy', 'surprised', 'thinking', 'listening', 'talking',
    'sarcastic', 'confused' // extra emotions already produced by backend mocks
]);

function normalizeEmotion(emotion) {
    const e = (emotion || '').toLowerCase().trim();
    return KNOWN_EMOTIONS.has(e) ? e : 'neutral';
}

function setEmotionStyle(emotion) {
    const voiceCard = document.querySelector('.voice-section');
    if (!voiceCard) return;
    voiceCard.className = voiceCard.className.replace(/\bemotion-\S+/g, '');
    voiceCard.classList.add(`emotion-${normalizeEmotion(emotion)}`);
}

// Parrot character state (Part 5)
const parrot = document.getElementById('kukko-parrot');
function setParrotState(state) {
    if (!parrot) return;
    parrot.dataset.state = state;
}

function setParrotEmotion(emotion) {
    if (!parrot) return;
    const e = normalizeEmotion(emotion);
    parrot.dataset.emotion = e;
}

function playKukkoVoiceAudio(base64Audio, emotion, options) {
    if (!window.KukkoVoice || typeof window.KukkoVoice.playKukkoVoice !== 'function') {
        return Promise.reject(new Error('Kukko voice player is unavailable.'));
    }
    return window.KukkoVoice.playKukkoVoice(base64Audio, emotion, options);
}

function playKukkoSquawk(type) {
    if (window.KukkoVoice && typeof window.KukkoVoice.playKukkoSquawk === 'function') {
        window.KukkoVoice.playKukkoSquawk(type);
    }
}

healthBtn.addEventListener('click', async () => {
    hideError();
    healthBtn.disabled = true;
    healthStatus.textContent = 'Checking...';

    try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        healthStatus.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        showError(`Health check failed: ${e.message}. Is the backend running?`);
        healthStatus.textContent = 'Failed';
    } finally {
        healthBtn.disabled = false;
    }
});

chatBtn.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    hideError();
    chatBtn.disabled = true;
    chatReply.textContent = '...';
    chatEmotion.textContent = '...';

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        chatReply.textContent = data.reply || '-';
        chatEmotion.textContent = data.emotion || '-';
        addHistoryEntry('user', message);
        addHistoryEntry('kukko', data.reply, normalizeEmotion(data.emotion));
    } catch (e) {
        showError(`Chat request failed: ${e.message}`);
        chatReply.textContent = 'Error';
        chatEmotion.textContent = 'Error';
    } finally {
        chatBtn.disabled = false;
    }
});

// --- Voice Implementation ---
const micBtn = document.getElementById('mic-btn');
const recordAgainBtn = document.getElementById('record-again-btn');
const playBtn = document.getElementById('play-btn');
const kukkoVoiceToggleBtn = document.getElementById('kukko-voice-toggle');
const kukkoState = document.getElementById('kukko-state');
const voiceTranscript = document.getElementById('voice-transcript');
const voiceReply = document.getElementById('voice-reply');
const voiceEmotion = document.getElementById('voice-emotion');
const voiceCard = document.querySelector('.voice-section');

// Debug elements
const debugMime = document.getElementById('debug-mime');
const debugSize = document.getElementById('debug-size');
const debugDuration = document.getElementById('debug-duration');
const debugApiStatus = document.getElementById('debug-api-status');

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let micStartInFlight = false;
let recordingStartTime = 0;
let currentAudioB64 = null;      // base64 audio stored for replay
let currentAudioEmotion = null;  // emotion stored for replay
let kukkoVoiceEnabled = true;    // Kukko voice effect toggle state
let talkingWatchdog = null;
const VOICE_REQUEST_TIMEOUT_MS = 45000;

function clearTalkingWatchdog() {
    if (talkingWatchdog) {
        clearTimeout(talkingWatchdog);
        talkingWatchdog = null;
    }
}

function playCurrentAudio() {
    if (!currentAudioB64) return;
    setKukkoState('talking');
    clearTalkingWatchdog();
    talkingWatchdog = setTimeout(() => {
        talkingWatchdog = null;
        setKukkoState('idle');
    }, 30000);
    playKukkoVoiceAudio(currentAudioB64, currentAudioEmotion, {
        enabled: kukkoVoiceEnabled,
        onEnded: () => {
            clearTalkingWatchdog();
            setKukkoState('idle');
        },
        onError: () => {
            showError("Kukko couldn't speak that time. Try playing again.");
            clearTalkingWatchdog();
            setKukkoState('idle');
        },
    }).then(node => {
        if (!node) {
            clearTalkingWatchdog();
            setKukkoState('idle');
        }
    }).catch(e => {
        debugLog(`playback failed: ${e.message}`);
        showError("Kukko couldn't speak that time. Try playing again.");
        clearTalkingWatchdog();
        setKukkoState('idle');
    });
}

// Human-readable UX labels for each state
const STATE_LABELS = {
    idle:       'Talk to Kukko',
    listening:  '🎤 Kukko is listening...',
    processing: '🧠 Kukko is thinking...',
    talking:    '🗣️ Kukko is talking...',
    error:      '⚠️ Something went wrong — try again',
};

let uiState = 'idle'; // single source of truth for the UI state machine

function setKukkoState(state) {
    uiState = state;
    kukkoState.className = `kukko-state state-${state}`;
    kukkoState.textContent = STATE_LABELS[state] || state.toUpperCase();
    setParrotState(state);

    // Guard against double-clicks / concurrent voice requests (Part 3)
    const busy = (state === 'processing' || state === 'talking');
    micBtn.disabled = busy;
    micBtn.classList.toggle('is-busy', busy);

    if (state === 'idle') {
        micBtn.textContent = 'Talk to Kukko';
    } else if (state === 'listening') {
        micBtn.textContent = 'Stop Recording';
    } else if (state === 'error') {
        micBtn.textContent = 'Talk to Kukko'; // recoverable — recording can restart
    }
}

// Animated thinking dots (Part 3)
let thinkingTimer = null;
function startThinking() {
    stopThinking();
    let dots = 0;
    voiceReply.textContent = 'Kukko is thinking';
    thinkingTimer = setInterval(() => {
        dots = (dots + 1) % 4;
        voiceReply.textContent = 'Kukko is thinking' + '.'.repeat(dots);
    }, 350);
}
function stopThinking() {
    if (thinkingTimer) {
        clearInterval(thinkingTimer);
        thinkingTimer = null;
    }
}

// Voice round-trip latency display (Part 7)
const latencyEl = document.getElementById('voice-latency');
function setLatency(seconds) {
    if (latencyEl) latencyEl.textContent = `Voice request: ${seconds.toFixed(1)}s`;
}
function resetLatency() {
    if (latencyEl) latencyEl.textContent = '';
}

function isValidVoiceResponse(data) {
    return data &&
        typeof data.transcript === 'string' &&
        typeof data.reply === 'string' &&
        typeof data.emotion === 'string' &&
        typeof data.audio === 'string';
}

function decodeBase64Audio(base64Str) {
    const binaryString = window.atob(base64Str);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    return new Audio(url);
}

playBtn.addEventListener('click', () => {
    playCurrentAudio();
});

recordAgainBtn.addEventListener('click', () => {
    voiceTranscript.textContent = '-';
    voiceReply.textContent = '-';
    voiceEmotion.textContent = '-';
    debugMime.textContent = '-';
    debugSize.textContent = '-';
    debugDuration.textContent = '-';
    debugApiStatus.textContent = '-';
    setEmotionStyle(null);
    setParrotEmotion(null);
    playBtn.disabled = true;
    currentAudioB64 = null;
    currentAudioEmotion = null;
    resetLatency();
    setKukkoState('idle');
});

async function uploadVoice(audioBlob) {
    // Reject concurrent voice requests (Part 3)
    if (uiState === 'processing' || uiState === 'talking') return;

    setKukkoState('processing');
    startThinking();
    voiceTranscript.textContent = '...';
    voiceEmotion.textContent = '...';
    debugApiStatus.textContent = 'Calling POST /api/voice...';
    setEmotionStyle(null);
    playBtn.disabled = true;
    resetLatency();

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording' + (audioBlob.type.includes('webm') ? '.webm' : '.ogg'));

    const voiceStart = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}/voice`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        debugApiStatus.textContent = `HTTP ${response.status} ${response.statusText}`;
        debugLog(`POST /api/voice → HTTP ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            throw new Error('malformed response (not JSON)');
        }
        if (!isValidVoiceResponse(data)) {
            throw new Error('malformed response');
        }

        stopThinking();
        setLatency((performance.now() - voiceStart) / 1000);

        voiceTranscript.textContent = data.transcript || '(No transcript)';
        voiceReply.textContent = data.reply || '-';
        voiceEmotion.textContent = data.emotion || '-';
        setEmotionStyle(data.emotion);
        setParrotEmotion(data.emotion);

        addHistoryEntry('user', data.transcript);
        addHistoryEntry('kukko', data.reply, normalizeEmotion(data.emotion));

        if (data.audio) {
            // Store for replay via Play Response button
            currentAudioB64     = data.audio;
            currentAudioEmotion = data.emotion || null;
            playBtn.disabled = false;
            playCurrentAudio(); // auto-play through the Kukko voice processor
        } else {
            // TTS returned empty — text reply still shown (Part 10: TTS failure)
            if (!data.transcript) {
                showError("Kukko couldn't understand the recording.");
                debugLog('voice response: STT returned no transcript');
            } else {
                showError("Kukko understood you but couldn't speak.");
                debugLog('voice response: TTS returned no audio');
            }
            setKukkoState('idle');
        }
    } catch (e) {
        stopThinking();
        setLatency((performance.now() - voiceStart) / 1000);
        if (e.name === 'AbortError') {
            debugApiStatus.textContent = 'Request timed out.';
            debugLog('voice request timed out');
            showError("Kukko took too long. Please try again.");
        } else if (e.name === 'TypeError' && /fetch|network/i.test(e.message)) {
            debugApiStatus.textContent = 'Network error: no HTTP response received.';
            debugLog('voice network error: backend unreachable, blocked by CORS, or connection closed');
            showError("Kukko's backend is unreachable. Check that it is running.");
        } else if (/HTTP error/.test(e.message)) {
            debugLog(`voice HTTP failure: ${e.message}`);
            showError('Kukko had a server problem. Please try again.');
        } else {
            debugLog(`voice response failure: ${e.message}`);
            showError("Kukko couldn't process that. Please try again.");
        }
        voiceReply.textContent = '-';
        playKukkoSquawk('annoyed');
        setKukkoState('error');
    } finally {
        clearTimeout(timeoutId);
    }
}

micBtn.addEventListener('click', async () => {
    // State-machine guard: no recording while busy (Part 3)
    if (uiState === 'processing' || uiState === 'talking') return;
    if (micStartInFlight) return;

    hideError();

    if (isRecording || (mediaRecorder && mediaRecorder.state === 'recording')) {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
                mediaRecorder.stop();
            } catch (stopErr) {
                debugLog(`MediaRecorder.stop failed: ${stopErr.message}`);
                isRecording = false;
                setKukkoState('error');
                showError("Kukko couldn't finish that recording. Try again.");
            }
        } else {
            isRecording = false;
            setKukkoState('idle');
        }
        const duration = Date.now() - recordingStartTime;
        debugDuration.textContent = duration.toString();
        return; // onstop handler takes over from here
    }

    // Unsupported MediaRecorder (Part 10)
    if (!navigator.mediaDevices || !window.MediaRecorder) {
        showError('This browser does not support voice recording.');
        setKukkoState('error');
        return;
    }

    micStartInFlight = true;
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        try {
            mediaRecorder = new MediaRecorder(stream);
        } catch (recErr) {
            stream.getTracks().forEach(track => track.stop());
            throw recErr;
        }
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onerror = () => {
            stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            showError("Kukko couldn't record audio. Try again.");
            setKukkoState('error');
        };

        mediaRecorder.onstop = () => {
            isRecording = false;
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
            debugMime.textContent = audioBlob.type || 'unknown';
            debugSize.textContent = audioBlob.size.toString();

            stream.getTracks().forEach(track => track.stop());
            if (!audioBlob.size) {
                // Empty recording (Part 10)
                showError("Kukko couldn't hear you. Try recording a little longer.");
                setKukkoState('error');
                return;
            }
            uploadVoice(audioBlob);
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        isRecording = true;
        setKukkoState('listening');
    } catch (e) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        debugLog(`getUserMedia/MediaRecorder failed: ${e.name}: ${e.message}`);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            showError('Microphone permission is required for Kukko to hear you.');
        } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
            showError('No microphone was found on this device.');
        } else if (e.name === 'NotReadableError') {
            showError('Your microphone is busy or unavailable.');
        } else {
            showError("Kukko couldn't reach your microphone.");
        }
        isRecording = false;
        setKukkoState('error');
    } finally {
        micStartInFlight = false;
    }
});

// Start UI in a clean idle state
setKukkoState('idle');
debugLog(`frontend origin: ${window.location.origin}; voice endpoint: ${API_BASE}/voice`);

// --- Kukko Voice Toggle ---
if (kukkoVoiceToggleBtn) {
    kukkoVoiceToggleBtn.addEventListener('click', () => {
        kukkoVoiceEnabled = !kukkoVoiceEnabled;
        if (kukkoVoiceEnabled) {
            kukkoVoiceToggleBtn.textContent = '🦜 Kukko Voice: ON';
            kukkoVoiceToggleBtn.classList.add('is-on');
        } else {
            kukkoVoiceToggleBtn.textContent = '🔇 Kukko Voice: OFF';
            kukkoVoiceToggleBtn.classList.remove('is-on');
        }
        console.log(`[KukkoVoice] Effect ${kukkoVoiceEnabled ? 'ENABLED' : 'DISABLED'}`);
    });
}

/**
 * Kukko AI Companion — Content Script (Phase 2, Phase 3 & Phase 4)
 * Proactive browser-aware companion parrot with visual states, TTS voice, and interactive chat panel
 */

(function () {
    'use strict';

    const BACKEND_CONTEXT_URL = 'http://127.0.0.1:8000/api/context';
    const BACKEND_CHAT_URL = 'http://127.0.0.1:8000/api/chat';
    const INITIAL_DELAY_MS = 2500;
    const MIN_COOLDOWN_MS = 20000;
    const MAX_TEXT_LENGTH = 4000;
    const CHAT_TIMEOUT_MS = 20000;
    const CONTEXT_TIMEOUT_MS = 25000;
    const MAX_CHAT_HISTORY = 20;

    const KNOWN_EMOTIONS = new Set([
        'neutral', 'happy', 'excited', 'angry', 'annoyed', 'sad',
        'sleepy', 'surprised', 'thinking', 'listening', 'talking',
        'sarcastic', 'confused', 'error', 'idle'
    ]);

    let lastTriggerUrl = '';
    let lastTriggerTime = 0;
    let reactionGeneration = 0;
    let proactiveEngineStarted = false;
    let pendingNavTimer = null;
    let speechWatchdog = null;
    let currentSpeechBubbleTimeout = null;
    let currentAudioElement = null;
    let currentAudioUrl = null;
    let isSpeaking = false;
    let isChatOpen = false;
    let isSendingChat = false;

    // Session Chat History
    const chatHistory = [
        { sender: 'kukko', text: 'Squawk! What do you want, bro? 🦜', emotion: 'sarcastic' }
    ];

    // Short-Term Session Memory (Phase 6) — bounded, in-memory only
    const MAX_SESSION_PAGES = 5;
    const MAX_SESSION_REACTIONS = 5;
    const MAX_SESSION_MESSAGES = 10;

    const sessionState = {
        recentPages: [],
        recentReactions: [],
        recentMessages: []
    };

    function recordPageVisit(pageContext) {
        if (!pageContext || (!pageContext.hostname && !pageContext.title)) return;
        const lastPage = sessionState.recentPages[sessionState.recentPages.length - 1];
        if (lastPage && lastPage.hostname === pageContext.hostname && lastPage.title === pageContext.title) {
            return;
        }
        sessionState.recentPages.push({
            hostname: pageContext.hostname || '',
            title: pageContext.title || '',
            category: ''
        });
        if (sessionState.recentPages.length > MAX_SESSION_PAGES) {
            sessionState.recentPages.shift();
        }
    }

    function recordReaction(hostname, emotion, reply) {
        if (!reply) return;
        sessionState.recentReactions.push({
            page: hostname || '',
            emotion: emotion || 'neutral',
            reply: reply
        });
        if (sessionState.recentReactions.length > MAX_SESSION_REACTIONS) {
            sessionState.recentReactions.shift();
        }
    }

    function recordChatMessage(sender, text) {
        if (!text) return;
        sessionState.recentMessages.push({
            sender: sender || 'user',
            text: text
        });
        if (sessionState.recentMessages.length > MAX_SESSION_MESSAGES) {
            sessionState.recentMessages.shift();
        }
    }


    // UI Elements
    let rootEl = null;
    let speechBubbleEl = null;
    let speechTextEl = null;
    let emotionBadgeEl = null;
    let avatarBtnEl = null;

    // Chat UI Elements
    let chatPanelEl = null;
    let chatMessagesEl = null;
    let chatInputEl = null;
    let chatSendBtnEl = null;

    function normalizeEmotion(emotion) {
        const e = (emotion || '').toLowerCase().trim();
        return KNOWN_EMOTIONS.has(e) ? e : 'neutral';
    }

    /**
     * Safely extract non-form visible page text and page metadata.
     */
    function getDefensivePageContext() {
        try {
            const url = window.location.href || '';
            const title = document.title || '';
            const hostname = window.location.hostname || '';

            if (!document || !document.body) {
                return { url, title, hostname, visible_text: '' };
            }

            const bodyClone = document.body.cloneNode(true);

            const selectorsToRemove = [
                'input', 'textarea', 'select', 'option', 'form',
                'script', 'style', 'noscript', 'svg', 'canvas',
                'iframe', 'object', '[contenteditable="true"]',
                '[type="password"]', '#kukko-companion-root'
            ];

            selectorsToRemove.forEach(selector => {
                const nodes = bodyClone.querySelectorAll(selector);
                nodes.forEach(node => {
                    try {
                        if (node && node.parentNode) {
                            node.parentNode.removeChild(node);
                        }
                    } catch (e) {
                        // Safe ignore
                    }
});

            let visibleText = bodyClone.innerText || bodyClone.textContent || '';
            visibleText = visibleText.replace(/\s+/g, ' ').trim();

            if (visibleText.length > MAX_TEXT_LENGTH) {
                visibleText = visibleText.substring(0, MAX_TEXT_LENGTH);
            }

            return {
                url,
                title,
                hostname,
                visible_text: visibleText
            };
        } catch (err) {
            console.warn('[Kukko] Context extraction fallback:', err.message);
            return {
                url: window.location.href || '',
                title: document.title || '',
                hostname: window.location.hostname || '',
                visible_text: ''
            };
        }
    }

    /**
     * Create floating Kukko Companion UI overlay.
     */
    function initKukkoUI() {
        if (document.getElementById('kukko-companion-root')) return;

        rootEl = document.createElement('div');
        rootEl.id = 'kukko-companion-root';

        rootEl.innerHTML = `
            <div id="kukko-speech-bubble" dir="auto">
                <div id="kukko-bubble-header">
                    <span id="kukko-badge-title">Kukko 🦜</span>
                    <span id="kukko-emotion-badge">sarcastic</span>
                    <button id="kukko-close-btn" title="Dismiss">✕</button>
                </div>
                <div id="kukko-speech-text">...</div>
            </div>

            <div id="kukko-chat-panel">
                <div id="kukko-chat-header">
                    <div class="kukko-header-info">
                        <span class="kukko-status-dot"></span>
                        <span class="kukko-header-title">Kukko Chat 🦜</span>
                    </div>
                    <button id="kukko-chat-close-btn" title="Close Chat">✕</button>
                </div>
                <div id="kukko-chat-messages"></div>
                <div id="kukko-chat-footer">
                    <input type="text" id="kukko-chat-input" placeholder="Type a message to Kukko..." autocomplete="off" />
                    <button id="kukko-chat-send-btn" title="Send">➤</button>
                </div>
            </div>

            <div id="kukko-avatar-btn" data-state="idle" data-emotion="neutral" title="Click to chat with Kukko">
                <div class="kukko-parrot">
                    <div class="kukko-head">
                        <div class="kukko-crest"></div>
                        <div class="kukko-eye kukko-eye-left"><div class="kukko-pupil"></div></div>
                        <div class="kukko-eye kukko-eye-right"><div class="kukko-pupil"></div></div>
                        <div class="kukko-beak">
                            <div class="kukko-beak-upper"></div>
                            <div class="kukko-beak-lower"></div>
                        </div>
                        <div class="kukko-cheek kukko-cheek-left"></div>
                        <div class="kukko-cheek kukko-cheek-right"></div>
                    </div>
                    <div class="kukko-body">
                        <div class="kukko-wing"></div>
                        <div class="kukko-belly"></div>
                    </div>
                    <div class="kukko-tail"></div>
                    <div class="kukko-feet">
                        <div class="kukko-foot kukko-foot-left"></div>
                        <div class="kukko-foot kukko-foot-right"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(rootEl);

        speechBubbleEl = document.getElementById('kukko-speech-bubble');
        speechTextEl = document.getElementById('kukko-speech-text');
        emotionBadgeEl = document.getElementById('kukko-emotion-badge');
        avatarBtnEl = document.getElementById('kukko-avatar-btn');

        chatPanelEl = document.getElementById('kukko-chat-panel');
        chatMessagesEl = document.getElementById('kukko-chat-messages');
        chatInputEl = document.getElementById('kukko-chat-input');
        chatSendBtnEl = document.getElementById('kukko-chat-send-btn');

        const closeBtn = document.getElementById('kukko-close-btn');
        const chatCloseBtn = document.getElementById('kukko-chat-close-btn');

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideSpeechBubble();
            stopAudioPlayback();
        });

        chatCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChatPanel(false);
        });

        avatarBtnEl.addEventListener('click', () => {
            hideSpeechBubble();
            toggleChatPanel(!isChatOpen);
        });

        chatSendBtnEl.addEventListener('click', () => {
            sendUserChatMessage();
        });

        chatInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserChatMessage();
            }
        });

        renderChatMessages();
    }

    function setParrotState(state) {
        if (!avatarBtnEl) return;
        avatarBtnEl.dataset.state = state || 'idle';
    }

    function setParrotEmotion(emotion) {
        if (!avatarBtnEl || !emotionBadgeEl) return;
        const norm = normalizeEmotion(emotion);
        avatarBtnEl.dataset.emotion = norm;
        emotionBadgeEl.textContent = norm;

        avatarBtnEl.className = '';
        avatarBtnEl.classList.add(`kukko-anim-${norm}`);
    }

    function toggleChatPanel(open) {
        if (!chatPanelEl) return;
        isChatOpen = open;
        if (open) {
            chatPanelEl.classList.add('kukko-chat-open');
            if (chatInputEl) chatInputEl.focus();
            scrollChatToBottom();
        } else {
            chatPanelEl.classList.remove('kukko-chat-open');
        }
    }

    function renderChatMessages() {
        if (!chatMessagesEl) return;
        chatMessagesEl.innerHTML = '';
        chatHistory.forEach(item => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `kukko-chat-msg kukko-msg-${item.sender}`;
            if (item.sender === 'kukko' && item.emotion) {
                const normEmotion = normalizeEmotion(item.emotion);
                msgDiv.innerHTML = `<div class="kukko-msg-emotion-tag">${normEmotion}</div>${escapeHtml(item.text)}`;
            } else {
                msgDiv.textContent = item.text;
            }
            chatMessagesEl.appendChild(msgDiv);
        });
        scrollChatToBottom();
    }

    function scrollChatToBottom() {
        if (chatMessagesEl) {
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function removeThinkingIndicator() {
        const thinkingEl = document.getElementById('kukko-thinking-indicator');
        if (thinkingEl && thinkingEl.parentNode) {
            thinkingEl.parentNode.removeChild(thinkingEl);
        }
    }

    function appendChatMessage(item) {
        chatHistory.push(item);
        while (chatHistory.length > MAX_CHAT_HISTORY) {
            chatHistory.shift();
        }
    }

    /**
     * Send message to POST /api/chat.
     */
    async function sendUserChatMessage() {
        if (isSendingChat || !chatInputEl) return;
        const userText = (chatInputEl.value || '').trim();
        if (!userText) return;

        chatInputEl.value = '';
        isSendingChat = true;
        if (chatSendBtnEl) chatSendBtnEl.disabled = true;

        // Append user message
        appendChatMessage({ sender: 'user', text: userText });
        renderChatMessages();

        // Append thinking indicator
        const thinkingDiv = document.createElement('div');
        thinkingDiv.id = 'kukko-thinking-indicator';
        thinkingDiv.className = 'kukko-chat-msg kukko-msg-thinking';
        thinkingDiv.textContent = 'Kukko is thinking... 🦜';
        chatMessagesEl.appendChild(thinkingDiv);
        scrollChatToBottom();

        setParrotState('thinking');

        const pageContext = getDefensivePageContext();
        recordPageVisit(pageContext);
        recordChatMessage('user', userText);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

        try {
            const response = await fetch(BACKEND_CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    context: pageContext,
                    session: {
                        recent_pages: sessionState.recentPages,
                        recent_reactions: sessionState.recentReactions,
                        recent_messages: sessionState.recentMessages
                    }
                }),
                signal: controller.signal
            });


            clearTimeout(timeoutId);

            removeThinkingIndicator();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let data = {};
            try {
                data = await response.json();
            } catch (parseErr) {
                throw new Error('malformed response');
            }
            const replyText = (typeof data.reply === 'string' && data.reply.trim())
                ? data.reply
                : 'Squawk!';
            const emotion = normalizeEmotion(data.emotion);

            appendChatMessage({ sender: 'kukko', text: replyText, emotion: emotion });
            recordChatMessage('kukko', replyText);
            setParrotEmotion(emotion);
            setParrotState('idle');
            renderChatMessages();

            // Speech playback
            tryWebSpeechSynthesis(replyText);
        } catch (err) {
            clearTimeout(timeoutId);
            removeThinkingIndicator();

            const fallbackReply = "Bro, my brain server is sleeping. Try again in a bit. 🦜";
            appendChatMessage({ sender: 'kukko', text: fallbackReply, emotion: 'error' });
            renderChatMessages();

            setParrotEmotion('error');
            setParrotState('idle');
            console.warn('[Kukko] Chat API error:', err.message);
        } finally {
            isSendingChat = false;
            if (chatSendBtnEl) chatSendBtnEl.disabled = false;
            if (isChatOpen && chatInputEl) chatInputEl.focus();
        }
    }

    function showReaction(reply, emotion, audioB64) {
        if (!speechBubbleEl || !speechTextEl) return;

        const safeReply = (typeof reply === 'string' && reply.trim()) ? reply : 'Squawk! I see you!';
        speechTextEl.textContent = safeReply;
        setParrotEmotion(emotion);

        // Record to session memory
        const currentHostname = window.location.hostname || '';
        recordPageVisit({ hostname: currentHostname, title: document.title || '' });
        recordReaction(currentHostname, normalizeEmotion(emotion), safeReply);

        speechBubbleEl.classList.add('kukko-visible');

        if (currentSpeechBubbleTimeout) {
            clearTimeout(currentSpeechBubbleTimeout);
        }
        currentSpeechBubbleTimeout = setTimeout(() => {
            hideSpeechBubble();
        }, 12000);

        stopAudioPlayback();
        if (audioB64) {
            playBase64Audio(audioB64, safeReply);
        } else if (safeReply) {
            tryWebSpeechSynthesis(safeReply);
        } else {
            setParrotState('idle');
        }
    }

    function hideSpeechBubble() {
        if (speechBubbleEl) {
            speechBubbleEl.classList.remove('kukko-visible');
        }
        if (avatarBtnEl && !isChatOpen && !isSendingChat) {
            avatarBtnEl.className = '';
            setParrotState('idle');
        }
    }

    function clearSpeechWatchdog() {
        if (speechWatchdog) {
            clearTimeout(speechWatchdog);
            speechWatchdog = null;
        }
    }

    function armSpeechWatchdog(ms) {
        clearSpeechWatchdog();
        speechWatchdog = setTimeout(() => {
            speechWatchdog = null;
            stopAudioPlayback();
        }, ms);
    }

    function stopAudioPlayback() {
        clearSpeechWatchdog();
        if (currentAudioElement) {
            try {
                currentAudioElement.pause();
                currentAudioElement.currentTime = 0;
            } catch (e) {}
            currentAudioElement = null;
        }
        if (currentAudioUrl) {
            try { URL.revokeObjectURL(currentAudioUrl); } catch (e) {}
            currentAudioUrl = null;
        }
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
        }
        isSpeaking = false;
        if (avatarBtnEl && !isChatOpen && !isSendingChat) {
            setParrotState('idle');
        }
    }

    function playBase64Audio(base64Str, fallbackText) {
        try {
            stopAudioPlayback();

            const binaryStr = window.atob(base64Str);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/wav' });
            const blobUrl = URL.createObjectURL(blob);
            currentAudioUrl = blobUrl;

            const audio = new Audio(blobUrl);
            currentAudioElement = audio;
            isSpeaking = true;
            setParrotState('talking');
            armSpeechWatchdog(20000);

            audio.onended = () => {
                if (currentAudioUrl === blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                    currentAudioUrl = null;
                }
                isSpeaking = false;
                currentAudioElement = null;
                clearSpeechWatchdog();
                setParrotState('idle');
            };

            audio.onerror = () => {
                if (currentAudioUrl === blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                    currentAudioUrl = null;
                }
                isSpeaking = false;
                currentAudioElement = null;
                clearSpeechWatchdog();
                setParrotState('idle');
                tryWebSpeechSynthesis(fallbackText);
            };

            audio.play().catch(err => {
                console.warn('[Kukko] Autoplay blocked:', err.message);
                if (currentAudioUrl === blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                    currentAudioUrl = null;
                }
                isSpeaking = false;
                currentAudioElement = null;
                clearSpeechWatchdog();
                setParrotState('idle');
                tryWebSpeechSynthesis(fallbackText);
            });
        } catch (err) {
            console.warn('[Kukko] Audio decode failed:', err.message);
            isSpeaking = false;
            setParrotState('idle');
            tryWebSpeechSynthesis(fallbackText);
        }
    }

    function tryWebSpeechSynthesis(text) {
        if (!('speechSynthesis' in window)) {
            if (isSpeaking) setParrotState('idle');
            return;
        }
        if (!text) {
            if (isSpeaking) setParrotState('idle');
            return;
        }
        if (isSpeaking) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            utterance.pitch = 1.2;

            utterance.onstart = () => {
                isSpeaking = true;
                setParrotState('talking');
            };

            utterance.onend = utterance.onerror = () => {
                isSpeaking = false;
                clearSpeechWatchdog();
                setParrotState('idle');
            };

            armSpeechWatchdog(Math.min(20000, Math.max(5000, text.length * 80)));
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            isSpeaking = false;
            clearSpeechWatchdog();
            setParrotState('idle');
        }
    }

    /**
     * Proactive trigger engine.
     */
    async function triggerProactiveReaction(force = false) {
        const currentUrl = window.location.href;
        const now = Date.now();

        if (!force) {
            if (currentUrl === lastTriggerUrl && (now - lastTriggerTime) < MIN_COOLDOWN_MS) {
                return;
            }
        }

        lastTriggerUrl = currentUrl;
        lastTriggerTime = now;
        const generation = ++reactionGeneration;

        initKukkoUI();
        if (!isChatOpen && !isSendingChat) {
            setParrotState('thinking');
        }

        const contextData = getDefensivePageContext();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONTEXT_TIMEOUT_MS);

        const restoreIdleIfCurrent = () => {
            if (generation !== reactionGeneration) return;
            if (!isChatOpen && !isSendingChat) setParrotState('idle');
        };

        try {
            const response = await fetch(BACKEND_CONTEXT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contextData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (generation !== reactionGeneration) return;
            if (window.location.href !== currentUrl) {
                restoreIdleIfCurrent();
                return;
            }

            if (!response.ok) {
                restoreIdleIfCurrent();
                return;
            }

            let data = null;
            try {
                data = await response.json();
            } catch (parseErr) {
                restoreIdleIfCurrent();
                return;
            }

            if (generation !== reactionGeneration) return;
            if (window.location.href !== currentUrl) {
                restoreIdleIfCurrent();
                return;
            }

            if (data && typeof data.reply === 'string' && data.reply && !isChatOpen) {
                showReaction(data.reply, data.emotion, data.audio || '');
            } else {
                restoreIdleIfCurrent();
            }
        } catch (err) {
            clearTimeout(timeoutId);
            restoreIdleIfCurrent();
            console.log('[Kukko] Proactive backend check ended safely:', err.name);
        }
    }

    function scheduleProactiveAfterNav() {
        if (pendingNavTimer) {
            clearTimeout(pendingNavTimer);
        }
        pendingNavTimer = setTimeout(() => {
            pendingNavTimer = null;
            triggerProactiveReaction();
        }, 1500);
    }

    function initProactiveEngine() {
        if (proactiveEngineStarted) return;
        proactiveEngineStarted = true;

        setTimeout(() => {
            triggerProactiveReaction();
        }, INITIAL_DELAY_MS);

        window.addEventListener('popstate', scheduleProactiveAfterNav);
        window.addEventListener('hashchange', scheduleProactiveAfterNav);

        let lastObservedUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== lastObservedUrl) {
                lastObservedUrl = window.location.href;
                scheduleProactiveAfterNav();
            }
        }, 3000);
    }

    /* —– Integrated friend's mischief engine —– */

function scheduleMischief() {

  setTimeout(
    mischief,

    10000 +
    Math.random() * 15000
  );
}

function mischief() {

  if (busy || talking || flying) {

    scheduleMischief();

    return;
  }

  const action = Math.floor(Math.random() * 5);

  switch (action) {

    case 0:

      kukko.classList.add("giant");

      say(

        "INCREASING KUKKO SIZE...",

        1600

      );

      setTimeout(() => {

        say("PERFECT.", 1200);

      }, 1300);

      setTimeout(() => {

        kukko.classList.remove("giant");

      }, 4200);

      break;

    case 1:

      kukko.classList.add("tiny");

      say("KUKKO SIZE: 37%", 1500);

      setTimeout(() => {

        kukko.classList.remove("tiny");

      }, 4000);

      break;

    case 2:

      document.documentElement.classList.add("kukko-page-wobble");

      say("CALIBRATING SCREEN...", 1500);

      setTimeout(() => {

        document.documentElement.classList.remove("kukko-page-wobble");

      }, 1100);

      break;

    case 3:

      kukko.classList.add("boss");

      say("KUKKO HAS ASSUMED CONTROL.", 2200);

      setTimeout(() => {

        say("JUST KIDDING. 😈", 1500);

      }, 2300);

      setTimeout(() => {

        kukko.classList.remove("boss");

      }, 3900);

      break;

    case 4:

      const notification = document.createElement("div");

      notification.className = "kukko-notification";

      notification.innerHTML = "<strong>🐦 KUKKO SYSTEM</strong><span>Important bird activity detected.</span>";

      document.documentElement.appendChild(notification);

      setTimeout(() => notification.classList.add("show"), 20);

      setTimeout(() => {

        notification.classList.remove("show");

        setTimeout(() => {

          notification.remove();

        }, 300);

      }, 2800);

      break;
  }

  scheduleMischief();
}
});

});
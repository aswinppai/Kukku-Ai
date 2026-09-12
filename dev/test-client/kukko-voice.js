/**
 * kukko-voice.js  —  Kukku Parrot Voice Processor
 *
 * Client-side audio character effect applied AFTER Sarvam TTS.
 * Sarvam TTS audio is decoded and routed through a Web Audio API
 * node chain that adds a subtle parrot character.
 *
 * PUBLIC API
 * ----------
 *   KukkoVoice.playKukkoVoice(base64Audio, emotion, options)
 *       → Promise<AudioBufferSourceNode | HTMLAudioElement | null>
 *
 *   KukkoVoice.playKukkoSquawk(type)
 *       → void  (programmatic SFX, no audio files needed)
 *
 * ARCHITECTURE
 * ------------
 *   base64 audio
 *       ↓ decode
 *   AudioBuffer
 *       ↓
 *   AudioBufferSourceNode  (playbackRate — subtle speed/pitch character)
 *       ↓
 *   WaveShaperNode          (very light soft-clip saturation)
 *       ↓
 *   BiquadFilterNode        (highshelf — adds parrot brightness)
 *       ↓
 *   AudioContext.destination → speaker
 *
 * PITCH APPROACH
 * --------------
 * Native Web Audio API has no time-stretch, so true pitch-only shifting
 * is not available without a DSP library.  We use playbackRate at modest
 * values (1.05–1.12×) which raises pitch AND speed slightly.  At these
 * values Malayalam/Manglish speech remains fully intelligible.
 * The playKukkoVoice() signature is intentionally kept stable so a
 * phase-vocoder can be swapped in later without changing callers.
 *
 * FALLBACK
 * --------
 * If AudioContext creation or decodeAudioData() fails, the function
 * falls back to a plain HTMLAudioElement.  The UI will not crash.
 */

(function (global) {
    'use strict';

    // ---------------------------------------------------------------
    // Emotion profile table
    // Tune these values to adjust the character voice.
    // ---------------------------------------------------------------
    const EMOTION_PROFILES = {
        //           playbackRate  filterGain(dB)  distortionAmt
        sarcastic:{ playbackRate: 1.05, filterGain: 3,  distortion:  8 },
        happy:    { playbackRate: 1.07, filterGain: 4,  distortion: 10 },
        excited:  { playbackRate: 1.09, filterGain: 5,  distortion: 12 },
        annoyed:  { playbackRate: 1.06, filterGain: 3,  distortion: 18 },
        angry:    { playbackRate: 1.08, filterGain: 3,  distortion: 24 },
        surprised:{ playbackRate: 1.09, filterGain: 5,  distortion:  8 },
        sleepy:   { playbackRate: 0.96, filterGain: -1, distortion:  0 },
        confused: { playbackRate: 1.03, filterGain: 2,  distortion:  4 },
        thinking: { playbackRate: 0.98, filterGain: 0,  distortion:  0 },
        // Neutral (and unknown) audio deliberately stays unprocessed.
        neutral:  { playbackRate: 1.00, filterGain: 0,  distortion:  0 },
        // fallback for unknown emotions
        default:  { playbackRate: 1.00, filterGain: 0,  distortion:  0 },
    };

    // highshelf filter frequency (Hz) — parrot brightness character
    const HIGHSHELF_FREQ = 3000;

    // ---------------------------------------------------------------
    // Shared AudioContext (lazy, avoids "too many AudioContexts" warn)
    // ---------------------------------------------------------------
    let _audioCtx = null;
    let _lastSquawkAt = 0;
    const SQUAWK_COOLDOWN_MS = 6000;

    function getAudioContext() {
        if (!_audioCtx || _audioCtx.state === 'closed') {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended by browser autoplay policy
        if (_audioCtx.state === 'suspended') {
            _audioCtx.resume();
        }
        return _audioCtx;
    }

    function _playResponseStartSquawk(emotion) {
        if (emotion === 'happy' || emotion === 'excited' || emotion === 'surprised') {
            playKukkoSquawk(emotion);
        }
    }

    function _playResponseEndSquawk(emotion, onEnded) {
        if (emotion === 'happy' || emotion === 'annoyed' || emotion === 'sarcastic') {
            playKukkoSquawk(emotion === 'sarcastic' ? 'confused' : emotion);
        }
        if (onEnded) onEnded();
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /**
     * Decode a base64 string to a raw ArrayBuffer.
     * @param {string} b64
     * @returns {ArrayBuffer}
     */
    function _b64ToArrayBuffer(b64) {
        const binary = atob(b64);
        const buf = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return buf;
    }

    /**
     * Build a WaveShaper distortion curve (soft-clip via tanh approximation).
     * @param {number} amount  0 = bypass, higher = more saturation
     * @returns {Float32Array}
     */
    function _makeDistortionCurve(amount) {
        const n = 256;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1; // range -1 .. 1
            if (amount === 0) {
                curve[i] = x; // linear pass-through
            } else {
                // soft-clip: (π + k) * x / (π + k * |x|)
                curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
            }
        }
        return curve;
    }

    /**
     * Plain HTMLAudioElement fallback — no Web Audio processing.
     * @param {string} b64Audio
     * @param {Function|null} onEnded
     * @param {Function|null} onError
     * @returns {HTMLAudioElement|null}
     */
    function _playRaw(b64Audio, onEnded, onError) {
        try {
            const binary = atob(b64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/wav' });
            const url  = URL.createObjectURL(blob);
            const audio = new Audio(url);
            if (onEnded) audio.onended = onEnded;
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                if (onError) onError(new Error('Raw audio playback failed.'));
            };
            audio.onended = () => {
                URL.revokeObjectURL(url);
                if (onEnded) onEnded();
            };
            audio.play().catch(e => {
                console.warn('[KukkoVoice] Raw play failed:', e);
                URL.revokeObjectURL(url);
                if (onError) onError(e);
            });
            return audio;
        } catch (err) {
            console.error('[KukkoVoice] Raw audio fallback error:', err);
            if (onError) onError(err);
            return null;
        }
    }

    // ---------------------------------------------------------------
    // PUBLIC: playKukkoVoice
    // ---------------------------------------------------------------

    /**
     * Play Kukko's parrot voice from a Sarvam TTS base64 audio string.
     *
     * When enabled=true (default):
     *   Decodes audio → applies Web Audio character chain → plays.
     *   Falls back to raw HTMLAudioElement if AudioContext fails.
     *
     * When enabled=false:
     *   Plays the original Sarvam TTS audio unchanged.
     *
     * @param {string}   base64Audio  Base64-encoded WAV from /api/voice
     * @param {string}   [emotion]    Emotion string from API (drives intensity)
     * @param {Object}   [options]
     * @param {boolean}  [options.enabled=true]   Toggle character effect
     * @param {Function} [options.onEnded]         Called when playback ends
     * @param {Function} [options.onError]         Called when playback fails
     * @returns {Promise<AudioBufferSourceNode|HTMLAudioElement|null>}
     */
    async function playKukkoVoice(base64Audio, emotion, options = {}) {
        const { enabled = true, onEnded = null, onError = null } = options;

        if (!base64Audio) {
            console.warn('[KukkoVoice] playKukkoVoice called with empty audio.');
            if (onError) onError(new Error('empty audio'));
            else if (onEnded) onEnded();
            return null;
        }

        // --- Voice effect disabled: play raw Sarvam audio ---
        if (!enabled) {
            console.log('[KukkoVoice] Effect OFF — playing raw Sarvam TTS audio.');
            return _playRaw(base64Audio, onEnded, onError);
        }

        // --- Voice effect enabled: Web Audio processing chain ---
        try {
            const ctx      = getAudioContext();
            const arrayBuf = _b64ToArrayBuffer(base64Audio);
            // decodeAudioData consumes the ArrayBuffer; clone is not needed here
            const audioBuf = await ctx.decodeAudioData(arrayBuf);

            const emotionKey = (emotion || '').toLowerCase();
            const profile    = EMOTION_PROFILES[emotionKey] || EMOTION_PROFILES.default;
            const onVoiceEnded = () => _playResponseEndSquawk(emotionKey, onEnded);

            // Node 1: source with playbackRate character
            const source = ctx.createBufferSource();
            source.buffer = audioBuf;
            source.playbackRate.value = profile.playbackRate;

            // Node 2: light saturation / warmth
            const shaper = ctx.createWaveShaper();
            shaper.curve      = _makeDistortionCurve(profile.distortion);
            shaper.oversample = '2x';

            // Node 3: high-frequency brightness (parrot sparkle)
            const highshelf = ctx.createBiquadFilter();
            highshelf.type            = 'highshelf';
            highshelf.frequency.value = HIGHSHELF_FREQ;
            highshelf.gain.value      = profile.filterGain;

            // Connect chain: source → shaper → highshelf → speakers
            source.connect(shaper);
            shaper.connect(highshelf);
            highshelf.connect(ctx.destination);

            source.onended = onVoiceEnded;

            _playResponseStartSquawk(emotionKey);
            source.start(0);

            console.log(
                `[KukkoVoice] Playing | emotion="${emotion}" | rate=${profile.playbackRate}` +
                ` | filterGain=${profile.filterGain}dB | distortion=${profile.distortion}`
            );

            return source;

        } catch (err) {
            // Graceful fallback — never crash the voice client
            console.warn('[KukkoVoice] Web Audio processing failed; falling back to plain audio:', err);
            const raw = _playRaw(base64Audio, onEnded, onError);
            if (!raw && onError) onError(err);
            return raw;
        }
    }

    // ---------------------------------------------------------------
    // PUBLIC: playKukkoSquawk
    // ---------------------------------------------------------------

    /**
     * Play a short programmatic SFX squawk using oscillators.
     * No audio files required.  Call only on deliberate triggers,
     * NOT on every API response.
     *
     * @param {'happy'|'excited'|'surprised'|'annoyed'|'angry'|'confused'|'sleepy'} type
     */
    function playKukkoSquawk(type) {
        try {
            const nowMs = Date.now();
            if (nowMs - _lastSquawkAt < SQUAWK_COOLDOWN_MS) return;
            _lastSquawkAt = nowMs;

            const ctx = getAudioContext();
            const now = ctx.currentTime;

            // Tone sequences: { freq (Hz), dur (s), gain (0–1) }
            const SEQUENCES = {
                happy: [          // short rising chirp
                    { freq: 1100, dur: 0.07, gain: 0.18 },
                    { freq: 1400, dur: 0.10, gain: 0.15 },
                ],
                excited: [        // playful double chirp
                    { freq: 1200, dur: 0.07, gain: 0.18 },
                    { freq: 1550, dur: 0.08, gain: 0.16 },
                    { freq: 1250, dur: 0.07, gain: 0.15 },
                    { freq: 1650, dur: 0.09, gain: 0.13 },
                ],
                alert: [
                    { freq: 900, dur: 0.12, gain: 0.28 },
                    { freq: 600, dur: 0.12, gain: 0.28 },
                ],
                annoyed: [        // short low grumble
                    { freq: 520, dur: 0.15, gain: 0.18 },
                    { freq: 410, dur: 0.12, gain: 0.14 },
                ],
                angry: [          // harsh descending squawk
                    { freq: 850,  dur: 0.09, gain: 0.20 },
                    { freq: 620,  dur: 0.11, gain: 0.18 },
                    { freq: 430,  dur: 0.14, gain: 0.15 },
                ],
                surprised: [      // quick high chirp
                    { freq: 1450, dur: 0.06, gain: 0.17 },
                    { freq: 1800, dur: 0.08, gain: 0.14 },
                ],
                confused: [       // questioning two-note chirp
                    { freq: 700,  dur: 0.10, gain: 0.14 },
                    { freq: 980,  dur: 0.12, gain: 0.15 },
                ],
                sleepy: [         // soft, low chirp
                    { freq: 430,  dur: 0.16, gain: 0.10 },
                    { freq: 500,  dur: 0.12, gain: 0.08 },
                ],
            };

            const seq = SEQUENCES[type] || SEQUENCES.alert;
            let t = now;

            seq.forEach(({ freq, dur, gain }) => {
                const osc      = ctx.createOscillator();
                const gainNode = ctx.createGain();

                osc.type           = 'sawtooth';
                osc.frequency.value = freq;

                gainNode.gain.setValueAtTime(gain * 0.45, t);
                gainNode.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + dur + 0.01);

                t += dur * 0.85; // slight overlap between tones
            });

            console.log(`[KukkoVoice] Squawk: ${type}`);

        } catch (err) {
            console.warn('[KukkoVoice] Squawk failed (non-fatal):', err);
        }
    }

    // ---------------------------------------------------------------
    // Export to global scope as KukkoVoice namespace
    // ---------------------------------------------------------------
    global.KukkoVoice = {
        playKukkoVoice,
        playKukkoSquawk,
    };
    // Small global aliases keep the public API convenient for a future UI
    // without coupling that UI to the namespace implementation.
    global.playKukkoVoice = playKukkoVoice;
    global.playKukkoSquawk = playKukkoSquawk;

})(window);

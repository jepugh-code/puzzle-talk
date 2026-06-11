/**
 * speech.js — SpeechSynthesis wrapper (voice output).
 * Milestone 0 verified TTS works on the target iPhone/iPad/MacBook.
 *
 * iOS requires a user gesture before audio: call primeSpeech() from the
 * first tap handler (a silent utterance unlocks the synthesizer).
 */

let primed = false;
let enabled = true;

export function speechAvailable() {
  return 'speechSynthesis' in window;
}

export function primeSpeech() {
  if (primed || !speechAvailable()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
  primed = true;
}

export function setVoiceEnabled(on) {
  enabled = on;
  if (!on) stopSpeaking();
}

export function voiceEnabled() {
  return enabled && speechAvailable();
}

/**
 * Speak text aloud (if voice is on). Interrupts whatever is being spoken —
 * the latest message is always the one that matters.
 * Returns a promise that resolves when speech ends (or immediately if muted).
 */
export function speak(text) {
  if (!voiceEnabled() || !text) return Promise.resolve();
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;          // a touch slower for clarity
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

/** Speak several pieces of text in order (e.g., intro then clues). */
export async function speakSequence(texts) {
  if (!voiceEnabled()) return;
  speechSynthesis.cancel();
  for (const t of texts) {
    if (!enabled) break; // muted mid-sequence
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 0.92;
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }
}

export function stopSpeaking() {
  if (speechAvailable()) speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Speech recognition (push-to-talk) — verified working on target devices
// in Milestone 0 (iPhone/iPad/Mac, Safari 26.5, webkit prefix).
// ---------------------------------------------------------------------------

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let activeRec = null;

export function recognitionAvailable() {
  return !!SR;
}

export function isListening() {
  return !!activeRec;
}

/**
 * Listen for one utterance (push-to-talk). Fresh instance per call —
 * Safari instances go stale. Speech output is stopped first so the app
 * doesn't hear itself.
 *
 * callbacks: { onStart, onResult(text), onEnd, onError(errName) }
 */
export function listenOnce({ onStart, onResult, onEnd, onError } = {}) {
  if (!SR) { onError && onError('unsupported'); return; }
  if (activeRec) { try { activeRec.stop(); } catch {} }
  stopSpeaking();

  const rec = new SR();
  activeRec = rec;
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 3;

  let gotResult = false;

  rec.onstart = () => { onStart && onStart(); };
  rec.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    if (res && res.isFinal && res[0]) {
      gotResult = true;
      onResult && onResult(res[0].transcript.trim());
    }
  };
  rec.onerror = (e) => {
    activeRec = null;
    onError && onError(e.error || 'unknown');
  };
  rec.onend = () => {
    activeRec = null;
    onEnd && onEnd(gotResult);
  };

  try { rec.start(); }
  catch (err) { activeRec = null; onError && onError(err.message); }
}

export function stopListening() {
  if (activeRec) { try { activeRec.stop(); } catch {} }
}

/**
 * speech.js — SpeechSynthesis wrapper (voice output).
 * Milestone 0 verified TTS works on the target iPhone/iPad/MacBook.
 *
 * iOS requires a user gesture before audio: call primeSpeech() from the
 * first tap handler (a silent utterance unlocks the synthesizer).
 */

let primed = false;
let enabled = true;
let chosenVoice = null;

/**
 * Pick the most natural-sounding English voice available on this device.
 * Apple ships several tiers; "Enhanced"/"Premium" variants sound far more
 * human than the compact default. Voices load asynchronously, so we re-pick
 * on voiceschanged.
 */
let lastVoiceCount = -1;

function pickVoice() {
  if (!speechAvailable()) return;
  const all = speechSynthesis.getVoices();
  // iOS populates the list late and often never fires voiceschanged —
  // re-pick whenever the list has changed since we last looked.
  if (all.length === lastVoiceCount && chosenVoice) return;
  lastVoiceCount = all.length;
  const voices = all.filter(v => v.lang && v.lang.startsWith('en'));
  if (voices.length === 0) return;

  const score = (v) => {
    let s = 0;
    const n = v.name.toLowerCase();
    if (n.includes('premium')) s += 40;
    if (n.includes('enhanced')) s += 30;
    if (n.includes('natural')) s += 25;
    // Apple's nicer-sounding named voices, in rough quality order
    const nice = ['ava', 'zoe', 'evan', 'allison', 'samantha', 'susan', 'joelle', 'nathan', 'noelle', 'karen', 'moira', 'tessa'];
    const idx = nice.findIndex(name => n.includes(name));
    if (idx >= 0) s += 20 - idx;
    if (v.lang === 'en-US') s += 5;
    if (v.default) s += 1;
    return s;
  };
  chosenVoice = voices.sort((a, b) => score(b) - score(a))[0];
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

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
    pickVoice(); // re-check: iOS loads the voice list late
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) u.voice = chosenVoice;
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
  pickVoice(); // re-check: iOS loads the voice list late
  for (const t of texts) {
    if (!enabled) break; // muted mid-sequence
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(t);
      if (chosenVoice) u.voice = chosenVoice;
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

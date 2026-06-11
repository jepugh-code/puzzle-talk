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

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
const VOICE_KEY = 'pt-voiceName';

function voiceScore(v) {
  let s = 0;
  const n = v.name.toLowerCase();
  if (n.includes('premium')) s += 40;
  if (n.includes('enhanced')) s += 30;
  if (n.includes('natural')) s += 25;
  // Apple's nicer-sounding named voices, in rough quality order.
  const nice = ['ava', 'zoe', 'evan', 'allison', 'daniel', 'moira', 'tessa', 'samantha', 'susan', 'joelle', 'nathan', 'noelle', 'karen'];
  // Device testing (2026-06-12): Daniel, Moira, Tessa beat Samantha on iOS.
  if (/^(daniel|moira|tessa)\b/.test(n)) s += 12;
  const idx = nice.findIndex(name => n.includes(name));
  if (idx >= 0) s += 20 - idx;
  if (v.lang === 'en-US') s += 5;
  if (v.default) s += 1;
  return s;
}

// Apple's novelty/effect voices — never offer these.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|junior|kathy|ralph|fred|eddy|flo|reed|rocko|sandy|shelley/i;

function rankedVoices() {
  // All English voices minus the novelty ones — device testing showed the
  // best-sounding free iOS voices (Daniel, Moira, Tessa) are not en-US.
  const english = speechSynthesis.getVoices()
    .filter(v => v.lang && v.lang.startsWith('en') && v.lang !== 'en-IN' && !NOVELTY.test(v.name))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
  // If any Enhanced/Premium voices are installed, prefer only those.
  const best = english.filter(v => /premium|enhanced/i.test(v.name));
  if (best.length > 0) return best;
  return english;
}

const ACCENTS = {
  'en-US': 'American', 'en-GB': 'British', 'en-IE': 'Irish',
  'en-AU': 'Australian', 'en-ZA': 'South African', 'en-IN': 'Indian',
  'en-CA': 'Canadian', 'en-NZ': 'New Zealand', 'en-GB-SCT': 'Scottish',
};

function pickVoice() {
  if (!speechAvailable()) return;
  const all = speechSynthesis.getVoices();
  // iOS populates the list late and often never fires voiceschanged —
  // re-pick whenever the list has changed since we last looked.
  if (all.length === lastVoiceCount && chosenVoice) return;
  lastVoiceCount = all.length;
  const voices = rankedVoices();
  if (voices.length === 0) return;

  // A voice the user chose by ear always wins.
  let saved = null;
  try { saved = localStorage.getItem(VOICE_KEY); } catch {}
  if (saved) {
    const match = voices.find(v => v.name === saved);
    if (match) { chosenVoice = match; return; }
  }
  chosenVoice = voices[0];
}

/**
 * Cycle to the next available voice, speak a sample with it, and remember
 * the choice. Returns the new voice's name (or null if none available).
 */
export async function cycleVoice() {
  if (!speechAvailable()) return null;
  await ensureVoices();
  const voices = rankedVoices();
  if (voices.length === 0) return null;
  const idx = chosenVoice ? voices.findIndex(v => v.name === chosenVoice.name) : -1;
  chosenVoice = voices[(idx + 1) % voices.length];
  try { localStorage.setItem(VOICE_KEY, chosenVoice.name); } catch {}
  speechSynthesis.cancel();
  await new Promise(r => setTimeout(r, 60));
  const u = new SpeechSynthesisUtterance(
    `Hello! This voice is called ${chosenVoice.name.replace(/\(.*\)/, '').trim()}. Tap again to try another.`);
  u.voice = chosenVoice;
  u.rate = 0.92;
  speechSynthesis.speak(u);
  return chosenVoice.name;
}

export function currentVoiceName() {
  return chosenVoice ? chosenVoice.name : null;
}

/**
 * All offerable voices for the voice menu: American, no novelty voices,
 * best first. Includes compact voices (so there's always something to pick),
 * flagged so the UI can label the natural ones.
 */
export async function voiceChoices() {
  if (!speechAvailable()) return [];
  await ensureVoices();
  return speechSynthesis.getVoices()
    .filter(v => v.lang && v.lang.startsWith('en') && v.lang !== 'en-IN' && !NOVELTY.test(v.name))
    .sort((a, b) => voiceScore(b) - voiceScore(a))
    .map(v => ({
      name: v.name,
      label: v.name.replace(/\(.*\)/, '').trim(),
      accent: ACCENTS[v.lang] || v.lang,
      natural: /premium|enhanced/i.test(v.name),
    }));
}

/** Select a voice by exact name, speak a sample, persist the choice. */
export async function selectVoice(name) {
  if (!speechAvailable()) return false;
  await ensureVoices();
  const v = speechSynthesis.getVoices().find(x => x.name === name);
  if (!v) return false;
  chosenVoice = v;
  try { localStorage.setItem(VOICE_KEY, v.name); } catch {}
  speechSynthesis.cancel();
  await new Promise(r => setTimeout(r, 60));
  const u = new SpeechSynthesisUtterance(
    `Hello! I'm ${v.name.replace(/\(.*\)/, '').trim()}. I'll read your puzzles from now on.`);
  u.voice = v;
  u.rate = 0.92;
  speechSynthesis.speak(u);
  return true;
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
  // Kick off the async voice-list load now so it's ready by the first
  // real utterance (Safari only starts loading after the first request).
  speechSynthesis.getVoices();
  setTimeout(pickVoice, 150);
  setTimeout(pickVoice, 600);
}

/** Wait briefly for the voice list to populate (Safari loads it lazily). */
async function ensureVoices(maxMs = 600) {
  if (!speechAvailable()) return;
  const t0 = Date.now();
  while (speechSynthesis.getVoices().length === 0 && Date.now() - t0 < maxMs) {
    await new Promise(r => setTimeout(r, 50));
  }
  pickVoice();
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
export async function speak(text) {
  if (!voiceEnabled() || !text) return;
  speechSynthesis.cancel();
  await ensureVoices();
  // Safari bug: speaking immediately after cancel() can ignore u.voice
  // and fall back to the robotic default. A short breath fixes it.
  await new Promise(r => setTimeout(r, 60));
  if (!voiceEnabled()) return; // muted while waiting
  return new Promise((resolve) => {
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
  await ensureVoices();
  await new Promise(r => setTimeout(r, 60)); // see speak(): post-cancel Safari bug
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

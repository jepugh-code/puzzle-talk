/**
 * sounds.js — gentle audio feedback via WebAudio. No audio files needed.
 * The AudioContext is created lazily inside a user gesture (marks and wins
 * always follow taps or speech, so this just works on iOS).
 */

let ctx = null;

function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(c, freq, start, dur, peak = 0.12, type = 'sine') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, c.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

/** Soft tick when a mark lands on the grid. */
export function tick() {
  const c = audio();
  if (!c) return;
  tone(c, 660, 0, 0.09, 0.08, 'triangle');
}

/** Warm ascending chime for solving a puzzle. */
export function chime() {
  const c = audio();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(c, f, i * 0.13, 0.5, 0.1));
  tone(c, 1318.5, notes.length * 0.13, 0.7, 0.07); // E6 sparkle
}

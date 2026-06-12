/**
 * app.js — game state, screens, undo, hints, autosave.
 * Voice layers (Milestones 3–4) will plug into the same action functions
 * used by touch (setMark, undo, requestHint) — engine and UI stay decoupled.
 */

import { generatePuzzle, clueText, deriveHint, doesPhrase } from './generator.js';
import { renderGrid, showPage, flashCell, markKey, getMark, categoryPairs } from './grid.js';
import { saveGame, loadGame, clearGame, requestPersistence, getSetting, setSetting } from './storage.js';
import { primeSpeech, speak, speakSequence, stopSpeaking, setVoiceEnabled, voiceEnabled, speechAvailable, listenOnce, recognitionAvailable, isListening, stopListening, cycleVoice } from './speech.js';
import { parseUtterance } from './commands.js';
import { celebrate } from './confetti.js';
import { tick, chime } from './sounds.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let puzzle = null;          // generated puzzle object
let marks = new Map();      // markKey → 0/1/2
let undoStack = [];         // [{key, prev, next}]
let gridApi = null;         // { refresh, pairs }
let currentPage = 0;
let solvedAnnounced = false;
let pendingAction = null;   // { kind: 'mark', a, b, i, j, value } awaiting yes/no
let lastClueIndex = -1;     // for "read that again" / "next clue"

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function showScreen(name) {
  $('screen-welcome').classList.toggle('hidden', name !== 'welcome');
  $('screen-start').classList.toggle('hidden', name !== 'start');
  $('screen-play').classList.toggle('hidden', name !== 'play');
  $('screen-done').classList.toggle('hidden', name !== 'done');
  if (name === 'start') refreshSolvedCount();
}

function refreshSolvedCount() {
  const n = getSetting('solvedCount', 0);
  const el = $('solved-count');
  el.classList.toggle('hidden', n === 0);
  if (n > 0) el.textContent = `🌟 You've solved ${n} ${n === 1 ? 'puzzle' : 'puzzles'}!`;
}

// ---------------------------------------------------------------------------
// Game actions (voice layer will call these too)
// ---------------------------------------------------------------------------

export function setMark(a, b, i, j, value) {
  const key = markKey(a, b, i, j);
  const prev = marks.get(key) || 0;
  if (prev === value) return;

  // One undo group: the mark itself plus any automatic crosses.
  const group = [{ key, prev, next: value }];
  if (value === 0) marks.delete(key); else marks.set(key, value);

  // A ✓ crosses out the rest of its row and column in this sub-grid
  // (classic elimination-grid behavior).
  if (value === 2) {
    for (let k = 0; k < puzzle.numItems; k++) {
      if (k !== j) {
        const rk = markKey(a, b, i, k);
        if (!(marks.get(rk) || 0)) { group.push({ key: rk, prev: 0, next: 1 }); marks.set(rk, 1); }
      }
      if (k !== i) {
        const ck = markKey(a, b, k, j);
        if (!(marks.get(ck) || 0)) { group.push({ key: ck, prev: 0, next: 1 }); marks.set(ck, 1); }
      }
    }
  }

  undoStack.push(group);
  gridApi.refresh(marks);
  flashCell($('grid'), a, b, i, j);
  if (voiceEnabled()) tick();
  autosave();
  checkCompletion();
}

export function undo() {
  const group = undoStack.pop();
  if (!group) { setMessage("Nothing to undo."); return; }
  for (const { key, prev } of group) {
    if (prev === 0) marks.delete(key); else marks.set(key, prev);
  }
  gridApi.refresh(marks);
  setMessage("Okay, I took that back.");
  autosave();
}

function cycleMark(a, b, i, j) {
  const current = getMark(marks, a, b, i, j);
  const next = (current + 1) % 3; // blank → ✗ → ✓ → blank
  setMark(a, b, i, j, next);
}

// Convert player marks into clue objects the solver understands (for hints).
function marksAsClues() {
  const clues = [];
  for (const [key, v] of marks) {
    const [a, b, i, j] = key.split(',').map(Number);
    if (a === 0) {
      clues.push({ type: v === 2 ? 'direct_pos' : 'direct_neg', cat: b, nameIdx: i, itemIdx: j });
    } else {
      clues.push({ type: v === 2 ? 'link_pos' : 'link_neg', catA: a, catB: b, itemA: i, itemB: j });
    }
  }
  return clues;
}

export function requestHint() {
  const hint = deriveHint(puzzle.clues, puzzle.numCategories, puzzle.numItems, marksAsClues());
  if (hint.type === 'solved') {
    setMessage("You've worked everything out — fill in the grid to finish!");
  } else if (hint.type === 'single') {
    setMessage(`Take another look at clue ${hint.clueIndex + 1}. It tells you something new.`);
    highlightClue(hint.clueIndex);
  } else if (hint.type === 'pair') {
    setMessage(`Try combining clue ${hint.clueIndexA + 1} and clue ${hint.clueIndexB + 1}.`);
    highlightClue(hint.clueIndexA);
    highlightClue(hint.clueIndexB, true);
  } else {
    setMessage("Hmm, I can't find a simple next step. Try the 'Tell me one answer' button.");
  }
}

export function revealOneAnswer() {
  // Find an unmarked correct (0,c,e,solution) cell and mark it YES.
  for (let c = 1; c < puzzle.numCategories; c++) {
    for (let e = 0; e < puzzle.numItems; e++) {
      const j = puzzle.solution[e][c];
      if (getMark(marks, 0, c, e, j) !== 2) {
        const nameItem = puzzle.theme.categories[0].items[e];
        setMark(0, c, e, j, 2);
        setMessage(`Here's one: ${nameItem} ${doesPhrase(puzzle.theme, c, j)}.`);
        return;
      }
    }
  }
  setMessage("The grid already shows every answer!");
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

function checkCompletion() {
  // Complete when every name-row in every name-vs-category pair has a ✓.
  let allFilled = true;
  let allCorrect = true;
  for (let c = 1; c < puzzle.numCategories; c++) {
    for (let e = 0; e < puzzle.numItems; e++) {
      let rowYes = -1;
      for (let j = 0; j < puzzle.numItems; j++) {
        if (getMark(marks, 0, c, e, j) === 2) { rowYes = j; break; }
      }
      if (rowYes === -1) { allFilled = false; }
      else if (rowYes !== puzzle.solution[e][c]) { allCorrect = false; }
    }
  }
  if (!allFilled) return;

  if (allCorrect) {
    if (!solvedAnnounced) {
      solvedAnnounced = true;
      finishPuzzle();
    }
  } else {
    setMessage("Hmm — the grid is full, but something doesn't quite match the clues. Want to double-check, or use a hint?");
  }
}

async function finishPuzzle() {
  const text = `Wonderful! You solved the ${puzzle.theme.name} puzzle.`;
  $('done-text').textContent = text;
  $('done-id').textContent = `Puzzle ${puzzle.id}`;
  setSetting('solvedCount', getSetting('solvedCount', 0) + 1);
  if (voiceEnabled()) chime();
  speak(text);
  await clearGame();
  showScreen('done');
  celebrate();
}

// ---------------------------------------------------------------------------
// Messages & clue highlighting
// ---------------------------------------------------------------------------

/** Show a message on screen and (unless silent) speak it aloud. */
function setMessage(text, { silent = false } = {}) {
  $('message').textContent = text;
  if (!silent) speak(text);
}

// ---------------------------------------------------------------------------
// Voice input — Talk button + intent dispatch
// ---------------------------------------------------------------------------

const WELCOME_TEXT =
  "Welcome to Puzzle Talk! Here's how it works. I'll give you a little story " +
  "and some clues. You figure out who goes with what — and you can do it all " +
  "just by talking to me. Tap the big blue microphone button, then say things like: " +
  "Mary doesn't have the cat. I'll mark the puzzle grid for you. " +
  "If you ever feel stuck, just say: give me a hint. " +
  "Ready? Pick Easy to try your first puzzle.";

// Gentle nudge if she's been quiet on the play screen for a while.
const IDLE_NUDGE_MS = 90000;
let idleTimer = null;

function armIdleNudge() {
  clearTimeout(idleTimer);
  if ($('screen-play').classList.contains('hidden') || solvedAnnounced) return;
  idleTimer = setTimeout(() => {
    if (!$('screen-play').classList.contains('hidden') && !solvedAnnounced) {
      setMessage("Take your time — there's no hurry. Whenever you're ready, you can say: read the clues. Or: give me a hint.");
    }
  }, IDLE_NUDGE_MS);
}

const HELP_TEXT =
  "Here's how to play. Every person matches one thing in each group, and the clues " +
  "tell you how to figure out who goes with what. Tell me things like: " +
  "Mary doesn't have the cat. Or: Ben lives in House 2. I'll mark the grid for you. " +
  "You can also say: read the clues. Give me a hint. What do I know so far? Or: undo.";

/** Friendly phrase for a (cat,item) pair, e.g. "Alice" or "keeps the Dog". */
function refPhrase(ref, positive) {
  if (ref.cat === 0) return puzzle.theme.categories[0].items[ref.item];
  const c = puzzle.theme.categories[ref.cat];
  const tmpl = positive ? c.does : c.not;
  return tmpl.replace('{}', c.items[ref.item]);
}

/** Spoken confirmation for a mark, e.g. "Okay — Alice doesn't keep the Cat." */
function confirmPhrase(a, i, b, j, positive) {
  // Prefer name-first phrasing when a name is involved.
  const refs = a === 0 ? [{ cat: a, item: i }, { cat: b, item: j }]
             : b === 0 ? [{ cat: b, item: j }, { cat: a, item: i }]
             : [{ cat: a, item: i }, { cat: b, item: j }];
  if (refs[0].cat === 0) {
    return `${refPhrase(refs[0])} ${refPhrase(refs[1], positive)}`;
  }
  const whoDoes = puzzle.theme.categories[refs[0].cat].does
    .replace('{}', puzzle.theme.categories[refs[0].cat].items[refs[0].item]);
  return `the ${puzzle.theme.who} who ${whoDoes} ${refPhrase(refs[1], positive)}`;
}

/** Would marking this cell YES clash with an existing YES in its row/column? */
function conflictsWithExistingYes(a, b, i, j) {
  for (let k = 0; k < puzzle.numItems; k++) {
    if (k !== j && getMark(marks, a, b, i, k) === 2) return true;
    if (k !== i && getMark(marks, a, b, k, j) === 2) return true;
  }
  return false;
}

function applyVoiceMark(a, b, i, j, value) {
  setMark(a, b, i, j, value);
  if (!solvedAnnounced) {
    setMessage(`Okay — ${confirmPhrase(a, i, b, j, value === 2)}.`);
  }
}

function proposeMark(refs, positive, confident) {
  const [r1, r2] = refs;
  const a = r1.cat, i = r1.item, b = r2.cat, j = r2.item;
  const value = positive ? 2 : 1;
  const existing = getMark(marks, a, b, i, j);

  if (existing === value) {
    setMessage(`That's already marked — ${confirmPhrase(a, i, b, j, positive)}.`);
    return;
  }

  const overwriting = existing !== 0;
  const clashing = positive && conflictsWithExistingYes(a, b, i, j);

  if (!confident || overwriting || clashing) {
    pendingAction = { kind: 'mark', a, b, i, j, value };
    let q = `Did you mean: ${confirmPhrase(a, i, b, j, positive)}?`;
    if (overwriting) q = `That square is already marked. Change it so ${confirmPhrase(a, i, b, j, positive)}?`;
    else if (clashing) q = `Hmm — that row already has a check mark. Are you sure ${confirmPhrase(a, i, b, j, positive)}?`;
    setMessage(`${q} Say yes or no.`);
    return;
  }

  applyVoiceMark(a, b, i, j, value);
}

function readClue(n) { // 1-based
  if (n < 1 || n > puzzle.clues.length) {
    setMessage(`There are ${puzzle.clues.length} clues. Which one would you like?`);
    return;
  }
  lastClueIndex = n - 1;
  highlightClue(lastClueIndex);
  setMessage(`Clue ${n}. ${clueText(puzzle.clues[lastClueIndex], puzzle.theme)}`);
}

function statusSummary() {
  const found = [];
  for (let c = 1; c < puzzle.numCategories; c++) {
    for (let e = 0; e < puzzle.numItems; e++) {
      for (let j = 0; j < puzzle.numItems; j++) {
        if (getMark(marks, 0, c, e, j) === 2) {
          found.push(confirmPhrase(0, e, c, j, true));
        }
      }
    }
  }
  const total = puzzle.numItems * (puzzle.numCategories - 1);
  if (found.length === 0) {
    setMessage("Nothing is settled yet — but every ✗ helps! Try asking for a hint.");
  } else {
    setMessage(`So far you know: ${found.join('. ')}. That's ${found.length} of ${total} answers.`);
  }
}

function checkWork() {
  let wrong = 0, right = 0;
  for (let c = 1; c < puzzle.numCategories; c++) {
    for (let e = 0; e < puzzle.numItems; e++) {
      for (let j = 0; j < puzzle.numItems; j++) {
        if (getMark(marks, 0, c, e, j) === 2) {
          if (puzzle.solution[e][c] === j) right++; else wrong++;
        }
      }
    }
  }
  const total = puzzle.numItems * (puzzle.numCategories - 1);
  if (wrong === 0 && right === total) {
    setMessage("Everything matches — you've solved it!");
  } else if (wrong === 0) {
    setMessage(`Everything you've marked looks right so far — ${right} of ${total} answers found. Keep going!`);
  } else {
    setMessage("Most of it looks good, but at least one check mark doesn't quite match the clues. You can say undo, or ask for a hint.");
  }
}

function handleUtterance(text) {
  armIdleNudge();
  const parsed = parseUtterance(text, puzzle.theme);

  // Resolve a pending yes/no question first.
  if (pendingAction) {
    if (parsed.intent === 'yes') {
      const p = pendingAction; pendingAction = null;
      if (p.kind === 'mark') applyVoiceMark(p.a, p.b, p.i, p.j, p.value);
      if (p.kind === 'new_puzzle') { stopSpeaking(); clearGame(); showScreen('start'); }
      return;
    }
    if (parsed.intent === 'no') {
      pendingAction = null;
      setMessage("Okay, never mind.");
      return;
    }
    pendingAction = null; // anything else cancels the question and is handled below
  }

  switch (parsed.intent) {
    case 'mark':
      proposeMark(parsed.refs, parsed.positive, parsed.confident);
      break;
    case 'partial': {
      const label = parsed.refs[0].label;
      setMessage(`I heard "${label}" — but ${label} and what? Say both, like: ${puzzle.theme.categories[0].items[0]} ${puzzle.theme.categories[1].does.replace('{}', puzzle.theme.categories[1].items[0])}.`);
      break;
    }
    case 'undo': undo(); break;
    case 'hint': requestHint(); break;
    case 'reveal': revealOneAnswer(); break;
    case 'help': setMessage(HELP_TEXT); break;
    case 'status': statusSummary(); break;
    case 'check': checkWork(); break;
    case 'read_all': readCluesAloud(); break;
    case 'read_clue': readClue(parsed.n); break;
    case 'repeat':
      readClue(lastClueIndex >= 0 ? lastClueIndex + 1 : 1);
      break;
    case 'next_clue':
      readClue(lastClueIndex + 2 > puzzle.clues.length ? 1 : lastClueIndex + 2);
      break;
    case 'new_puzzle':
      pendingAction = { kind: 'new_puzzle' };
      setMessage("Leave this puzzle and start a new one? Say yes or no.");
      break;
    case 'yes':
    case 'no':
      setMessage("I'm not sure what that was for — try telling me a deduction, like: " +
        `${puzzle.theme.categories[0].items[0]} ${puzzle.theme.categories[1].not.replace('{}', puzzle.theme.categories[1].items[0])}.`);
      break;
    default:
      setMessage(`I heard "${text}" — but I didn't quite understand. You can say things like: ` +
        `${puzzle.theme.categories[0].items[0]} ${puzzle.theme.categories[1].not.replace('{}', puzzle.theme.categories[1].items[0])}. Or: read the clues. Or: give me a hint.`);
  }
}

function startTalking() {
  primeSpeech();
  if (!recognitionAvailable()) {
    setMessage("I'm sorry — this browser can't listen for speech. You can still tap the grid to play.");
    return;
  }
  if (isListening()) { stopListening(); return; }

  const talkBtn = $('btn-talk');
  listenOnce({
    onStart: () => {
      talkBtn.classList.add('listening');
      talkBtn.textContent = '👂';
      $('message').textContent = "I'm listening…";
    },
    onResult: (text) => handleUtterance(text),
    onEnd: (gotResult) => {
      talkBtn.classList.remove('listening');
      talkBtn.textContent = '🎤';
      if (!gotResult && $('message').textContent === "I'm listening…") {
        setMessage("I didn't hear anything. Tap the microphone and try again.", { silent: true });
      }
    },
    onError: (err) => {
      talkBtn.classList.remove('listening');
      talkBtn.textContent = '🎤';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setMessage("I need permission to use the microphone. Please allow it in Safari and try again.");
      } else if (err === 'no-speech') {
        setMessage("I didn't hear anything. Tap the microphone and try again.", { silent: true });
      } else {
        setMessage("Sorry, I had trouble hearing. Tap the microphone to try again.", { silent: true });
      }
    },
  });
}

function readCluesAloud() {
  const texts = [puzzle.theme.intro];
  puzzle.clues.forEach((clue, i) => {
    texts.push(`Clue ${i + 1}. ${clueText(clue, puzzle.theme)}`);
  });
  speakSequence(texts);
}

function highlightClue(index, secondary = false) {
  const items = $('clues').querySelectorAll('li');
  items.forEach((li, i) => {
    if (i === index) li.classList.add('clue-highlight');
  });
  // Clear highlights after a while
  setTimeout(() => {
    items.forEach(li => li.classList.remove('clue-highlight'));
  }, 6000);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!puzzle || solvedAnnounced) return;
    saveGame({
      difficulty: puzzle.difficulty,
      seed: puzzle.seed,
      themeIndex: puzzle.themeIndex,
      marks: [...marks.entries()],
      undoStack,
    }).catch(() => { /* best effort */ });
  }, 300);
}

// ---------------------------------------------------------------------------
// Puzzle lifecycle
// ---------------------------------------------------------------------------

function startPuzzle(p, restoredMarks = null, restoredUndo = null) {
  puzzle = p;
  marks = new Map(restoredMarks || []);
  // Undo entries are groups (arrays); wrap any single entries from old saves.
  undoStack = (restoredUndo || []).map(e => (Array.isArray(e) ? e : [e]));
  solvedAnnounced = false;
  currentPage = 0;

  // Title + clues
  $('puzzle-title').textContent = `${p.theme.name} (${p.difficulty})`;
  const cluesEl = $('clues');
  cluesEl.textContent = '';
  p.clues.forEach((clue, idx) => {
    const li = document.createElement('li');
    li.textContent = clueText(clue, p.theme);
    cluesEl.appendChild(li);
  });

  // Grid
  gridApi = renderGrid($('grid'), p.theme, marks, cycleMark);
  updatePaging();

  setMessage(p.theme.intro);
  showScreen('play');
  armIdleNudge();
  autosave();
}

function newPuzzle(difficulty) {
  setSetting('difficulty', difficulty);
  let p = null;
  for (let tries = 0; tries < 8 && !p; tries++) {
    p = generatePuzzle({ difficulty });
  }
  if (!p) {
    setMessage("Sorry, I had trouble making a puzzle. Please try again.");
    return;
  }
  startPuzzle(p);
}

// ---------------------------------------------------------------------------
// Phone paging
// ---------------------------------------------------------------------------

function isNarrow() {
  return window.matchMedia('(max-width: 700px)').matches;
}

function updatePaging() {
  const pairs = gridApi.pairs;
  if (isNarrow()) {
    showPage($('grid'), pairs, currentPage);
    const [a, b] = pairs[currentPage];
    $('page-label').textContent =
      `${puzzle.theme.categories[a].label} × ${puzzle.theme.categories[b].label} (${currentPage + 1} of ${pairs.length})`;
    $('pager').classList.remove('hidden');
  } else {
    showPage($('grid'), pairs, -1);
    $('pager').classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Wire up UI
// ---------------------------------------------------------------------------

async function init() {
  requestPersistence();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // Voice on/off (persisted). Priming must happen inside a user gesture (iOS).
  setVoiceEnabled(getSetting('voice', true) && speechAvailable());
  const voiceBtn = $('btn-voice');
  function refreshVoiceBtn() {
    voiceBtn.textContent = voiceEnabled() ? 'Voice: on' : 'Voice: off';
    voiceBtn.setAttribute('aria-pressed', String(voiceEnabled()));
  }
  refreshVoiceBtn();
  voiceBtn.addEventListener('click', () => {
    primeSpeech();
    const on = !voiceEnabled();
    setVoiceEnabled(on && speechAvailable());
    setSetting('voice', on);
    refreshVoiceBtn();
    if (voiceEnabled()) speak('Voice is on.');
  });

  $('btn-easy').addEventListener('click', () => { primeSpeech(); newPuzzle('easy'); });
  $('btn-medium').addEventListener('click', () => { primeSpeech(); newPuzzle('medium'); });
  $('btn-hard').addEventListener('click', () => { primeSpeech(); newPuzzle('hard'); });

  $('btn-talk').addEventListener('click', startTalking);
  $('btn-help').addEventListener('click', () => { primeSpeech(); setMessage(HELP_TEXT); });

  // Choose-by-ear voice picker (on the start screen)
  $('btn-voice-pick').addEventListener('click', async () => {
    primeSpeech();
    const name = await cycleVoice();
    $('btn-voice-pick').textContent = name
      ? `🔈 Voice: ${name.replace(/\(.*\)/, '').trim()} — tap to try another`
      : '🔈 No voices available';
  });
  $('btn-read').addEventListener('click', () => { primeSpeech(); readCluesAloud(); });
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', requestHint);
  $('btn-reveal').addEventListener('click', revealOneAnswer);
  $('btn-quit').addEventListener('click', async () => {
    stopSpeaking();
    await clearGame();
    showScreen('start');
  });
  $('btn-done-home').addEventListener('click', () => showScreen('start'));

  $('btn-prev').addEventListener('click', () => {
    currentPage = (currentPage - 1 + gridApi.pairs.length) % gridApi.pairs.length;
    updatePaging();
  });
  $('btn-next').addEventListener('click', () => {
    currentPage = (currentPage + 1) % gridApi.pairs.length;
    updatePaging();
  });
  window.addEventListener('resize', () => { if (puzzle) updatePaging(); });

  // First-run welcome (one big button; the tap is also the iOS audio unlock)
  $('btn-welcome').addEventListener('click', () => {
    primeSpeech();
    setSetting('welcomed', true);
    showScreen('start');
    speak(WELCOME_TEXT);
  });

  // Idle nudge: any tap or utterance resets the timer
  document.addEventListener('pointerdown', armIdleNudge);

  // Resume saved game?
  let saved = null;
  try { saved = await loadGame(); } catch { /* ignore */ }
  if (saved && saved.seed !== undefined) {
    const p = generatePuzzle({
      difficulty: saved.difficulty,
      seed: saved.seed,
      themeIndex: saved.themeIndex,
    });
    if (p) {
      startPuzzle(p, saved.marks, saved.undoStack);
      setMessage("Welcome back! Your puzzle is just as you left it.");
      return;
    }
  }
  showScreen(getSetting('welcomed', false) ? 'start' : 'welcome');
}

init();

// Debug hook: lets us test the voice pipeline without a microphone
// (feeds text through the exact path recognizer results take).
window.__handleUtterance = (text) => handleUtterance(text);

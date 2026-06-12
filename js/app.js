/**
 * app.js — game state, screens, undo, hints, autosave.
 * Voice layers (Milestones 3–4) will plug into the same action functions
 * used by touch (setMark, undo, requestHint) — engine and UI stay decoupled.
 */

import { generatePuzzle, clueText, deriveHint, doesPhrase } from './generator.js';
import { setFamilyNames, themeCount } from './themes.js';
import { renderGrid, showPage, flashCell, markKey, getMark, categoryPairs } from './grid.js';
import { saveGame, loadGame, clearGame, requestPersistence, getSetting, setSetting } from './storage.js';
import { primeSpeech, speak, speakSequence, stopSpeaking, setVoiceEnabled, voiceEnabled, speechAvailable, listenOnce, recognitionAvailable, isListening, stopListening, voiceChoices, selectVoice, currentVoiceName } from './speech.js';
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
let coachMode = false;      // first-ever puzzle gets gentle coaching
let coachStep = 0;
let shareMessage = '';      // filled in when a puzzle is solved

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function showScreen(name) {
  $('screen-welcome').classList.toggle('hidden', name !== 'welcome');
  $('screen-start').classList.toggle('hidden', name !== 'start');
  $('screen-play').classList.toggle('hidden', name !== 'play');
  $('screen-done').classList.toggle('hidden', name !== 'done');
  if (name === 'start') {
    refreshSolvedCount();
    // Offer to continue a puzzle that's underway
    $('btn-continue').classList.toggle('hidden', !(puzzle && !solvedAnnounced));
  }
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
  coachEncourage();
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
    $('btn-fix').classList.remove('hidden');
    setMessage("Hmm — the grid is full, but something doesn't quite match the clues. Don't worry! Just say: fix my mistakes — or tap the Fix button — and I'll clear the marks that don't fit, keeping all your correct work.");
  }
}

async function finishPuzzle() {
  coachMode = false;
  const text = `Wonderful! You solved the ${puzzle.theme.name} puzzle.`;
  $('done-text').textContent = text;
  $('done-id').textContent = `Puzzle ${puzzle.id}`;
  setSetting('solvedCount', getSetting('solvedCount', 0) + 1);
  shareMessage = `I just solved the "${puzzle.theme.name}" ${puzzle.difficulty} logic puzzle on Puzzle Talk! 🧩`;
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

/**
 * Ask a question aloud, then open the microphone automatically so she can
 * answer hands-free (no Talk tap needed for yes/no questions).
 */
async function askAndListen(text) {
  $('message').textContent = text;
  await speak(text);
  if (pendingAction && recognitionAvailable() && voiceEnabled() && !isListening()) {
    startTalking();
  }
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
    askAndListen(`${q} Say yes or no.`);
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

/** Does the real solution connect item i of category a with item j of category b? */
function cellCorrect(a, b, i, j) {
  for (let e = 0; e < puzzle.numItems; e++) {
    const hasA = a === 0 ? e === i : puzzle.solution[e][a] === i;
    const hasB = b === 0 ? e === j : puzzle.solution[e][b] === j;
    if (hasA && hasB) return true;
  }
  return false;
}

/** Clear every mark that contradicts the solution — the un-stuck button. */
export function fixMistakes() {
  const group = [];
  for (const [a, b] of categoryPairs(puzzle.numCategories)) {
    for (let i = 0; i < puzzle.numItems; i++) {
      for (let j = 0; j < puzzle.numItems; j++) {
        const v = getMark(marks, a, b, i, j);
        if (v === 0) continue;
        const correct = cellCorrect(a, b, i, j);
        if ((v === 2 && !correct) || (v === 1 && correct)) {
          const key = markKey(a, b, i, j);
          group.push({ key, prev: v, next: 0 });
          marks.delete(key);
        }
      }
    }
  }
  $('btn-fix').classList.add('hidden');
  if (group.length === 0) {
    setMessage("Good news — everything on your grid matches the clues! Keep going.");
    return;
  }
  undoStack.push(group);
  gridApi.refresh(marks);
  autosave();
  setMessage(`I cleared ${group.length === 1 ? 'one mark' : group.length + ' marks'} that didn't match the clues. Everything still on the grid is right — keep going!`);
}

/** Read the grid back, person by person — for finding your place again. */
function readGridBack() {
  const lines = [];
  for (let e = 0; e < puzzle.numItems; e++) {
    const name = puzzle.theme.categories[0].items[e];
    const knowns = [];
    for (let c = 1; c < puzzle.numCategories; c++) {
      for (let j = 0; j < puzzle.numItems; j++) {
        if (getMark(marks, 0, c, e, j) === 2) {
          knowns.push(confirmPhrase(0, e, c, j, true));
        }
      }
    }
    lines.push(knowns.length > 0 ? knowns.join('. ') : `Nothing settled for ${name} yet`);
  }
  setMessage(`Here's your grid. ${lines.join('. ')}.`);
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
    case 'read_grid': readGridBack(); break;
    case 'fix_mistakes': fixMistakes(); break;
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
      askAndListen("Leave this puzzle and start a new one? Say yes or no.");
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
      // Keep the question on screen while auto-listening for its answer
      if (!pendingAction) $('message').textContent = "I'm listening…";
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

// Faint per-theme watermark behind the play screen.
const THEME_EMOJI = {
  'Garden Club': '🌷', 'Grandkids': '🧸', 'Church Potluck': '🥧',
  'Book Club': '📚', 'Street Neighbors': '🏡', 'Craft Fair': '🧶',
  'Bingo Night': '🎯', 'Farmers Market': '🌽', 'Bird Watchers': '🐦',
  'Bake Sale': '🧁', 'Quilting Bee': '🧵', 'Family Recipes': '🍲',
  'Choir Practice': '🎵', 'Lake Cabin Week': '🛶',
};

function setThemeBackground(themeName) {
  const emoji = THEME_EMOJI[themeName] || '🧩';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>` +
    `<text x='30' y='70' font-size='44' opacity='0.06'>${emoji}</text>` +
    `<text x='130' y='180' font-size='44' opacity='0.06' transform='rotate(-12 150 160)'>${emoji}</text>` +
    `</svg>`;
  $('screen-play').style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function startPuzzle(p, restoredMarks = null, restoredUndo = null) {
  setThemeBackground(p.theme.name);
  puzzle = p;
  marks = new Map(restoredMarks || []);
  // Undo entries are groups (arrays); wrap any single entries from old saves.
  undoStack = (restoredUndo || []).map(e => (Array.isArray(e) ? e : [e]));
  solvedAnnounced = false;
  currentPage = 0;
  $('btn-fix').classList.add('hidden');

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

  setMessage(coachMode ? `${p.theme.intro} ${coachSuggestion()}` : p.theme.intro);
  showScreen('play');
  armIdleNudge();
  autosave();
}

function newPuzzle(difficulty) {
  setSetting('difficulty', difficulty);
  // Gentle onboarding: coach the very first puzzle (before any win).
  coachMode = difficulty === 'easy' && getSetting('solvedCount', 0) === 0;
  coachStep = 0;
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

/** Today's puzzle — same for everyone, a fresh one each day. */
function dailyPuzzle() {
  const day = Math.floor(Date.now() / 86400000); // UTC day number
  coachMode = false;
  let p = null;
  for (let tries = 0; tries < 8 && !p; tries++) {
    p = generatePuzzle({
      difficulty: 'medium',
      seed: (day * 7919 + tries * 104729) >>> 0,
      themeIndex: (day + tries) % themeCount(),
    });
  }
  if (!p) { setMessage("Sorry, I had trouble making today's puzzle."); return; }
  startPuzzle(p);
}

// --- Onboarding coach (first puzzle ever) ---

/** Suggest an exact phrase she can say, drawn from this puzzle's own clues. */
function coachSuggestion() {
  const c = puzzle.clues.find(x => x.type === 'direct_neg' || x.type === 'direct_pos');
  if (c) {
    const name = puzzle.theme.categories[0].items[c.nameIdx];
    const cat = puzzle.theme.categories[c.cat];
    const tmpl = c.type === 'direct_pos' ? cat.does : cat.not;
    return `Let's try it together. Tap the big blue microphone and say: ${name} ${tmpl.replace('{}', cat.items[c.itemIdx])}.`;
  }
  return 'Tap the big blue microphone and say: read the clues.';
}

function coachEncourage() {
  if (!coachMode) return;
  coachStep++;
  if (coachStep === 1) {
    setTimeout(() => {
      if (coachMode && !solvedAnnounced) {
        setMessage("Lovely — that's exactly how it works! Keep going clue by clue. Whenever you're unsure, just say: give me a hint.");
      }
    }, 4500);
    coachMode = false; // one nudge is plenty; the hints take it from here
  }
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
// Menu overlay
// ---------------------------------------------------------------------------

function openMenu() {
  primeSpeech();
  // Home button only makes sense while a puzzle is open
  $('menu-game-section').classList.toggle('hidden',
    $('screen-play').classList.contains('hidden'));
  $('menu-help-text').classList.add('hidden');
  refreshVoiceToggle();
  populateVoiceList();
  $('menu-overlay').classList.remove('hidden');
}

function closeMenu() {
  $('menu-overlay').classList.add('hidden');
}

function refreshVoiceToggle() {
  $('menu-voice-toggle').textContent = voiceEnabled()
    ? '🔊 Voice is ON — tap to turn off'
    : '🔇 Voice is OFF — tap to turn on';
}

async function populateVoiceList() {
  const box = $('menu-voices');
  box.textContent = 'Looking for voices…';
  const choices = await voiceChoices();
  box.textContent = '';
  if (choices.length === 0) {
    box.textContent = 'No voices found on this device.';
    return;
  }
  const current = currentVoiceName();
  for (const v of choices) {
    const btn = document.createElement('button');
    btn.className = 'menu-btn voice-btn' + (v.name === current ? ' voice-current' : '');
    btn.textContent = (v.name === current ? '✓ ' : '') + v.label +
      ' (' + v.accent + ')' + (v.natural ? ' ⭐ natural' : '');
    btn.addEventListener('click', async () => {
      await selectVoice(v.name);
      populateVoiceList(); // refresh checkmarks
    });
    box.appendChild(btn);
  }
}

function initMenu() {
  $('btn-menu').addEventListener('click', openMenu);
  $('btn-start-menu').addEventListener('click', openMenu);
  $('menu-close').addEventListener('click', closeMenu);
  $('menu-overlay').addEventListener('click', (e) => {
    if (e.target === $('menu-overlay')) closeMenu();
  });

  $('menu-home').addEventListener('click', () => {
    stopSpeaking();
    closeMenu();
    showScreen('start');
  });

  for (const btn of document.querySelectorAll('.menu-new')) {
    btn.addEventListener('click', () => {
      closeMenu();
      newPuzzle(btn.dataset.diff);
    });
  }

  $('menu-voice-toggle').addEventListener('click', () => {
    const on = !voiceEnabled();
    setVoiceEnabled(on && speechAvailable());
    setSetting('voice', on);
    refreshVoiceToggle();
    if (voiceEnabled()) speak('Voice is on.');
  });

  // Family names → Grandkids puzzles
  const famInputs = [...document.querySelectorAll('.fam-name')];
  const savedNames = getSetting('familyNames', []);
  famInputs.forEach((inp, i) => { inp.value = savedNames[i] || ''; });
  $('menu-save-names').addEventListener('click', () => {
    const names = famInputs.map(inp => inp.value);
    const applied = setFamilyNames(names);
    setSetting('familyNames', applied);
    famInputs.forEach((inp, i) => { inp.value = applied[i] || ''; });
    speak(applied.length > 0
      ? `Saved! The next Grandkids puzzle will star ${applied.join(', ')}.`
      : 'Names cleared — back to the regular puzzle names.');
    $('menu-save-names').textContent = '✓ Saved!';
    setTimeout(() => { $('menu-save-names').textContent = '💾 Save names'; }, 2500);
  });

  // Larger print toggle
  function refreshBigText() {
    const on = getSetting('bigText', false);
    document.documentElement.classList.toggle('big-text', on);
    $('menu-big-text').textContent = on
      ? '🔍 Larger print is ON — tap for regular size'
      : '🔍 Tap for larger print';
  }
  refreshBigText();
  $('menu-big-text').addEventListener('click', () => {
    setSetting('bigText', !getSetting('bigText', false));
    refreshBigText();
  });

  $('menu-instructions').addEventListener('click', () => {
    if (!$('screen-play').classList.contains('hidden')) {
      closeMenu();
      setMessage(HELP_TEXT);
    } else {
      const el = $('menu-help-text');
      el.textContent = HELP_TEXT;
      el.classList.remove('hidden');
      speak(HELP_TEXT);
    }
  });
}

// ---------------------------------------------------------------------------
// Wire up UI
// ---------------------------------------------------------------------------

async function init() {
  requestPersistence();
  // Saved family names personalize the Grandkids theme (must run before
  // any puzzle — including a resumed one — is generated).
  const fam = getSetting('familyNames', []);
  if (fam.length > 0) setFamilyNames(fam);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // Voice on/off (persisted). Priming must happen inside a user gesture (iOS).
  setVoiceEnabled(getSetting('voice', true) && speechAvailable());

  $('btn-easy').addEventListener('click', () => { primeSpeech(); newPuzzle('easy'); });
  $('btn-medium').addEventListener('click', () => { primeSpeech(); newPuzzle('medium'); });
  $('btn-hard').addEventListener('click', () => { primeSpeech(); newPuzzle('hard'); });
  $('btn-continue').addEventListener('click', () => { primeSpeech(); showScreen('play'); });
  $('btn-daily').addEventListener('click', () => { primeSpeech(); dailyPuzzle(); });

  // Share a win (system share sheet; falls back to copying the text)
  $('btn-share').addEventListener('click', async () => {
    const text = shareMessage || 'I just solved a logic puzzle on Puzzle Talk! 🧩';
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        $('btn-share').textContent = '✓ Copied — paste it in a message!';
      } catch { /* no clipboard either; nothing to do */ }
    }
  });

  $('btn-talk').addEventListener('click', startTalking);
  $('btn-read').addEventListener('click', () => { primeSpeech(); readCluesAloud(); });
  $('btn-fix').addEventListener('click', () => { primeSpeech(); fixMistakes(); });
  $('btn-howto').addEventListener('click', () => {
    primeSpeech();
    openMenu();
    const el = $('menu-help-text');
    el.textContent = HELP_TEXT;
    el.classList.remove('hidden');
    $('menu-instructions').scrollIntoView({ block: 'center' });
    speak(HELP_TEXT);
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', requestHint);
  $('btn-reveal').addEventListener('click', revealOneAnswer);

  // Home keeps the puzzle saved — she can continue any time.
  $('btn-home').addEventListener('click', () => { stopSpeaking(); showScreen('start'); });
  $('btn-done-home').addEventListener('click', () => showScreen('start'));

  initMenu();

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

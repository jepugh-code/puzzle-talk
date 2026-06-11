/**
 * app.js — game state, screens, undo, hints, autosave.
 * Voice layers (Milestones 3–4) will plug into the same action functions
 * used by touch (setMark, undo, requestHint) — engine and UI stay decoupled.
 */

import { generatePuzzle, clueText, deriveHint, doesPhrase } from './generator.js';
import { renderGrid, showPage, flashCell, markKey, getMark, categoryPairs } from './grid.js';
import { saveGame, loadGame, clearGame, requestPersistence, getSetting, setSetting } from './storage.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let puzzle = null;          // generated puzzle object
let marks = new Map();      // markKey → 0/1/2
let undoStack = [];         // [{key, prev, next}]
let gridApi = null;         // { refresh, pairs }
let currentPage = 0;
let solvedAnnounced = false;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function showScreen(name) {
  $('screen-start').classList.toggle('hidden', name !== 'start');
  $('screen-play').classList.toggle('hidden', name !== 'play');
  $('screen-done').classList.toggle('hidden', name !== 'done');
}

// ---------------------------------------------------------------------------
// Game actions (voice layer will call these too)
// ---------------------------------------------------------------------------

export function setMark(a, b, i, j, value) {
  const key = markKey(a, b, i, j);
  const prev = marks.get(key) || 0;
  if (prev === value) return;
  undoStack.push({ key, prev, next: value });
  if (value === 0) marks.delete(key); else marks.set(key, value);
  gridApi.refresh(marks);
  flashCell($('grid'), a, b, i, j);
  autosave();
  checkCompletion();
}

export function undo() {
  const last = undoStack.pop();
  if (!last) { setMessage("Nothing to undo."); return; }
  if (last.prev === 0) marks.delete(last.key); else marks.set(last.key, last.prev);
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
  $('done-text').textContent = `Wonderful! You solved the ${puzzle.theme.name} puzzle. 🎉`;
  $('done-id').textContent = `Puzzle ${puzzle.id}`;
  await clearGame();
  showScreen('done');
}

// ---------------------------------------------------------------------------
// Messages & clue highlighting
// ---------------------------------------------------------------------------

function setMessage(text) {
  $('message').textContent = text;
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
  undoStack = restoredUndo || [];
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
  autosave();
}

function newPuzzle(difficulty) {
  setSetting('difficulty', difficulty);
  const p = generatePuzzle({ difficulty });
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

  $('btn-easy').addEventListener('click', () => newPuzzle('easy'));
  $('btn-medium').addEventListener('click', () => newPuzzle('medium'));
  $('btn-hard').addEventListener('click', () => newPuzzle('hard'));

  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', requestHint);
  $('btn-reveal').addEventListener('click', revealOneAnswer);
  $('btn-quit').addEventListener('click', async () => {
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
  showScreen('start');
}

init();

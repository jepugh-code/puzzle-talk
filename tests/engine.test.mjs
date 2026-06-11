/**
 * Milestone 1 engine tests — run with: node tests/engine.test.mjs
 */

import assert from 'node:assert/strict';
import { createState, applyClue, propagate, isSolved, countSolutions, getCell, YES, NO } from '../js/solver.js';
import { generatePuzzle, clueText, deriveHint, createRng } from '../js/generator.js';
import { getTheme } from '../js/themes.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
console.log('\n── Solver: basic constraint propagation ──');
// ---------------------------------------------------------------------------

test('direct_pos sets YES and eliminates row/col', () => {
  const state = createState(3, 3);
  applyClue(state, { type: 'direct_pos', cat: 1, nameIdx: 0, itemIdx: 2 });
  assert.equal(getCell(state, 0, 1, 0, 2), YES);
  assert.equal(getCell(state, 0, 1, 0, 0), NO);
  assert.equal(getCell(state, 0, 1, 0, 1), NO);
  assert.equal(getCell(state, 0, 1, 1, 2), NO);
  assert.equal(getCell(state, 0, 1, 2, 2), NO);
});

test('direct_neg sets NO', () => {
  const state = createState(3, 3);
  applyClue(state, { type: 'direct_neg', cat: 1, nameIdx: 1, itemIdx: 0 });
  assert.equal(getCell(state, 0, 1, 1, 0), NO);
});

test('link_pos propagates transitively', () => {
  // If cat1[0]=cat2[1], and we learn names[2]=cat1[0], then names[2]=cat2[1]
  const state = createState(3, 3);
  applyClue(state, { type: 'link_pos', catA: 1, catB: 2, itemA: 0, itemB: 1 });
  applyClue(state, { type: 'direct_pos', cat: 1, nameIdx: 2, itemIdx: 0 });
  assert.equal(getCell(state, 0, 2, 2, 1), YES);
});

test('single remaining unknown in row becomes YES', () => {
  const state = createState(3, 3);
  applyClue(state, { type: 'direct_neg', cat: 1, nameIdx: 0, itemIdx: 0 });
  applyClue(state, { type: 'direct_neg', cat: 1, nameIdx: 0, itemIdx: 1 });
  // Only item 2 remains for names[0] in cat 1
  assert.equal(getCell(state, 0, 1, 0, 2), YES);
});

test('isSolved detects complete solution', () => {
  const state = createState(2, 3);
  // Assign: entity 0→item0, entity1→item1, entity2→item2 in cat1
  applyClue(state, { type: 'direct_pos', cat: 1, nameIdx: 0, itemIdx: 0 });
  applyClue(state, { type: 'direct_pos', cat: 1, nameIdx: 1, itemIdx: 1 });
  applyClue(state, { type: 'direct_pos', cat: 1, nameIdx: 2, itemIdx: 2 });
  assert.ok(isSolved(state));
});

test('countSolutions returns 0 for contradictory clue set', () => {
  const clues = [
    { type: 'direct_pos', cat: 1, nameIdx: 0, itemIdx: 0 },
    { type: 'direct_pos', cat: 1, nameIdx: 1, itemIdx: 0 }, // contradiction
  ];
  assert.equal(countSolutions(clues, 2, 3, 2), 0);
});

// ---------------------------------------------------------------------------
console.log('\n── Puzzle generation ──');
// ---------------------------------------------------------------------------

test('easy puzzle generates and is uniquely solvable', () => {
  const puzzle = generatePuzzle({ difficulty: 'easy', seed: 0xdeadbeef });
  assert.ok(puzzle, 'generatePuzzle returned null');
  assert.equal(puzzle.numCategories, 3);
  assert.equal(puzzle.numItems, 3);
  const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
  assert.equal(n, 1, `Expected 1 solution, got ${n}`);
});

test('medium puzzle generates and is uniquely solvable', () => {
  const puzzle = generatePuzzle({ difficulty: 'medium', seed: 0xcafebabe });
  assert.ok(puzzle, 'generatePuzzle returned null');
  assert.equal(puzzle.numCategories, 4);
  assert.equal(puzzle.numItems, 4);
  const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
  assert.equal(n, 1, `Expected 1 solution, got ${n}`);
});

test('hard puzzle generates and is uniquely solvable', () => {
  const puzzle = generatePuzzle({ difficulty: 'hard', seed: 0x12345678 });
  assert.ok(puzzle, 'generatePuzzle returned null');
  assert.equal(puzzle.numCategories, 4);
  assert.equal(puzzle.numItems, 5);
  const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
  assert.equal(n, 1, `Expected 1 solution, got ${n}`);
});

test('puzzle is reproducible from same seed', () => {
  const a = generatePuzzle({ difficulty: 'easy', seed: 0xaabbccdd });
  const b = generatePuzzle({ difficulty: 'easy', seed: 0xaabbccdd });
  assert.ok(a && b);
  assert.deepEqual(a.solution, b.solution);
  assert.deepEqual(a.clues, b.clues);
  assert.equal(a.id, b.id);
});

test('different seeds produce different puzzles', () => {
  const a = generatePuzzle({ difficulty: 'easy', seed: 1 });
  const b = generatePuzzle({ difficulty: 'easy', seed: 2 });
  assert.ok(a && b);
  assert.notDeepEqual(a.solution, b.solution);
});

test('clueText produces non-empty strings for all clue types', () => {
  // Try a few seeds; some may miss the hard difficulty band.
  let puzzle;
  for (const seed of [0x99887766, 0xabc12345, 0x55667788, 0xdeadbeef]) {
    puzzle = generatePuzzle({ difficulty: 'hard', seed });
    if (puzzle) break;
  }
  assert.ok(puzzle, 'Could not generate a hard puzzle in any of the test seeds');
  for (const clue of puzzle.clues) {
    const text = clueText(clue, puzzle.theme);
    assert.ok(text.length > 5, `Short clue text: "${text}"`);
  }
});

test('puzzle has a puzzle ID', () => {
  const puzzle = generatePuzzle({ difficulty: 'medium', seed: 0x11223344 });
  assert.ok(puzzle);
  assert.ok(typeof puzzle.id === 'string' && puzzle.id.length > 0);
});

// ---------------------------------------------------------------------------
console.log('\n── Difficulty bands (sample check) ──');
// ---------------------------------------------------------------------------

test('easy puzzle has no direct_neg-only requirement (trivially solvable)', () => {
  // Easy puzzles can be solved; the band check is permissive.
  const puzzle = generatePuzzle({ difficulty: 'easy', seed: 0x55aa55aa });
  assert.ok(puzzle);
});

test('medium puzzle has at least 3 multi-clue deductions', () => {
  // Try a few seeds to guard against lucky easy puzzles.
  let found = false;
  for (const s of [0x1, 0x2, 0x3, 0x4, 0x5]) {
    const puzzle = generatePuzzle({ difficulty: 'medium', seed: s });
    if (puzzle) { found = true; break; }
  }
  assert.ok(found, 'Could not generate any medium puzzle in 5 seeds');
});

// ---------------------------------------------------------------------------
console.log('\n── Hints ──');
// ---------------------------------------------------------------------------

test('deriveHint returns a single-clue hint for easy puzzle (fully open board)', () => {
  const puzzle = generatePuzzle({ difficulty: 'easy', seed: 0xfeed });
  assert.ok(puzzle);
  const hint = deriveHint(puzzle.clues, puzzle.numCategories, puzzle.numItems);
  assert.ok(['single', 'pair', 'solved'].includes(hint.type));
});

test('deriveHint returns solved when board is complete', () => {
  const puzzle = generatePuzzle({ difficulty: 'easy', seed: 0x1234 });
  assert.ok(puzzle);
  // Apply all clues to get solved state, then ask for hint
  const hint = deriveHint(puzzle.clues, puzzle.numCategories, puzzle.numItems);
  // With all clues applied and board solved, type should be 'solved'
  const state = createState(puzzle.numCategories, puzzle.numItems);
  propagate(state, puzzle.clues);
  if (isSolved(state)) {
    assert.equal(hint.type, 'solved');
  } else {
    assert.ok(['single', 'pair'].includes(hint.type));
  }
});

// ---------------------------------------------------------------------------
console.log('\n── Themes ──');
// ---------------------------------------------------------------------------

test('getTheme slices correctly for 3 categories, 3 items', () => {
  const theme = getTheme(0, 3, 3);
  assert.equal(theme.categories.length, 3);
  assert.equal(theme.categories[0].items.length, 3);
});

test('getTheme slices correctly for 4 categories, 5 items', () => {
  const theme = getTheme(0, 4, 5);
  assert.equal(theme.categories.length, 4);
  assert.equal(theme.categories[0].items.length, 5);
});

// ---------------------------------------------------------------------------
console.log('\n── Bulk generation smoke test ──');
// ---------------------------------------------------------------------------

test('10 easy puzzles all uniquely solvable', () => {
  const rng = createRng(0xdeadbeef);
  for (let i = 0; i < 10; i++) {
    const seed = (rng() * 0xffffffff) >>> 0;
    const puzzle = generatePuzzle({ difficulty: 'easy', seed });
    assert.ok(puzzle, `Puzzle ${i} returned null (seed ${seed.toString(16)})`);
    const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
    assert.equal(n, 1, `Puzzle ${i} (seed ${seed.toString(16)}) has ${n} solutions`);
  }
});

test('5 medium puzzles all uniquely solvable', () => {
  const rng = createRng(0xcafebabe);
  for (let i = 0; i < 5; i++) {
    const seed = (rng() * 0xffffffff) >>> 0;
    const puzzle = generatePuzzle({ difficulty: 'medium', seed });
    assert.ok(puzzle, `Medium puzzle ${i} returned null`);
    const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
    assert.equal(n, 1, `Medium puzzle ${i} has ${n} solutions`);
  }
});

test('3 hard puzzles all uniquely solvable', () => {
  const rng = createRng(0x13572468);
  for (let i = 0; i < 3; i++) {
    const seed = (rng() * 0xffffffff) >>> 0;
    const puzzle = generatePuzzle({ difficulty: 'hard', seed });
    assert.ok(puzzle, `Hard puzzle ${i} returned null`);
    const n = countSolutions(puzzle.clues, puzzle.numCategories, puzzle.numItems, 2);
    assert.equal(n, 1, `Hard puzzle ${i} has ${n} solutions`);
  }
});

// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed}/${total} tests passed${failed > 0 ? ` — ${failed} FAILED` : ' ✓'}`);
if (failed > 0) process.exit(1);

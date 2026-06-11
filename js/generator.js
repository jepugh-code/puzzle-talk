/**
 * generator.js — puzzle generation, clue creation, uniqueness verification,
 * difficulty pruning, and seeded RNG.
 *
 * generatePuzzle(options) → { id, seed, theme, solution, clues, difficulty }
 *
 * solution[entityIndex][categoryIndex] = itemIndex
 * (entity 0 is the entity whose name is names[0], etc.)
 */

import {
  createState, cloneState, applyClue, propagate,
  isSolved, countSolutions, getCell,
} from './solver.js';
import { getTheme, themeCount } from './themes.js';

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32 — simple, reproducible)
// ---------------------------------------------------------------------------

export function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) { // [min, max)
  return min + Math.floor(rng() * (max - min));
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Random solution generation
// ---------------------------------------------------------------------------

function randomSolution(rng, numCategories, numItems) {
  // solution[entity][category] = itemIndex
  // Category 0 is identity: entity i always has item i (names are fixed labels).
  const sol = Array.from({ length: numItems }, (_, e) =>
    Array.from({ length: numCategories }, (_, c) => c === 0 ? e : 0)
  );
  for (let c = 1; c < numCategories; c++) {
    const perm = shuffle(rng, Array.from({ length: numItems }, (_, i) => i));
    for (let e = 0; e < numItems; e++) sol[e][c] = perm[e];
  }
  return sol;
}

// Entity index for a given category/item pair (from solution).
function entityOf(solution, cat, item) {
  return solution.findIndex(e => e[cat] === item);
}

// ---------------------------------------------------------------------------
// Clue generation — enumerate all true clues for a solution
// ---------------------------------------------------------------------------

function generateCandidateClues(rng, solution, theme, difficulty) {
  const numCategories = theme.categories.length;
  const numItems = theme.categories[0].items.length;
  const clues = [];

  for (let a = 0; a < numCategories; a++) {
    for (let b = a + 1; b < numCategories; b++) {
      for (let i = 0; i < numItems; i++) {
        const entity = solution.findIndex(e => e[a] === i);
        const j = solution[entity][b]; // item in cat b for this entity

        if (a === 0 && difficulty === 'easy') {
          // direct_pos: names[i] has cat[b] item[j]
          clues.push({ type: 'direct_pos', cat: b, nameIdx: i, itemIdx: j });
        }

        // direct_neg: names[i] does NOT have cat[b] item[k] (for each k≠j)
        if (a === 0) {
          for (let k = 0; k < numItems; k++) {
            if (k !== j) {
              clues.push({ type: 'direct_neg', cat: b, nameIdx: i, itemIdx: k });
            }
          }
        }

        // link_pos: cat[a][i] = cat[b][j]
        if (a !== 0) {
          clues.push({ type: 'link_pos', catA: a, catB: b, itemA: i, itemB: j });
        }

        // link_neg: cat[a][i] ≠ cat[b][k] for each k≠j
        if (a !== 0) {
          for (let k = 0; k < numItems; k++) {
            if (k !== j) {
              clues.push({ type: 'link_neg', catA: a, catB: b, itemA: i, itemB: k });
            }
          }
        }

        // either_or (hard only): cat[a][i] = cat[b][j] OR cat[a][i] = cat[b][k]
        // True clue: j is the real match, k is a distractor.
        if (difficulty === 'hard' && a !== 0) {
          const others = Array.from({ length: numItems }, (_, x) => x).filter(x => x !== j);
          if (others.length > 0) {
            const k = others[randInt(rng, 0, others.length)];
            clues.push({ type: 'either_or', catA: a, catB: b, itemA: i, itemB: j, itemC: k });
          }
        }

        // ordering (hard only): entity with cat[a][i] has strictly lower ordinal in
        // cat[b] than some other entity. Only emit one ordering clue per entity pair.
        if (difficulty === 'hard' && theme.categories[b].ordinal && a !== 0 && j < numItems - 1) {
          for (let e2 = 0; e2 < numItems; e2++) {
            if (e2 === entity) continue;
            const j2 = solution[e2][b];
            if (j < j2) {
              const itemA2 = solution[e2][a];
              clues.push({
                type: 'ordering',
                catA: a, itemA: i, itemB: itemA2,
                ordCat: b, numItems,
              });
              break; // one ordering clue per entity is enough
            }
          }
        }
      }
    }
  }

  shuffle(rng, clues);
  return clues;
}


function meetsDifficultyBand(clues, numCategories, numItems, difficulty) {
  if (difficulty === 'easy') return true;

  // Count link clues between non-name (non-zero) categories.
  // These require the player to combine cross-attribute information.
  const nonNameLinks = clues.filter(c =>
    (c.type === 'link_pos' || c.type === 'link_neg') &&
    c.catA !== 0 && c.catB !== 0
  );
  // Direct clues for names (easy single-step deductions).
  const directName = clues.filter(c => c.type === 'direct_neg' || c.type === 'direct_pos');

  if (difficulty === 'medium') {
    // At least 3 inter-attribute links and not overwhelmingly easy (few direct clues).
    return nonNameLinks.length >= 3 && directName.length <= 6;
  }
  if (difficulty === 'hard') {
    const special = clues.filter(c => c.type === 'either_or' || c.type === 'ordering');
    return nonNameLinks.length >= 5 && special.length >= 1;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Clue pruning — remove redundant clues while preserving unique solvability
// ---------------------------------------------------------------------------

function pruneClues(rng, clues, numCategories, numItems) {
  // Order matters: backwards iteration tries high-index items first.
  // Put "easy" clues (direct_neg for names) at the END so they're tried
  // for removal first, preserving the harder inter-attribute link clues.
  const direct = shuffle(rng, clues.filter(c => c.type === 'direct_neg' || c.type === 'direct_pos'));
  const links  = shuffle(rng, clues.filter(c => c.type !== 'direct_neg' && c.type !== 'direct_pos'));
  const pruned = [...links, ...direct];

  for (let i = pruned.length - 1; i >= 0; i--) {
    const candidate = [...pruned.slice(0, i), ...pruned.slice(i + 1)];
    const n = countSolutions(candidate, numCategories, numItems, 2);
    if (n === 1) pruned.splice(i, 1);
  }
  return pruned;
}

// ---------------------------------------------------------------------------
// Clue text rendering
// ---------------------------------------------------------------------------

/**
 * Prose clue rendering. Items appear exactly as on the grid ("Rose",
 * "House 3") inside per-category verb templates from themes.js, e.g.
 * "The member who grows the Rose doesn't drink Earl Grey."
 */
export function doesPhrase(theme, cat, itemIdx) {
  const c = theme.categories[cat];
  return c.does.replace('{}', c.items[itemIdx]);
}

export function notPhrase(theme, cat, itemIdx) {
  const c = theme.categories[cat];
  return c.not.replace('{}', c.items[itemIdx]);
}

export function clueText(clue, theme) {
  const name = (i) => theme.categories[0].items[i];
  const who = theme.who; // "member", "neighbor", ...
  const does = (c, i) => doesPhrase(theme, c, i);
  const not = (c, i) => notPhrase(theme, c, i);

  switch (clue.type) {
    case 'direct_pos':
      return `${name(clue.nameIdx)} ${does(clue.cat, clue.itemIdx)}.`;
    case 'direct_neg':
      return `${name(clue.nameIdx)} ${not(clue.cat, clue.itemIdx)}.`;
    case 'link_pos':
      return `The ${who} who ${does(clue.catA, clue.itemA)} also ${does(clue.catB, clue.itemB)}.`;
    case 'link_neg':
      return `The ${who} who ${does(clue.catA, clue.itemA)} ${not(clue.catB, clue.itemB)}.`;
    case 'either_or':
      return `The ${who} who ${does(clue.catA, clue.itemA)} either ${does(clue.catB, clue.itemB)} or ${does(clue.catB, clue.itemC)}.`;
    case 'ordering':
      return `The ${who} who ${does(clue.catA, clue.itemA)} ${theme.categories[clue.ordCat].before} the ${who} who ${does(clue.catA, clue.itemB)}.`;
    default:
      return '(unknown clue type)';
  }
}

// ---------------------------------------------------------------------------
// Hint derivation — find clues that together unlock a new deduction
// ---------------------------------------------------------------------------

/**
 * Derive a hint given the puzzle clues and (optionally) the player's current
 * marks expressed as clue objects (link_pos / link_neg / direct_*).
 * The hint is computed from the player's board, not the fully-propagated one,
 * so it points at what the *player* can deduce next.
 */
export function deriveHint(clues, numCategories, numItems, markClues = []) {
  const state = createState(numCategories, numItems);
  propagate(state, markClues);
  if (isSolved(state)) return { type: 'solved' };

  // Try each single clue — if it fires (changes state), return it as hint.
  for (let i = 0; i < clues.length; i++) {
    const test = cloneState(state);
    const before = test.data.slice();
    applyClue(test, clues[i]);
    if (!before.every((v, k) => v === test.data[k])) {
      return { type: 'single', clueIndex: i };
    }
  }

  // Try pairs.
  for (let i = 0; i < clues.length; i++) {
    for (let j = i + 1; j < clues.length; j++) {
      const test = cloneState(state);
      applyClue(test, clues[i]);
      const before = test.data.slice();
      applyClue(test, clues[j]);
      if (!before.every((v, k) => v === test.data[k])) {
        return { type: 'pair', clueIndexA: i, clueIndexB: j };
      }
    }
  }

  return { type: 'unknown' };
}

// ---------------------------------------------------------------------------
// Puzzle ID
// ---------------------------------------------------------------------------

function makePuzzleId(seed, themeIndex, difficulty) {
  return `${difficulty[0].toUpperCase()}${themeIndex}-${seed.toString(16).padStart(8, '0')}`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const DIFFICULTY_SIZES = {
  easy:   { numCategories: 3, numItems: 3 },
  medium: { numCategories: 4, numItems: 4 },
  hard:   { numCategories: 4, numItems: 5 },
};

const MAX_ATTEMPTS = 200;

export function generatePuzzle({ difficulty = 'easy', themeIndex, seed } = {}) {
  const { numCategories, numItems } = DIFFICULTY_SIZES[difficulty];

  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const usedSeed = seed !== undefined ? seed : (Math.random() * 0xffffffff) >>> 0;
    const usedTheme = themeIndex !== undefined ? themeIndex : randInt(createRng(usedSeed), 0, themeCount());
    const rng = createRng(usedSeed ^ (usedTheme * 0x9e3779b9));

    const theme = getTheme(usedTheme, numCategories, numItems);
    if (theme.categories.length < numCategories) {
      // Theme doesn't have enough categories; try next theme.
      if (themeIndex !== undefined) break;
      continue;
    }

    const solution = randomSolution(rng, numCategories, numItems);

    // Generate ALL true clues, then verify the full set is uniquely solvable,
    // then prune down. This avoids countSolutions on underconstrained sets.
    const candidates = generateCandidateClues(rng, solution, theme, difficulty);

    // With all clues, puzzle should be heavily constrained — verify quickly.
    const n = countSolutions(candidates, numCategories, numItems, 2);
    if (n !== 1) continue; // degenerate solution; re-roll

    // Prune redundant clues (puzzle stays constrained throughout pruning)
    const pruned = pruneClues(rng, candidates, numCategories, numItems);

    // Check difficulty band
    if (!meetsDifficultyBand(pruned, numCategories, numItems, difficulty)) {
      if (seed !== undefined) break; // fixed seed, can't re-roll
      continue;
    }

    const finalSeed = usedSeed;
    const id = makePuzzleId(finalSeed, usedTheme, difficulty);

    return {
      id,
      seed: finalSeed,
      themeIndex: usedTheme,
      theme,
      solution,
      clues: pruned,
      difficulty,
      numCategories,
      numItems,
    };
  }

  // Fallback: return whatever we have even if difficulty band missed,
  // rather than failing silently. Caller can check.
  return null;
}

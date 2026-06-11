/**
 * solver.js — constraint-propagation solver for grid-deduction logic puzzles.
 *
 * A puzzle has N categories, each with M items. The solution is a bijection:
 * one item per category maps to exactly one "entity" (identified by its index
 * in category 0, the primary category, usually names).
 *
 * State: a possibility matrix — for every pair of categories (a, b) and every
 * pair of items (i, j), can item a[i] belong to the same entity as item b[j]?
 * Values: UNKNOWN=0, NO=1, YES=2.
 *
 * Public API:
 *   createState(numCategories, numItems) → state
 *   cloneState(state) → state
 *   getCell(state, a, b, i, j) → value
 *   applyClue(state, clue) → { changed: bool, contradiction: bool }
 *   propagate(state, clues) → { solved: bool, contradiction: bool, steps: int[] }
 *   isSolved(state) → bool
 *   countSolutions(clues, numCategories, numItems, maxCount) → number
 */

export const UNKNOWN = 0;
export const NO = 1;
export const YES = 2;

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

export function createState(numCategories, numItems) {
  const size = numCategories * numCategories * numItems * numItems;
  return { numCategories, numItems, data: new Uint8Array(size) };
}

export function cloneState(state) {
  return {
    numCategories: state.numCategories,
    numItems: state.numItems,
    data: new Uint8Array(state.data),
  };
}

function _idx(state, a, b, i, j) {
  const N = state.numCategories, M = state.numItems;
  return ((a * N + b) * M + i) * M + j;
}

export function getCell(state, a, b, i, j) {
  if (a === b) return i === j ? YES : NO;
  if (a > b) return getCell(state, b, a, j, i);
  return state.data[_idx(state, a, b, i, j)];
}

/**
 * Set cell (a,b,i,j). Normalises a<b.
 * Returns: true if changed, false if already that value,
 * 'contradiction' if trying to overwrite YES with NO or vice-versa.
 */
function setCell(state, a, b, i, j, value) {
  if (a > b) return setCell(state, b, a, j, i, value);
  if (a === b) return false;
  const k = _idx(state, a, b, i, j);
  const old = state.data[k];
  if (old === value) return false;
  if (old !== UNKNOWN) return 'contradiction';
  state.data[k] = value;
  return true;
}

// ---------------------------------------------------------------------------
// Core propagation
// ---------------------------------------------------------------------------

/**
 * BFS from a queue of (a,b,i,j,value) seed changes.
 * Returns true if a contradiction was found.
 */
function runPropagation(state, queue) {
  let ptr = 0;
  while (ptr < queue.length) {
    const [a, b, i, j, value] = queue[ptr++];

    if (value === YES) {
      // Eliminate all other items in the same row and column
      for (let k = 0; k < state.numItems; k++) {
        if (k !== j) {
          const r = setCell(state, a, b, i, k, NO);
          if (r === 'contradiction') return true;
          if (r === true) queue.push([a, b, i, k, NO]);
        }
        if (k !== i) {
          const r = setCell(state, a, b, k, j, NO);
          if (r === 'contradiction') return true;
          if (r === true) queue.push([a, b, k, j, NO]);
        }
      }
      // Transitivity across all other categories
      for (let c = 0; c < state.numCategories; c++) {
        if (c === a || c === b) continue;
        for (let k = 0; k < state.numItems; k++) {
          const ac = getCell(state, a, c, i, k);
          const bc = getCell(state, b, c, j, k);
          if (ac === YES && bc !== YES) {
            const r = setCell(state, b, c, j, k, YES);
            if (r === 'contradiction') return true;
            if (r === true) queue.push([b, c, j, k, YES]);
          } else if (bc === YES && ac !== YES) {
            const r = setCell(state, a, c, i, k, YES);
            if (r === 'contradiction') return true;
            if (r === true) queue.push([a, c, i, k, YES]);
          } else if (ac === NO && bc !== NO) {
            const r = setCell(state, b, c, j, k, NO);
            if (r === 'contradiction') return true;
            if (r === true) queue.push([b, c, j, k, NO]);
          } else if (bc === NO && ac !== NO) {
            const r = setCell(state, a, c, i, k, NO);
            if (r === 'contradiction') return true;
            if (r === true) queue.push([a, c, i, k, NO]);
          }
        }
      }
    }

    // After any change: check if any row/col now has exactly one UNKNOWN → force YES
    if (_forceSingles(state, a, b, queue)) return true;
  }
  return false;
}

/** Force YES in any row/col that has exactly one UNKNOWN left. Returns true on contradiction. */
function _forceSingles(state, a, b, queue) {
  const M = state.numItems;
  for (let i = 0; i < M; i++) {
    let unknownCount = 0, lastJ = -1, hasYes = false;
    for (let j = 0; j < M; j++) {
      const v = getCell(state, a, b, i, j);
      if (v === YES) { hasYes = true; break; }
      if (v === UNKNOWN) { unknownCount++; lastJ = j; }
    }
    if (!hasYes) {
      if (unknownCount === 0) return true; // contradiction: no option left
      if (unknownCount === 1) {
        const r = setCell(state, a, b, i, lastJ, YES);
        if (r === 'contradiction') return true;
        if (r === true) queue.push([a, b, i, lastJ, YES]);
      }
    }
  }
  for (let j = 0; j < M; j++) {
    let unknownCount = 0, lastI = -1, hasYes = false;
    for (let i = 0; i < M; i++) {
      const v = getCell(state, a, b, i, j);
      if (v === YES) { hasYes = true; break; }
      if (v === UNKNOWN) { unknownCount++; lastI = i; }
    }
    if (!hasYes) {
      if (unknownCount === 0) return true;
      if (unknownCount === 1) {
        const r = setCell(state, a, b, lastI, j, YES);
        if (r === 'contradiction') return true;
        if (r === true) queue.push([a, b, lastI, j, YES]);
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Clue application
// ---------------------------------------------------------------------------

export function applyClue(state, clue) {
  const queue = [];
  let changed = false;

  const seed = (a, b, i, j, v) => {
    const r = setCell(state, a, b, i, j, v);
    if (r === 'contradiction') return true; // signal contradiction
    if (r === true) { queue.push([a, b, i, j, v]); changed = true; }
    return false;
  };

  let contradiction = false;

  switch (clue.type) {
    case 'direct_pos':
      contradiction = seed(0, clue.cat, clue.nameIdx, clue.itemIdx, YES);
      break;
    case 'direct_neg':
      contradiction = seed(0, clue.cat, clue.nameIdx, clue.itemIdx, NO);
      break;
    case 'link_pos':
      contradiction = seed(clue.catA, clue.catB, clue.itemA, clue.itemB, YES);
      break;
    case 'link_neg':
      contradiction = seed(clue.catA, clue.catB, clue.itemA, clue.itemB, NO);
      break;
    case 'either_or': {
      // (catA[itemA]=catB[itemB]) OR (catA[itemA]=catB[itemC])
      const ab = getCell(state, clue.catA, clue.catB, clue.itemA, clue.itemB);
      const ac = getCell(state, clue.catA, clue.catB, clue.itemA, clue.itemC);
      if (ab === NO && ac !== YES) {
        contradiction = seed(clue.catA, clue.catB, clue.itemA, clue.itemC, YES);
      } else if (ac === NO && ab !== YES) {
        contradiction = seed(clue.catA, clue.catB, clue.itemA, clue.itemB, YES);
      } else if (ab === NO && ac === NO) {
        contradiction = true;
      }
      break;
    }
    case 'ordering': {
      // entity with catA[itemA] has strictly lower ordinal in ordCat than entity with catA[itemB]
      // → itemA's entity cannot have the last ordinal position
      // → itemB's entity cannot have the first ordinal position
      const M = clue.numItems;
      contradiction = seed(clue.catA, clue.ordCat, clue.itemA, M - 1, NO)
        || seed(clue.catA, clue.ordCat, clue.itemB, 0, NO);
      break;
    }
  }

  if (!contradiction && queue.length > 0) {
    contradiction = runPropagation(state, queue);
  }
  return { changed: changed || queue.length > 0, contradiction };
}

// ---------------------------------------------------------------------------
// Full propagation loop (runs to convergence)
// ---------------------------------------------------------------------------

export function propagate(state, clues) {
  const steps = [];
  let anyChange = true;
  while (anyChange) {
    anyChange = false;
    for (let ci = 0; ci < clues.length; ci++) {
      const before = state.data.slice();
      const { contradiction } = applyClue(state, clues[ci]);
      if (contradiction) return { solved: false, contradiction: true, steps };
      if (!before.every((v, k) => v === state.data[k])) {
        anyChange = true;
        steps.push(ci);
      }
    }
  }
  return { solved: isSolved(state), contradiction: false, steps };
}

// ---------------------------------------------------------------------------
// Solved check
// ---------------------------------------------------------------------------

export function isSolved(state) {
  const { numCategories, numItems } = state;
  for (let a = 0; a < numCategories; a++) {
    for (let b = a + 1; b < numCategories; b++) {
      for (let i = 0; i < numItems; i++) {
        let hasYes = false;
        for (let j = 0; j < numItems; j++) {
          if (getCell(state, a, b, i, j) === YES) { hasYes = true; break; }
        }
        if (!hasYes) return false;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Solution counting — MRV backtracking
// ---------------------------------------------------------------------------

export function countSolutions(clues, numCategories, numItems, maxCount = 2) {
  const state = createState(numCategories, numItems);
  const { contradiction, solved } = propagate(state, clues);
  if (contradiction) return 0;
  if (solved) return 1;
  return _search(state, clues, maxCount);
}

/**
 * Backtracking search using the Minimum Remaining Values (MRV) heuristic:
 * pick the most constrained undetermined row and try each possible YES
 * assignment for it. Propagate after each assignment.
 */
function _search(state, clues, maxCount) {
  const { numCategories: N, numItems: M } = state;

  // Find the (a, b, i) row with the fewest UNKNOWN cells (but ≥2, so we
  // know it hasn't been forced yet by propagation).
  let bestA = -1, bestB = -1, bestI = -1, bestCount = M + 1;

  outerLoop:
  for (let a = 0; a < N; a++) {
    for (let b = a + 1; b < N; b++) {
      for (let i = 0; i < M; i++) {
        let unknownCount = 0;
        let hasYes = false;
        for (let j = 0; j < M; j++) {
          const v = getCell(state, a, b, i, j);
          if (v === YES) { hasYes = true; break; }
          if (v === UNKNOWN) unknownCount++;
        }
        if (hasYes) continue; // already assigned
        if (unknownCount === 0) return 0; // contradiction
        if (unknownCount < bestCount) {
          bestCount = unknownCount;
          bestA = a; bestB = b; bestI = i;
          if (bestCount === 2) break outerLoop; // optimal, stop searching
        }
      }
    }
  }

  if (bestA === -1) return isSolved(state) ? 1 : 0;

  // Try each candidate YES assignment for the chosen row.
  let count = 0;
  for (let j = 0; j < M; j++) {
    if (getCell(state, bestA, bestB, bestI, j) !== UNKNOWN) continue;
    const branch = cloneState(state);
    setCell(branch, bestA, bestB, bestI, j, YES);
    const { contradiction, solved } = propagate(branch, clues);
    if (!contradiction) {
      count += solved ? 1 : _search(branch, clues, maxCount - count);
    }
    if (count >= maxCount) return count;
  }
  return count;
}

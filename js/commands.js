/**
 * commands.js — parses spoken utterances into game intents. DOM-free.
 *
 * Matching philosophy (per CLAUDE.md): simple cascade against the puzzle's
 * small vocabulary — normalize → exact → prefix → character overlap.
 * Natural conversational phrasings supported via synonym patterns.
 *
 * parseUtterance(text, vocab) → one of:
 *   { intent: 'mark', refs: [{cat, item}, {cat, item}], positive, confident }
 *   { intent: 'undo' | 'hint' | 'reveal' | 'help' | 'status' | 'new_puzzle'
 *           | 'check' | 'read_all' | 'repeat' | 'next_clue' | 'yes' | 'no' }
 *   { intent: 'read_clue', n }            (1-based)
 *   { intent: 'unknown' }
 *   { intent: 'partial', refs, positive } (only one item heard)
 *
 * vocab = theme object ({ categories: [{label, items}, ...] }).
 */

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
};

export function normalize(text) {
  let t = text.toLowerCase();
  t = t.replace(/n't\b/g, ' not');           // doesn't → does not
  t = t.replace(/[^a-z0-9\s]/g, ' ');        // strip punctuation
  t = t.replace(/\s+/g, ' ').trim();
  t = t.split(' ').map(w => NUMBER_WORDS[w] || w).join(' ');
  return t;
}

// ---------------------------------------------------------------------------
// Word-level fuzzy matching (exact → prefix → bigram overlap)
// ---------------------------------------------------------------------------

function bigrams(s) {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** True if the words differ by a single substitution/insertion/deletion. */
function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function wordScore(token, target) {
  if (token === target) return 1;
  if (target.length >= 3 && token.length >= 3) {
    if (target.startsWith(token) || token.startsWith(target)) return 0.85;
    if (oneEditApart(token, target)) return 0.75; // catches "kat"→"cat", "alise"→"alice"
  }
  // Dice coefficient on bigrams
  const a = bigrams(token), b = bigrams(target);
  if (a.length === 0 || b.length === 0) return 0;
  let overlap = 0;
  const used = new Array(b.length).fill(false);
  for (const bg of a) {
    const idx = b.findIndex((x, k) => x === bg && !used[k]);
    if (idx >= 0) { used[idx] = true; overlap++; }
  }
  const dice = (2 * overlap) / (a.length + b.length);
  return dice >= 0.6 ? dice * 0.9 : 0;
}

/**
 * Find the best window match for a multi-word term in the utterance tokens.
 * Returns { score, start } — score is the average word score over the window.
 */
function termMatch(tokens, termTokens) {
  let best = { score: 0, start: -1 };
  for (let s = 0; s + termTokens.length <= tokens.length; s++) {
    let sum = 0;
    for (let k = 0; k < termTokens.length; k++) {
      sum += wordScore(tokens[s + k], termTokens[k]);
    }
    const score = sum / termTokens.length;
    if (score > best.score) best = { score, start: s };
  }
  return best;
}

/** Find all vocabulary items mentioned in the utterance. */
export function findItems(text, vocab) {
  const tokens = normalize(text).split(' ');
  const found = [];
  vocab.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const termTokens = normalize(item).split(' ');
      const m = termMatch(tokens, termTokens);
      if (m.score >= 0.65) {
        found.push({ cat: ci, item: ii, score: m.score, start: m.start, label: item });
      }
    });
  });
  // Keep the best match per category; drop overlapping window collisions
  // (e.g. "house 1" matching both House 1 strongly and House 2 weakly).
  const byCat = new Map();
  for (const f of found) {
    const prev = byCat.get(f.cat);
    if (!prev || f.score > prev.score) byCat.set(f.cat, f);
  }
  return [...byCat.values()].sort((x, y) => x.start - y.start);
}

// ---------------------------------------------------------------------------
// Intent patterns (checked before deduction parsing)
// ---------------------------------------------------------------------------

const CONTROL_PATTERNS = [
  // undo / take it back
  { intent: 'undo', re: /\b(undo|go back|take (that|it) back|that can not be right|that s wrong|wait)\b/ },
  { intent: 'undo', re: /^(no wait|oops|scratch that|never mind that)/ },
  // hint
  { intent: 'hint', re: /\b(hint|i am stuck|i m stuck|stuck|help me out|what (should|do) i (do|try))\b/ },
  // reveal
  { intent: 'reveal', re: /\b(tell me (one|an) answer|give me (one|an) answer|just tell me)\b/ },
  // help / how to play
  { intent: 'help', re: /\b(help|how do i play|how does this work|i do not understand|i am confused|i m confused|what is this)\b/ },
  // read the grid back (deeper than status — row by row)
  { intent: 'read_grid', re: /\b(read|tell)( me)?( back)? (my|the) grid( back)?\b|\bwhere did i leave off\b|\bread (it all|everything) back\b/ },
  // status
  { intent: 'status', re: /\b(what do i know|where am i|where was i|what have i (got|found)|so far)\b/ },
  // check / done
  { intent: 'check', re: /\b(am i done|check my work|did i (get it|win|finish)|is (that|it) right)\b/ },
  // new puzzle
  { intent: 'new_puzzle', re: /\b(new puzzle|another puzzle|different puzzle|start over)\b/ },
  // clue reading
  { intent: 'read_clue_n', re: /\b(read|say|repeat|what was|what is)\b.*\bclue (\d+)\b/ },
  { intent: 'read_clue_n', re: /\bclue (\d+)\b.*\b(again|please)?$/ },
  { intent: 'next_clue', re: /\bnext clue\b/ },
  { intent: 'repeat', re: /\b(read|say) (that|it) ?(1 )?again\b|\bwhat was (that|the clue)\b|\brepeat (that|it)\b/ },
  { intent: 'read_all', re: /\bread\b.*\bclues\b|\bread (me )?the (puzzle|story|clues)\b/ },
  // yes / no (for confirmation flow)
  { intent: 'yes', re: /^(yes|yeah|yep|yes please|right|correct|sure|that s right|ok|okay)$/ },
  { intent: 'no', re: /^(no|nope|cancel|never mind|wrong|that s wrong)$/ },
];

const NEGATIVE_RE = /\b(not|no|never|cross (out|off)|rule out|eliminate|x)\b/;
const POSITIVE_RE = /\b(has|have|is|are|was|does|do|yes|drinks|keeps|owns|lives|loves|plays|sits|goes|grows|wears|visits|brought|drank|hosts|snacks|munches|dabs|decorates|check|tick)\b/;

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function parseUtterance(text, vocab) {
  const t = normalize(text);
  if (!t) return { intent: 'unknown' };

  for (const p of CONTROL_PATTERNS) {
    const m = t.match(p.re);
    if (m) {
      if (p.intent === 'read_clue_n') {
        const n = parseInt(m[2] || m[1], 10);
        if (n >= 1) return { intent: 'read_clue', n };
        continue;
      }
      return { intent: p.intent };
    }
  }

  // Deduction parsing: find item references
  const refs = findItems(t, vocab);
  const negative = NEGATIVE_RE.test(t);
  const positiveCue = POSITIVE_RE.test(t);

  if (refs.length >= 2) {
    // Use the two strongest-scoring refs from different categories
    const sorted = [...refs].sort((x, y) => y.score - x.score).slice(0, 2);
    const confident =
      sorted.every(r => r.score >= 0.85) && (negative || positiveCue);
    return {
      intent: 'mark',
      refs: sorted.sort((x, y) => x.start - y.start),
      positive: !negative,
      confident,
    };
  }

  if (refs.length === 1) {
    return { intent: 'partial', refs, positive: !negative };
  }

  return { intent: 'unknown' };
}

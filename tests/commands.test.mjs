/**
 * Command parser tests — run with: node tests/commands.test.mjs
 */

import assert from 'node:assert/strict';
import { normalize, parseUtterance, findItems } from '../js/commands.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓  ${name}`); passed++; }
  catch (e) { console.error(`  ✗  ${name}\n     ${e.message}`); failed++; }
}

// Street Neighbors-style vocab (what the parser sees from a real puzzle)
const vocab = {
  categories: [
    { label: 'Neighbor', items: ['Alice', 'Ben', 'Carol'] },
    { label: 'Pet', items: ['Dog', 'Cat', 'Bird'] },
    { label: 'House', items: ['House 1', 'House 2', 'House 3'] },
  ],
};

console.log('\n── normalize ──');

test('lowercases and strips punctuation', () => {
  assert.equal(normalize("Mary doesn't have the cat!"), 'mary does not have the cat');
});

test('number words become digits', () => {
  assert.equal(normalize('read clue three'), 'read clue 3');
  assert.equal(normalize('house one'), 'house 1');
});

console.log('\n── deduction parsing ──');

test('"Alice doesn\'t have the cat" → negative mark', () => {
  const r = parseUtterance("Alice doesn't have the cat", vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, false);
  assert.equal(r.confident, true);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 0], [1, 1]]);
});

test('"Ben has the dog" → positive mark', () => {
  const r = parseUtterance('Ben has the dog', vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, true);
  assert.equal(r.confident, true);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 1], [1, 0]]);
});

test('"Carol lives in house two" → positive mark with House 2', () => {
  const r = parseUtterance('Carol lives in house two', vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, true);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 2], [2, 1]]);
});

test('"the cat is not in house 3" → negative cross-category mark', () => {
  const r = parseUtterance('the cat is not in house 3', vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, false);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[1, 1], [2, 2]]);
});

test('recognizer mishears: "Alise doesn\'t have the kat" still matches', () => {
  const r = parseUtterance("Alise doesn't have the kat", vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, false);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 0], [1, 1]]);
});

test('fuzzy match is not confident', () => {
  const r = parseUtterance("Alise doesn't have the kat", vocab);
  assert.equal(r.confident, false);
});

test('"mark the cat for Alice" → mark, not confident (ambiguous polarity)', () => {
  const r = parseUtterance('mark the cat for Alice', vocab);
  assert.equal(r.intent, 'mark');
  assert.equal(r.confident, false);
});

test('only one item heard → partial', () => {
  const r = parseUtterance('something about the bird', vocab);
  assert.equal(r.intent, 'partial');
  assert.deepEqual([r.refs[0].cat, r.refs[0].item], [1, 2]);
});

console.log('\n── control intents ──');

test('"undo that" → undo', () => {
  assert.equal(parseUtterance('undo that', vocab).intent, 'undo');
});

test('"wait, go back" → undo', () => {
  assert.equal(parseUtterance('wait, go back', vocab).intent, 'undo');
});

test('"take that back" → undo', () => {
  assert.equal(parseUtterance('take that back', vocab).intent, 'undo');
});

test('"give me a hint" → hint', () => {
  assert.equal(parseUtterance('give me a hint', vocab).intent, 'hint');
});

test('"I\'m stuck" → hint', () => {
  assert.equal(parseUtterance("I'm stuck", vocab).intent, 'hint');
});

test('"just tell me one answer" → reveal', () => {
  assert.equal(parseUtterance('just tell me one answer', vocab).intent, 'reveal');
});

test('"how do I play" → help', () => {
  assert.equal(parseUtterance('how do I play?', vocab).intent, 'help');
});

test('"I don\'t understand" → help', () => {
  assert.equal(parseUtterance("I don't understand", vocab).intent, 'help');
});

test('"what do I know so far" → status', () => {
  assert.equal(parseUtterance('what do I know so far?', vocab).intent, 'status');
});

test('"am I done?" → check', () => {
  assert.equal(parseUtterance('am I done?', vocab).intent, 'check');
});

test('"read the clues" → read_all', () => {
  assert.equal(parseUtterance('read the clues', vocab).intent, 'read_all');
});

test('"read clue three again" → read_clue 3', () => {
  const r = parseUtterance('read clue three again', vocab);
  assert.equal(r.intent, 'read_clue');
  assert.equal(r.n, 3);
});

test('"what was clue two?" → read_clue 2', () => {
  const r = parseUtterance('what was clue two?', vocab);
  assert.equal(r.intent, 'read_clue');
  assert.equal(r.n, 2);
});

test('"read that one again" → repeat', () => {
  assert.equal(parseUtterance('read that one again', vocab).intent, 'repeat');
});

test('"next clue" → next_clue', () => {
  assert.equal(parseUtterance('next clue', vocab).intent, 'next_clue');
});

test('"new puzzle" → new_puzzle', () => {
  assert.equal(parseUtterance('new puzzle please', vocab).intent, 'new_puzzle');
});

test('"yes" → yes; "no" → no; "never mind" → no', () => {
  assert.equal(parseUtterance('yes', vocab).intent, 'yes');
  assert.equal(parseUtterance('no', vocab).intent, 'no');
  assert.equal(parseUtterance('never mind', vocab).intent, 'no');
});

test('gibberish → unknown', () => {
  assert.equal(parseUtterance('flibber jabberwock', vocab).intent, 'unknown');
});

console.log('\n── multi-word items ──');

const vocab2 = {
  categories: [
    { label: 'Member', items: ['Agnes', 'Bette', 'Clara'] },
    { label: 'Tea', items: ['Earl Grey', 'Chamomile', 'Green Tea'] },
  ],
};

test('"Agnes drinks Earl Grey" matches multi-word item', () => {
  const r = parseUtterance('Agnes drinks Earl Grey', vocab2);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, true);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 0], [1, 0]]);
});

test('"Clara does not drink green tea" → negative', () => {
  const r = parseUtterance('Clara does not drink green tea', vocab2);
  assert.equal(r.intent, 'mark');
  assert.equal(r.positive, false);
  assert.deepEqual(r.refs.map(x => [x.cat, x.item]), [[0, 2], [1, 2]]);
});

// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed}/${total} tests passed${failed > 0 ? ` — ${failed} FAILED` : ' ✓'}`);
if (failed > 0) process.exit(1);

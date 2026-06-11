# Puzzle Talk

A voice-driven logic grid puzzle web app for an 80-year-old player. Classic
*Games*-magazine-style grid-deduction puzzles, played primarily by talking
(Web Speech API), with a large high-contrast on-screen elimination grid and
touch input as a full fallback.

## Guiding principle

Favor simplicity over cleverness. If a feature can be implemented in a simpler way with similar user value, choose the simpler implementation. The target user is an elderly non-technical player, not a power user.

## Session startup

On starting a new session, first read PROGRESS.md and this file, then give the
user a one-paragraph status before continuing. Keep PROGRESS.md updated after
every milestone or significant chunk of work.

## Stack & architecture

- Pure static site: vanilla HTML/CSS/ES-module JS. **No build step, no
  framework, no backend.** Hosted on GitHub Pages (HTTPS required for mic).
- Pure-logic modules (`solver.js`, `generator.js`, `commands.js`) must stay
  DOM-free and are tested via plain Node scripts in `tests/` (`node
  tests/solver.test.js`, assert-based, no test framework).
- Keep the puzzle engine and conversational layer decoupled from the grid UI:
  a future grid-free "spoken mystery" mode must be addable without
  rearchitecting. (Future option only — do not build it.)

## Voice (expected behavior — UNVERIFIED until Milestone 0 passes on target devices)

- iOS/iPadOS Safari: `webkitSpeechRecognition` since 14.5. Push-to-talk only —
  continuous mode is broken on iOS. Re-create the recognition instance per use.
- Expected: SpeechRecognition FAILS in standalone-PWA mode on iOS → manifest
  must use `"display": "browser"`.
- `speechSynthesis` needs a user gesture on iOS; prime with a silent utterance
  on first tap.
- Do not deepen voice-dependent architecture assumptions until the Milestone 0
  device tests confirm behavior on the actual target iPhone/iPad/MacBook.

## Command matching (keep simple)

Cascade against the puzzle's small vocabulary (~15–20 words):
normalize (lowercase, strip punctuation, number-words ↔ digits) → exact match
→ prefix match → closest word by simple character overlap. No
Levenshtein/phonetic matching unless Milestone 4 testing on real recognizer
output shows the cascade failing. Support natural conversational paraphrases
("put an X there", "that can't be right", "I'm stuck", "wait, go back") via a
synonym layer, with the confirm-aloud flow resolving ambiguity.

## Hints (scope limit)

Hints only point at clues and opportunities ("Try combining clues 2 and 5",
"Clue 4 lets you eliminate something for Mary") plus a "just tell me one
answer" cell reveal. No natural-language proof/explanation engine.

## Difficulty targets (starting values — calibrate empirically in Milestone 1, document finals here)

- **Easy:** 3×3; direct positives allowed; every deduction achievable from a
  single clue plus board state.
- **Medium:** 4×4; no direct positives; ≥3 deductions requiring combining two
  clues.
- **Hard:** 4×5; includes either/or and (when a category is ordinal) ordering
  clues; requires multiple chained multi-clue deductions.
- Re-roll generated puzzles that miss their band. No extra complexity metrics
  beyond what's needed to hit these bands.

## Puzzles

- Generated programmatically (constraint solver + clue generation + uniqueness
  verification + redundancy pruning). Never scraped, never LLM-authored logic.
- Themes are curated theme packs in `themes.js` (no LLM).
- **Deterministic:** every puzzle carries a reproducible puzzle ID + RNG seed;
  any puzzle can be recreated exactly. Surface the ID unobtrusively (small
  text on the completion screen).

## Storage

- IndexedDB is the single save mechanism for game state (request
  `navigator.storage.persist()`). localStorage only for tiny settings (e.g.,
  last difficulty). No parallel save paths.

## Accessibility (hard requirements)

- All text sized in rem; never disable pinch-zoom. Body text ≥ 20px-equivalent
  (1.25rem), clues larger.
- All tap targets ≥ 44px; Talk button much larger (≥ 88px).
- High contrast; ✓/✗ distinguished by shape + color, never color alone.
- No drag gestures, no double-tap, no long-press anywhere.
- Fully usable in portrait on phone.
- One big Talk button; no menus deeper than one level; no timers, scores,
  ads, or login. Everything spoken aloud also appears as large on-screen text.

## UX decisions

- Puzzle completion returns to the three-button (easy/medium/hard) start screen.
- Mistakes are never punished; unlimited undo; contradicting marks get a
  gentle spoken flag, never a block.
- Storage eviction worst case is accepted: she starts a fresh puzzle.

## Milestones

0. Speech test harness on real devices (**pause for user's device-test results
   before proceeding**)
1. Engine (terminal-testable)
2. Touch-only playable app
3. Voice output
4. Voice input
5. Polish & ship

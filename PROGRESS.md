# PROGRESS

_Last updated: 2026-06-10_

## Status: Milestone 3 COMPLETE (pending user device testing) — next: Milestone 4 (voice input)

## Done (Milestone 3)

- `js/speech.js`: SpeechSynthesis wrapper — gesture priming (iOS), speak(),
  speakSequence() for intro+clues, stopSpeaking, enable/disable
- All `setMessage` text is spoken aloud AND shown on screen (silent option exists)
- "🔊 Read clues" button reads story intro + numbered clues in order
- "Voice: on/off" toggle, persisted in localStorage settings
- Completion congratulations spoken; speech cancelled on quit/new puzzle
- Verified in preview via speechSynthesis.speak interception: priming utterance,
  intro on start, hint speech, clue sequence, mute suppresses speech but keeps text

## Done

- Plan approved with amendments (see CLAUDE.md for all binding decisions).
- CLAUDE.md and PROGRESS.md created.
- Milestone 0 harness built and deployed to GitHub Pages.
- **Device tests PASSED** (2026-06-10):
  - iPhone iOS 18.7 / Safari 26.5 (browser tab): ✅ recognition, ✅ TTS
  - iPhone iOS 18.7 / Safari 26.5 (standalone/home-screen): ✅ recognition, ✅ TTS
  - iPad iOS 18.7 / Safari 26.5 (browser tab): ✅ recognition, ✅ TTS
  - MacBook Safari 26.5 (browser tab): ✅ recognition, ✅ TTS
- Key finding: standalone/PWA mode does NOT break recognition on this device.
  Manifest may use `"display": "standalone"`.

## Done (continued)

- Milestone 1 engine complete — 22/22 tests pass:
  - `js/solver.js`: constraint-propagation + MRV backtracking solver
  - `js/generator.js`: generate-all-then-prune approach; link clues preferred over direct_neg during pruning; deterministic puzzle IDs
  - `js/themes.js`: 7 curated theme packs
  - `tests/engine.test.mjs`: full suite covering solver, generation, difficulty, hints, themes, bulk smoke tests
- Key decisions made in M1:
  - Difficulty metric: count non-name link clues (medium ≥3, hard ≥5+special) rather than propagation rounds
  - Pruner order: try to remove direct_neg first (put at high indices), preserve link clues
  - MRV heuristic in backtracking search prevents OOM on medium/hard puzzles
  - `either_or` clues: hard only (not medium) — simplifies solver and generation

## CLAUDE.md: Final difficulty metrics (calibrated)
- **Easy 3×3**: any uniquely solvable puzzle; direct_pos and direct_neg allowed
- **Medium 4×4**: pruned clues must include ≥3 non-name link clues; direct_neg ≤6
- **Hard 4×5**: pruned clues must include ≥5 non-name link clues + ≥1 either_or or ordering clue

## Done (Milestone 2)

- Touch-only playable app, deployed to GitHub Pages (pushed 2026-06-10):
  - `index.html`, `css/style.css`: start (3 big difficulty buttons) / play / done screens
  - `js/grid.js`: elimination sub-grids, tap-to-cycle blank→✗→✓, phone paging (◀ ▶), wide layout shows all sub-grids
  - `js/app.js`: undo stack, hint (clue-pointing via deriveHint with player marks), "tell me one answer" reveal, completion check (gentle message if full-but-wrong), autosave
  - `js/storage.js`: IndexedDB single save slot + navigator.storage.persist; localStorage for last-difficulty only
  - `deriveHint` now takes player marks → hints reflect what the *player* can deduce next
  - Clue text uses grid labels verbatim ("Booth 3 and Pink do not go together"); pets get "the dog" via `article: true` theme flag
- Verified in browser preview: full play loop, tap cycling, undo, hint, reveal→completion→done screen with puzzle ID, reload→resume from IndexedDB
- All 23 engine tests pass

## Next

- User tests Milestone 2 on real devices (solve a puzzle by hand)
- Milestone 3 — voice output: speech.js (SpeechSynthesis), read intro/clues/confirmations aloud, iOS audio unlock on first gesture, everything spoken also shown as text

## Decisions log

- 2026-06-10: Prose-style puzzles (user request, Daydream Puzzles style): themes
  carry a story intro + per-category verb templates (does/not/before); clueText
  renders natural sentences. No LLM — curated templates only.

- 2026-06-10: localStorage→IndexedDB as sole game-state store; GitHub Pages
  hosting; vanilla JS no build step; curated themes, no LLM; completion
  returns to start screen; milestone 0 inserted before engine work.

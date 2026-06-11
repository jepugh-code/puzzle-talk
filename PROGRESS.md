# PROGRESS

_Last updated: 2026-06-10_

## Status: Milestone 1 COMPLETE — ready to begin Milestone 2

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

## Next

Milestone 2 — touch-only playable web app:
- `index.html` + `css/style.css` + `js/grid.js` + `js/app.js`
- Elimination grid, tap-to-mark cycling (✓/✗/blank), clue list, undo
- Difficulty picker start screen, completion check
- IndexedDB autosave/resume
- Responsive layout (phone portrait + iPad/Mac landscape)

## Decisions log

- 2026-06-10: localStorage→IndexedDB as sole game-state store; GitHub Pages
  hosting; vanilla JS no build step; curated themes, no LLM; completion
  returns to start screen; milestone 0 inserted before engine work.

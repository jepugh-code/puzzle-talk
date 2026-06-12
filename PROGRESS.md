# PROGRESS

_Last updated: 2026-06-10_

## Status: Milestone 5 COMPLETE — all milestones shipped. Open item: voice quality follow-up

## Done (Milestone 5 — polish & ship)

- PWA: manifest.webmanifest now belongs to the main app (`display:
  standalone`, verified safe on target devices in M0), canvas-drawn app
  icons (elimination-grid motif, 192/512 + 180 apple-touch-icon)
- `sw.js`: network-first service worker — always fresh online, opens from
  cache offline; registered in app.js (failure is non-fatal)
- On-screen ❓ Help button (same plain-language text as the "help" voice command)
- speech-test.html kept as a diagnostic tool; manifest link removed

## Post-ship fixes already landed

- Auto-cross row/column on ✓ (one undo group; old saves normalized)
- Natural voice selection: prefer Premium/Enhanced/named Apple voices;
  re-pick at speak time; wait up to 600ms for Safari's lazy voice list
  (first-utterance robotic-voice bug fixed — confirmed by user log)

## Post-ship round 2 (2026-06-11)

- Voice: choose-by-ear picker on start screen (cycleVoice speaks each
  voice's name, persists in localStorage 'pt-voiceName', saved choice wins
  over auto-pick); 60ms post-cancel delay (Safari ignores u.voice if
  speak() follows cancel() immediately — likely the remaining robotic case).
  NOTE: iOS Settings voice selection does NOT apply to web apps.
- Visual refresh: gradient background, colored difficulty buttons,
  card shadows, speech-bubble message box, pop animation on marks,
  blurred action bar, ui-rounded type.
- confetti.js celebration on win + bouncing emoji (prefers-reduced-motion
  respected).

## Post-ship round 3 (2026-06-11)

- Voice picker restricted: en-US only, novelty voices excluded, and if any
  Enhanced/Premium voices are installed the picker offers ONLY those
- sounds.js: WebAudio tick on marks + chime on solve (gated by Voice toggle)
- First-run welcome screen ('welcomed' setting) with spoken walkthrough
- Solved-puzzles counter on start screen ('solvedCount' setting, hidden at 0)
- 7 new themes (total 14), all verified generating at every difficulty
- Talk button breathing animation; 90s idle → gentle spoken nudge
- newPuzzle retries up to 8 seeds on difficulty-band misses

## Post-ship round 4 (2026-06-11)

- ☰ Menu overlay (single level, from start + play screens): Home, new
  puzzle per difficulty, voice list (en-US non-novelty, ⭐ natural flag,
  ✓ current, tap = preview + select), voice on/off, instructions, and an
  on-screen tip for downloading Enhanced voices in iOS Settings
- 🏠 Home button on play screen preserves the game; start screen shows
  "▶ Continue your puzzle"
- Removed: scattered quit/help/voice buttons, start-screen cycle picker

## Post-ship round 5 (2026-06-11)

- Family puzzle: menu inputs put real names into Grandkids theme
  ('familyNames' setting, applied in init before any generation)
- "Read my grid back" voice intent (read_grid) — per-person spoken recap
- Daily puzzle button (UTC day seed × 7919, theme rotates by day, medium)
- Larger-print toggle ('bigText' setting → html.big-text, 125% base)
- Onboarding coach: first puzzle before any win suggests an exact utterance
  from the puzzle's own clues; one encouragement after first mark
- Share button on win screen (navigator.share → clipboard fallback)

## Open items

- Voice quality: if her devices show only robotic voices in the menu list,
  Enhanced voices are not downloaded on that device — the menu tip explains
  the Settings path. Verify Zoe appears with ⭐ after download.
- Grandma field test!

## Done (Milestone 4 — voice input)

- `js/commands.js`: DOM-free utterance parser. Normalize (lowercase, strip
  punctuation, number-words→digits, n't→not), control-intent patterns
  (undo "wait, go back" / hint "I'm stuck" / reveal / help "I don't
  understand" / status / check "am I done" / read clues / read clue N /
  next clue / repeat / new puzzle / yes / no), then deduction parsing:
  vocabulary matching cascade exact→prefix→edit-distance-1→bigram-Dice.
  30 tests in tests/commands.test.mjs (incl. recognizer-mishear cases).
- `js/speech.js`: listenOnce() push-to-talk (fresh recognition instance per
  use, cancels TTS first so the app doesn't hear itself).
- `js/app.js`: big round Talk button (pulses red while listening);
  confirm-when-unsure flow ("Did you mean…? Say yes or no") for fuzzy
  matches, overwrites, and contradictions; status summary; check-my-work
  (gentle); voice "new puzzle" requires yes/no confirm; mic-permission and
  no-speech error messages; `window.__handleUtterance` debug hook.
- Verified in preview end-to-end: solved a full puzzle by voice alone,
  mishears trigger confirmation, contradictions flagged gently, completion
  spoken. No console errors. 53/53 tests total.

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

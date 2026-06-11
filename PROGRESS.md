# PROGRESS

_Last updated: 2026-06-10_

## Status: Milestone 0 — speech test harness built, awaiting device-test results

## Done

- Plan approved with amendments (see CLAUDE.md for all binding decisions:
  simplicity principle, difficulty bands, simple command-matching cascade,
  IndexedDB-only saves, deterministic puzzle IDs, accessibility requirements,
  hint scope limit, decoupled engine for future grid-free mode).
- Verified (desk research only): iOS Safari supports `webkitSpeechRecognition`
  since 14.5; continuous mode broken on iOS; recognition reportedly fails in
  standalone-PWA mode. **All treated as unverified until Milestone 0 passes on
  the actual target devices.**
- CLAUDE.md and PROGRESS.md created.
- Milestone 0 harness built: `speech-test.html` — standalone page with
  push-to-talk recognition test, SpeechSynthesis sample-clue test, and an
  on-screen diagnostic log (UA, display mode, errors).

## In progress

- User deploys harness to GitHub Pages (instructions given in chat) and runs
  it on the target iPhone, iPad, and MacBook — both in Safari and after
  add-to-home-screen — and reports results.

## Next

- **PAUSED until device-test results arrive.** Then: Milestone 1 — puzzle
  engine (solver.js, generator.js, themes.js + Node test scripts), calibrate
  difficulty bands, document final metrics in CLAUDE.md.

## Decisions log

- 2026-06-10: localStorage→IndexedDB as sole game-state store; GitHub Pages
  hosting; vanilla JS no build step; curated themes, no LLM; completion
  returns to start screen; milestone 0 inserted before engine work.

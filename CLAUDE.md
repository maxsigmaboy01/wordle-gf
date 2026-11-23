# Daily Puzzle

A five-letter word puzzle game played across five levels, with a surprise reveal on level 3. It ships as an offline standalone HTML player, a web player, a macOS app (Tauri) and an iPhone app (SwiftUI). See `README.md` for gameplay details.

## Role of main

Main is the tech lead. It breaks work into small tasks, hands them to the team, checks each hand-back against the diff and test results, and integrates. Main does small edits itself; anything bigger goes to an agent.

## Layout

```text
backend/     game rules, grading, round/campaign state (game.js, campaign.js) + *.test.js
backend/data levels.json, words.txt (accepted guesses), answers.txt (keep order)
frontend/    page, styles, views, keyboard, storage, audio, seasons/themes, assets
scripts/     build.mjs (esbuild bundle -> dist/)
src-tauri/   macOS app (Rust/Tauri)
ios/         SwiftUI iPhone app
dist/        build output, git-ignored
```

## Commands

- Install: `npm ci`
- Test: `npm test` (node --test)
- Build: `npm run build` -> `dist/index.html`; player only: `npm run build:player`
- Mac: `npm run build:mac` (needs Rust)
- Rebuild after editing any source or dictionary.

## Rules

- The engine in `backend/` is pure JS with no server; the frontend bundles it. Keep game logic in `backend/` and UI in `frontend/`.
- Every rule change in `backend/` comes with a test in `backend/*.test.js`.
- The player must keep working offline: embed assets and add no external runtime requests.
- Do not reorder `answers.txt`; saved games depend on its order.
- Original game content only: our own art, sounds and themes. Do not copy assets from existing games.
- Ask before installs, commits, pushes, or deleting files.
- Before saying something is done, run `npm test` and `npm run build` and report the real results.

## Team

Agent definitions are in `.claude/agents/`. Every brief must name the goal, the files the agent may edit, and what counts as done.

| Agent | Use for |
|---|---|
| `game-engineer` | Game rules, grading, levels, campaign state, dictionaries (`backend/`) |
| `frontend-engineer` | UI, styles, animation, themes, audio, storage (`frontend/`) |
| `platform-engineer` | Build script, Tauri mac app, iOS app |
| `test-runner` | Run tests/builds and report results; does not fix |
| `code-reviewer` | Read-only review of a diff before it is accepted |

Workflow: write -> review (`code-reviewer`) -> test (`test-runner`) -> fix -> verify. One writer per file; run independent tasks in parallel.

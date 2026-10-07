# Status

Status: Active cross-PC handoff entry point; fee collector accounting integration in progress
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The existing Google Apps Script fee collector in `fee-collector/` is merged into `main`; a follow-up integration branch `codex/fee-collector-accounting-integration` is in progress.
- The in-progress branch points the app at `Simpsons会計` (`1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`), adds operational tabs, and reads game-specific amounts from `試合会計`. The spreadsheet timezone is `Asia/Tokyo`; the legacy sheet remains an untouched backup. This branch has not been deployed, committed, or pushed yet.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The deployed Apps Script web app remains at version 8 until this integration is completed and deployed. Its touch-device sizing, execute-as-owner behavior, and URL-based access are unchanged. The public GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/` declares the adopted 180×180 Apple touch icon. The current fee collector still uses the previous ledger and fixed payment behavior until a new deployment is verified.
- The live fee collector exposes `台帳を開く`, which opens the connected ledger spreadsheet in a new tab. This was confirmed from the GitHub Pages entry on 2026-10-07.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-collector-accounting-integration` (in progress)

## Next

The next fee-collector step is to verify player-master synchronization (finance IDs are internal; names/jersey numbers are the human lookup), then commit, push, and deploy the completed integration. The legacy source had no populated match, participant, or receipt records on inspection and remains a backup. Other follow-ups: the player photo library inbox is empty, and the official logo file still needs confirmation. The home-screen icon task is complete and confirmed on iPhone.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

# Status

Status: Active cross-PC handoff entry point; 2026-10-17 lineup handoff in progress
Last updated: 2026-10-16

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The existing Google Apps Script fee collector, accounting integration, and member auto-fill are merged into `main` through PRs #10 and #11. This lineup handoff does not deploy the app or install its edit trigger.
- The 2026-10-17 STARTING LINEUP PNG, source, roster, and DH/pitcher presentation are recorded in `instagram/lineups/`.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The last verified Apps Script web app deployment was version 8. This lineup handoff did not check or change its deployment. The public GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/` declares the adopted 180×180 Apple touch icon.
- The live fee collector exposes `台帳を開く`, which opens the connected ledger spreadsheet in a new tab. This was confirmed from the GitHub Pages entry on 2026-10-07.

## Active branch

Update this field at the end of each meaningful development session.

`codex/starting-lineup-2026-10-17` (based on `origin/main` at `e644c87`)

## Next

No further work is requested for the 2026-10-17 lineup. Future lineups should use the confirmed source and verify each new match's facts and roster. Separately, the merged accounting and member auto-fill code still requires deployment, owner authorization of `installMemberLookupTrigger`, and a smoke check. The player photo library inbox is empty, and the official Feature Player logo file still needs confirmation.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

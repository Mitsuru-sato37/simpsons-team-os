# Status

Status: Active cross-PC handoff entry point
Last updated: 2026-10-06

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The Google Apps Script fee collector in `fee-collector/` is merged into `main`.
- The collector records cash, manually confirmed PayPay, and bank-transfer receipts against `Simpsons_集金台帳_試作版`, preserves cancellations, prevents duplicate active receipts, and advances to the next open game after completion.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The Apps Script web app is at deployment version 7. It retains touch-device sizing for embedded viewports, executes as the owner, and is accessible to anyone with its URL. The public GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/` declares the adopted 180×180 Apple touch icon in the top-level page and embeds the existing app; use this URL for iPhone Home Screen installation. The Apps Script deployment ID and URL are unchanged. Cash records the full outstanding balance, while PayPay and bank transfer remain 300 yen per action. Per-game participants are registered in the `参加者` tab with game ID and player ID; names resolve from the master, with no in-app roster picker yet.

## Active branch

Update this field at the end of each meaningful development session.

`codex/player-photo-library`

## Next

The player photo library service, Drive provider wiring contract, and Codex connector runbook are on `codex/player-photo-library`. The inbox is empty, so the end-to-end photo preview and catalog update remain to be exercised when the user adds photos. Existing separate follow-up: confirm the official logo image in the Feature Player Drive folder and update the Drive SNS guide if it remains canonical. The home-screen icon task is complete and the user confirmed it appears on iPhone.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

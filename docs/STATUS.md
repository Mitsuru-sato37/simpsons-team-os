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
- The private web app is at deployment version 6; the same owner-only URL now includes touch-device sizing for embedded viewports. Cash records the full outstanding balance, while PayPay and bank transfer remain 300 yen per action. Per-game participants are currently registered in the `参加者` tab with game ID and player ID; names resolve from the master, with no in-app roster picker yet.

## Active branch

Update this field at the end of each meaningful development session.

`codex/feature-player-workflow`

## Next

Push the committed FEATURE PLAYER workflow update when GitHub connectivity is available. Then verify the official logo asset in the Feature Player Drive folder and align `Simpsons_試合後SNS標準運用ガイド_v2.1` with the photo-preserving Canva layer workflow. The trusted-read bridge required before editing an existing Google Doc was unavailable here, so the Drive guide was not changed.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

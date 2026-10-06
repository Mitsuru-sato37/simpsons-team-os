# Status

Status: Active cross-PC handoff entry point
Last updated: 2026-10-05

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The Google Apps Script fee collector in `fee-collector/` is merged into `main`.
- The collector records cash, manually confirmed PayPay, and bank-transfer receipts against `Simpsons_集金台帳_試作版`, preserves cancellations, prevents duplicate active receipts, and advances to the next open game after completion.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The private web app is at deployment version 5; the same private URL now includes larger mobile typography and touch targets. Cash records the full outstanding balance, while PayPay and bank transfer remain 300 yen per action. Per-game participants are currently registered in the `参加者` tab with game ID and player ID; names resolve from the master, with no in-app roster picker yet.

## Active branch

Update this field at the end of each meaningful development session.

`codex/player-master-integration`

## Next

Refresh the version 5 private Apps Script on an iPhone and confirm the responsive layout, then run the remaining iPhone operation checks against the real sheet. Do not create a receipt as part of visual verification. Confirm jersey-number display, full-balance cash collection, PayPay/bank-transfer confirmation, receipt display, cancellation, duplicate-tap prevention, and automatic next-game selection. Then decide whether to add an in-app player-master picker for participant registration. Record the result in `docs/PROGRESS.md`.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

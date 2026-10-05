# Status

Status: Active cross-PC handoff entry point
Last updated: 2026-10-05

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The Google Apps Script fee collector in `fee-collector/` is merged into `main`.
- The collector records cash and manually confirmed PayPay receipts against `Simpsons_集金台帳_試作版`, preserves cancellations, prevents duplicate active receipts, and advances to the next open game after completion.

## Active branch

Update this field at the end of each meaningful development session.

`main`

## Next

Deploy the fee collector as a private Apps Script web app and run an iPhone operation test against the real sheet. Confirm receipt display, cancellation, duplicate-tap prevention, and automatic next-game selection. Record the result in `docs/PROGRESS.md`.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

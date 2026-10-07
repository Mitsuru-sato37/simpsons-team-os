# Status

Status: App-mediated roster import implementation in progress
Last updated: 2026-10-07

This file is the stable cross-PC handoff entry point. See `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md` for project context and history.

## Current state

- Active branch: `codex/fee-collector-cloud-roster`, based on `codex/fee-collector-roster-picker` (PR #13 remains open).
- The fee-collector Apps Script deployment remains version 11 at its existing URL. PR #13 includes roster selection, accounting integration, emergency member IDs, startup optimization, and the ¥300 default.
- The user requested a phone-friendly cloud process: attach a lineup or scorebook image, review player matches and uncertain names, confirm attendance, then handle same-day additions or absences from the phone.
- The user approved the design and plan. The user confirmed phone image reading works. The workflow now uses assistant-produced copy-ready jersey/name lines pasted into the existing mobile app; the app previews and applies changes through Apps Script. Implementation is in progress on the branch.
- On 2026-10-07, the user authorized clearing all current match, participant, and invoice records in `Simpsons会計`. Those records are now empty; the six finance tabs, operational tabs/headers/formulas, member roster, and player master remain. The legacy ledger is retained as backup.
- Read access to both Sheets is confirmed. Direct connector writes are not used; attendance changes stay in the existing Apps Script `google.script.run` path and its lock/reconciliation functions. No new endpoint or deployment access change is planned.
- Emergency attendee identity must use server-assigned finance IDs without fabricating a player-master record.

## Active branch

`codex/fee-collector-cloud-roster` (worktree: `C:\Users\佐藤充\.codex\worktrees\fee-collector-cloud-roster\simpsons-team-os`)

## Next

Implement pasted-roster preview/confirmation and safe participant changes within the existing app, then test with local fixtures. The capability check made no live sheet changes.

## Handoff requirements

Before ending a meaningful development session, update `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`, commit and push intended changes, and keep this file aligned with the active branch and next task.

# Status

Status: Implementation plan approved; cloud attendance-write boundary is blocked
Last updated: 2026-10-07

This file is the stable cross-PC handoff entry point. See `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md` for project context and history.

## Current state

- Active branch: `codex/fee-collector-cloud-roster`, based on `codex/fee-collector-roster-picker` (PR #13 remains open).
- The fee-collector Apps Script deployment remains version 11 at its existing URL. PR #13 includes roster selection, accounting integration, emergency member IDs, startup optimization, and the ¥300 default.
- The user requested a phone-friendly cloud process: attach a lineup or scorebook image, review player matches and uncertain names, confirm attendance, then handle same-day additions or absences from the phone.
- The user approved the design in `docs/superpowers/specs/2026-10-07-fee-collector-mobile-cloud-roster-design.md`. The implementation plan is at `docs/superpowers/plans/2026-10-07-fee-collector-mobile-cloud-roster.md`. No implementation or product tests have started; the user must review the plan before code changes.
- On 2026-10-07, the user authorized clearing all current match, participant, and invoice records in `Simpsons会計`. Those records are now empty; the six finance tabs, operational tabs/headers/formulas, member roster, and player master remain. The legacy ledger is retained as backup.
- Read access to both Google Sheets is confirmed. The connected tools do not expose Apps Script execution or an authenticated, lock-aware attendance writer. Direct Sheets writes would bypass locking, E-ID allocation, and invoice/match reconciliation; do not implement the import writer until a safe path is selected.
- Emergency attendee identity must use server-assigned finance IDs without fabricating a player-master record.

## Active branch

`codex/fee-collector-cloud-roster` (worktree: `C:\Users\佐藤充\.codex\worktrees\fee-collector-cloud-roster\simpsons-team-os`)

## Next

The user approved the plan. Before code changes, resolve the missing safe write path: either provide an authenticated route to the Apps Script attendance operation, or revise the workflow to a user-mediated path inside the existing app. The current sheet state was not modified during the capability check.

## Handoff requirements

Before ending a meaningful development session, update `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`, commit and push intended changes, and keep this file aligned with the active branch and next task.

# Status

Status: Mobile/cloud roster intake design drafted; awaiting user review
Last updated: 2026-10-07

This file is the stable cross-PC handoff entry point. See `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md` for project context and history.

## Current state

- Active branch: `codex/fee-collector-cloud-roster`, based on `codex/fee-collector-roster-picker` (PR #13 remains open).
- The fee-collector Apps Script deployment remains version 11 at its existing URL. PR #13 includes roster selection, accounting integration, emergency member IDs, startup optimization, and the ¥300 default.
- The user requested a phone-friendly cloud process: attach a lineup or scorebook image, review player matches and uncertain names, confirm attendance, then handle same-day additions or absences from the phone.
- A design draft is at `docs/superpowers/specs/2026-10-07-fee-collector-mobile-cloud-roster-design.md`. No implementation or tests have started. The user must review this design before an implementation plan is written.
- On 2026-10-07, the user authorized clearing all current match, participant, and invoice records in `Simpsons会計`. Those records are now empty; the six finance tabs, operational tabs/headers/formulas, member roster, and player master remain. The legacy ledger is retained as backup.
- Cloud image/Sheets connector availability and safe write guarantees are not yet verified. Emergency attendee identity must use server-assigned finance IDs without fabricating a player-master record.

## Active branch

`codex/fee-collector-cloud-roster` (worktree: `C:\Users\佐藤充\.codex\worktrees\fee-collector-cloud-roster\simpsons-team-os`)

## Next

Commit and push the design draft and handoff notes, then ask the user to review the design. After approval, write an implementation plan and get approval before changing the application. Verify cloud image/Sheets connector access and the Apps Script attendance-write boundary before implementing. If those capabilities or safe writes are unavailable, report the constraint and adjust the design with the user.

## Handoff requirements

Before ending a meaningful development session, update `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`, commit and push intended changes, and keep this file aligned with the active branch and next task.

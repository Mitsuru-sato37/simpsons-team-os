# Status

Status: Active cross-PC handoff entry point; fee-collector accounting integration and emergency member IDs in progress
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The active local branch is `codex/fee-collector-roster-picker` based on `origin/main`. It contains participant selection, accounting integration, roster lookup, and the new emergency member-ID change; changes remain uncommitted in this worktree.
- The target `Simpsons会計` spreadsheet retains its six accounting tabs plus the fee-collector operational tabs. The live `メンバー請求` name column has a 40-name roster dropdown and accepts free text; the accidental dropdown on `メンバー` was restored to text.
- Local source resolves known names to existing `M` IDs and assigns emergency names persistent `E001`-style IDs in blank invoice rows. It adds emergency members without jersey numbers, reuses IDs by name, and does not alter app-generated invoices. The handler extension still needs to be saved to the live Apps Script project and verified there.
- Local verification: `node --test tests/*.test.mjs` passed (55 tests); `git diff --check` passed. `git fetch origin` failed because this environment cannot write `.git/FETCH_HEAD`; commit/push and PR creation remain pending in an environment with Git write access.
- The deployed Apps Script web app remains at version 8 until the source changes are published and a new deployment is verified. The old ledger remains a backup and the spreadsheet timezone is `Asia/Tokyo`.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-collector-roster-picker` (in progress; based on origin/main; local worktree changes)

## Next

Save/publish the updated Apps Script source, verify the existing installable edit trigger with a disposable emergency name and confirm its E ID in both `メンバー請求` and `メンバー`. Then complete review, commit, push, and create/update the PR once `.git` write access is available. The working test fixture is marked `TEST-DEMO-20261007`; no payment was recorded. The legacy ledger remains a backup.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

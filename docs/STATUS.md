# Status

Status: Active cross-PC handoff entry point; fee-collector accounting integration and emergency member IDs in progress
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The active branch is `codex/fee-collector-roster-picker` based on `origin/main`, with four commits pushed. [PR #13](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/13) is open and mergeable. It contains participant selection, accounting integration, roster lookup, and emergency member IDs.
- The target `Simpsons会計` spreadsheet retains its six accounting tabs plus the fee-collector operational tabs. The live `メンバー請求` name column has a 40-name roster dropdown and accepts free text; the accidental dropdown on `メンバー` was restored to text.
- Local source resolves known names to existing `M` IDs and assigns emergency names persistent `E001`-style IDs in blank invoice rows. It adds emergency members without jersey numbers, reuses IDs by name, and does not alter app-generated invoices. The live Apps Script project has the existing `handleMemberRosterEdit` installable trigger, but its current `Logic.gs` does not contain the emergency-ID helper; the local changes still need to be saved and verified there.
- Local verification: `node --test tests/*.test.mjs` passed (56 tests); `git diff --check` passed. Direct fetch was blocked by `.git` sandbox restrictions, but push and PR creation succeeded through approved GitHub access.
- The Apps Script deployment manager shows web app version 9, while emergency-ID behavior is still absent from the live source. The old ledger remains a backup and the spreadsheet timezone is `Asia/Tokyo`.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-collector-roster-picker` (pushed; PR #13 open)

## Next

The existing Apps Script project is mapped by `fee-collector/.clasp.json`, and the user completed clasp OAuth login. `clasp push` is blocked until the user enables “Google Apps Script API” at https://script.google.com/home/usersettings. Once enabled, push from `fee-collector/`, verify the existing edit trigger with a disposable emergency name, confirm its E ID appears in both `メンバー請求` and `メンバー`, then clear the test row. The deployment manager currently shows version 9. The working fixture is marked `TEST-DEMO-20261007`; no payment was recorded. The legacy ledger remains a backup.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

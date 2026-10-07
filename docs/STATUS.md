# Status

Status: Active cross-PC handoff entry point; fee-collector accounting integration and emergency member IDs deployed and live-tested
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The active branch is `codex/fee-collector-roster-picker`, pushed to GitHub. [PR #13](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/13) is open and mergeable. It contains participant selection, accounting integration, roster lookup, and emergency member IDs.
- The target `Simpsons会計` spreadsheet retains its six accounting tabs plus the fee-collector operational tabs. The live `メンバー請求` name column has the 40-name roster dropdown and allows typed names outside the list; the accidental dropdown on `メンバー` was removed.
- Local source resolves roster names to existing `M` IDs and assigns emergency names persistent `E001`-style IDs in blank invoice rows. It adds emergency members without jersey numbers, reuses IDs by name, and does not alter app-generated invoices. The live Apps Script source was synchronized, and a live edit confirmed `渡部 琉斗` mapped to `M001` and a free-typed emergency name mapped to `E002` in both tables. Both disposable rows were cleared; no payment was made.
- Local verification: `node --test tests/*.test.mjs` passed (56 tests); `git diff --check` passed. Direct fetch was blocked by `.git` sandbox restrictions, but push and PR creation succeeded through approved GitHub access.
- The existing `handleMemberRosterEdit` installable trigger remains in place; no duplicate trigger was installed. The existing deployment is version 10 at the same deployment ID and URL. The old ledger remains a backup and the spreadsheet timezone is `Asia/Tokyo`.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-collector-roster-picker` (pushed; PR #13 open)

## Next

The Apps Script sync and version 10 deployment are complete. Google Sheet live testing confirmed roster-name lookup and emergency E-ID creation; the temporary rows are cleared. `E001` and `E002` were consumed by disposable tests, so the next emergency ID will be `E003` by design. The pre-existing fixture remains marked `TEST-DEMO-20261007`; no payment was recorded. Next: review and merge PR #13, then verify the live web app's game list and normal receipt workflow without entering a payment. The legacy ledger remains a backup.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

# Status

Status: Video-analysis results show estimated transition intervals and support corrected/missed intervals
Last updated: 2026-10-21

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Video-analysis work is on `codex/video-inning-mvp`, based on `main`. Candidate rows show heuristic start/end intervals (logic 1.1), prefill editable feedback fields, and distinguish confirmed/manual intervals. Missed intervals can be added manually. The branded VBS launcher starts Python without a terminal. Feedback stays local and does not automatically alter detection logic.
- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The fee collector continues on the separate `codex/fee-collector-roster-picker` branch, with PR #13 open. This video branch is based on `main` and does not include that branch's source changes.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The Apps Script deployment described by the separate fee-collector handoff is version 11. Its live state is outside this video task.
- The live fee collector exposes `台帳を開く`, which opens the connected ledger spreadsheet in a new tab. This was confirmed from the GitHub Pages entry on 2026-10-07.

## Active branch

Update this field at the end of each meaningful development session.

`codex/video-inning-mvp` (video-analysis work). Fee-collector work continues separately on `codex/fee-collector-roster-picker` with PR #13 open.

## Next

Rerun analysis on saved videos to compute their estimated intervals, then review and correct interval labels. Older JSON results cannot be backfilled because they do not contain the detailed frame samples. The separate fee-collector next task is to review PR #13.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

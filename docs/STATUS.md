# Status

Status: Local video-analysis MVP processed GX010430.mp4; candidate review and feedback pending
Last updated: 2026-10-08

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Video-analysis work is on `codex/video-inning-mvp`, based on `main`. Its desktop module processed the local GX010430.mp4 and saved five candidates. Python/OpenCV and FFmpeg were discovered under the user's profile; the launcher now finds those standard installation paths without a PATH edit. Candidate truth labels remain pending.
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

Open the saved GX010430 analysis in the review UI, confirm candidate boundaries and record feedback, then tune detection. The separate fee-collector next task is to review PR #13.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

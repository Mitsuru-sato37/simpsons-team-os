# Status

Status: Video-analysis detector updated from saved local inning feedback (logic 1.2)
Last updated: 2026-10-22

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Video-analysis work is on `codex/video-inning-mvp`, based on `main`. Logic 1.2 adds a 4x4 spatial color-state route, using local feedback-derived thresholds and movement checks alongside the existing global-color route. Candidate rows show heuristic start/end intervals and prefill editable feedback fields. Missed intervals can be added manually. Feedback remains local and does not automatically alter logic. Current feedback and camera assumptions are documented in `video_analysis/README.md` and `docs/PROJECT_CONTEXT.md`.
- Verified: all 25 `tests/test_video_analysis.py` tests pass. Local replay confirmed spatial candidates overlapping all seven manually entered positive intervals, including GX020480 933–1063 (detected 890–1050); checked false-positive examples were rejected after the home-plate-side share gate. The replay is a small, single-camera feedback set and is not a general accuracy estimate.
- Next: review detector behavior in the user's app on additional recordings, especially whether estimated starts/ends are useful; collect new misses and false positives before changing camera-position assumptions.
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

Verify the VBS launch on the user's PC, using `.local/video-analysis/startup-error.log` if it still fails. Rerun analysis on saved videos to compute estimated intervals; older JSON results cannot be backfilled because they do not contain detailed frame samples. The separate fee-collector next task is to review PR #13.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

# Status

Status: Simpsons会計統合と選手マスター自動補完を反映済み。ライブ確認完了
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The fee collector accounting integration and player-master auto-fill are merged into `main` (PRs #10 and #11).
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The existing Apps Script web app is deployed at version 9. It uses `Simpsons会計`, reads per-game charges, and retains its deployment ID, URL, execute-as-owner behavior, and anyone-with-URL access. The installable edit trigger `handleMemberRosterEdit` is active for player-master completion in `メンバー`. The target spreadsheet timezone is `Asia/Tokyo`.
- The live fee collector exposes `台帳を開く`, which opens the connected ledger spreadsheet in a new tab. This was confirmed from the GitHub Pages entry on 2026-10-07.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-collector-live-rollout` (handoff documentation update)

## Next

No populated legacy game, participant, or receipt rows were found, so there was nothing to transfer; the old spreadsheet remains untouched as a backup. The live app loads without error and correctly shows no games. Do a harmless roster auto-fill spot-check on an existing member before entering operational data. Other follow-ups: the player photo library inbox is empty, and the official logo file still needs confirmation. The home-screen icon task is complete and confirmed on iPhone.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

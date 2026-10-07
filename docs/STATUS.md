# Status

Status: Active cross-PC handoff entry point; member identity auto-fill follow-up in progress
Last updated: 2026-10-07

This file is the stable handoff entry point. Detailed project context and progress remain authoritative in `docs/PROJECT_CONTEXT.md` and `docs/PROGRESS.md`.

## Current state

- Repository initialized for cross-PC Codex development.
- Durable Simpsons / ラキポタ context is recorded.
- The existing Google Apps Script fee collector in `fee-collector/` is merged into `main`; the accounting integration and member auto-fill are proposed in stacked PRs #10 and #11.
- [PR #10](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/10) contains the fee-collector accounting integration and targets `main`. [PR #11](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/11), commit `4314412` on `codex/fee-member-autofill`, adds automatic player-master completion of ID/name/jersey number in the accounting member tab and is based on PR #10. The app remains undeployed at version 8 until both changes are reviewed/merged and the installable trigger is authorized.
- The collector now integrates with the native Google Sheets player master `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` for jersey numbers and names.
- The deployed Apps Script web app remains at version 8 until this integration is completed and deployed. Its touch-device sizing, execute-as-owner behavior, and URL-based access are unchanged. The public GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/` declares the adopted 180×180 Apple touch icon. The current fee collector still uses the previous ledger and fixed payment behavior until a new deployment is verified.
- The live fee collector exposes `台帳を開く`, which opens the connected ledger spreadsheet in a new tab. This was confirmed from the GitHub Pages entry on 2026-10-07.

## Active branch

Update this field at the end of each meaningful development session.

`codex/fee-member-autofill` (in progress; based on PR #10)

## Next

Review/merge PR #10 and stacked PR #11, then deploy the Apps Script, run `installMemberLookupTrigger` once as owner, and smoke-check name/jersey lookup without recording a payment. The legacy ledger remains a backup. Other follow-ups: the player photo library inbox is empty, and the official logo file still needs confirmation. The home-screen icon task is complete and confirmed on iPhone.

## Required handoff update

Before ending a meaningful session:

1. Update `docs/PROGRESS.md` with active branch, completed work, exact next task, verification, and blockers/dependencies.
2. Update `docs/PROJECT_CONTEXT.md` if durable requirements changed.
3. Update this file if the top-level state or active branch changed.
4. Commit and push all intended changes.

Codex chat history is optional context only; GitHub documentation must be sufficient to resume on another PC.

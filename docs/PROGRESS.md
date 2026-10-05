# Progress

Status: fee collector supports three manual payment channels
Last updated: 2026-10-05

## Completed

- GitHub repository identity is now documented as `Mitsuru-sato37/simpsons-team-os`.
- Existing Apps Script fee collector is connected by design to spreadsheet ID `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`.
- Deterministic next-open-game selection and receipt projection helpers were added.
- Payment double-submit protection remains backed by the Apps Script lock and active-receipt recheck.
- Game completion now uses a lock and selects the next open game.
- Cancelled receipts remain in the sheet and are shown in a separate collapsed `取消履歴` section.
- Repository design and implementation plan were added under `docs/superpowers/`.
- Unpaid-player cards now use the operational labels `現金300円` and `PayPay確認`.
- Unpaid-player cards now also expose `銀行振込確認`; bank transfer is manually confirmed and stored as a receipt method.
- `完了` と `中止` の試合は手動選択して確認できるが、完了操作を再実行できない。Apps Script側も状態を確認して更新を拒否する。
- `codex/fee-collector` was merged into `main` on 2026-10-05.
- Existing private Apps Script web app was updated to deployment version 2 with the bank-transfer UI; the web app URL is unchanged.

## Verification

- `node --test tests/fee-collector-logic.test.mjs` — 14 tests passed (2026-10-05)
- `git diff --check`
- Google Sheets metadata and headers were checked for `試合`, `参加者`, `受領履歴`, and `当日集金`.

## Remaining scope

- Run the iPhone operation test against the updated private Apps Script web app.
- Participant registration from a starting-lineup image remains a later feature.
- PayPay API integration, authentication, and public deployment remain out of scope.

## Handoff

Current branch: `codex/payment-channels`

Next task: perform an iPhone operation test against the updated private Apps Script deployment, including all three payment labels, receipt display, cancellation, duplicate-tap prevention, and automatic next-game selection.

The merged `main` branch must be pushed before switching PCs. Keep the spreadsheet ID in configuration/documentation only and do not commit deployment secrets.

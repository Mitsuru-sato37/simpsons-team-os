# Fee Collector → Simpsons会計 統合仕様

## Goal

Keep the existing fee-collector interface while making `Simpsons会計` the operational source of truth for games, participants, receipts, member invoices, transactions, and match settlement.

## Existing state

- Target spreadsheet: `1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ` (`Simpsons会計`), currently with six tabs: `ダッシュボード`, `取引台帳`, `試合会計`, `メンバー請求`, `会費管理`, and `メンバー`.
- Target spreadsheet timezone is currently `America/Los_Angeles`; it must be `Asia/Tokyo`.
- Legacy spreadsheet: `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E` (`Simpsons_集金台帳_試作版`). It contains the tabs `試合`, `参加者`, and `受領履歴`. A read-only inspection found no match rows or receipt rows; `参加者` currently contains only template formulas.
- The existing fee collector is a Google Apps Script web app with a master player lookup using `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4` / `選手マスター` and legacy `P001`-style ID normalization.
- Target financial structures already exist: `試合会計` includes `試合ID`, `日付`, `対戦相手`, `グラウンド`, `合計`, `負担人数`, `1人あたり基準額`, `実徴収額/人`, `徴収予定総額`, `実入金額`, `未回収額`, and `精算状態`; `メンバー請求` includes `請求ID`, `メンバーID`, `名前`, `種類`, `関連ID`, `請求日`, `請求額`, `入金額（請求管理用）`, `未払い額`, and `状態`; `取引台帳` includes the existing accounting fields through `メモ`.

## Design

1. Keep the six existing accounting tabs and their user-entered financial facts. Add three fee-collector-specific tabs: `集金_試合`, `集金_参加者`, and `集金_受領履歴`. These are the authoritative operational records for the app after migration.
2. Point fee-collector reads and writes at the new spreadsheet ID. Continue resolving player names and jersey numbers through the existing player master, normalizing legacy participant IDs exactly as today.
3. Use `試合会計` → `実徴収額/人` as the per-game charge used by the app. Do not substitute a fixed 300-yen default. A missing or non-positive per-game amount blocks payment and is surfaced as an actionable error. Payment amount for each method is the remaining balance, capped only by the player's outstanding charge. For migrated historical participants, preserve an existing row-level invoice amount when the historical match has no per-person amount in the new accounting sheet.
4. For each game/person, maintain one `メンバー請求` row. Its amount is the game charge; its received amount is the sum of active receipts. Each receipt has a stable receipt ID and one corresponding `取引台帳` row. A cancelled receipt remains in receipt history and its corresponding transaction is marked cancelled so it no longer contributes to accounting totals. Match settlement totals are derived from participant charges and active receipts.
5. Keep receipt recording under the existing Apps Script lock and recheck active receipts inside the lock before inserting. Make transaction and invoice projections idempotent by using stable receipt IDs and the composite game/person invoice key.
6. Provide an idempotent migration/setup path that copies all non-empty legacy games, participants, and receipts without deleting or changing the old file. Existing IDs, timestamps, methods, amounts, status, memo, and per-player charge are preserved. Legacy rows are not re-imported once their IDs exist in the new fee tabs.
7. Set the target spreadsheet timezone to `Asia/Tokyo`. Keep the old spreadsheet as an untouched backup.
8. Retain the existing UI flow and show actual game/person charge values from the new data. Do not change deployment access settings or URLs.

## Acceptance criteria

- A game with a configured charge uses that exact amount in the participant state and collection controls; a game without a charge cannot record a receipt. Migrated historical invoices retain their original participant-specific billed amounts when no match-level charge was recorded.
- One collection creates one immutable receipt-history row, updates the member invoice, adds one linked transaction, and updates match settlement/dashboard formulas.
- Cancellation marks the receipt and linked transaction cancelled, decreases invoice received amount and match actual receipts, and allows a later replacement collection without deleting audit history.
- Duplicate submission remains serialized and cannot create duplicate active payment or transaction records.
- Migration can be run repeatedly without duplicating data. The source spreadsheet remains unchanged and available as the backup.
- The target retains its original six tabs and adds only the three operational tabs. Its timezone is `Asia/Tokyo`.
- Player master ID/name/jersey lookup remains in place.
- Existing fee-collector tests pass, with regression coverage for dynamic charges, missing-charge rejection, cancellation projections, and migration deduplication.

## Out of scope

- Changing the Apps Script deployment URL, access, or execute-as-owner mode.
- Deleting or renaming the legacy spreadsheet.
- Adding authentication, a roster-picker UI, or PayPay API integration.
- Changing unrelated team finance or membership rules.

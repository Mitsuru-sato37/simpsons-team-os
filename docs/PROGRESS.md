# Progress

Status: Instagram production module implemented on `codex/instagram-production`; fee collector hardening remains on `codex/fee-collector`
Last updated: 2026-10-06

## Completed

- GitHub repository identity is now documented as `Mitsuru-sato37/simpsons-team-os`.
- Added an independent Codex Instagram production module with separate `starting-lineup` and `post-game` routes and a shared `MatchContext` schema.
- Recorded the verified GAME RESULT / GAME STATS Canva source IDs and checked Drive reference files; added strict editable-field/fixed-element rules.
- Added a FEATURE PLAYER workflow based on the Drive reference image/examples and a rule to stop if the existing STARTING LINEUP source/method cannot be identified.
- Added Canva preview approval, copy-only editing, no-generated-image fallback, and Drive output verification rules.
- Added Node contract tests for the schema, workflow routing, Canva rules, Drive references, and stop conditions.
- Existing Apps Script fee collector is connected by design to spreadsheet ID `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`.
- Deterministic next-open-game selection and receipt projection helpers were added.
- Payment double-submit protection remains backed by the Apps Script lock and active-receipt recheck.
- Game completion now uses a lock and selects the next open game.
- Cancelled receipts remain in the sheet and are shown in a separate collapsed `取消履歴` section.
- Repository design and implementation plan were added under `docs/superpowers/`.

## Verification

- `node --test tests/instagram-production.test.mjs`
- `node --test tests/fee-collector-logic.test.mjs`
- `git diff --check`
- Google Sheets metadata and headers were checked for `試合`, `参加者`, `受領履歴`, and `当日集金`.

## Remaining scope

- The current STARTING LINEUP Drive folders are empty and no matching Canva design was found; production must stop until the existing source/method is identified.
- Canva has no direct export operation in the connected tool inventory. During an actual production request, verify the Canva browser download and Google Drive upload path; report any incomplete Drive save honestly.
- Resolve the intended completed-output Drive folder for each asset type when none is discoverable.
- Apps Script deployment and real iPhone operation test remain external steps.
- Participant registration from a starting-lineup image remains a later feature.
- PayPay API integration, authentication, and public deployment remain out of scope.

## Handoff

Current branch: `codex/instagram-production`. Push only when handing off across PCs. Keep the spreadsheet ID in configuration/documentation only and do not commit deployment secrets.

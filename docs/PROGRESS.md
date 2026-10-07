# Progress

Status: Simpsons会計統合に続く、選手マスターからのメンバー欄自動補完を実装中
Last updated: 2026-10-07

## Fee collector accounting integration (active)

- Active follow-up branch: `codex/fee-member-autofill`, based on pushed integration branch `codex/fee-collector-accounting-integration` (PR #10).
- App source now targets `Simpsons会計` (`1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`) and preserves its six accounting tabs. Operational tabs `集金_試合`, `集金_参加者`, and `集金_受領履歴` were added with headers matching the Apps Script schema.
- The target spreadsheet timezone is verified as `Asia/Tokyo`. Dashboard formulas now cover through row 1000. The finance member tab has a `背番号` column and is populated with 40 player-master records (`M001`–`M040`, names, and jersey numbers); the six original tabs remain present.
- The legacy spreadsheet (`1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`) remains untouched. Read-only inspection found zero populated game, participant, or receipt rows to migrate.
- Source implements idempotent legacy migration, per-match charges from `試合会計!J`, receipt/transaction/invoice/match-accounting projections, cancellation reversal, and retained lock-based duplicate prevention.
- Verification so far: `node --test tests/fee-collector-logic.test.mjs` (31 passed); Apps Script source parse passed; `git diff --check` passed. Live sheet headers, roster rows, timezone, and dashboard formulas were read back.
- The user's clarification was that people are known by jersey number or name. Finance IDs are therefore internal only; source roster IDs `001`–`050` map deterministically to `M001`–`M050`, and the finance member directory receives the player-master names and jersey numbers. User-facing screens continue to show names and jersey numbers.
- The follow-up adds an installable edit trigger so manually entering member ID, name, or jersey number on `メンバー` fills the other two using the player master. Ambiguous and missing matches are surfaced rather than guessed. The trigger requires one-time authorization/installation by the Apps Script owner.
- The live `メンバー!H2:H1000` range is formatted as text so entering a jersey such as `00` preserves its leading zeros.
- Verification: `node --test tests/*.test.mjs` passed (48); Apps Script source parse and `git diff --check` passed. Live `メンバー!H2:H1000` formatting was read back as text. PR #10 (`codex/fee-collector-accounting-integration` → `main`) remains open and is the dependency; this follow-up will be a stacked PR against that branch. The deployed app remains version 8 until the integration is merged and the trigger is installed.
- Current delivery: commit `4314412` is pushed on `codex/fee-member-autofill`; [PR #11](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/11) is open against PR #10's branch. The deployed app remains version 8 and the edit trigger is not installed. After both PRs merge, deploy the source and run `installMemberLookupTrigger` once as the Apps Script owner; then verify name/jersey entry without recording a payment. Keep the legacy ledger as a backup.

## Completed

- 2026-10-07: Added a `台帳を開く` link to the fee collector source. The app obtains the URL from the spreadsheet it actually uses, including Script Properties overrides, and opens it in a separate tab. Updated the existing Apps Script web app deployment to version 8, keeping the deployment ID, URL, execute-as-owner setting, and access setting unchanged. Verified from the GitHub Pages entry that the link appears and opens `Simpsons_集金台帳_試作版` in a new tab; no payment action or sheet edit was performed. The app showed no registered games during this verification.

- 2026-10-06: Inspected Simpsons Drive photo folders. Confirmed `03_選手写真`, `99_未仕分け`, `01_試合写真`, and player-specific folders. User clarified that `99_未仕分け` is currently empty; it is the intake location for photos added later. Existing photos are not being bulk-imported.
- 2026-10-06: Added `instagram/photo-library/` with an ID-based asset schema, source contract, Drive JSON catalog repository, atomic local JSON repository, and domain service for dry-run previews, safe classification, user confirmation history, deduplication, review queues, summaries, and player/match queries. FEATURE PLAYER lookup returns confirmed photos only.
- 2026-10-06: Added a Drive runtime composition root and documented the concrete Codex connector mapping for folder listing, image/catalog reads, player-master lookup, and same-file JSON catalog replacement/read-back. The Codex host supplies tool callbacks; no new API client, credentials, or cloud infrastructure are introduced.
- 2026-10-06: Added an independent `photo-library` Codex route and operating rules; `MatchContext.featurePlayer.playerId` now supports master-ID references.
- 2026-10-06: Created and read-verified the empty Drive catalog `Simpsons_写真資産カタログ.json` (`11QeVpv1yhrrx8wSGjNVnsxPoF8hJ2gib`) inside the existing `03_選手写真` folder. No image or folder was moved, renamed, or modified; no photo has been classified.

- GitHub repository identity is now documented as `Mitsuru-sato37/simpsons-team-os`.
- Added an independent Codex Instagram production module with separate `starting-lineup` and `post-game` routes and a shared `MatchContext` schema.
- Recorded the verified GAME RESULT / GAME STATS Canva source IDs and checked Drive reference files; added strict editable-field/fixed-element rules.
- Added a FEATURE PLAYER workflow based on the Drive reference image/examples and a rule to stop if the existing STARTING LINEUP source/method cannot be identified.
- Added Canva preview approval, copy-only editing, no-generated-image fallback, and Drive output verification rules.
- Added Node contract tests for the schema, workflow routing, Canva rules, Drive references, and stop conditions.
- Instagram workflow implementation originated on `codex/instagram-production` and is now included in `codex/fee-collector` for integration into `main`.
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
- Existing private Apps Script web app was updated to deployment version 3 with player-master integration; the web app URL is unchanged.
- The original Excel player master was deleted after conversion, as requested.
- The Excel player master was converted to native Google Sheets; the native copy is now the source of truth.
- Fee collector source now resolves participant IDs against the master and displays master jersey numbers and names.
- Cash collection now records the full outstanding balance and labels the button with that amount; PayPay and bank-transfer actions retain the 300-yen per-action cap.
- The private Apps Script web app was updated to deployment version 4 at the existing URL; the live sample with a 500-yen balance displayed `現金500円`.
- Confirmed the current participant workflow: attendance is entered per game in `参加者` with game ID and player ID; player names resolve from the master, but there is no in-app roster picker yet.
- Added a narrow-screen CSS layout for the fee collector: full-width content, larger typography, larger game selector, and 52–56px payment controls. Desktop breakpoints and payment behavior are unchanged.
- Deployed the initial mobile readability update to the existing private Apps Script web app as version 5 on 2026-10-06. The deployment remains restricted to the owner and retains the same URL.
- The iPhone screenshot after version 5 still showed the old compact sizing. Added a touch-device rule for embedded viewports up to 1024px, using viewport-relative sizing to compensate for the Apps Script frame; deployed as version 6 on 2026-10-06, retaining owner-only access and the existing URL.
- Updated FEATURE PLAYER workflow after the Enjoys post: per-game layouts can vary, the selected player's source photo remains unchanged, any generated background excludes people/logos/text, and the official Feature Player folder logo is added small as an independent Canva image layer.
- Recorded the user-confirmed Instagram caption structure and the requirement to offer three music options with a marked first choice.

- 2026-10-06: Added the user-approved 180×180 Apple touch icon to the fee collector and linked it from `Index.html`.
- Updated the existing owner-only Apps Script deployment to version 7; the deployment ID, URL, and access setting remain unchanged.
- 2026-10-06: Changed the existing version 7 Apps Script deployment access from owner-only to anyone with the URL, at the user's request. It continues to execute as the owner, and the deployment ID and URL are unchanged.
- 2026-10-06: Added and published a static GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/`. The top-level page links the adopted 180×180 touch icon and embeds the existing Apps Script app, preserving the app UI and app deployment URL.
- 2026-10-06: Restricted the GitHub Pages deployment workflow to `main`. Manual dispatches from feature branches now skip deployment, avoiding failures from the `github-pages` environment protection rules. The post-merge deployment from `main` succeeded.
## Verification

- 2026-10-07: Source diff check passed before commit. Live version 8 was opened through the public GitHub Pages entry; the link was visible and opened the correct ledger in another tab. No automated tests were run.

- Initial `git-status.cmd` / `git fetch origin` was blocked by access denied on `.git/FETCH_HEAD`. Local repository was clean on `main` at `origin/main`; `codex/player-photo-library` was created after narrowly scoped approval for Git metadata write.
- Drive folder inspection and empty catalog content/parent were verified read-only. No tests were added or run because the request did not ask for testing or verification. Implementation checks are still outstanding.
- `git diff --check` completed without whitespace errors (Git reported only existing LF-to-CRLF normalization notices).
- Connector execution mapping is documented but has not been exercised end-to-end. The inbox is empty, so the first real preview/write cycle must occur after the user adds photos. Cloud use requires the same Drive tools and access in that cloud task.

- 2026-10-06 handoff: fetched `origin`; `codex/player-photo-library` is based on the current `origin/main` commit `fa626c8`. `git diff --check` completed without whitespace errors (line-ending notices only). Tests were not run. The service/provider contract and concrete Codex connector procedure were reviewed; actual connector callbacks still run in the Codex host and have not been exercised end-to-end.

- `node --test tests/instagram-production.test.mjs`
- `node --test tests/fee-collector-logic.test.mjs`
- `git diff --check`
- Existing checks from the prior player-master integration: `node --test tests/fee-collector-logic.test.mjs` — 17 tests passed (2026-10-05); `git diff --check`.
- Visually inspected the live version 4 web app: sample game showed 6 participants, ¥2,000 billed, ¥1,500 received, ¥500 outstanding, and `現金500円` for the unpaid player. No receipt/payment action was triggered.
- `node --test tests/*.test.mjs` — 31 tests passed after resolving the latest `main` integration.
- Instagram schema and design registry JSON validation; `git diff --check` passed.
- Google Sheets metadata and headers were checked for `試合`, `参加者`, `受領履歴`, and `当日集金`.
- Native player master metadata and `選手マスター!A1:C12` were checked; the live web app version 4 loaded the real collection data successfully without creating a new receipt.
- Added a regression test for mobile-width layout sizing and updated a stale cash-button test to match the existing full-outstanding-balance label.
- `node --test tests/fee-collector-logic.test.mjs` — 18 tests passed; `git diff --check` passed.
- Reloaded the existing web app URL after deployment and confirmed the current sample game and participant data render. No payment, cancellation, or completion action was triggered. Desktop screenshot verified the unchanged wide-screen layout; verify mobile sizing on the user's iPhone after refresh.
- Added touch-device / embedded-viewport sizing regression coverage; current test run: `node --test tests/fee-collector-logic.test.mjs` — 19 tests passed; `git diff --check` passed.
- `jq empty instagram/designs.json` and `git diff --check` passed for the current documentation and workflow-registry changes. Automated tests were not run.

- Browser verification after deployment version 7 confirmed the app opens and its served HTML contains the 180×180 `apple-touch-icon` URL. The public Drive image loads as a 180×180 image. No payment action was performed.
- Apps Script Manage deployments confirmed version 7, execute-as-owner, access `全員` (anyone), and the same deployment ID and web app URL after the access update. No payment action was performed.
- GitHub Actions Pages deployment succeeded (run 1). The live entry page's top-level DOM has one `apple-touch-icon` link to `/apple-touch-icon.png` with `sizes="180x180"`; the page loads the existing Apps Script app in its iframe. No payment action was performed.
- The user confirmed the adopted icon is displayed on the iPhone Home Screen after using the GitHub Pages entry URL and said touch-device sizing does not need further checking.
- After PR #8 merged, the GitHub Pages workflow succeeded on `main` (run 6). Feature-branch workflow runs failed because the `github-pages` environment protection rules reject `codex/*` branches; the workflow trigger is now restricted to `main`.
## Remaining scope

- The current STARTING LINEUP Drive folders are empty and no matching Canva design was found; production must stop until the existing source/method is identified.
- Canva has no direct export operation in the connected tool inventory. During an actual production request, verify the Canva browser download and Google Drive upload path; report any incomplete Drive save honestly.
- Resolve the intended completed-output Drive folder for each asset type when none is discoverable.
- Verify which official logo file is in the Feature Player Drive folder and align the Drive SNS guide after the required file-backed trusted read is available.
- Verify the deployed private Apps Script on an iPhone after refreshing the version 6 layout; do not record a real payment during the test.
- Participant registration from a starting-lineup image remains a later feature.
- Consider adding an in-app player-master picker to register participants per game without manually entering IDs; no such UI exists yet.
- PayPay API integration and user authentication remain out of scope. Public directory listing is not enabled; app access requires its URL.

## Handoff

Current branch: `codex/fee-collector-ledger-link`.

Completed in this handoff: added the connected spreadsheet link to the fee collector source, updated the existing Apps Script deployment to version 8, and verified the live link opens the ledger in a separate tab. At verification the app showed no registered games, which may need investigation if unexpected. The photo-library implementation and operating instructions are also present at `2ce4b32`; no photos have been classified or moved.

Next task: if the empty game list in the live fee collector is unexpected, inspect its configured ledger connection and current game data without recording a payment. After the user adds photos to `99_未仕分け`, run a preview and review candidates/unknowns before writing confirmed metadata to the Drive catalog. Separate follow-ups remain: confirm the official logo image in the Feature Player Drive folder and align the Drive SNS guide if it remains canonical.

- 2026-10-06 correction: verified the current `99_未仕分け` folder is a direct child of the active `03_選手写真` folder. Do not use any `00` folder or archive as the photo intake source. Updated the Instagram operating route and project context to preserve that boundary.
- 2026-10-06: User supplied the `99_アーカイブ` folder URL and explicitly prohibited using anything in it as a reference. Read only its metadata (not its contents) to confirm the folder identity. Added its ID to the exclusion list and a runtime allowlist so photo intake can list only the configured inbox; no archive files were opened.
- 2026-10-07: Fast-forward merged `codex/player-photo-library` into `main`; `git fetch origin` completed before merge and `git diff --check` had no whitespace errors. Automated tests were not run for this merge request.
- 2026-10-07: Fee-collector spreadsheet-link implementation is on `codex/fee-collector-ledger-link`; deployment version 8 and live-link navigation were verified.

The merged `main` branch must be pushed before switching PCs. Keep the spreadsheet ID in configuration/documentation only and do not commit deployment secrets.

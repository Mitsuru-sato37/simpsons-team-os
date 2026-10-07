# Progress

Status: App-mediated roster import implementation in progress
Last updated: 2026-10-08

## Current handoff — mobile/cloud roster intake

- Active branch: `codex/fee-collector-cloud-roster`, based on `codex/fee-collector-roster-picker` (PR #13 remains open).
- User approved the design and implementation plan, and confirmed the cloud assistant reads the phone image successfully. The agreed implementation flow is assistant-generated jersey/name lines → paste into the phone app → master matching and preview → confirm inside app.
- Implementation plan: `docs/superpowers/plans/2026-10-07-fee-collector-mobile-cloud-roster.md`. User approved the plan. Local implementation now includes copy/paste parsing, master matching, a read-only preview, confirmation guarded by a script lock and fingerprint recheck, explicit emergency registration, attendance absence/restore actions, and mobile review UI.
- Capability check: connected Google Sheets tools successfully read metadata and bounded ranges from `Simpsons会計` and `Simpsons_選手マスター`; target accounting timezone is `Asia/Tokyo` and the operational tab headers are present. This confirms read access only.
- Ruling: The current cloud host has no Apps Script execution connector. Use the existing app's `google.script.run` bridge for preview and apply. Direct Sheets writes and a new external endpoint are excluded because direct writes bypass the app's lock/reconciliation and an anonymous endpoint expands the surface of an anyone-with-URL deployment. This adds a copy/paste step from assistant to app, but keeps the write inside the existing attendance UI and Apps Script lock.
- Confirmed by source inspection: current app already calls Apps Script functions through `google.script.run`; `Code.gs` owns spreadsheet access, `LockService`, emergency-ID counter, and invoice/match reconciliation. Target spreadsheet metadata/header reads succeeded; no live values were changed.
- Emergency participants need stable, server-assigned finance `E###` identities without creating fake player-master records. The app must also safely handle absence/removal and block removal when an active receipt exists.
- Live Simpsons会計 match, participant, and invoice records were cleared at the user's explicit request on 2026-10-07. Finance tabs, headers/formulas, member roster, and player master remain. No current game is registered; no payment was entered. The old ledger stays as backup.
- Verification: `node --test tests/fee-collector-logic.test.mjs` — 70 passed; `git diff --check` passed. Tests use local Apps Script sheet fixtures; no live finance rows or receipts were modified.
- Remaining: complete source review; verify Apps Script syntax/synchronization and update the existing web deployment if the authorized project credentials are available; commit and push, then create/attach a PR if needed. Use the existing app bridge only.

## Active fee-collector work

- Active branch: `codex/fee-collector-roster-picker`, pushed to GitHub; [PR #13](https://github.com/Mitsuru-sato37/simpsons-team-os/pull/13) is open and mergeable. The branch includes the roster picker, accounting name lookup, and emergency participant IDs.
- 2026-10-07 follow-up: User approved the ¥300 default and startup optimization. Existing Apps Script deployment was updated to version 11 at the same deployment ID and URL. Commit `5ccbe22` is pushed on this branch and included in PR #13.
- The live `メンバー請求` name column has the 40 player names in a dropdown and accepts unlisted text. A live edit test resolved `渡部 琉斗` to `M001`, and a separate emergency-name test created an `E` ID in both the invoice and member table. Disposable test rows were cleared afterward; no payment was entered. The accidental name selector on `メンバー` remains removed.
- Source behavior: editing the name in a blank invoice row resolves roster members to their `M` ID. An unregistered emergency name gets a stable `E001`-style ID, is added to `メンバー` without a jersey, and reuses that ID on later invoices with the same name. A locked sequence counter prevents reusing IDs if a row is removed. App-generated rows with an invoice ID are protected from this edit handler.
- Current local verification before the live sync: `node --test tests/*.test.mjs` — 56 passed; `git diff --check` passed. A stale-ID case after clearing a manual invoice name is covered by a regression test.
- The user enabled the Apps Script API. `clasp push --force` synchronized the six intended source files and the existing web deployment was updated to version 10 at the same deployment ID and URL. The existing `handleMemberRosterEdit` trigger was retained; no duplicate trigger was installed. OAuth credentials remain only under ignored `tmp/` and were not committed.
- The live dropdown is now a normal validation rule with invalid input allowed, applied from `メンバー請求!C2:C1000`, so normal names remain selectable while emergency names can be typed. The initial table dropdown's strict validation blocked the API edit; its column type was changed to untyped, then the 40-name dropdown rule was restored with free text allowed.
- A direct `git fetch origin` could not update `.git/FETCH_HEAD` due sandbox restrictions, but the committed branch was pushed successfully and PR #13 was created through the GitHub connection.
- The `Simpsons会計` spreadsheet (`1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`) retains its six original finance tabs and operational tabs. The legacy ledger remains untouched as backup; it contained no populated rows during prior migration inspection. Spreadsheet timezone is `Asia/Tokyo`.

## Verification and handoff

- Live sheet test: entering `渡部 琉斗` in a blank invoice name cell filled `M001`; entering `Codex確認用20261007` filled `E002` and added a temporary member row. Both test entries were cleared after read-back verification. The allocator is monotonic, so `E001` and `E002` are consumed and the next new emergency ID will be `E003`.
- `clasp deployments` confirms the existing web deployment at version 10; the spreadsheet metadata confirms `Asia/Tokyo`. No real payment was entered.
- Next: review and merge PR #13, then check the live web app's game list and receipt flow without entering a payment. Branch `codex/fee-collector-roster-picker`; push any intended docs changes before handoff.

## Read-only operational audit (2026-10-07)

- `node --test tests/*.test.mjs`: 56 passed. Live finance and player-master sheets both have 40 roster rows; all 40 `M` member IDs match master names and jersey numbers, including jersey `00`. No duplicate master IDs, jersey numbers, names, or finance member IDs were found. Accounting timezone is `Asia/Tokyo`.
- The 2026-10-07 audit snapshot predates the 2026-09-26 real game and roster entry described in the latest handoff below.
- `メンバー請求` contains the same `FEE-TEST-DEMO-20261007-P001` invoice ID on two rows with different member IDs; one row does not match the only participant (`P001`). This is a stale/inconsistent demo invoice row; there are no receipt rows or transaction rows, and no payment total is currently affected. It was left untouched pending an explicit cleanup decision.
- Dashboard, transaction, and invoice formula ranges returned no formula errors. The live app remains configured to execute as owner and allow anyone with the URL, as previously approved; it has no sign-in gate.
- No spreadsheet rows were changed during this audit. Before real collection, remove or correct the display-test game and duplicate invoice, register a real game/participant, and set that game's `実徴収額/人`.

## Completed

- 2026-10-07: User approved setting the default per-person charge to ¥300, with match-specific amounts taking precedence, and removing migration/reconciliation work from normal app startup. Applied ¥300 to the 2026-09-26 Mercuries game (11 participants; expected total ¥3,300; no receipts entered). Source changes make bootstrap read-only apart from one-time filling of blank match charges, add an explicit `initializeFeeCollector` maintenance entry point, and reuse each game's charge instead of rereading all accounting games for every participant. Documentation and existing contract assertions were updated. Syntax and whitespace checks passed; tests were not run. Existing Apps Script deployment was updated to version 11 at the same deployment ID and URL. Live verification showed the 2026-09-26 game with 11 people, ¥300 each, ¥3,300 expected, and no received amount. Commit `5ccbe22` was pushed to `codex/fee-collector-roster-picker` and PR #13.

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

Current branch: `codex/fee-collector-roster-picker` (pushed; PR #13 open).

Completed in this handoff: synchronized local fee-collector source to the existing Apps Script project; updated the existing deployment to version 10; retained its ID, URL, access, and installed edit trigger; enabled a free-typing name field with roster dropdown suggestions; and live-tested roster and emergency ID lookup. The temporary test rows were cleared. No payment was recorded. The legacy ledger remains a backup.

Next task: review and merge PR #13. Before production collection, resolve the test-only game and duplicate invoice noted in the audit, then register a real game and fee. Separate photo-library work remains: after the user adds photos to `99_未仕分け`, preview candidates and review before writing confirmed metadata. No photos have been classified or moved.

- 2026-10-06 correction: verified the current `99_未仕分け` folder is a direct child of the active `03_選手写真` folder. Do not use any `00` folder or archive as the photo intake source. Updated the Instagram operating route and project context to preserve that boundary.
- 2026-10-06: User supplied the `99_アーカイブ` folder URL and explicitly prohibited using anything in it as a reference. Read only its metadata (not its contents) to confirm the folder identity. Added its ID to the exclusion list and a runtime allowlist so photo intake can list only the configured inbox; no archive files were opened.
- 2026-10-07: Fast-forward merged `codex/player-photo-library` into `main`; `git fetch origin` completed before merge and `git diff --check` had no whitespace errors. Automated tests were not run for this merge request.
- 2026-10-07: Fee-collector spreadsheet-link implementation landed in the `codex/fee-collector-roster-picker` line; the web deployment is now version 10 and the same ledger URL was confirmed.

The merged `main` branch must be pushed before switching PCs. Keep the spreadsheet ID in configuration/documentation only and do not commit deployment secrets.

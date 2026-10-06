# Progress

Status: fee collector uses the native Google Sheets player master; Instagram production instructions are updated locally for photo-preserving FEATURE PLAYER composition
Last updated: 2026-10-06

## Completed

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

Current branch: `main` (PR #8 and the Pages trigger fix merged on 2026-10-06).

Next task: confirm the official logo image in the Feature Player Drive folder and update the Drive SNS guide if it remains the canonical production guide. The user confirmed the home-screen icon appears on iPhone; icon work is complete. The fee-collector iPhone verification remains a separate outstanding task.

The merged `main` branch must be pushed before switching PCs. Keep the spreadsheet ID in configuration/documentation only and do not commit deployment secrets.

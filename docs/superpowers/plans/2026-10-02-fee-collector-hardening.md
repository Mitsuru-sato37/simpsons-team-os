# Fee Collector Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Simpsons Apps Script fee collector safe and clear for real operation against the confirmed Google Sheet, while preserving its current architecture and payment flow.

**Architecture:** Keep Google Apps Script as the backend and the existing HTML files as the mobile UI. Add a small dependency-free logic file for deterministic game selection and receipt projection, then have `Code.gs` use those rules while keeping all sheet writes behind Apps Script locks. Extend the UI state with cancelled receipts and update repository documentation to the `simpsons-team-os` identity.

**Tech Stack:** Google Apps Script V8, HTML/CSS/vanilla JavaScript, Node.js built-in test runner for pure logic checks, GitHub branch `codex/fee-collector`.

**Spec:** `docs/superpowers/specs/2026-10-02-fee-collector-hardening-design.md`

## Global Constraints

- Use the confirmed spreadsheet ID `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E` in documentation only; never commit credentials or deployment secrets.
- Preserve the sheet tabs `試合`, `参加者`, and `受領履歴` and their existing nine-column layouts.
- Keep payment methods exactly `現金` and `PayPay`, with the default fee exactly `300`.
- Keep cancellation as a status update to `取消`; never delete receipt rows.
- Do not add PayPay API integration, authentication, external backend, or roster-image automation.
- Keep the current branch and Apps Script entry points: `doGet`, `getBootstrap`, `recordPayment`, `cancelReceipt`, and `completeGame`.

## Review Focus

- A manually selected earlier or later game is completed: the next selection must be the first open game after it, with a first-open fallback when none follows; Task 1 tests this.
- A receipt is cancelled: the player must become unpaid while the original receipt remains visible in cancelled history; Tasks 1 and 2 test this.
- Two payment requests arrive for the same player concurrently: only one active receipt may be created; Task 2 preserves and statically checks the lock/recheck path.
- A player has a non-default charge or a partial active receipt: outstanding amount, payment amount, and receipt projection must not exceed the charge; Task 1 tests this.
- The sheet is empty or missing a required tab: bootstrap must return an actionable error or an empty state without dereferencing a missing selected game; Task 2 tests the existing guards and UI fallback.

## File Map

- Create: `fee-collector/Logic.gs` — Apps Script-compatible pure helpers for game selection and receipt grouping.
- Create: `tests/fee-collector-logic.test.mjs` — Node built-in tests for deterministic helper behavior.
- Modify: `fee-collector/Code.gs` — use helpers, expose cancelled receipts, lock completion, and choose the next game.
- Modify: `fee-collector/Index.html` — add a cancelled-history section.
- Modify: `fee-collector/App.html` — render cancelled receipts and keep state synchronized after cancellation.
- Modify: `fee-collector/Styles.html` — style the cancelled-history rows without changing the existing mobile layout.
- Modify: `fee-collector/README.md` — exact spreadsheet setup, headers, state transitions, and cancellation behavior.
- Modify: `README.md` — rename the repository context and document the fee collector entry point.
- Modify: `docs/PROJECT_CONTEXT.md` — record the durable fee collector and spreadsheet decisions.
- Modify: `docs/PROGRESS.md` — record branch, completed work, verification, and remaining scope.

### Task 1: Deterministic fee-collector domain helpers

**Files:**
- Create: `fee-collector/Logic.gs`
- Create: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Produces `pickNextOpenGame_(games, completedGameId)` returning a game object or `null`.
- Produces `projectReceipts_(rows, selectedGameId)` returning `{ active, cancelled, byPlayer }` with receipt objects shaped as `{ id, gameId, playerId, name, receivedAt, amount, method, status, memo }`.

- [ ] **Step 1: Write failing tests**

  Add tests named `selects the first open game after the completed game`, `falls back to the first open game`, `separates cancelled receipts`, and `does not project active amount above the source row amount`. Use the exact statuses `予定`, `完了`, `中止`, `有効`, and `取消`.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run `node --test tests/fee-collector-logic.test.mjs`.

  Expected: FAIL because `fee-collector/Logic.gs` does not yet exist or does not expose the required behavior.

- [ ] **Step 3: Implement the helpers**

  Implement the two helpers as dependency-free functions. Preserve input order for games, skip `完了` and `中止`, and for receipt projection retain both active and cancelled rows while grouping them by player. Export the helpers for Node tests while leaving the functions available in the Apps Script global scope.

- [ ] **Step 4: Run the focused tests and verify success**

  Run `node --test tests/fee-collector-logic.test.mjs`.

  Expected: all focused tests pass with zero failures.

- [ ] **Step 5: Commit**

  Run `git add fee-collector/Logic.gs tests/fee-collector-logic.test.mjs` and commit with `test: add fee collector domain rules`.

### Task 2: Backend state and mutation hardening

**Files:**
- Modify: `fee-collector/Code.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Consumes `pickNextOpenGame_` and `projectReceipts_` from Task 1.
- Produces bootstrap state with `cancelled` receipt entries and participant receipt data limited to active receipts; `completeGame(gameId)` returns state selected by the next-open rule.

- [ ] **Step 1: Extend failing tests for backend-facing source contracts**

  Add source-contract assertions that `Code.gs` calls `projectReceipts_`, uses `LockService.getScriptLock()` in `completeGame`, preserves `recordPayment`'s active-receipt recheck, and returns a `cancelled` collection from bootstrap state.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run `node --test tests/fee-collector-logic.test.mjs`.

  Expected: the new source-contract assertions fail against the current `Code.gs`.

- [ ] **Step 3: Update `Code.gs`**

  Replace the inline receipt filtering with `projectReceipts_`; keep only active receipts in participant payment totals, add cancelled receipts to the returned state, and add a script lock around game completion. Make completion select the next open game after the completed row, falling back to the first open game. Preserve all existing validation messages and the `ALREADY_PAID` response shape.

- [ ] **Step 4: Run focused and static checks**

  Run `node --test tests/fee-collector-logic.test.mjs` and `git diff --check`.

  Expected: all tests pass and `git diff --check` exits successfully.

- [ ] **Step 5: Commit**

  Run `git add fee-collector/Code.gs tests/fee-collector-logic.test.mjs` and commit with `feat: harden fee collector backend state`.

### Task 3: Mobile UI for active and cancelled history

**Files:**
- Modify: `fee-collector/Index.html`
- Modify: `fee-collector/App.html`
- Modify: `fee-collector/Styles.html`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Consumes `state.data.cancelled` and active receipt objects from Task 2.
- Produces visible sections for unpaid players, active received players, and cancelled receipt history; payment and cancellation continue to use the existing Apps Script function names.

- [ ] **Step 1: Add failing UI contract assertions**

  Add source assertions for a `cancelledList` element, a `取消履歴` label, rendering of `state.data.cancelled`, and continued presence of `PayPay確認`, `受領票を表示`, and `取り消す`.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run `node --test tests/fee-collector-logic.test.mjs`.

  Expected: the new UI assertions fail because the cancelled-history section is absent.

- [ ] **Step 3: Implement the UI changes**

  Add a collapsed-by-default cancelled-history section. Render cancelled rows with player, amount, payment method, timestamp, receipt ID, and a clear `取消` status. Keep active receipt buttons and payment buttons unchanged. Ensure a bootstrap response with no selected game disables completion and shows the existing empty-state behavior.

- [ ] **Step 4: Run focused tests and static checks**

  Run `node --test tests/fee-collector-logic.test.mjs` and `git diff --check`.

  Expected: all tests pass and the diff has no whitespace errors.

- [ ] **Step 5: Commit**

  Run `git add fee-collector/Index.html fee-collector/App.html fee-collector/Styles.html tests/fee-collector-logic.test.mjs` and commit with `feat: show fee collector cancellation history`.

### Task 4: Repository documentation and handoff

**Files:**
- Modify: `fee-collector/README.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes the final behavior from Tasks 1–3.
- Produces operator documentation that names `Mitsuru-sato37/simpsons-team-os`, branch `codex/fee-collector`, spreadsheet ID, exact tabs, headers, deployment steps, and remaining out-of-scope work.

- [ ] **Step 1: Write documentation checks**

  Add source assertions to the test file for the repository name, spreadsheet ID, all three required tab names, `取消`, `現金`, `PayPay`, and the `codex/fee-collector` branch.

- [ ] **Step 2: Run checks and verify failure**

  Run `node --test tests/fee-collector-logic.test.mjs`.

  Expected: documentation assertions fail because the current README and progress/context still contain the old repository identity and omit the confirmed spreadsheet details.

- [ ] **Step 3: Update the documents**

  Rewrite only stale or missing sections; preserve the durable mascot/brand context. Record the actual implementation status and validation commands in `docs/PROGRESS.md`. Do not include secrets or deployment URLs.

- [ ] **Step 4: Run the full verification**

  Run `node --test tests/fee-collector-logic.test.mjs`, `git diff --check`, and `rg -n "simpsons-instagram|SPREADSHEET_ID|1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E|取消履歴" README.md docs fee-collector`.

  Expected: all tests pass, the diff check is clean, and any remaining `simpsons-instagram` match is either absent or explicitly historical context in the spec.

- [ ] **Step 5: Commit**

  Run `git add README.md docs fee-collector/README.md` and commit with `docs: update Simpsons team OS handoff`.

## Final Verification

Run `node --test tests/fee-collector-logic.test.mjs`, `git diff --check`, and review `git diff origin/codex/fee-collector...HEAD` for unintended files or secrets. Push the completed branch only after these commands pass.

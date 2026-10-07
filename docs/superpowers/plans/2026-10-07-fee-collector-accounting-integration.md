# Fee Collector Accounting Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the existing fee collector to `Simpsons会計` with safe migration, reversible cancellations, and per-game charges.

**Architecture:** Keep Apps Script and the current UI. Store app-specific games, participants, and receipts in three new operational tabs; project them into the existing invoice, transaction, match-accounting, and dashboard structures. Use deterministic references and lock-protected, idempotent write helpers so migration and payment retries do not duplicate records.

**Tech Stack:** Google Apps Script, Google Sheets, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-07-fee-collector-accounting-integration.md`

## Global Constraints

- Preserve all six existing accounting tabs.
- Never delete or mutate the old ledger during migration.
- Per-game `試合会計` → `実徴収額/人` is authoritative; no fixed 300-yen fallback.
- Preserve player-master integration and lock-protected duplicate receipt prevention.
- Keep existing UI and deployment access settings/URL.
- Set target sheet timezone to `Asia/Tokyo`.

## Review Focus

- Unconfigured, zero, or invalid game charge: reject collection rather than silently charging a fallback; test the configured-charge resolver.
- Partial payment followed by cancellation and replacement: only active receipts count; test projection of mixed active/cancelled rows.
- Retried migration/payment: stable IDs do not duplicate operational, invoice, or transaction rows; test idempotency helpers.
- Legacy P-style IDs and unmatched master entries: preserve ID compatibility and player-master display; test legacy normalization and fallback display.
- A repeated cancellation or missing linked transaction: cancellation is idempotent and reports projection repair behavior without deleting receipt history; test duplicate-cancel projection.

---

### Task 1: Add domain-level accounting and migration helpers

**Files:**
- Modify: `fee-collector/Logic.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Produces `resolveGameCharge_(charge) -> number|null`, `buildFeeInvoiceId_(gameId, playerId) -> string`, and `projectReceiptAccounting_(rows, gameId) -> { active, cancelled, activeTotalByPlayer }`.

- [x] Add failing tests for configured/missing charges, stable invoice keys, active totals, and cancellations.
- [x] Run the targeted test file and confirm the new assertions fail before helper implementation.
- [x] Implement the pure helpers in `Logic.gs`.
- [x] Re-run the targeted test file and confirm all tests pass.

### Task 2: Switch the Apps Script storage and project each receipt

**Files:**
- Modify: `fee-collector/Code.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Consumes Task 1 charge/invoice/projection helpers.
- Produces setup functions for the three operational tabs; game/person charge reads from `試合会計`; receipt, invoice, transaction, and match-accounting projection writers keyed by stable IDs.

- [x] Add tests for target spreadsheet/tab configuration, no fixed-fee fallback, receipt projections, lock retention, and cancellation reversal.
- [x] Confirm new assertions fail before their corresponding implementation.
- [x] Add schema initialization that creates only missing fee-specific tabs and validates headers.
- [x] Switch operational reads/writes to `Simpsons会計` and retain player master lookup.
- [x] On collection, append one receipt, upsert one match/person invoice, create one journal row keyed by receipt ID, and refresh match settlement values.
- [x] On cancellation, retain receipt history, mark the linked journal transaction cancelled, then recompute invoice and match totals from active receipts.
- [x] Re-run the targeted suite and confirm all tests pass.

### Task 3: Add safe, repeatable legacy migration and match selection

**Files:**
- Modify: `fee-collector/Code.gs`
- Modify: `fee-collector/Logic.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Consumes Task 2 setup and projection writers.
- Produces `migrateLegacyFeeData_() -> { games, participants, receipts, skipped }`, de-duplicated by legacy game IDs, game/person composite keys, and receipt IDs.

- [x] Add failing tests for migration mapping and rerun de-duplication.
- [x] Confirm the new assertions fail before helper implementation.
- [x] Implement idempotent migration of all non-empty legacy rows, keeping the source untouched.
- [x] Use `試合会計` per-person charge for current billing; preserve a legacy participant amount if no match-level charge exists.
- [x] Re-run the targeted suite and confirm all tests pass.

### Task 4: Complete UI copy, operational docs, and live-sheet configuration

**Files:**
- Modify: `fee-collector/README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/STATUS.md`
- Sheet: target spreadsheet ID `1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`

- [x] Update README and durable project context with per-match charges, app tabs, master mapping, migration, and cancellation projections.
- [x] Apply timezone change, create the missing operational tabs, sync names/jersey numbers to finance Members, and extend dashboard formulas through row 1000.
- [x] Verify original tabs remain, timezone, headers, formulas, member snapshots, and zero populated legacy rows; the legacy source remains untouched.
- [x] Run `node --test tests/fee-collector-logic.test.mjs` (31 passing) and `git diff --check`.

### Task 5: Commit, push, and open a pull request

**Files:** all intended files from Tasks 1–4.

- [ ] Run the full requested test suite and inspect the final diff.
- [ ] Commit the branch with a focused message.
- [ ] Push `codex/fee-collector-accounting-integration`.
- [ ] Open a PR to the repository's main branch if the branch is not already merged, and attach the resulting PR to this chat.

# Mobile Cloud Roster Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user import a game roster from a phone-provided lineup or scorebook image, confirm player matches, and update Simpsons会計 and the existing mobile fee collector safely.

**Architecture:** The cloud assistant reads the phone-attached image and returns copy-ready jersey/name lines. The existing mobile fee-collection app accepts the pasted list, asks Apps Script to match it against the current master and preview the delta, then confirms through the same Apps Script backend. The backend applies the confirmed delta under a lock and reconciles invoices and match totals; direct Google Sheets connector writes are not used.

**Tech Stack:** Google Apps Script, Google Sheets, existing `google.script.run` app bridge, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-07-fee-collector-mobile-cloud-roster-design.md`

## Global Constraints

- The user confirmed that phone image reading already works in the cloud assistant; do not add image OCR code to the application.
- Do not introduce a paid OCR provider, a new cloud service, unattended Drive polling, or a separate attendance database for the first release.
- Preview is read-only; only explicit confirmation applies the proposed attendance changes.
- Use player name or jersey number for user-facing identity; never require internal IDs from the user.
- Unknown or ambiguous players, unreadable text, duplicate jersey numbers, and conflicting sources must remain unresolved and block the affected write.
- Keep receipt history; do not mark a participant absent while an active receipt exists.
- Use stable game/player keys and idempotent writes; re-read before writing and read back after writing.
- Preserve the existing player master, six accounting tabs, existing app URL/deployment settings, ¥300 default, and the legacy ledger backup.
- Emergency members use server-assigned finance `E###` IDs; never create fake player-master records.
- Do not modify live attendance or finance rows during implementation verification; use disposable fixtures and do not record payments.

## Review Focus

- **The copied OCR text is malformed or incomplete:** Do not create guessed participants; keep invalid rows unresolved and block confirmation; test malformed and blank lines.
- **Player name or jersey is ambiguous:** Show unresolved candidates without guessing; test duplicate normalized names and jersey values.
- **Preview is stale:** Reject confirmation if the roster changed since preview; test version/fingerprint mismatch.
- **Repeated confirmation:** Do not duplicate participants or invoices; test idempotent replay of the same confirmation.
- **A removed attendee has an active receipt:** Refuse the absence change and preserve all receipt and accounting rows; test active-receipt guard.

---

### Task 1: Verify existing app bridge and accounting write boundary

**Files:**
- Inspect: `fee-collector/App.html` (existing `google.script.run` actions)
- Inspect: `fee-collector/Code.gs` (Apps Script lock, player master, and reconciliation boundary)
- Record findings: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: Existing mobile fee-collector UI and Apps Script server functions.
- Produces: Verified in-app flow for pasted roster text → Apps Script preview → explicit confirmation → lock-protected writer. User confirmed phone image reading; app/server source confirms the existing bridge and accounting boundary.

- [x] Image reading in the phone cloud assistant is confirmed by the user; image recognition is outside the app code.
- [x] Verify `google.script.run` is already used by the fee collector and the Apps Script backend already owns the sheet lock, player-master read, invoice projection, and match reconciliation.
- [x] Confirm the target spreadsheets, operational tabs, headers, and timezone using metadata and bounded reads; no live values were edited.
- [x] Record the planned calls as `previewRosterImport({ gameId, rosterText })` and `applyConfirmedRoster({ gameId, previewFingerprint, playerIds, emergencyNames })` via the existing `google.script.run` bridge. These methods will be added in Task 3; do not create an external/public write endpoint or change deployment access.

### Task 2: Add deterministic roster preview and matching domain

**Files:**
- Modify: `fee-collector/Logic.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Produces `parseRosterPaste_(text) -> Candidate[]`, `normalizeRosterIdentity_(value) -> string`, `matchRosterCandidate_(candidate, masterRows) -> MatchResult`, and `buildRosterPreview_(game, extractedRows, masterRows, currentParticipants, receipts) -> Preview`.
- `Preview` contains a stable `gameId`, a source fingerprint, matched additions, proposed absences, unresolved rows with candidate choices, and a `readyToConfirm` flag. It contains no spreadsheet write side effects.

- [ ] Add tests named `parses_copy_ready_roster_lines`, `matches_by_jersey_and_name`, `normalizes_name_spaces`, `leaves_ambiguous_identity_unresolved`, `blocks_duplicate_master_jersey`, `proposes_additions_and_absences`, and `preview_is_read_only`.
- [ ] Run `node --test tests/fee-collector-logic.test.mjs` and confirm the new behavior fails before implementation.
- [ ] Implement safe parsing of pasted rows, name/jersey matching, duplicate detection, stable preview fingerprint, and roster delta calculation in `Logic.gs`; do not match by batting order or position.
- [ ] Validate that unresolved or incomplete game identity sets `readyToConfirm` to false.
- [ ] Re-run the targeted test file and confirm all assertions pass.

### Task 3: Add lock-protected Apps Script roster application

**Files:**
- Modify: `fee-collector/Logic.gs`
- Modify: `fee-collector/Code.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Produces `applyConfirmedRoster_(payload) -> { ok, gameId, added, absent, blocked }`.
- Payload contains `gameId`, `previewFingerprint`, confirmed master `playerIds`, and emergency attendee names; it never treats model-extracted internal IDs as authoritative.
- `previewRosterImport({ gameId, rosterText })` is read-only. The server re-reads game, members, participants, and active receipts under `LockService` during `applyConfirmedRoster`, validates the preview fingerprint, resolves current player master identities, and reconciles affected `メンバー請求` and `試合会計` rows.

- [ ] Add tests named `rejects_unknown_game`, `rejects_stale_roster_fingerprint`, `replays_confirmation_without_duplicates`, `blocks_absence_with_active_receipt`, `keeps_cancelled_receipt_history`, and `assigns_emergency_finance_id_server_side`.
- [ ] Run the targeted fee-collector test and confirm new assertions fail before implementation.
- [ ] Implement the server writer using existing `getGames_`, participant and receipt readers, invoice reconciliation, match reconciliation, and lock patterns; only update the selected game.
- [ ] Preserve absent participants as auditable rows and exclude them from current invoice/match totals; never delete or alter receipt rows.
- [ ] Re-run the targeted test file and confirm all assertions pass.

### Task 4: Add phone attendance adjustments to the existing app

**Files:**
- Modify: `fee-collector/Code.gs`
- Modify: `fee-collector/Index.html`
- Modify: `fee-collector/App.html`
- Modify: `fee-collector/Styles.html`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Adds `markParticipantAbsent({ gameId, playerId })` and a return-to-attendance action that call the same lock-protected server validation and projection updates.
- Existing `addParticipant` remains the late-add path and continues to accept player name/jersey search results; emergency attendees use stored names and server-assigned E IDs.

- [ ] Add contract tests for the attendance action names, active-receipt refusal, emergency name display without a jersey, and accessible touch-sized controls.
- [ ] Run the targeted fee-collector suite and confirm these contracts fail before the UI/server changes.
- [ ] Add an absent status action for unpaid participants and a way to restore attendance; disable or explain the action when an active receipt exists.
- [ ] Keep current collection controls, game selector, and visual structure; add no payment or game-completion behavior to roster import.
- [ ] Re-run the fee-collector suite and confirm all assertions pass.

### Task 5: Document the assistant-to-app handoff and operating instructions

**Files:**
- Create: `fee-collector/roster-import/README.md`
- Create: `fee-collector/roster-import/AGENTS.md`
- Modify: `fee-collector/README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/STATUS.md`
- Modify: `tests/fee-collector-roster-import.test.mjs`

**Interfaces:**
- The cloud assistant route returns one paste-ready line per attendee with jersey number and name, marks uncertain readings, and never calls sheet-write tools.
- The in-app import text area invokes `previewRosterImport`; the confirmation control invokes `applyConfirmedRoster` via the existing `google.script.run` bridge.

- [ ] Add contract tests named `app_has_roster_preview_and_confirm_bridge`, `assistant_route_never_writes_sheets`, and `copy_ready_output_preserves_uncertain_rows` in `tests/fee-collector-logic.test.mjs`.
- [ ] Run `node --test tests/fee-collector-logic.test.mjs` and verify these contracts fail before documentation/UI completion.
- [ ] Document the assistant image-to-copy-list prompt contract and the in-app preview/confirmation steps; never call Google Sheets write tools directly from the assistant route.
- [ ] Document the phone flow, corrections, confirmation, late arrivals, absences, emergency participants, and recovery steps in Japanese.
- [ ] Update handoff documents with implementation results, deployment state, exact verification, and remaining dependencies.
- [ ] Run `node --test tests/fee-collector-logic.test.mjs` and `git diff --check`; review the final diff before commit.

### Task 6: Commit, push, deploy, and verify with a disposable fixture

**Files:**
- All intended files from Tasks 2–5.

- [ ] Confirm no unrelated working-tree changes are included.
- [ ] Commit the implementation on `codex/fee-collector-cloud-roster` and push the branch.
- [ ] Deploy only through the existing Apps Script project/deployment, retaining its URL and access settings; use only the in-app bridge to invoke the lock-protected server writer.
- [ ] Use a disposable fixture to import a sample lineup, verify preview-before-write and app roster totals after read-back, then remove only the fixture data.
- [ ] Verify an active receipt blocks absence and that no payment was recorded.
- [ ] Open a pull request if the branch is not already represented by one; attach the PR to the task.

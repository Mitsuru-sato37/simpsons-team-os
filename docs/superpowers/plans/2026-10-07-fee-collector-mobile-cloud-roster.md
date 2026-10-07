# Mobile Cloud Roster Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user import a game roster from a phone-provided lineup or scorebook image, confirm player matches, and update Simpsons会計 and the existing mobile fee collector safely.

**Architecture:** Keep image interpretation in the cloud-assisted SimpsonsTeamOS workflow and keep attendance/accounting writes behind the existing Apps Script project. A pure roster-import module builds a read-only preview from extracted names/numbers, the player master, and current attendance; after confirmation, an Apps Script operation applies only the confirmed delta under a lock and reconciles invoices and match totals. The existing phone UI remains the day-of collection screen and gains safe attendance adjustments.

**Tech Stack:** Google Apps Script, Google Sheets, Node.js ES modules, `node:test`, existing Codex Google Drive/Sheets connector.

**Spec:** `docs/superpowers/specs/2026-10-07-fee-collector-mobile-cloud-roster-design.md`

## Global Constraints

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

- **Cloud capability is unavailable in a future task:** The workflow must stop before a write when image/Sheets access or the safe writer is missing; test missing provider actions.
- **Player name or jersey is ambiguous:** Show unresolved candidates without guessing; test duplicate normalized names and jersey values.
- **Preview is stale:** Reject confirmation if the roster changed since preview; test version/fingerprint mismatch.
- **Repeated confirmation:** Do not duplicate participants or invoices; test idempotent replay of the same confirmation.
- **A removed attendee has an active receipt:** Refuse the absence change and preserve all receipt and accounting rows; test active-receipt guard.

---

### Task 1: Verify cloud connectors and safe write boundary

**Files:**
- Inspect: `instagram/photo-library/runtime.mjs` and `instagram/photo-library/README.md` (existing connector-injection pattern)
- Inspect: `fee-collector/Code.gs` (Apps Script read/write and reconciliation boundary)
- Record findings: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: Existing Google Drive/Sheets connector and current Apps Script deployment configuration.
- Produces: A verified provider contract for image input, player-master read, Simpsons会計 read, and confirmed attendance write; otherwise a concrete blocker and stop before Tasks 2–4.

- [ ] Confirm a cloud task can receive a phone-attached image and read it without requiring a local path or saving it to Drive.
- [ ] Confirm the available Sheets connector can read the player master and the target accounting ranges.
- [ ] Confirm the existing Apps Script backend can expose a safe confirmed-roster operation to the cloud workflow without broadening deployment access or bypassing its lock/reconciliation logic.
- [ ] If any check fails, update `docs/PROGRESS.md` with the exact unavailable capability and stop implementation for user review; do not add credentials, public write endpoints, or an alternate cloud service.
- [ ] Record the verified callback signatures and deployment boundary before proceeding.

### Task 2: Add deterministic roster preview and matching domain

**Files:**
- Create: `fee-collector/roster-import/roster-import.mjs`
- Create: `fee-collector/roster-import/preview.schema.json`
- Create: `tests/fee-collector-roster-import.test.mjs`

**Interfaces:**
- Produces `normalizeRosterIdentity_(value) -> string`, `matchRosterCandidate_(candidate, masterRows) -> MatchResult`, and `buildRosterPreview({ game, extractedRows, masterRows, currentParticipants }) -> Preview`.
- `Preview` contains a stable `gameId`, a source fingerprint, matched additions, proposed absences, unresolved rows with candidate choices, and a `readyToConfirm` flag. It contains no spreadsheet write side effects.

- [ ] Add tests named `matches_by_jersey_and_name`, `normalizes_name_spaces`, `leaves_ambiguous_identity_unresolved`, `blocks_duplicate_master_jersey`, `proposes_additions_and_absences`, and `preview_is_read_only`.
- [ ] Run `node --test tests/fee-collector-roster-import.test.mjs` and confirm the new behavior fails before implementation.
- [ ] Implement name/jersey matching, duplicate detection, stable preview serialization, and roster delta calculation in `roster-import.mjs`; do not match by batting order or position.
- [ ] Define the schema in `preview.schema.json` and validate that unresolved or incomplete game identity sets `readyToConfirm` to false.
- [ ] Re-run the targeted test file and confirm all assertions pass.

### Task 3: Add lock-protected Apps Script roster application

**Files:**
- Modify: `fee-collector/Logic.gs`
- Modify: `fee-collector/Code.gs`
- Modify: `tests/fee-collector-logic.test.mjs`

**Interfaces:**
- Produces `applyConfirmedRoster_(payload) -> { ok, gameId, added, absent, blocked }`.
- Payload contains `gameId`, `previewFingerprint`, confirmed master `playerIds`, and emergency attendee names; it never treats model-extracted internal IDs as authoritative.
- The server re-reads game, members, participants, and active receipts under `LockService`, validates the preview fingerprint, resolves current player master identities, and reconciles affected `メンバー請求` and `試合会計` rows.

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

### Task 5: Compose the cloud intake route and operational instructions

**Files:**
- Create: `fee-collector/roster-import/runtime.mjs`
- Create: `fee-collector/roster-import/README.md`
- Create: `fee-collector/roster-import/AGENTS.md`
- Modify: `fee-collector/README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/STATUS.md`
- Modify: `tests/fee-collector-roster-import.test.mjs`

**Interfaces:**
- `createRosterImportRuntime({ readImage, readPlayerMaster, readGame, readParticipants, applyConfirmedRoster })` returns `previewRoster(image, gameHint)` and `confirmRoster(preview, corrections)`.
- Connector/provider functions are injected; the runtime contains no credentials and cannot write during preview. `confirmRoster` calls the Task 3 writer only after an explicit user confirmation and a fresh read.

- [ ] Add tests named `preview_does_not_call_writer`, `confirmation_calls_writer_once`, `missing_connector_blocks_before_write`, and `readback_mismatch_reports_partial_result`.
- [ ] Run `node --test tests/fee-collector-roster-import.test.mjs` and verify the workflow tests fail before runtime implementation.
- [ ] Implement preview and confirmation composition using the provider interface verified in Task 1; stop cleanly if the host cannot supply it.
- [ ] Document the phone flow, corrections, confirmation, late arrivals, absences, emergency participants, and recovery steps in Japanese.
- [ ] Update handoff documents with implementation results, deployment state, exact verification, and remaining dependencies.
- [ ] Run `node --test tests/fee-collector-logic.test.mjs tests/fee-collector-roster-import.test.mjs` and `git diff --check`; review the final diff before commit.

### Task 6: Commit, push, deploy, and verify with a disposable fixture

**Files:**
- All intended files from Tasks 2–5.

- [ ] Confirm no unrelated working-tree changes are included.
- [ ] Commit the implementation on `codex/fee-collector-cloud-roster` and push the branch.
- [ ] Deploy only through the existing Apps Script project/deployment, retaining its URL and access settings; do not deploy unless the approved safe writer from Task 1 is available.
- [ ] Use a disposable fixture to import a sample lineup, verify preview-before-write and app roster totals after read-back, then remove only the fixture data.
- [ ] Verify an active receipt blocks absence and that no payment was recorded.
- [ ] Open a pull request if the branch is not already represented by one; attach the PR to the task.

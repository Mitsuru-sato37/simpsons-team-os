# Instagram Production Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable repository instructions and independent data definitions so Codex can produce Simpsons pre-game and post-game Instagram assets using the connected Canva and Google Drive tools.

**Architecture:** Keep the current Google Apps Script fee collector untouched. Add a self-contained `instagram/` module containing the shared match context contract, Codex production instructions, and source-of-truth design IDs. Register the workflows in repository `AGENTS.md` so Codex can route starting-lineup and post-game requests into separate production flows that use Canva/Drive connectors.

**Tech Stack:** Markdown, JSON Schema, Node.js built-in test runner; Codex Canva and Google Drive connected tools at execution time.

**Spec:** `docs/superpowers/specs/2026-10-06-instagram-production-module-design.md`

## Global Constraints

- Treat `sources/` as read-only reference material and do not edit, rename, move, or delete synced project files.
- GAME RESULT must copy Canva Design ID `DAHWk9bIJ3U`; update only team name, side/order layout, score, date, venue, and weekday.
- GAME STATS must copy Canva Design ID `DAHWxMb6kxg`; update only the values for runs, hits, walks/HBP, stolen bases, extra-base hits, RBIs, opponent, date, and venue.
- Preserve the six GAME STATS labels, six frames, mascot, title, subtitle, logos, background, decorations, and palette.
- STARTING LINEUP keeps the current production method and must not be converted into a new master.
- FEATURE PLAYER uses the Drive reference design and examples; the photo is primary and the user-provided ghost Simpsons logo is the only permitted logo.
- Do not infer facts from unreadable sources. Stop and ask about missing required information or unavailable references/designs.
- Do not use new AI image generation as a fallback; do not add Instagram auto-posting, authentication, scheduling, or paid services.
- Canva edits are saved only after showing the preview and receiving the user's explicit approval.
- Do not add a runtime dependency or alter `fee-collector/` behavior.

## Review Focus

- Missing `matchId`, date, opponent, or venue: reject the context before invoking Canva or Drive; Task 1 pins this with schema and validator tests.
- Missing home/away order or scorebook-confirmed post-game figures: stop the affected post-game item and list only the unknown facts; Task 2 tests these gates.
- The required Canva master is unavailable or copy fails: stop without generating an alternative; Task 2 tests the stop rule and fixed IDs.
- A proposed GAME STATS edit changes a metric label or fixed design element: reject it; Task 2 tests the allowlist and fixed elements.
- Preview has not been explicitly approved: do not commit Canva editing transaction; Task 2 tests the required approval sequence.

---

## File Map

- Create: `instagram/match-context.schema.json` — shared match data contract and required/optional fields.
- Create: `instagram/README.md` — entry points, data contract usage, and module map.
- Create: `instagram/AGENTS.md` — Codex-operable Canva/Drive workflow, guardrails, and output contract.
- Create: `instagram/designs.json` — verified Canva IDs, source labels, editable fields, fixed elements, and Drive reference folder/file IDs.
- Modify: `AGENTS.md` — route Instagram requests into the appropriate independent workflow.
- Create: `tests/instagram-production.test.mjs` — schema and instruction source-contract tests using Node built-ins.
- Modify: `README.md` — document how to invoke the new Codex workflows.
- Modify: `docs/PROJECT_CONTEXT.md` — record durable Instagram workflow and design decisions.
- Modify: `docs/PROGRESS.md` — record implementation state and verification evidence.

### Task 1: Shared match context contract

**Files:**
- Create: `instagram/match-context.schema.json`
- Create: `instagram/README.md`
- Create: `tests/instagram-production.test.mjs`

**Interfaces:**
- Produces a JSON Schema for `MatchContext` with required `matchId`, `date`, `opponent`, and `venue`; optional pre/post-game values include home/away batting order, Simpsons/opponent score, and the six fixed Simpsons statistics.
- Documents two independent workflow names: `starting-lineup` and `post-game`; downstream workflow files do not receive fee-collector state.

- [ ] **Step 1: Write failing contract tests**

  Add tests asserting the schema requires the four shared fields, exposes the six statistics under stable names, and the README names both independent workflows and their input contract.

- [ ] **Step 2: Run tests and verify the expected failure**

  Run `node --test tests/instagram-production.test.mjs` from `repo/`.

  Expected: FAIL because the Instagram schema and README do not exist.

- [ ] **Step 3: Add the schema and module README**

  Use JSON Schema draft 2020-12. Define the six statistic keys as `runs`, `hits`, `walksHbp`, `stolenBases`, `extraBaseHits`, and `rbis`. Keep uncertain per-flow facts optional at the shared-context level; the relevant workflow will require them before production.

- [ ] **Step 4: Run the focused tests**

  Run `node --test tests/instagram-production.test.mjs`.

  Expected: all Task 1 assertions pass.

### Task 2: Codex Canva and Drive production workflow

**Files:**
- Create: `instagram/AGENTS.md`
- Create: `instagram/designs.json`
- Modify: `tests/instagram-production.test.mjs`

**Interfaces:**
- Consumes the `MatchContext` contract from Task 1.
- Produces exact source IDs, allowlists, fixed elements, reference folder IDs, and procedural rules Codex follows when using Canva/Drive connectors.
- Starting lineup and each post-game asset can be requested independently.

- [ ] **Step 1: Add failing workflow contract tests**

  Assert that workflow instructions contain the two independent entry names, prohibit fee-collector dependencies and AI-image fallback, require source verification and Canva duplication, require preview plus explicit approval before commit, and define stop behavior for unknown facts or failed master access. Assert the design registry contains both verified Canva IDs and all six fixed metric names.

- [ ] **Step 2: Run tests and verify the expected failure**

  Run `node --test tests/instagram-production.test.mjs`.

  Expected: the workflow and design registry assertions fail because these files do not exist.

- [ ] **Step 3: Add the design registry**

  Record GAME RESULT `DAHWk9bIJ3U`, title `A案（レイヤー分け済）`, and GAME STATS `DAHWxMb6kxg`, title `GAME STATSレイヤーA案`. Record Drive folders `1o1RolFm9_WR2JQMbVu-PflgekJtANZ_7` (GAME RESULT), `1yInos9_FzalUWIRrkCyMsyZ6YmuV-oll` (GAME STATS), `1Om6-gseDi3Utonzzm8P0fKQe4czSW0Qc` (FEATURE PLAYER), and `1JvY9-2BwyxMWuch5KGlumDpyak1AvmDu` (STARTING LINEUP). Record verified Drive references: GAME RESULT SAMPLE file `1gtgWq39tAxcbLo7BxzT5JKirB8VwzHpR` and 空MASTER file `1r3h7SDA_b1v8AtK3b45HY_yidvTxgVSe`; GAME STATS SAMPLE file `1QX_fHNN5PEXIvA-acXS7Jz7GivHLHoJZ` (its 空MASTER folder currently has no file); FEATURE PLAYER 基準デザイン file `1coH8OyXgS44gUrH5lskFbl8eQfblOqFk` and example files `1prfwWlb45EZIXOsmSZSWgnqYjpJ_4mbz`, `1Yih7Sch1q2MKhLZSKMq_LS8Zqj8mHYuC`, and `1GsK2c5o7zd9qQdii2ODEP4SUJCm9QdNc`. The checked STARTING LINEUP Drive folders currently contain no files and Canva search found no design, so retain the documented existing production method and require confirmation if its existing source/method cannot be identified at run time; never create a new master.

- [ ] **Step 4: Write Codex workflow instructions**

  Define the pre-game flow to validate shared context and continue the established STARTING LINEUP method. Define the post-game flow to establish scorebook facts first and then independently create GAME RESULT, GAME STATS, and FEATURE PLAYER. For the two fixed masters, use Canva search/read, copy the exact source design, edit the copy's allowed elements, inspect a preview, obtain explicit user approval, then commit. Save requested finished images to the matching Drive destination and report file names and links. Stop on unclear source data, missing master, failed copy, unexpected design structure, disallowed edit, or layout breakage. Include no generation fallback.

- [ ] **Step 5: Run focused tests and review the instructions**

  Run `node --test tests/instagram-production.test.mjs` and check that instruction paths do not add credential or fee-collector dependencies.

  Expected: all focused tests pass and the workflow specifies the actual connected-tool sequence.

### Task 3: Repository routing and documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/PROGRESS.md`
- Modify: `tests/instagram-production.test.mjs`

**Interfaces:**
- Consumes the workflow in `instagram/AGENTS.md` and registry in `instagram/designs.json`.
- Produces discoverable Codex routing for user phrases about starting lineup and post-game Instagram production.

- [ ] **Step 1: Add failing repository-routing tests**

  Assert root `AGENTS.md` routes pre-game and post-game requests into their separate instructions, `README.md` explains how to invoke each, and project context/progress record fixed master and independence decisions.

- [ ] **Step 2: Run tests and verify the expected failure**

  Run `node --test tests/instagram-production.test.mjs`.

  Expected: the repository-routing assertions fail before documentation changes.

- [ ] **Step 3: Add routing and update docs**

  Add concise trigger examples to root `AGENTS.md`, linking the corresponding workflow file. Record the feature in root README and durable policy in project context. Update progress with completed files and verification commands; preserve existing fee-collector status and handoff information.

- [ ] **Step 4: Run all repository checks**

  Run `node --test tests/instagram-production.test.mjs`, `node --test tests/fee-collector-logic.test.mjs`, and `git diff --check`.

  Expected: all tests pass and Git reports no whitespace errors. Review the final diff to confirm no `sources/` or `fee-collector/` files changed.

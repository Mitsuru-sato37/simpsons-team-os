# Project context

Status: Simpsons運営OSの開発中
Last updated: 2026-10-05

## Team

- Name: Simpsons
- Primary colors: purple and yellow
- Baseball team branding should remain identifiable in visual/content work.

## Mascot: ラキポタ

- Name: ラキポタ
- Number: 2023
- Character concept: ghost
- Often disguises itself in potage soup, primarily corn potage.
- Color can change depending on the use case, including yellow-based, purple-based, or mixed treatments.
- Character detail: two small fallen feathers drifting from the tail are used as an accent. They are not full wings.

## Existing visual direction

For profile/icon concepts, a strong direction is ラキポタ peeking out of a mug patterned after the Simpsons baseball uniform.

Known preferences:

- Simpsons logo on the outside of the cup.
- Include an explicit baseball element such as a ball or bat.
- Use the team's uniform language on the mug.
- Corn-potage color for the soup.
- Make effective use of the circular crop used by profile icons.
- Avoid designs that are overly similar to third-party characters or existing copyrighted visual identities.

## Fee collector

The repository's first operational feature is the Google Apps Script fee collector in `fee-collector/`.

- Source repository: `Mitsuru-sato37/simpsons-team-os`
- Active branch: `codex/fee-collector`
- Spreadsheet: `Simpsons_集金台帳_試作版`
- Spreadsheet ID: `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`
- Required tabs: `試合`, `参加者`, `受領履歴`
- Payment methods: `現金` and `PayPay`; default fee is 300 yen.
- Each unpaid player is presented with `現金300円` and `PayPay確認`; the receipt records the actual accepted amount, method, server timestamp, and receipt ID.
- Receipts are append-only records. Cancellation changes the status to `取消` and never deletes the row.
- Completing a game selects the next open game in sheet order; manual selection remains available for past and future games.
- Completed and cancelled games remain selectable for review, but cannot be marked complete again from either the UI or the server action.
- PayPay is manually confirmed from the PayPay transfer history; there is no API integration.

The current feature does not include roster-image recognition, automatic participant registration, authentication, or public deployment.

## Instagram production module

- Instagram image production is available as a Codex workflow in `instagram/` and is independent of the fee-collection app (集金機能とは独立) in `fee-collector/`.
- Shared match context (`matchId`, date, opponent, venue, and optional confirmed game facts) is defined in `instagram/match-context.schema.json`.
- GAME RESULT uses Canva Design ID `DAHWk9bIJ3U` (`A案（レイヤー分け済）`) by copying it and editing only its allowed fields.
- GAME STATS uses Canva Design ID `DAHWxMb6kxg` by copying it and updating only the six approved Simpsons stat values, opponent, date, and venue.
- STARTING LINEUP keeps the current production method and must not be converted into a new master. If the current source/method is not available, ask and stop.
- FEATURE PLAYER uses the Drive reference design and examples. A reference image may be converted to an editable per-match output; it is not registered as a master.
- Never guess unclear source facts or use new AI image generation as a fallback. Show a Canva preview and get explicit approval before committing edits. Instagram posting remains manual.
- Current checked Drive reference IDs, Canva operation sequence, output rules, and Codex routes are recorded in `instagram/designs.json` and `instagram/AGENTS.md`.

## Scope boundary

Do not assume that this repository must become an Instagram auto-posting tool, a social media analytics service, a full team-management application, an image-generation pipeline, or a public website. Implement only the next explicitly assigned task and update this context when durable decisions are made.

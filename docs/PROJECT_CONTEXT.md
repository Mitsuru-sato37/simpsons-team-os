# Project context

Status: Simpsons運営OSの開発中
Last updated: 2026-10-06

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
- Active branch: `codex/player-master-integration`
- Spreadsheet: `Simpsons_集金台帳_試作版`
- Spreadsheet ID: `1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`
- Required tabs: `試合`, `参加者`, `受領履歴`
- Player master: `Simpsons_選手マスター` (native Google Spreadsheet)
- Player master spreadsheet ID: `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4`
- Player master sheet: `選手マスター`; source columns are `選手ID`, `背番号`, and `氏名`.
- Participant rows may retain legacy `P001`-style IDs; the app normalizes them against the master ID and displays the master `背番号` and `氏名`.
- Payment channels are cash, PayPay, and bank transfer; the default fee is 300 yen.
- Each unpaid player is presented with a cash button for the full outstanding balance (for example, `現金500円`), `PayPay確認`, and `銀行振込確認`; PayPay and bank-transfer confirmations remain capped at the default 300 yen per action. The receipt records the accepted amount, method, server timestamp, and receipt ID.
- For each game, attendance is currently registered as rows in `参加者` using `試合ID` and `選手ID`; the player name is resolved from the master for display. The web app does not yet provide a roster picker or attendee-registration UI.
- Receipts are append-only records. Cancellation changes the status to `取消` and never deletes the row.
- Completing a game selects the next open game in sheet order; manual selection remains available for past and future games.
- Completed and cancelled games remain selectable for review, but cannot be marked complete again from either the UI or the server action.
- PayPay is manually confirmed from the PayPay transfer history; there is no API integration.

The current feature does not include roster-image recognition, automatic participant registration, or user authentication. The Apps Script deployment is intentionally accessible to anyone who has its URL and executes as the owner; it is not discoverable by public directory listing.

- The fee collector uses the user-approved 180×180 Simpsons home-screen icon at `fee-collector/apple-touch-icon.png`. Its Apple touch icon reference is in `fee-collector/Index.html`; the PNG is also stored in Drive as a link-readable image so Safari can fetch it. The Apps Script web app executes as the owner and is accessible to anyone with its URL.
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

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
- Active branch: `codex/fee-collector-accounting-integration` (integration work in progress)
- Primary accounting spreadsheet: `Simpsons会計`
- Primary spreadsheet ID: `1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`
- Existing accounting tabs retained: `ダッシュボード`, `取引台帳`, `試合会計`, `メンバー請求`, `会費管理`, `メンバー`
- Fee collector operational tabs: `集金_試合`, `集金_参加者`, `集金_受領履歴`
- Legacy backup spreadsheet: `Simpsons_集金台帳_試作版` (`1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`); migration reads from it and leaves it intact.
- Accounting spreadsheet timezone: `Asia/Tokyo`
- Player master: `Simpsons_選手マスター` (native Google Spreadsheet)
- Player master spreadsheet ID: `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4`
- Player master sheet: `選手マスター`; source columns are `選手ID`, `背番号`, and `氏名`.
- Participant rows may retain legacy `P001`-style IDs; the app normalizes them against the master ID and displays the master `背番号` and `氏名`.
- Payment channels are cash, PayPay, and bank transfer. The app reads the per-game charge from `試合会計` column J (`実徴収額/人`) and blocks collection when it is unset; there is no fixed 300-yen app default.
- For each game, attendance is registered in `集金_参加者` using `試合ID` and `選手ID`; the app continues resolving names and jersey numbers from the player master. The web app does not yet provide a roster picker or attendee-registration UI.
- A successful receipt updates `メンバー請求`, `取引台帳`, and `試合会計`; dashboard formulas aggregate those records. Cancellation keeps the receipt and marks linked accounting entries cancelled.
- Finance `メンバーID` values are internal keys. The app maps roster IDs `001`–`050` to `M001`–`M050`, while synchronizing player-master names and jersey numbers into the finance member directory. People are identified operationally by name/jersey number, not by finance IDs.
- In `メンバー`, manually entering one of the member ID, name, or jersey-number fields completes the other two from the player master. This uses an installable edit trigger because the master is in a separate spreadsheet; the Apps Script owner authorizes and installs the trigger once. Ambiguous or missing matches are not guessed. Jersey numbers are stored as text to preserve values such as `00`.
- Receipts are append-only records. Cancellation changes the status to `取消` and never deletes the row.
- Completing a game selects the next open game in sheet order; manual selection remains available for past and future games.
- Completed and cancelled games remain selectable for review, but cannot be marked complete again from either the UI or the server action.
- PayPay is manually confirmed from the PayPay transfer history; there is no API integration.

The current feature does not include roster-image recognition, automatic participant registration, or user authentication. The Apps Script deployment is intentionally accessible to anyone who has its URL and executes as the owner; it is not discoverable by public directory listing.

- The fee collector uses the user-approved 180×180 Simpsons home-screen icon at `fee-collector/apple-touch-icon.png`. The Apps Script web app executes as the owner and is accessible to anyone with its URL. Since Apps Script HTML Service runs inside nested iframes, iPhone Home Screen installation uses the public GitHub Pages entry at `https://mitsuru-sato37.github.io/simpsons-team-os/`, which declares the icon in the top-level document and embeds the unchanged Apps Script app. The original app's `Index.html` also retains its inner-frame icon reference.
- The fee collector provides a `台帳を開く` link to the spreadsheet currently connected to the Apps Script project; the URL comes from the active spreadsheet configuration rather than a hard-coded screen URL.
## Instagram production module

- Instagram image production is available as a Codex workflow in `instagram/` and is independent of the fee-collection app (集金機能とは独立) in `fee-collector/`.
- Shared match context (`matchId`, date, opponent, venue, and optional confirmed game facts) is defined in `instagram/match-context.schema.json`.
- GAME RESULT uses Canva Design ID `DAHWk9bIJ3U` (`A案（レイヤー分け済）`) by copying it and editing only its allowed fields.
- GAME STATS uses Canva Design ID `DAHWxMb6kxg` by copying it and updating only the six approved Simpsons stat values, opponent, date, and venue.
- STARTING LINEUP keeps the current production method and must not be converted into a new master. If the current source/method is not available, ask and stop.
- FEATURE PLAYER layouts may vary per game, using the Drive reference design and examples as visual direction rather than fixed templates. Preserve the selected player's source photo unchanged, add the official logo as a small separate Canva image layer from the Feature Player Drive folder, and keep critical text editable where practical.
- Generated visuals may be used only as separate backgrounds without people, logos, or text; never regenerate the player's photo or official logo. Show a Canva preview and get explicit approval before committing edits. Instagram posting remains manual.
- For Instagram captions, use an available prior post as the style reference. The latest user-confirmed format is account name, date/opponent, brief game narrative and score, FEATURE PLAYER jersey number, then the established hashtags. Provide three suitable music options and mark one first choice.
- Current checked Drive reference IDs, Canva operation sequence, output rules, and Codex routes are recorded in `instagram/designs.json` and `instagram/AGENTS.md`.

## Player photo library

- The independent `photo-library` route lives in `instagram/photo-library/`; it does not connect to `fee-collector/`.
- Existing Drive photos live under the current `Simpsons/03_選手写真` folder (`1aKYXMNMrN5ZZy-VM7tglFHXSyrZCt_JN`), with the direct-child `99_未仕分け` folder (`1rXzSh9w7eO7oqyh1oqMbJgUdSj81iRqA`), player-specific folders, and `01_試合写真` (`1CE_FNt0gtgCZ3UksaSD2iBE2jf2uWblY`). The inbox's parent was verified as `03_選手写真` on 2026-10-06. Preserve this structure and original files. The user explicitly excluded `99_アーカイブ` (`184xMcL_Gdk8UyZaIz1ufpEbA4FYMwv8B`); do not list, search, fetch, preview, or import anything from it. Do not treat any `00` folder or archive as a source of truth.
- The current `03_選手写真/99_未仕分け` is empty. It is the intake location for future photos; when the user requests sorting and it is still empty, report zero items and stop without importing existing player-folder or archive assets. If the active Drive location changes, verify it from the current photo folder before processing. The Drive photo source runtime allows listing only the configured inbox and rejects excluded folder IDs.
- The canonical catalog is the Drive JSON file `Simpsons_写真資産カタログ.json`, ID `11QeVpv1yhrrx8wSGjNVnsxPoF8hJ2gib`, in `03_選手写真`. It was initialized with version 1 and an empty asset list. Its ID is recorded in `instagram/photo-library/drive-sources.json`.
- Photo identity references the existing player master ID; match association references `MatchContext.matchId`. Unknown match association stays null. Candidate and unknown photos require user review; only confirmed photos are returned for FEATURE PLAYER use.
- Strong evidence for confirmation is a readable jersey number/name, trusted metadata, or explicit user confirmation. Position, equipment, catcher gear, sequence, neighboring images, and apparent scene continuity can only narrow candidates. No face recognition or automatic identity verification is used.
- Photos remain in place. The catalog stores Drive file IDs, locations, classification, candidates/reasons, tags, and history. A dry-run preview precedes catalog writes. The Codex workflow maps the Drive list/fetch/update and player-master range connectors into the service provider; read-back verifies catalog replacement. Cloud use depends on those same connectors being available and authorized in the cloud task.

## Local video analysis MVP

- User-requested Phase 1 scope: find inning-change candidates in large local GoPro MP4s, show heuristic scores, and capture correct/incorrect feedback with a corrected time and reason. Never upload the original video or overwrite it.
- Keep this module independent of `fee-collector/` and Instagram workflows. The repository currently has no shared Team OS chat UI; the MVP uses a Windows local desktop interface. Chat invocation and video splitting are later phases.
- Analysis is coarse-to-fine: 10-second samples across the video, then 1-second samples around candidates. Current colors derive from the user's existing HSV experiment. Do not treat scores as calibrated probabilities or fabricate exact inning labels.
- Store per-analysis local JSON with video identity, time, settings, logic version, candidate evidence, and feedback. Do not commit videos or local result files.

## Scope boundary

Do not assume that this repository must become an Instagram auto-posting tool, a social media analytics service, a full team-management application, an image-generation pipeline, or a public website. Implement only the next explicitly assigned task and update this context when durable decisions are made.

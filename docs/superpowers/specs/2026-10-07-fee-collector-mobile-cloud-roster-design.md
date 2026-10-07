# Mobile Cloud Roster Import for Fee Collector

**Status:** Draft for user review. No implementation is authorized until this design is approved.

## Goal

Let Mitsuru operate the Simpsons game-attendance and fee-collection workflow from a phone without moving lineup or scorebook photos to a local PC. The submitted image is processed in the SimpsonsTeamOS cloud task, participant names are matched to the existing player master, and confirmed attendance is written to the existing `Simpsons会計` spreadsheet. The existing mobile fee-collection web app remains the game-day collection screen.

## User-approved direction

- Most attendees can be identified from a starting lineup or scorebook; only last-minute additions and absences should usually need manual attention.
- The user works from a phone as well as a PC, so the workflow must not depend on local file paths or a particular computer.
- People are identified by name or jersey number. Internal player/member IDs are resolved by the system and are not required as user input.
- The AI may prepare an attendance proposal, but uncertain matches must be shown for correction rather than guessed.
- `Simpsons会計` and the existing player master remain the cloud sources of truth.

## Approaches considered

1. **Codex cloud-assisted intake (recommended):** Attach the image to the SimpsonsTeamOS cloud task from a phone. The task reads the image, prepares a preview, and uses the already-connected Sheets tools after confirmation. This matches the user's mobile request pattern and avoids a new OCR service; it depends on the cloud task having the required image and Sheets access.
2. **Photo-upload screen in the fee-collection web app:** Keeps intake and collection in one mobile site, but requires a new upload/review UI and a secure, consistent path from Apps Script to image recognition. It adds more infrastructure and access design than the user has requested.
3. **Manual-only entry in the current app:** Lowest implementation effort, but requires entering the baseline roster one person at a time and does not fulfill image-based import.

The first approach is the smallest cloud-native first release. A dedicated team-facing upload screen can be considered later if other team members need to import rosters without using a Codex task.

## Recommended workflow

1. From the SimpsonsTeamOS cloud task on a phone, the user attaches a starting-lineup or scorebook image and identifies the game by date/opponent when that information is not already clear.
2. The cloud workflow reads the image and the current player master. It matches printed jersey numbers and names to the master, normalizing spaces in names. It does not infer an identity from position, batting order, or visual context alone.
3. The workflow prepares a preview showing the target game, recognized attendees, master matches, additions/removals compared with the existing attendance list, and any ambiguous or unmatched names.
4. The user corrects unclear rows and confirms the proposed attendance. No spreadsheet changes happen before confirmation.
5. After confirmation, the workflow writes the confirmed game/attendance data to `Simpsons会計`. It uses stable game/player keys so repeating the same import does not create duplicate participants or invoices. The fee collector reflects the result after refresh.
6. On game day, the user opens the existing fee-collection app on a phone. They can add a late attendee by name or jersey number and mark an absent participant out before collection. A name absent from the player master can be entered as an emergency member; the Apps Script server assigns and stores its internal finance ID under its existing lock/counter pattern. The user never types IDs.

The normal per-person charge remains the existing ¥300 default, with the current per-game amount taking precedence when set.

## Integration and data rules

- Implement this as a SimpsonsTeamOS cloud workflow that uses the host's already-connected Google Sheets/Drive tools to read the master and update the spreadsheet. Keep credentials and connector calls outside the domain logic, following the repository's existing provider-injection pattern.
- Do not introduce a paid OCR provider, a new cloud service, unattended Drive polling, or a separate attendance database for the first release.
- Do not make lineup-image storage a new requirement. Use the user-attached image as task input; persist only the confirmed attendance data unless the user separately asks to save the image.
- Match an existing game by a stable game ID. If no game can be uniquely matched, or required game facts are missing, stop and ask rather than creating a guessed match.
- Keep participant registration, member-invoice projection, and match totals consistent. Preserve receipt history. If a participant already has an active receipt, block removal until the existing cancellation/correction process is completed; never erase payment history to make attendance fit.
- Unknown or ambiguous players, unreadable text, duplicate jersey numbers, and conflicting sources must remain unresolved in the preview and block the affected write until the user resolves them.
- Re-read the target rows immediately before writing. If the sheet changed since preview, show the updated difference and request confirmation again. Verify the write by reading back the target rows.
- If cloud access to the required Google Sheets connector is missing or unauthorized, stop before writing and report the blocker. Do not silently fall back to a local PC or local copy.

## Mobile adjustment behavior

- Registered master members can be added by searching a name or jersey number and selecting the matching result.
- A participant can be marked absent before collection; the row remains auditable and is excluded from the bill. This is preferable to physically deleting a participant row.
- An emergency attendee can be entered by name, reviewed, and assigned the next persistent `E###` finance member ID automatically. No jersey number is required.
- The existing app resolves participant IDs through the player master. Implementation must explicitly support an emergency finance member ID as a participant/receipt key and display its stored name with no jersey number; it must not invent a player-master ID.
- A participant with an active receipt cannot be marked absent until that receipt has been cancelled through the existing flow.

## Error handling and safety

- Preview is read-only. Confirmation applies only to the exact game and attendance changes displayed in that preview.
- A write is idempotent by game/player identity. If a write partially fails or the read-back differs, stop, report which rows changed, reload the current state, and do not blindly retry.
- Do not mark an unknown name as a roster member without the user's explicit choice. Do not overwrite unrelated games, member-master rows, dues, or financial records.
- No real payment, payment cancellation, or game-completion operation is part of roster import.

## Verification

- Unit coverage: name/jersey matching, ambiguity handling, stable keys, duplicate imports, additions/removals, emergency attendees, and active-receipt removal protection.
- Workflow coverage: preview causes no writes; confirmation writes only the selected game's rows; missing cloud connector blocks before writes; read-back matches the confirmed preview.
- Mobile smoke check: attach a sample image from a phone-compatible cloud task, review a preview, then use a disposable fixture to verify the fee app reflects the confirmed roster. Do not record a payment.

## Open question before implementation

Verify that the target SimpsonsTeamOS cloud task can receive a phone-attached image and use the Google Sheets connector with access to both the player master and `Simpsons会計`. Also verify a safe, consistent write path for creating/updating attendance and invoice projections; emergency `E###` allocation must remain authoritative in Apps Script under `LockService` and `ScriptProperties`. If the cloud host cannot provide the image/Sheets capabilities, or cannot preserve those write guarantees, stop and present the concrete limitation before selecting a different hosting or authentication design.

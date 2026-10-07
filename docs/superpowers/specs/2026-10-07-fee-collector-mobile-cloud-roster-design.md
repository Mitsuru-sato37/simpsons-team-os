# Mobile Cloud Roster Import for Fee Collector

**Status:** User-approved direction; app-mediated paste/preview/write flow refined 2026-10-07.

## Goal

Let Mitsuru operate the Simpsons game-attendance and fee-collection workflow from a phone without moving lineup or scorebook photos to a local PC. The cloud assistant reads the submitted image and returns a copy-ready roster of names and jersey numbers. The user pastes it into the existing mobile fee-collection app, which matches players against the master, previews the changes, and writes only after confirmation through the existing Apps Script backend.

## User-approved direction

- Most attendees can be identified from a starting lineup or scorebook; a supplied lineup sheet represents all attendees, including listed backups. Only last-minute additions and absences should usually need manual attention.
- The user works from a phone as well as a PC, so the workflow must not depend on local file paths or a particular computer.
- People are identified by name or jersey number. Internal player/member IDs are resolved by the system and are not required as user input.
- The user has tested image reading successfully. The AI prepares copy-ready jersey/name lines; uncertain readings stay marked for correction rather than guessed.
- `Simpsons会計` and the existing player master remain the cloud sources of truth.

## Approaches considered

1. **Cloud assistant plus in-app confirmation (recommended):** Attach the image to the SimpsonsTeamOS cloud task from a phone. The assistant returns a copy-ready text list. Paste it into the existing fee-collection app, where Apps Script reads the master, prepares the preview, and safely applies confirmed changes. The user has already tested image reading successfully. This avoids a new OCR service and avoids direct connector writes that bypass Apps Script locks and reconciliation.
2. **Photo-upload screen in the fee-collection web app:** Keeps intake and collection in one mobile site, but requires a new upload/review UI and a secure, consistent path from Apps Script to image recognition. It adds more infrastructure and access design than the user has requested.
3. **Manual-only entry in the current app:** Lowest implementation effort, but requires entering the baseline roster one person at a time and does not fulfill image-based import.

The first approach is the smallest cloud-native first release. Image reading remains in the cloud assistant; the fee collector owns identity matching, preview, and writes. A dedicated upload screen can be considered later if other team members need to import rosters without using a Codex task.

## Recommended workflow

1. From the SimpsonsTeamOS cloud task on a phone, the user attaches a starting-lineup or scorebook image and identifies the game by date/opponent when that information is not already clear. A lineup sheet is treated as the complete attendee list when the user says so; listed backups count as attendees.
2. The assistant returns one copy-ready entry per person with visible jersey number and name. It marks unreadable or uncertain values as uncertain and never invents an identity from position or batting order.
3. The assistant returns copy-ready jersey/name lines. The user pastes them into the fee collector. Apps Script matches jersey/name against the current player master, normalizing spaces, and prepares an in-app preview showing the game, additions, proposed absences, and ambiguous/unmatched rows.
4. The user corrects unclear rows and confirms the proposed attendance in the app. No spreadsheet changes happen before confirmation.
5. Apps Script re-reads the game, roster, and receipts under its lock, rejects stale previews, and writes the confirmed delta. Stable game/player keys make repeated imports idempotent; invoices and match accounting are reconciled through existing server functions.
6. On game day, the user opens the existing fee-collection app on a phone. They can add a late attendee by name or jersey number and mark an absent participant out before collection. A name absent from the player master can be entered as an emergency member; the Apps Script server assigns and stores its internal finance ID under its existing lock/counter pattern. The user never types IDs.

The normal per-person charge remains the existing ¥300 default, with the current per-game amount taking precedence when set.

## Integration and data rules

- Keep image reading in the cloud assistant and matching/preview/writes in the fee-collector app. Do not use direct Google Sheets connector writes for attendance; they bypass Apps Script locks and reconciliation.
- Do not introduce a paid OCR provider, a new cloud service, unattended Drive polling, or a separate attendance database for the first release.
- Do not make lineup-image storage a new requirement. Use the user-attached image as task input; persist only the confirmed attendance data unless the user separately asks to save the image.
- Match an existing game by a stable game ID. If no game can be uniquely matched, or required game facts are missing, stop and ask rather than creating a guessed match.
- Keep participant registration, member-invoice projection, and match totals consistent. Preserve receipt history. If a participant already has an active receipt, block removal until the existing cancellation/correction process is completed; never erase payment history to make attendance fit.
- Unknown or ambiguous players, unreadable text, duplicate jersey numbers, and conflicting sources must remain unresolved in the preview and block the affected write until the user resolves them.
- Re-read the target rows immediately before writing. If the sheet changed since preview, show the updated difference and request confirmation again. Verify the write by reading back the target rows.
- If the existing app cannot call a lock-protected server operation for confirmed roster changes, stop before writing and report the blocker. Do not silently fall back to a local PC or direct Sheets writes.

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

The user confirmed that phone-attached image reading works in the cloud assistant. Verify that the in-app paste, preview, and `google.script.run` path can call the existing Apps Script backend under `LockService`, reconcile invoices/match totals, and allocate emergency `E###` identities under its current authoritative counter. No direct connector write or new authentication/cloud service is needed. If the app path cannot preserve these guarantees, stop and present the concrete limitation before selecting a different hosting or authentication design.

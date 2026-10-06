# Photo Library API

The route is independent of `fee-collector/`. See [Instagram workflow](../AGENTS.md#photo-library-route) for the Codex and Drive procedure. The shared catalog is `drive-sources.json`'s `catalogFileId`.

## Service contract

```js
const library = createPhotoLibrary({ repository, source, playerDirectory });

await library.previewInbox(inboxFolderId);              // Unregistered image metadata; no writes
await library.previewImage(driveFileId);                 // Connector preview; no writes
await library.previewDecisions(decisions);               // Proposed records; no writes
await library.registerDecisions(decisions);               // Dry-run by default
await library.registerDecisions(decisions, { dryRun: false }); // Persist catalog records
await library.confirmPlayer(photoId, playerId, reason);   // Explicit human confirmation
await library.findPhotos({ playerId, matchId, status });
await library.getFeaturePlayerCandidates(playerId, matchId); // confirmed only
await library.getReviewQueue();
await library.summarize();
```

Inject a repository implementing `list`, `get`, `findByDriveFileId`, `save`, and `saveMany`; a `PhotoSource` from `photo-source.mjs`; and `playerDirectory.getById(playerId)`, backed by the existing player master. `createDrivePhotoLibrary` in `runtime.mjs` wires a host's existing Drive connector callbacks to the service and Drive JSON repository. The provider supplies `listImages(folderId)`, `getPreview(fileId)`, `readJsonFile(fileId)`, and `replaceJsonFile(fileId, contents)`. `createJsonFilePhotoAssetRepository` is available for an explicitly selected local JSON file. Credentials and Google client dependencies stay outside this module.

### Current Codex Drive connector mapping

This repository's production pattern is a Codex workflow, so the host provider uses the existing Google Drive connector rather than a new Google API client:

| Provider callback | Codex connector operation |
| --- | --- |
| `listImages(folderId)` | `google_drive_list_folder`; map `id`, `title`, and `mime_type` into file metadata. Keep only `image/*`. |
| `getPreview(fileId)` | `google_drive_fetch` for that file's Drive URL. If the connector cannot provide a viewable image, do not identify it from metadata alone. |
| `readJsonFile(fileId)` | `google_drive_fetch` for the catalog; decode the returned JSON payload and require `{ version: 1, assets: [...] }`. |
| `replaceJsonFile(fileId, contents)` | Write `contents` to a temporary `.json` file, call `google_drive_update_file` with the same catalog `fileId`, temporary path as `file_uri`, and `mime_type: application/json`, then fetch the file again and verify its contents. |

The player directory callback reads the existing master with `google_drive_get_spreadsheet_metadata` and `google_drive_get_spreadsheet_range` (`選手マスター` tab, columns A:C), then resolves exact IDs from `選手ID`. Do not guess IDs from display names. Keep only one catalog writer active; if a write fails or read-back differs, stop and reload before retrying. These calls work only where the Codex Google Drive connector is connected with permission to the source photos, master, and catalog.

Each decision includes `driveFileId`, `fileName`, `status`, `reason`, `candidatePlayers`, `evidence`, optional `matchId`, source/current folder IDs, and tags. `confirmed` requires a master player ID and at least one strong evidence kind. Weak evidence kinds are `position`, `gear`, `proximity`, and `sequence`; they cannot confirm identity. `candidate` requires one or more master player IDs and reasons. `unknown` has no candidates and no confirmed player ID.

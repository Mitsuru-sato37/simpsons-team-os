import { createDriveJsonPhotoAssetRepository } from './drive-json-repository.mjs';
import { createPhotoLibrary } from './photo-library.mjs';
import { createPhotoSource } from './photo-source.mjs';

/**
 * Composition root for a Drive-connected host. The host supplies thin
 * callbacks backed by its existing Drive connector and player master; this
 * module owns no credentials and performs no connector calls itself.
 */
export function createDrivePhotoLibrary({ catalogFileId, driveProvider, playerDirectory, clock }) {
  if (!driveProvider) throw new TypeError('driveProvider is required');
  const source = createPhotoSource({
    listImages: (folderId) => driveProvider.listImages(folderId),
    getPreview: (fileId) => driveProvider.getPreview(fileId),
  });
  const repository = createDriveJsonPhotoAssetRepository({
    fileId: catalogFileId,
    readJsonFile: (fileId) => driveProvider.readJsonFile(fileId),
    replaceJsonFile: (fileId, contents) => driveProvider.replaceJsonFile(fileId, contents),
  });
  return createPhotoLibrary({ repository, source, playerDirectory, clock });
}

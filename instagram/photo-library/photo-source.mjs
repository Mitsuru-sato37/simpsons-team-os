const IMAGE_MIME_PREFIX = 'image/';

/**
 * Wraps the existing Google Drive connection behind a replaceable source contract.
 * listImages(folderId) returns Drive metadata; getPreview(fileId) returns a
 * connector preview reference. This module never moves or edits Drive files.
 */
export function createPhotoSource({ listImages, getPreview, allowedInboxFolderIds = null, excludedFolderIds = [] }) {
  if (typeof listImages !== 'function' || typeof getPreview !== 'function') {
    throw new TypeError('PhotoSource requires listImages and getPreview functions');
  }
  const allowedFolders = allowedInboxFolderIds ? new Set(allowedInboxFolderIds) : null;
  const excludedFolders = new Set(excludedFolderIds);

  return Object.freeze({
    async listImages(folderId) {
      if (!folderId) throw new TypeError('folderId is required');
      if (excludedFolders.has(folderId)) throw new Error('This Drive folder is explicitly excluded from photo-library intake');
      if (allowedFolders && !allowedFolders.has(folderId)) throw new Error('This Drive folder is not an approved photo-library inbox');
      const files = await listImages(folderId);
      return (Array.isArray(files) ? files : [])
        .filter((file) => file?.id && String(file.mimeType || file.mime_type || '').startsWith(IMAGE_MIME_PREFIX))
        .map((file) => ({
          driveFileId: String(file.id),
          fileName: String(file.name || file.title || ''),
          mimeType: String(file.mimeType || file.mime_type || ''),
          originalLocation: folderId,
          currentLocation: folderId,
          modifiedAt: file.modifiedTime || file.modified_time || null,
          webViewLink: file.webViewLink || file.url || null,
        }));
    },
    async getPreview(fileId) {
      if (!fileId) throw new TypeError('fileId is required');
      return getPreview(fileId);
    },
  });
}

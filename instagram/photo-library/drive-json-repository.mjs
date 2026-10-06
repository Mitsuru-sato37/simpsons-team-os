/**
 * Drive-backed catalog port. Connectors are injected so the domain does not
 * depend on a particular Drive client, credential store, or API package.
 * The provider must replace the catalog file in one operation and should
 * reject writes when the file revision changed since the last read.
 */
export function createDriveJsonPhotoAssetRepository({ fileId, readJsonFile, replaceJsonFile }) {
  if (!fileId || typeof readJsonFile !== 'function' || typeof replaceJsonFile !== 'function') {
    throw new TypeError('fileId, readJsonFile, and replaceJsonFile are required');
  }

  async function readAssets() {
    const payload = await readJsonFile(fileId);
    const catalog = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.assets)) {
      throw new Error('Unsupported or invalid photo asset catalog');
    }
    return catalog.assets;
  }

  async function saveMany(newAssets) {
    const assets = await readAssets();
    const seenDriveIds = new Set();
    for (const asset of newAssets) {
      if (seenDriveIds.has(asset.driveFileId)) throw new Error(`Duplicate Drive file in save: ${asset.driveFileId}`);
      seenDriveIds.add(asset.driveFileId);
      const duplicate = assets.find((item) => item.driveFileId === asset.driveFileId);
      if (duplicate && duplicate.photoId !== asset.photoId) {
        throw new Error(`Drive file is already registered as ${duplicate.photoId}`);
      }
      const index = assets.findIndex((item) => item.driveFileId === asset.driveFileId);
      if (index >= 0) assets[index] = asset;
      else assets.push(asset);
    }
    await replaceJsonFile(fileId, JSON.stringify({ version: 1, assets }, null, 2) + '\n');
    return newAssets;
  }

  return Object.freeze({
    list: readAssets,
    async get(photoId) {
      return (await readAssets()).find((asset) => asset.photoId === photoId) || null;
    },
    async findByDriveFileId(driveFileId) {
      return (await readAssets()).find((asset) => asset.driveFileId === driveFileId) || null;
    },
    saveMany,
    async save(asset) {
      await saveMany([asset]);
      return asset;
    },
  });
}

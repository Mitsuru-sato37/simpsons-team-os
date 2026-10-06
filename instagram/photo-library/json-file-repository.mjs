import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Creates a JSON-backed repository. The path is explicit so private photo metadata is not stored in Git by default. */
export function createJsonFilePhotoAssetRepository(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('An explicit photo asset store path is required');
  }

  let writeQueue = Promise.resolve();

  async function readAssets() {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Photo asset store must contain a JSON array');
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw new Error(`Could not read photo asset store at ${filePath}: ${error.message}`, { cause: error });
    }
  }

  async function saveMany(newAssets) {
    const operation = writeQueue.then(async () => {
      const assets = await readAssets();
      const seenDriveIds = new Set();
      for (const asset of newAssets) {
        if (seenDriveIds.has(asset.driveFileId)) throw new Error(`Duplicate Drive file in save: ${asset.driveFileId}`);
        seenDriveIds.add(asset.driveFileId);
        const index = assets.findIndex((item) => item.driveFileId === asset.driveFileId);
        if (index >= 0) assets[index] = asset;
        else assets.push(asset);
      }
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify(assets, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        await rename(temporaryPath, filePath);
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
      }
      return newAssets;
    });
    writeQueue = operation.catch(() => {});
    return operation;
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

const STRONG_EVIDENCE = new Set([
  'jersey_number',
  'uniform_name',
  'trusted_metadata',
  'user_confirmation',
]);
const VALID_STATUSES = new Set(['confirmed', 'candidate', 'unknown']);

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((item) => ({
    type: requireText(item?.type, 'evidence.type'),
    description: requireText(item?.description, 'evidence.description'),
  }));
}

function assertDecision(decision) {
  if (!decision || !VALID_STATUSES.has(decision.status)) throw new TypeError('status must be confirmed, candidate, or unknown');
  if (!requireText(decision.driveFileId, 'driveFileId')) throw new TypeError('driveFileId is required');
  if (!requireText(decision.fileName, 'fileName')) throw new TypeError('fileName is required');
  requireText(decision.reason, 'reason');
  const candidates = Array.isArray(decision.candidatePlayers) ? decision.candidatePlayers : [];
  const candidateIds = new Set();
  for (const candidate of candidates) {
    const candidateId = requireText(candidate?.playerId, 'candidate.playerId');
    if (candidateIds.has(candidateId)) throw new Error(`Duplicate candidate playerId: ${candidateId}`);
    candidateIds.add(candidateId);
    requireText(candidate?.reason, 'candidate.reason');
  }
  if (decision.matchId !== null && decision.matchId !== undefined && typeof decision.matchId !== 'string') {
    throw new TypeError('matchId must be a string or null');
  }
  if (decision.status === 'candidate' && candidates.length === 0) {
    throw new TypeError('candidate status requires at least one candidate player');
  }
  if (decision.status === 'unknown' && candidates.length > 0) {
    throw new TypeError('unknown status cannot include candidate players');
  }
  if (decision.status === 'confirmed') {
    requireText(decision.playerId, 'playerId');
    if (candidates.length > 0) throw new TypeError('confirmed photos cannot retain unresolved candidate players');
    const evidence = normalizeEvidence(decision.evidence);
    if (!evidence.some((item) => STRONG_EVIDENCE.has(item.type))) {
      throw new TypeError('confirmed photos require strong evidence or explicit user confirmation');
    }
  }
}

function summarizeAssets(assets) {
  const result = { total: assets.length, confirmed: {}, candidate: {}, unknown: 0, reviewRequired: 0 };
  for (const asset of assets) {
    if (asset.status === 'confirmed') result.confirmed[asset.playerId] = (result.confirmed[asset.playerId] || 0) + 1;
    else {
      result.reviewRequired += 1;
      if (asset.status === 'candidate') {
        for (const candidate of asset.candidatePlayers) {
          result.candidate[candidate.playerId] = (result.candidate[candidate.playerId] || 0) + 1;
        }
      } else result.unknown += 1;
    }
  }
  return result;
}

export function createPhotoLibrary({ repository, source, playerDirectory, clock = () => new Date().toISOString() }) {
  if (!repository || !source || !playerDirectory) {
    throw new TypeError('repository, source, and playerDirectory are required');
  }
  for (const method of ['list', 'get', 'findByDriveFileId', 'save', 'saveMany']) {
    if (typeof repository[method] !== 'function') throw new TypeError(`repository.${method} is required`);
  }
  if (typeof source.listImages !== 'function' || typeof source.getPreview !== 'function') {
    throw new TypeError('source.listImages and source.getPreview are required');
  }
  if (typeof playerDirectory.getById !== 'function') throw new TypeError('playerDirectory.getById is required');

  async function assertKnownPlayer(playerId) {
    const id = requireText(playerId, 'playerId');
    if (!await playerDirectory.getById(id)) throw new TypeError(`Unknown playerId in the official player master: ${id}`);
    return id;
  }

  async function buildAsset(decision, existing = null) {
    assertDecision(decision);
    const evidence = normalizeEvidence(decision.evidence);
    const playerId = decision.status === 'confirmed' ? await assertKnownPlayer(decision.playerId) : null;
    const candidatePlayers = [];
    for (const candidate of decision.candidatePlayers || []) {
      candidatePlayers.push({
        playerId: await assertKnownPlayer(candidate.playerId),
        reason: requireText(candidate.reason, 'candidate.reason'),
      });
    }

    const timestamp = clock();
    const history = existing?.history ? [...existing.history] : [];
    history.push({
      fromStatus: existing?.status || null,
      toStatus: decision.status,
      changedAt: timestamp,
      reason: requireText(decision.reason, 'reason'),
      playerId,
    });

    return {
      photoId: existing?.photoId || `drive:${decision.driveFileId}`,
      driveFileId: decision.driveFileId,
      fileName: decision.fileName,
      playerId,
      matchId: decision.matchId || null,
      status: decision.status,
      candidatePlayers,
      evidence,
      decisionReason: decision.reason.trim(),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      originalLocation: existing?.originalLocation ?? decision.originalLocation ?? null,
      currentLocation: decision.currentLocation ?? existing?.currentLocation ?? decision.originalLocation ?? null,
      tags: [...new Set((decision.tags || []).map((tag) => requireText(tag, 'tag')))],
      history,
    };
  }

  async function previewDecisions(decisions) {
    if (!Array.isArray(decisions)) throw new TypeError('decisions must be an array');
    const seenDriveIds = new Set();
    const assets = [];
    for (const decision of decisions) {
      const driveFileId = requireText(decision?.driveFileId, 'driveFileId');
      if (seenDriveIds.has(driveFileId)) throw new Error(`Duplicate Drive file in preview: ${driveFileId}`);
      seenDriveIds.add(driveFileId);
      const existing = await repository.findByDriveFileId(decision.driveFileId);
      assets.push(await buildAsset(decision, existing));
    }
    return { assets, summary: summarizeAssets(assets), writesPerformed: false, driveChangesPerformed: false };
  }

  async function findPhotos({ playerId = null, matchId = null, status = null } = {}) {
    return (await repository.list()).filter((asset) => {
      if (playerId && asset.playerId !== playerId && !asset.candidatePlayers.some((item) => item.playerId === playerId)) return false;
      if (matchId && asset.matchId !== matchId) return false;
      if (status && asset.status !== status) return false;
      return true;
    });
  }

  return Object.freeze({
    async previewInbox(folderId) {
      const files = await source.listImages(folderId);
      const assets = await repository.list();
      const knownIds = new Set(assets.map((asset) => asset.driveFileId));
      return files.filter((file) => !knownIds.has(file.driveFileId));
    },

    previewImage: (driveFileId) => source.getPreview(requireText(driveFileId, 'driveFileId')),

    previewDecisions,

    async registerDecisions(decisions, { dryRun = true } = {}) {
      const preview = await previewDecisions(decisions);
      if (dryRun) return preview;
      const saved = await repository.saveMany(preview.assets);
      return { ...preview, assets: saved, writesPerformed: true };
    },

    async confirmPlayer(photoId, playerId, reason) {
      const existing = await repository.get(requireText(photoId, 'photoId'));
      if (!existing) throw new Error(`Photo asset not found: ${photoId}`);
      const confirmedPlayerId = await assertKnownPlayer(playerId);
      const asset = await buildAsset({
        driveFileId: existing.driveFileId,
        fileName: existing.fileName,
        playerId: confirmedPlayerId,
        matchId: existing.matchId,
        status: 'confirmed',
        candidatePlayers: [],
        evidence: [{ type: 'user_confirmation', description: 'ユーザーが選手を確認' }],
        reason: requireText(reason, 'reason'),
        originalLocation: existing.originalLocation,
        currentLocation: existing.currentLocation,
        tags: existing.tags,
      }, existing);
      return repository.save(asset);
    },

    async getReviewQueue() {
      return (await repository.list()).filter((asset) => asset.status !== 'confirmed');
    },

    findPhotos,

    async getFeaturePlayerCandidates(playerId, matchId = null) {
      return findPhotos({ playerId, matchId, status: 'confirmed' });
    },

    async summarize() {
      return summarizeAssets(await repository.list());
    },
  });
}

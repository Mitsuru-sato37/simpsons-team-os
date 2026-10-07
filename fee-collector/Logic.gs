function resolveMasterPlayer_(rows, playerId) {
  const key = normalizeMasterPlayerId_(playerId);
  const row = rows.find((item) => normalizeMasterPlayerId_(item[0]) === key);
  if (!row) return null;

  return {
    playerId: String(row[0] || ''),
    jerseyNumber: String(row[1] || ''),
    name: String(row[2] || ''),
  };
}

function searchMasterPlayers_(rows, query) {
  const input = String(query === null || query === undefined ? '' : query).trim().toLocaleLowerCase();
  if (!input) return [];
  const candidates = (rows || []).filter((row) => row[0] && (row[1] || row[2])).map((row) => ({
    playerId: String(row[0]),
    jerseyNumber: String(row[1] || ''),
    name: String(row[2] || ''),
  }));
  const jerseyMatches = candidates.filter((player) => player.jerseyNumber.trim().toLocaleLowerCase() === input);
  const matches = jerseyMatches.length ? jerseyMatches : candidates.filter((player) =>
    player.name.trim().toLocaleLowerCase().includes(input) ||
    player.jerseyNumber.trim().toLocaleLowerCase().includes(input)
  );
  return matches.slice(0, 10);
}

function parseRosterPaste_(text) {
  return String(text || '').split(/\r?\n/).map((line, index) => {
    let value = line.trim();
    if (!value) return null;
    const uncertain = /^\?\s*/.test(value);
    value = value.replace(/^\?\s*/, '');
    const match = value.match(/^#?\s*(\d{1,2}|##)(?:\s+(.+))?$/);
    if (match) {
      return {
        lineNumber: index + 1,
        jerseyNumber: match[1],
        name: String(match[2] || '').trim(),
        uncertain,
      };
    }
    return { lineNumber: index + 1, jerseyNumber: '', name: value, uncertain };
  }).filter(Boolean);
}

function normalizeRosterIdentity_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim().replace(/\s+/g, '').toLocaleLowerCase();
}

function matchRosterCandidate_(candidate, masterRows, memberRows) {
  const jerseyNumber = String(candidate && candidate.jerseyNumber || '').trim();
  const name = String(candidate && candidate.name || '').trim();
  const nameKey = normalizeRosterIdentity_(name);
  const masterData = (masterRows || []).slice(
    masterRows && masterRows[0] && String(masterRows[0][0]) === '選手ID' ? 1 : 0
  );
  const memberData = (memberRows || []).slice(
    memberRows && memberRows[0] && String(memberRows[0][0]) === 'メンバーID' ? 1 : 0
  );
  const players = masterData.filter((row) => row[0] && (row[1] || row[2] || row[3]))
    .map((row) => ({
      playerId: String(row[0]),
      jerseyNumber: String(row[1] || '').trim(),
      name: String(row[2] || '').trim(),
      aliases: [String(row[2] || ''), String(row[3] || '')].map(normalizeRosterIdentity_).filter(Boolean),
    }));
  const emergencyMembers = memberData.filter((row) =>
    /^E\d{3,}$/.test(String(row[0] || '')) && normalizeRosterIdentity_(row[1])
  ).map((row) => ({
    playerId: String(row[0]),
    jerseyNumber: '',
    name: String(row[1] || '').trim(),
    aliases: [normalizeRosterIdentity_(row[1])],
    emergency: true,
  }));
  const jerseyMatches = jerseyNumber ? players.filter((player) => player.jerseyNumber === jerseyNumber) : [];
  let nameMatches = nameKey ? players.filter((player) => player.aliases.some((alias) =>
    alias === nameKey || (nameKey.length >= 2 && alias.includes(nameKey))
  )) : [];
  if (!jerseyNumber && nameKey) {
    nameMatches = nameMatches.concat(emergencyMembers.filter((member) => member.aliases.includes(nameKey)));
  }
  let matched = null;
  let status = 'not_found';

  if (jerseyNumber && nameKey) {
    if (jerseyMatches.length > 1 || nameMatches.length > 1) status = 'ambiguous';
    else if (jerseyMatches.length === 1 && nameMatches.length === 1) {
      status = jerseyMatches[0].playerId === nameMatches[0].playerId ? 'matched' : 'conflict';
      matched = status === 'matched' ? jerseyMatches[0] : null;
    } else if (jerseyMatches.length || nameMatches.length) status = 'conflict';
  } else {
    const matches = jerseyNumber ? jerseyMatches : nameMatches;
    if (matches.length > 1) status = 'ambiguous';
    else if (matches.length === 1) {
      status = 'matched';
      matched = matches[0];
    }
  }

  if (candidate && candidate.uncertain && status === 'matched') status = 'uncertain';
  if (!matched || status !== 'matched') {
    return {
      status,
      jerseyNumber,
      name,
      candidates: status === 'conflict'
        ? [...new Map([...jerseyMatches, ...nameMatches].map((player) => [player.playerId, player])).values()]
        : [...new Map([...jerseyMatches, ...nameMatches].map((player) => [player.playerId, player])).values()],
    };
  }
  return {
    status: 'matched',
    playerId: matched.playerId,
    jerseyNumber: matched.jerseyNumber,
    name: matched.name,
    ...(matched.emergency ? { emergency: true } : {}),
  };
}

function buildRosterPreview_(game, extractedRows, masterRows, currentParticipants, receipts, memberRows, emergencyLineNumbers) {
  const validGame = game && game.id && isOpenGame_(game);
  const memberData = (memberRows || []).slice(
    memberRows && memberRows[0] && String(memberRows[0][0]) === 'メンバーID' ? 1 : 0
  );
  const current = (currentParticipants || []).filter((row) =>
    String(row[0]) === String(game && game.id) && String(row[4]) === '対象'
  );
  const activeReceipts = (receipts || []).filter((row) =>
    String(row[1]) === String(game && game.id) && String(row[7]) === '有効'
  );
  const matched = [];
  const unresolved = [];
  const seenPlayers = new Set();
  const emergencyLines = new Set((emergencyLineNumbers || []).map(Number));

  (extractedRows || []).forEach((candidate) => {
    let result = matchRosterCandidate_(candidate, masterRows, memberRows);
    if (result.status === 'not_found' && emergencyLines.has(Number(candidate.lineNumber)) &&
        candidate.name && !candidate.uncertain) {
      result = {
        status: 'matched', playerId: '', jerseyNumber: '', name: String(candidate.name).trim(),
        emergency: true, needsEmergencyId: true,
      };
    }
    if (result.status !== 'matched') {
      unresolved.push({ ...candidate, status: result.status, candidates: result.candidates || [] });
      return;
    }
    const seenKey = result.playerId || 'name:' + normalizeRosterIdentity_(result.name);
    if (seenPlayers.has(seenKey)) {
      unresolved.push({ ...candidate, status: 'duplicate', candidates: [result] });
      return;
    }
    seenPlayers.add(seenKey);
    matched.push(result);
  });

  const currentById = new Map(current.map((row) => [String(row[1]), row]));
  const proposedIds = new Set(matched.map((player) => player.playerId).filter(Boolean));
  const additions = matched.filter((player) => !player.playerId || !currentById.has(player.playerId)).map((player) => ({
    playerId: player.playerId,
    jerseyNumber: player.jerseyNumber,
    name: player.name,
    ...(player.emergency ? { emergency: true } : {}),
  }));
  const activeReceiptIds = new Set(activeReceipts.map((row) => String(row[2])));
  const absences = current.filter((row) => !proposedIds.has(String(row[1]))).map((row) => ({
    playerId: String(row[1]),
    name: String(row[2] || ''),
    blocked: activeReceiptIds.has(String(row[1])),
  }));
  const snapshot = [
    String(game && game.id || ''),
    String(game && game.status || ''),
    current.map((row) => [String(row[1]), String(row[4])]).sort((a, b) => a[0].localeCompare(b[0])),
    activeReceipts.map((row) => [String(row[0]), String(row[2]), String(row[7])]).sort((a, b) => a[0].localeCompare(b[0])),
    (memberData || []).filter((row) => /^E\d{3,}$/.test(String(row[0] || '')))
      .map((row) => [String(row[0]), normalizeRosterIdentity_(row[1])]).sort((a, b) => a[0].localeCompare(b[0])),
    [...emergencyLines].sort((a, b) => a - b),
  ];
  const blockedAbsences = absences.filter((item) => item.blocked);
  return {
    gameId: String(game && game.id || ''),
    attendees: matched.map((player) => ({
      playerId: player.playerId,
      jerseyNumber: player.jerseyNumber,
      name: player.name,
      ...(player.emergency ? { emergency: true } : {}),
    })),
    additions,
    absences,
    unresolved,
    emergencyLineNumbers: [...emergencyLines].sort((a, b) => a - b),
    previewFingerprint: JSON.stringify(snapshot),
    readyToConfirm: Boolean(validGame) && (extractedRows || []).length > 0 &&
      unresolved.length === 0 && blockedAbsences.length === 0,
  };
}

function normalizeMasterPlayerId_(playerId) {
  return String(playerId || '').trim().replace(/^P/i, '').padStart(3, '0');
}

function toFeeMemberId_(playerId) {
  const normalized = normalizeMasterPlayerId_(playerId);
  if (!/^\d{3}$/.test(normalized)) return null;
  const numericId = Number(normalized);
  return numericId >= 1 && numericId <= 50 ? 'M' + normalized : null;
}

function resolveEmergencyMemberId_(memberRows, name) {
  const normalizedName = String(name || '').trim().replace(/\s+/g, '');
  if (!normalizedName) return { status: 'not_found' };

  const rows = (memberRows || []).filter((row) => /^E\d{3,}$/.test(String(row[0] || '')));
  const matches = rows.filter((row) => String(row[1] || '').trim().replace(/\s+/g, '') === normalizedName);
  if (matches.length > 1) return { status: 'ambiguous' };
  if (matches.length === 1) {
    return { status: 'matched', memberId: String(matches[0][0]), name: String(matches[0][1]) };
  }

  const nextNumber = rows.reduce((maximum, row) => {
    const number = Number(String(row[0]).slice(1));
    return Number.isFinite(number) ? Math.max(maximum, number) : maximum;
  }, 0) + 1;
  return { status: 'new', memberId: 'E' + String(nextNumber).padStart(3, '0'), name: String(name).trim() };
}

function reserveEmergencyMemberId_(memberRows, propertyStore) {
  const nextNumberKey = 'emergency-member-next-id';
  const recorded = Number(propertyStore.getProperty(nextNumberKey) || 1);
  const nextFromSheet = (memberRows || []).reduce((maximum, row) => {
    const match = String(row[0] || '').match(/^E(\d{3,})$/);
    return match ? Math.max(maximum, Number(match[1]) + 1) : maximum;
  }, 1);
  const nextNumber = Math.max(Number.isFinite(recorded) ? recorded : 1, nextFromSheet);
  propertyStore.setProperty(nextNumberKey, String(nextNumber + 1));
  return 'E' + String(nextNumber).padStart(3, '0');
}

function resolveMemberLookup_(rows, field, value) {
  const input = String(value === null || value === undefined ? '' : value).trim();
  if (!input) return { status: 'not_found' };

  let matches;
  if (field === 'memberId') {
    const playerId = input.toUpperCase().replace(/^M/, '').replace(/^P/, '');
    const memberId = toFeeMemberId_(playerId);
    matches = memberId ? (rows || []).filter((row) => toFeeMemberId_(row[0]) === memberId) : [];
  } else if (field === 'name') {
    const nameKey = input.replace(/\s+/g, '');
    matches = (rows || []).filter((row) => String(row[2] || '').trim().replace(/\s+/g, '') === nameKey);
  } else if (field === 'jerseyNumber') {
    matches = (rows || []).filter((row) => String(row[1] === null || row[1] === undefined ? '' : row[1]).trim() === input);
  } else {
    return { status: 'invalid_field' };
  }

  matches = matches.filter((row) => row[0] && (row[2] || row[1]));
  if (!matches.length) return { status: 'not_found' };
  if (matches.length !== 1) return { status: 'ambiguous' };

  const player = resolveMasterPlayer_([matches[0]], matches[0][0]);
  if (!player) return { status: 'not_found' };
  const memberId = toFeeMemberId_(player.playerId);
  if (!memberId) return { status: 'not_found' };
  return { status: 'matched', playerId: player.playerId, memberId, name: player.name, jerseyNumber: player.jerseyNumber };
}

function isPaymentMethodAllowed_(method) {
  return ['現金', 'PayPay', '銀行振込'].includes(String(method || ''));
}

function isOpenGame_(game) {
  return game && game.status !== '完了' && game.status !== '中止';
}

function pickNextOpenGame_(games, completedGameId) {
  const list = Array.isArray(games) ? games : [];
  const completedIndex = list.findIndex(
    (game) => String(game.id) === String(completedGameId)
  );

  if (completedIndex >= 0) {
    const next = list.slice(completedIndex + 1).find(isOpenGame_);
    if (next) return next;
  }

  return list.find(isOpenGame_) || null;
}

function projectReceipts_(rows, selectedGameId) {
  const active = [];
  const cancelled = [];
  const byPlayer = {};

  (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row[1]) === String(selectedGameId) && row[0])
    .filter((row) => String(row[7]) === '有効' || String(row[7]) === '取消')
    .forEach((row) => {
      const receipt = {
        id: String(row[0]),
        gameId: String(row[1]),
        playerId: String(row[2]),
        name: String(row[3] || ''),
        receivedAt: row[4],
        amount: Number(row[5] || 0),
        method: String(row[6] || ''),
        status: String(row[7] || ''),
        memo: String(row[8] || ''),
      };

      if (!byPlayer[receipt.playerId]) byPlayer[receipt.playerId] = [];
      byPlayer[receipt.playerId].push(receipt);
      if (receipt.status === '取消') cancelled.push(receipt);
      else active.push(receipt);
    });

  return { active, cancelled, byPlayer };
}

function resolveGameCharge_(charge) {
  if (charge === null || charge === undefined || String(charge).trim() === '') return null;
  const amount = Number(charge);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function resolveParticipantCharge_(matchCharge, historicalCharge) {
  return resolveGameCharge_(matchCharge) || resolveGameCharge_(historicalCharge);
}

function buildFeeInvoiceId_(gameId, playerId) {
  return 'FEE-' + encodeURIComponent(String(gameId || '').trim()) + '-' +
    encodeURIComponent(String(playerId || '').trim());
}

function projectReceiptAccounting_(rows, selectedGameId) {
  const projected = projectReceipts_(rows, selectedGameId);
  const uniqueById = (receipts) => {
    const seen = new Set();
    return receipts.filter((receipt) => {
      if (seen.has(receipt.id)) return false;
      seen.add(receipt.id);
      return true;
    });
  };
  const active = uniqueById(projected.active);
  const cancelled = uniqueById(projected.cancelled);
  const activeTotalByPlayer = {};
  active.forEach((receipt) => {
    activeTotalByPlayer[receipt.playerId] =
      (activeTotalByPlayer[receipt.playerId] || 0) + receipt.amount;
  });
  return { active, cancelled, activeTotalByPlayer };
}

function legacyMigrationKey_(kind, row) {
  if (!Array.isArray(row)) return '';
  if (kind === 'game') return row[0] ? 'game:' + String(row[0]) : '';
  if (kind === 'participant') {
    return row[0] && row[1] ? 'participant:' + JSON.stringify([String(row[0]), String(row[1])]) : '';
  }
  if (kind === 'receipt') return row[0] ? 'receipt:' + String(row[0]) : '';
  throw new Error('Unknown legacy row kind: ' + kind);
}

function filterLegacyRows_(kind, sourceRows, existingRows) {
  const known = new Set((existingRows || []).map((row) => legacyMigrationKey_(kind, row)).filter(Boolean));
  const result = [];
  (sourceRows || []).forEach((row) => {
    const key = legacyMigrationKey_(kind, row);
    if (!key || known.has(key)) return;
    known.add(key);
    result.push(row);
  });
  return result;
}

function projectGames_(accountingRows, operationalRows, defaultCharge) {
  const operationsById = {};
  (operationalRows || []).slice(1).forEach((row) => {
    if (row[0]) operationsById[String(row[0])] = row;
  });
  return (accountingRows || []).slice(1)
    .filter((row) => row[0])
    .map((row) => {
      const operational = operationsById[String(row[0])] || [];
      return {
        id: String(row[0]),
        date: String(row[1] || ''),
        opponent: String(row[2] || ''),
        location: String(row[3] || ''),
        meetingTime: String(operational[4] || ''),
        startTime: String(operational[5] || ''),
        groundFee: Number(operational[6] || 0),
        status: String(operational[7] || '予定'),
        memo: String(operational[8] || ''),
        charge: resolveGameCharge_(row[9]) || resolveGameCharge_(defaultCharge),
      };
    });
}

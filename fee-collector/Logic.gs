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

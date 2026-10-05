const CONFIG = Object.freeze({
  SHEET_GAMES: '試合',
  SHEET_PARTICIPANTS: '参加者',
  SHEET_RECEIPTS: '受領履歴',
  PLAYER_MASTER_SHEET: '選手マスター',
  PLAYER_MASTER_SPREADSHEET_ID: '1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4',
  DEFAULT_FEE: 300,
  TIME_ZONE: 'Asia/Tokyo',
  PAYMENT_METHODS: ['現金', 'PayPay', '銀行振込'],
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Simpsons 集金')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBootstrap(preferredGameId) {
  const games = getGames_();
  const selected = pickGame_(games, preferredGameId);
  return buildState_(games, selected ? selected.id : null);
}

function recordPayment(payload) {
  if (!payload || !payload.gameId || !payload.playerId) {
    throw new Error('試合と選手を指定してください。');
  }

  const method = String(payload.method || '');
  if (!isPaymentMethodAllowed_(method)) {
    throw new Error('支払方法が不正です。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const participant = findParticipant_(ss, payload.gameId, payload.playerId);
    if (!participant || participant.target !== '対象') {
      throw new Error('この選手は集金対象ではありません。');
    }

    const due = participant.charge;
    const activeReceipts = getActiveReceipts_(ss, payload.gameId, payload.playerId);
    const received = activeReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);

    if (received >= due) {
      return {
        ok: false,
        code: 'ALREADY_PAID',
        message: 'すでに受領済みです。',
        state: buildState_(getGames_(), payload.gameId),
      };
    }

    const amount = Math.min(CONFIG.DEFAULT_FEE, due - received);
    const now = new Date();
    const receiptId = makeReceiptId_(now);
    const receiptSheet = ss.getSheetByName(CONFIG.SHEET_RECEIPTS);
    receiptSheet.appendRow([
      receiptId,
      payload.gameId,
      participant.playerId,
      participant.name,
      now,
      amount,
      method,
      '有効',
      payload.note || '',
    ]);

    SpreadsheetApp.flush();

    const receipt = {
      id: receiptId,
      gameId: payload.gameId,
      playerId: participant.playerId,
      name: participant.name,
      amount,
      method,
      receivedAt: Utilities.formatDate(now, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm:ss'),
    };

    return {
      ok: true,
      receipt,
      state: buildState_(getGames_(), payload.gameId),
    };
  } finally {
    lock.releaseLock();
  }
}

function cancelReceipt(receiptId) {
  if (!receiptId) throw new Error('受領IDがありません。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.SHEET_RECEIPTS);
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i += 1) {
      if (String(values[i][0]) !== String(receiptId)) continue;

      if (String(values[i][7]) === '取消') {
        return { ok: true, alreadyCancelled: true };
      }

      sheet.getRange(i + 1, 8).setValue('取消');
      const currentMemo = String(values[i][8] || '');
      sheet.getRange(i + 1, 9).setValue(
        currentMemo ? currentMemo + ' / 画面から取消' : '画面から取消'
      );
      SpreadsheetApp.flush();

      return {
        ok: true,
        state: buildState_(getGames_(), String(values[i][1])),
      };
    }

    throw new Error('受領記録が見つかりません。');
  } finally {
    lock.releaseLock();
  }
}

function completeGame(gameId) {
  if (!gameId) throw new Error('試合IDがありません。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.SHEET_GAMES);
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i += 1) {
      if (String(values[i][0]) !== String(gameId)) continue;

      if (['完了', '中止'].includes(String(values[i][7]))) {
        throw new Error('この試合は完了または中止のため、完了に変更できません。');
      }

      sheet.getRange(i + 1, 8).setValue('完了');
      SpreadsheetApp.flush();

      const games = getGames_();
      const next = pickNextOpenGame_(games, gameId);
      return buildState_(games, next ? next.id : null);
    }

    throw new Error('試合が見つかりません。');
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (configuredId) return SpreadsheetApp.openById(configuredId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'スプレッドシートに紐づけたApps Scriptとして使うか、Script PropertiesにSPREADSHEET_IDを設定してください。'
    );
  }
  return active;
}

function getPlayerMasterRows_() {
  const ss = SpreadsheetApp.openById(CONFIG.PLAYER_MASTER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.PLAYER_MASTER_SHEET);
  if (!sheet) throw new Error('選手マスターの「選手マスター」タブがありません。');
  return sheet.getDataRange().getValues().slice(1);
}

function getGames_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEET_GAMES);
  if (!sheet) throw new Error('「試合」タブがありません。');

  const rows = sheet.getDataRange().getValues().slice(1);
  return rows
    .filter((row) => row[0])
    .map((row) => ({
      id: String(row[0]),
      date: formatCellDate_(row[1]),
      opponent: String(row[2] || ''),
      location: String(row[3] || ''),
      meetingTime: String(row[4] || ''),
      startTime: String(row[5] || ''),
      groundFee: Number(row[6] || 0),
      status: String(row[7] || '予定'),
      memo: String(row[8] || ''),
    }));
}

function pickGame_(games, preferredGameId) {
  if (preferredGameId) {
    const exact = games.find((game) => game.id === preferredGameId);
    if (exact) return exact;
  }

  const openGames = games.filter(
    (game) => game.status !== '完了' && game.status !== '中止'
  );
  return openGames[0] || games[games.length - 1] || null;
}

function buildState_(games, gameId) {
  const selected = games.find((game) => game.id === gameId) || null;
  if (!selected) {
    return {
      games,
      selectedGame: null,
      participants: [],
      received: [],
      cancelled: [],
      summary: { participants: 0, expected: 0, received: 0, outstanding: 0 },
    };
  }

  const ss = getSpreadsheet_();
  const participantSheet = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
  const participantRows = participantSheet.getDataRange().getValues().slice(1);
  const masterRows = getPlayerMasterRows_();
  const receiptRows = ss
    .getSheetByName(CONFIG.SHEET_RECEIPTS)
    .getDataRange()
    .getValues()
    .slice(1);

  const projectedReceipts = projectReceipts_(receiptRows, selected.id);
  const activeReceipts = projectedReceipts.active.map((receipt) => ({
    ...receipt,
    receivedAt: formatDateTime_(receipt.receivedAt),
  }));
  const cancelledReceipts = projectedReceipts.cancelled.map((receipt) => ({
    ...receipt,
    receivedAt: formatDateTime_(receipt.receivedAt),
  }));

  const receiptsByPlayer = activeReceipts.reduce((map, receipt) => {
    if (!map[receipt.playerId]) map[receipt.playerId] = [];
    map[receipt.playerId].push(receipt);
    return map;
  }, {});

  const participants = participantRows
    .filter(
      (row) => String(row[0]) === selected.id && String(row[4]) === '対象'
    )
    .map((row) => {
      const playerId = String(row[1]);
      const masterPlayer = resolveMasterPlayer_(masterRows, playerId);
      const charge = Number(row[5] || row[3] || CONFIG.DEFAULT_FEE);
      const playerReceipts = receiptsByPlayer[playerId] || [];
      const receivedAmount = playerReceipts.reduce(
        (sum, receipt) => sum + receipt.amount,
        0
      );
      return {
        playerId,
        name: masterPlayer ? masterPlayer.name : String(row[2] || ''),
        jerseyNumber: masterPlayer ? masterPlayer.jerseyNumber : '',
        charge,
        receivedAmount,
        outstanding: Math.max(0, charge - receivedAmount),
        paid: receivedAmount >= charge,
        receipts: playerReceipts,
      };
    });

  participants.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    return a.name.localeCompare(b.name, 'ja');
  });

  const summary = participants.reduce(
    (acc, player) => {
      acc.participants += 1;
      acc.expected += player.charge;
      acc.received += player.receivedAmount;
      acc.outstanding += player.outstanding;
      return acc;
    },
    { participants: 0, expected: 0, received: 0, outstanding: 0 }
  );

  return {
    games,
    selectedGame: selected,
    participants,
    received: activeReceipts.sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt)
    ),
    cancelled: cancelledReceipts.sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt)
    ),
    summary,
  };
}

function findParticipant_(ss, gameId, playerId) {
  const rows = ss
    .getSheetByName(CONFIG.SHEET_PARTICIPANTS)
    .getDataRange()
    .getValues()
    .slice(1);

  const row = rows.find(
    (item) => String(item[0]) === String(gameId) && String(item[1]) === String(playerId)
  );
  if (!row) return null;

  return {
    gameId: String(row[0]),
    playerId: String(row[1]),
    name: (() => {
      const masterPlayer = resolveMasterPlayer_(getPlayerMasterRows_(), row[1]);
      return masterPlayer ? masterPlayer.name : String(row[2] || '');
    })(),
    fee: Number(row[3] || CONFIG.DEFAULT_FEE),
    target: String(row[4] || ''),
    charge: Number(row[5] || row[3] || CONFIG.DEFAULT_FEE),
  };
}

function getActiveReceipts_(ss, gameId, playerId) {
  return ss
    .getSheetByName(CONFIG.SHEET_RECEIPTS)
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(
      (row) =>
        String(row[1]) === String(gameId) &&
        String(row[2]) === String(playerId) &&
        String(row[7]) === '有効'
    )
    .map((row) => ({
      id: String(row[0]),
      amount: Number(row[5] || 0),
    }));
}

function makeReceiptId_(date) {
  const stamp = Utilities.formatDate(date, CONFIG.TIME_ZONE, 'yyyyMMdd-HHmmss');
  return 'R-' + stamp + '-' + Utilities.getUuid().slice(0, 6);
}

function formatCellDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIME_ZONE, 'yyyy/MM/dd');
  }
  return String(value || '');
}

function formatDateTime_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm:ss');
  }
  return String(value || '');
}

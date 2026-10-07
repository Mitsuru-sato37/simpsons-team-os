const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ',
  SHEET_GAMES: '集金_試合',
  SHEET_PARTICIPANTS: '集金_参加者',
  SHEET_RECEIPTS: '集金_受領履歴',
  LEGACY_SPREADSHEET_ID: '1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E',
  ACCOUNTING_GAMES: '試合会計',
  MEMBER_INVOICES: 'メンバー請求',
  TRANSACTIONS: '取引台帳',
  MEMBERS: 'メンバー',
  PLAYER_MASTER_SHEET: '選手マスター',
  PLAYER_MASTER_SPREADSHEET_ID: '1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4',
  TIME_ZONE: 'Asia/Tokyo',
  PAYMENT_METHODS: ['現金', 'PayPay', '銀行振込'],
});

const FEE_HEADERS = Object.freeze({
  [CONFIG.SHEET_GAMES]: ['試合ID', '日付', '対戦相手', '場所', '集合時刻', '試合時刻', 'グラウンド費', '状態', 'メモ'],
  [CONFIG.SHEET_PARTICIPANTS]: ['試合ID', '選手ID', '選手名', '参加費', '対象', '請求額', '受領額', '残額', 'メモ'],
  [CONFIG.SHEET_RECEIPTS]: ['受領ID', '試合ID', '選手ID', '選手名', '受領日時', '金額', '支払方法', '状態', 'メモ'],
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
  const ss = getSpreadsheet_();
  ensureFeeCollectorSchema_(ss);
  syncPlayerMasterMembers_(ss);
  migrateLegacyFeeData_(ss);
  reconcileAccounting_(ss);
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
    ensureFeeCollectorSchema_(ss);
    const participant = findParticipant_(ss, payload.gameId, payload.playerId);
    if (!participant || participant.target !== '対象') {
      throw new Error('この選手は集金対象ではありません。');
    }

    const due = resolveGameCharge_(participant.charge);
    if (!due) {
      throw new Error('試合会計の「実徴収額/人」を設定してから集金してください。');
    }
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

    const outstanding = due - received;
    const amount = outstanding;
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
    const receipt = {
      id: receiptId,
      gameId: payload.gameId,
      playerId: participant.playerId,
      name: participant.name,
      receivedAt: now,
      amount,
      method,
      status: '有効',
      memo: payload.note || '',
    };
    syncReceiptAccounting_(ss, receipt, '有効');
    reconcileMatchAccounting_(ss, payload.gameId);

    SpreadsheetApp.flush();

    receipt.receivedAt = Utilities.formatDate(now, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm:ss');
    const receiptResponse = {
      ...receipt,
      receivedAt: Utilities.formatDate(now, CONFIG.TIME_ZONE, 'yyyy/MM/dd HH:mm:ss'),
    };

    return {
      ok: true,
      receipt: receiptResponse,
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
    ensureFeeCollectorSchema_(ss);
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
      const receipt = receiptFromRow_(values[i]);
      cancelReceiptAccounting_(ss, receipt);
      reconcileMemberInvoice_(ss, receipt.gameId, receipt.playerId);
      reconcileMatchAccounting_(ss, receipt.gameId);
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
    const row = ensureOperationalGameRow_(ss, gameId);
    if (!row) throw new Error('試合が見つかりません。');
    const status = String(sheet.getRange(row, 8).getValue() || '予定');
    if (['完了', '中止'].includes(status)) {
      throw new Error('この試合は完了または中止のため、完了に変更できません。');
    }
    sheet.getRange(row, 8).setValue('完了');
    SpreadsheetApp.flush();

    const games = getGames_();
    const next = pickNextOpenGame_(games, gameId);
    return buildState_(games, next ? next.id : null);
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getPlayerMasterRows_() {
  const ss = SpreadsheetApp.openById(CONFIG.PLAYER_MASTER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.PLAYER_MASTER_SHEET);
  if (!sheet) throw new Error('選手マスターの「選手マスター」タブがありません。');
  return sheet.getDataRange().getValues().slice(1);
}

function ensureOperationalGameRow_(ss, gameId) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_GAMES);
  const existing = findDataRow_(sheet, 1, gameId);
  if (existing) return existing;
  const accounting = getAccountingGameRow_(ss, gameId);
  if (!accounting) return 0;
  const row = Math.max(2, findFirstEmptyRow_(sheet, 1));
  sheet.getRange(row, 1, 1, FEE_HEADERS[CONFIG.SHEET_GAMES].length).setValues([[
    accounting[0], accounting[1], accounting[2], accounting[3], '', '', 0, '予定', '',
  ]]);
  return row;
}

function ensureFeeCollectorSchema_(ss) {
  ss.setSpreadsheetTimeZone(CONFIG.TIME_ZONE);
  Object.keys(FEE_HEADERS).forEach((title) => {
    let sheet = ss.getSheetByName(title);
    if (!sheet) {
      sheet = ss.insertSheet(title);
      sheet.getRange(1, 1, 1, FEE_HEADERS[title].length).setValues([FEE_HEADERS[title]]);
      sheet.setFrozenRows(1);
      return;
    }
    const actual = sheet.getRange(1, 1, 1, FEE_HEADERS[title].length).getValues()[0];
    if (FEE_HEADERS[title].some((header, index) => String(actual[index] || '') !== header)) {
      throw new Error('「' + title + '」の列見出しが想定と異なります。シートを変更せず管理者へ連絡してください。');
    }
  });
}

function getAccountingGameRow_(ss, gameId) {
  const rows = ss.getSheetByName(CONFIG.ACCOUNTING_GAMES).getDataRange().getValues();
  return rows.find((row, index) => index > 0 && String(row[0]) === String(gameId)) || null;
}

function getGameCharge_(ss, gameId) {
  const row = getAccountingGameRow_(ss, gameId);
  return row ? resolveGameCharge_(row[9]) : null;
}

function getParticipantCharge_(ss, participantRow) {
  return resolveParticipantCharge_(getGameCharge_(ss, participantRow[0]), participantRow[5]);
}

function receiptFromRow_(row) {
  return {
    id: String(row[0] || ''), gameId: String(row[1] || ''), playerId: String(row[2] || ''),
    name: String(row[3] || ''), receivedAt: row[4], amount: Number(row[5] || 0),
    method: String(row[6] || ''), status: String(row[7] || ''), memo: String(row[8] || ''),
  };
}

function findDataRow_(sheet, column, value) {
  const rows = sheet.getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][column - 1]) === String(value)) return index + 1;
  }
  return 0;
}

function findFirstEmptyRow_(sheet, column) {
  const rows = sheet.getRange(1, column, sheet.getLastRow(), 1).getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][0] === '' || rows[index][0] === null) return index + 1;
  }
  return sheet.getLastRow() + 1;
}

function getDataRowValues_(sheet, column, value) {
  const rows = sheet.getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][column - 1]) === String(value)) return rows[index];
  }
  return null;
}

function ensureMemberSnapshot_(ss, memberId, name, jerseyNumber) {
  const sheet = ss.getSheetByName(CONFIG.MEMBERS);
  const row = findDataRow_(sheet, 1, memberId);
  if (row) {
    if (name && String(sheet.getRange(row, 2).getValue() || '') !== String(name)) {
      sheet.getRange(row, 2).setValue(name);
    }
    if (jerseyNumber && String(sheet.getRange(row, 8).getValue() || '') !== String(jerseyNumber)) {
      sheet.getRange(row, 8).setValue(jerseyNumber);
    }
    return row;
  }
  const next = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(next, 1, 1, 2).setValues([[memberId, name]]);
  if (jerseyNumber) sheet.getRange(next, 8).setValue(jerseyNumber);
  return next;
}

function syncPlayerMasterMembers_(ss) {
  const sheet = ss.getSheetByName(CONFIG.MEMBERS);
  const currentRows = sheet.getDataRange().getValues();
  const rowByMemberId = {};
  currentRows.slice(1).forEach((row, index) => {
    if (row[0]) rowByMemberId[String(row[0])] = index + 2;
  });
  const newMembers = [];
  getPlayerMasterRows_().forEach((row) => {
    const player = resolveMasterPlayer_([row], row[0]);
    if (!player) return;
    const memberId = toFeeMemberId_(player.playerId);
    if (!memberId) return;
    const existingRow = rowByMemberId[memberId];
    if (existingRow) {
      if (String(currentRows[existingRow - 1][1] || '') !== player.name) {
        sheet.getRange(existingRow, 2).setValue(player.name);
      }
      if (String(currentRows[existingRow - 1][7] || '') !== player.jerseyNumber) {
        sheet.getRange(existingRow, 8).setValue(player.jerseyNumber);
      }
      return;
    }
    newMembers.push([memberId, player.name, player.jerseyNumber]);
  });

  if (newMembers.length) {
    const startRow = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(startRow, 1, newMembers.length, 2)
      .setValues(newMembers.map((member) => [member[0], member[1]]));
    sheet.getRange(startRow, 8, newMembers.length, 1)
      .setValues(newMembers.map((member) => [member[2]]));
  }
}

function getGameDate_(ss, gameId) {
  const game = getDataRowValues_(ss.getSheetByName(CONFIG.SHEET_GAMES), 1, gameId);
  if (game) return game[1];
  const accountingGame = getAccountingGameRow_(ss, gameId);
  return accountingGame ? accountingGame[1] : '';
}

function getActiveReceiptTotal_(ss, gameId, playerId) {
  return getActiveReceipts_(ss, gameId, playerId)
    .reduce((total, receipt) => total + receipt.amount, 0);
}

function ensureFormula_(sheet, row, column, formula) {
  if (!sheet.getRange(row, column).getFormula()) sheet.getRange(row, column).setFormula(formula);
}

function upsertMemberInvoice_(ss, gameId, playerId, memberId, name, jerseyNumber, charge, received) {
  const sheet = ss.getSheetByName(CONFIG.MEMBER_INVOICES);
  const invoiceId = buildFeeInvoiceId_(gameId, playerId);
  let row = findDataRow_(sheet, 1, invoiceId);
  if (!row) row = Math.max(2, findFirstEmptyRow_(sheet, 1));
  if (memberId) ensureMemberSnapshot_(ss, memberId, name, jerseyNumber);
  sheet.getRange(row, 1).setValue(invoiceId);
  sheet.getRange(row, 2).setValue(memberId || '');
  sheet.getRange(row, 3).setValue(name);
  sheet.getRange(row, 4, 1, 5).setValues([[
    '試合参加費', gameId, getGameDate_(ss, gameId), charge || 0, received || 0,
  ]]);
  ensureFormula_(sheet, row, 9, '=IF(A' + row + '="","",MAX(G' + row + '-H' + row + ',0))');
  ensureFormula_(sheet, row, 10,
    '=IF(A' + row + '="","",IF(H' + row + '=0,"未払い",IF(H' + row + '<G' + row + ',"一部入金","完了")))');
  return row;
}

function upsertReceiptTransaction_(ss, receipt, status) {
  const sheet = ss.getSheetByName(CONFIG.TRANSACTIONS);
  const transactionId = 'FEE-' + receipt.id;
  let row = findDataRow_(sheet, 1, transactionId);
  if (!row) row = Math.max(2, findFirstEmptyRow_(sheet, 1));
  const dateValue = receipt.receivedAt instanceof Date ? receipt.receivedAt : new Date(receipt.receivedAt);
  sheet.getRange(row, 1, 1, 10).setValues([[
    transactionId, dateValue, '収入', '試合参加費', '試合参加費 ' + receipt.gameId,
    receipt.amount, 'チーム口座', receipt.name, receipt.id, receipt.method,
  ]]);
  ensureFormula_(sheet, row, 11,
    '=IF(A' + row + '="","",IF(L' + row + '<>"完了",0,IF(C' + row + '="収入",IF(G' + row + '="チーム口座",F' + row + ',0),IF(C' + row + '="支出",IF(G' + row + '="チーム口座",-F' + row + ',0),IF(C' + row + '="立替精算",IF(G' + row + '="チーム口座",-F' + row + ',0),IF(C' + row + '="調整",F' + row + ',0))))))');
  sheet.getRange(row, 12).setValue(status === '有効' ? '完了' : '取消');
  sheet.getRange(row, 13).setValue('受領ID: ' + receipt.id + (receipt.memo ? ' / ' + receipt.memo : ''));
  return row;
}

function syncReceiptAccounting_(ss, receipt, status) {
  upsertReceiptTransaction_(ss, receipt, status);
  reconcileMemberInvoice_(ss, receipt.gameId, receipt.playerId);
}

function cancelReceiptAccounting_(ss, receipt) {
  upsertReceiptTransaction_(ss, receipt, '取消');
}

function reconcileMemberInvoice_(ss, gameId, playerId) {
  const row = findParticipantRow_(ss, gameId, playerId);
  if (!row) return;
  const master = resolveMasterPlayer_(getPlayerMasterRows_(), playerId);
  const name = master ? master.name : String(row[2] || '');
  const jerseyNumber = master ? master.jerseyNumber : '';
  const memberId = toFeeMemberId_(playerId);
  const charge = getParticipantCharge_(ss, row);
  upsertMemberInvoice_(ss, gameId, playerId, memberId, name, jerseyNumber, charge,
    getActiveReceiptTotal_(ss, gameId, playerId));
}

function findParticipantRow_(ss, gameId, playerId) {
  const rows = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][0]) === String(gameId) && String(rows[index][1]) === String(playerId)) {
      return rows[index];
    }
  }
  return null;
}

function ensureMatchAccountingRow_(ss, gameId) {
  const sheet = ss.getSheetByName(CONFIG.ACCOUNTING_GAMES);
  let row = findDataRow_(sheet, 1, gameId);
  if (row) return row;
  const game = getDataRowValues_(ss.getSheetByName(CONFIG.SHEET_GAMES), 1, gameId);
  if (!game) return 0;
  row = Math.max(2, findFirstEmptyRow_(sheet, 1));
  sheet.getRange(row, 1, 1, 4).setValues([[game[0], game[1], game[2], game[3]]]);
  ensureFormula_(sheet, row, 5, '=IF(A' + row + '<>"",3500,"")');
  ensureFormula_(sheet, row, 7, '=IF(A' + row + '="","",E' + row + '+F' + row + ')');
  ensureFormula_(sheet, row, 9, '=IF(A' + row + '="","",IFERROR(G' + row + '/H' + row + ',0))');
  ensureFormula_(sheet, row, 11, '=IF(A' + row + '="","",J' + row + '*H' + row + ')');
  ensureFormula_(sheet, row, 13, '=IF(A' + row + '="","",MAX(K' + row + '-L' + row + ',0))');
  ensureFormula_(sheet, row, 14,
    '=IF(A' + row + '="","",IF(OR(H' + row + '="",J' + row + '="",K' + row + '=0),"要入力",IF(L' + row + '>=K' + row + ',"完了",IF(L' + row + '>0,"一部回収","未徴収"))))');
  return row;
}

function reconcileMatchAccounting_(ss, gameId) {
  const row = ensureMatchAccountingRow_(ss, gameId);
  if (!row) return;
  const participants = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).getDataRange().getValues()
    .slice(1).filter((item) => String(item[0]) === String(gameId) && String(item[4]) === '対象');
  const received = ss.getSheetByName(CONFIG.SHEET_RECEIPTS).getDataRange().getValues()
    .slice(1).filter((item) => String(item[1]) === String(gameId) && String(item[7]) === '有効')
    .reduce((total, item) => total + Number(item[5] || 0), 0);
  const sheet = ss.getSheetByName(CONFIG.ACCOUNTING_GAMES);
  sheet.getRange(row, 8).setValue(participants.length);
  sheet.getRange(row, 12).setValue(received);
}

function reconcileAccounting_(ss) {
  const participants = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).getDataRange().getValues()
    .slice(1).filter((row) => row[0] && row[1]);
  const affectedGames = {};
  participants.forEach((row) => reconcileMemberInvoice_(ss, row[0], row[1]));
  participants.forEach((row) => { affectedGames[String(row[0])] = true; });
  const receipts = ss.getSheetByName(CONFIG.SHEET_RECEIPTS).getDataRange().getValues()
    .slice(1).filter((row) => row[0]);
  receipts.forEach((row) => {
    const receipt = receiptFromRow_(row);
    syncReceiptAccounting_(ss, receipt, receipt.status);
    affectedGames[receipt.gameId] = true;
  });
  Object.keys(affectedGames).forEach((gameId) => reconcileMatchAccounting_(ss, gameId));
}

function appendRows_(sheet, rows, width) {
  if (!rows.length) return;
  const start = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(start, 1, rows.length, width).setValues(rows);
}

function migrateLegacyFeeData_(target) {
  const source = SpreadsheetApp.openById(CONFIG.LEGACY_SPREADSHEET_ID);
  const sourceGames = source.getSheetByName('試合');
  const sourceParticipants = source.getSheetByName('参加者');
  const sourceReceipts = source.getSheetByName('受領履歴');
  if (!sourceGames || !sourceParticipants || !sourceReceipts) {
    throw new Error('旧集金台帳に必要なタブがありません。移行を中断しました。');
  }

  const gameSheet = target.getSheetByName(CONFIG.SHEET_GAMES);
  const participantSheet = target.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
  const receiptSheet = target.getSheetByName(CONFIG.SHEET_RECEIPTS);
  const oldGames = sourceGames.getDataRange().getValues().slice(1).filter((row) => row[0]);
  const oldParticipants = sourceParticipants.getDataRange().getValues().slice(1)
    .filter((row) => row[0] && row[1]);
  const oldReceipts = sourceReceipts.getDataRange().getValues().slice(1).filter((row) => row[0]);

  const newGames = filterLegacyRows_('game', oldGames, gameSheet.getDataRange().getValues().slice(1));
  const newParticipants = filterLegacyRows_('participant', oldParticipants,
    participantSheet.getDataRange().getValues().slice(1));
  const newReceipts = filterLegacyRows_('receipt', oldReceipts, receiptSheet.getDataRange().getValues().slice(1));

  appendRows_(gameSheet, newGames, FEE_HEADERS[CONFIG.SHEET_GAMES].length);
  appendRows_(participantSheet, newParticipants, FEE_HEADERS[CONFIG.SHEET_PARTICIPANTS].length);
  appendRows_(receiptSheet, newReceipts, FEE_HEADERS[CONFIG.SHEET_RECEIPTS].length);

  oldGames.forEach((game) => ensureMatchAccountingRow_(target, game[0]));
  oldParticipants.forEach((participant) => reconcileMemberInvoice_(target, participant[0], participant[1]));
  newReceipts.forEach((row) => {
    const receipt = receiptFromRow_(row);
    upsertReceiptTransaction_(target, receipt, receipt.status);
  });
  oldGames.forEach((game) => reconcileMatchAccounting_(target, game[0]));

  return {
    games: newGames.length,
    participants: newParticipants.length,
    receipts: newReceipts.length,
    skipped: (oldGames.length - newGames.length) + (oldParticipants.length - newParticipants.length) +
      (oldReceipts.length - newReceipts.length),
  };
}

function getGames_() {
  const ss = getSpreadsheet_();
  const accounting = ss.getSheetByName(CONFIG.ACCOUNTING_GAMES);
  const operations = ss.getSheetByName(CONFIG.SHEET_GAMES);
  if (!accounting) throw new Error('「試合会計」タブがありません。');
  if (!operations) throw new Error('「集金_試合」タブがありません。');
  return projectGames_(accounting.getDataRange().getValues(), operations.getDataRange().getValues())
    .map((game) => ({ ...game, date: formatCellDate_(game.date) }));
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
  const ss = getSpreadsheet_();
  const selected = games.find((game) => game.id === gameId) || null;
  if (!selected) {
    return {
      games,
      selectedGame: null,
      ledgerUrl: ss.getUrl(),
      participants: [],
      received: [],
      cancelled: [],
      summary: { participants: 0, expected: 0, received: 0, outstanding: 0 },
    };
  }

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
      const charge = getParticipantCharge_(ss, row);
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
        chargeConfigured: resolveGameCharge_(charge) !== null,
        receivedAmount,
        outstanding: charge ? Math.max(0, charge - receivedAmount) : 0,
        paid: Boolean(charge) && receivedAmount >= charge,
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
      acc.expected += player.charge || 0;
      acc.received += player.receivedAmount;
      acc.outstanding += player.outstanding;
      return acc;
    },
    { participants: 0, expected: 0, received: 0, outstanding: 0 }
  );

  return {
    games,
    selectedGame: selected,
    ledgerUrl: ss.getUrl(),
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
    fee: Number(row[3] || 0),
    target: String(row[4] || ''),
    charge: getParticipantCharge_(ss, row),
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

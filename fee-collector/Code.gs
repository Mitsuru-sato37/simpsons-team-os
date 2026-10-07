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
  BASE_PER_PERSON_CHARGE: 300,
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
  const games = getGames_();
  const selected = pickGame_(games, preferredGameId);
  return buildState_(games, selected ? selected.id : null);
}

function initializeFeeCollector() {
  const ss = getSpreadsheet_();
  ensureFeeCollectorSchema_(ss);
  syncPlayerMasterMembers_(ss);
  const migration = migrateLegacyFeeData_(ss);
  reconcileAccounting_(ss);
  SpreadsheetApp.flush();
  return migration;
}

function searchPlayers(query) {
  return searchMasterPlayers_(getPlayerMasterRows_(), query);
}

function previewRosterImport(payload) {
  if (!payload || !payload.gameId) throw new Error('対象試合を選択してください。');
  const ss = getSpreadsheet_();
  return buildRosterImportPreview_(ss, payload.gameId, payload.rosterText, payload.emergencyLineNumbers || []);
}

function buildRosterImportPreview_(ss, gameId, rosterText, emergencyLineNumbers) {
  const accounting = ss.getSheetByName(CONFIG.ACCOUNTING_GAMES);
  const operations = ss.getSheetByName(CONFIG.SHEET_GAMES);
  const participants = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
  const receipts = ss.getSheetByName(CONFIG.SHEET_RECEIPTS);
  const members = ss.getSheetByName(CONFIG.MEMBERS);
  if (!accounting || !operations || !participants || !receipts || !members) {
    throw new Error('集金に必要なシートがありません。管理者へ連絡してください。');
  }
  const accountingRows = accounting.getDataRange().getValues();
  const games = projectGames_(accountingRows, operations.getDataRange().getValues(), CONFIG.BASE_PER_PERSON_CHARGE);
  const game = games.find((item) => String(item.id) === String(gameId));
  if (!game) throw new Error('試合が見つかりません。');
  if (!isOpenGame_(game)) throw new Error('完了または中止した試合の参加者は変更できません。');
  const participantRows = participants.getDataRange().getValues().slice(1);
  const receiptRows = receipts.getDataRange().getValues().slice(1);
  const memberRows = members.getDataRange().getValues();
  return {
    ...buildRosterPreview_(game, parseRosterPaste_(rosterText), getPlayerMasterRows_(),
      participantRows, receiptRows, memberRows, emergencyLineNumbers),
    game: { id: game.id, date: game.date, opponent: game.opponent, location: game.location },
  };
}

function applyConfirmedRoster(payload) {
  if (!payload || !payload.gameId || !payload.previewFingerprint) {
    throw new Error('参加者リストを確認してから確定してください。');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    ensureFeeCollectorSchema_(ss);
    const preview = buildRosterImportPreview_(ss, payload.gameId, payload.rosterText, payload.emergencyLineNumbers || []);
    if (!preview.readyToConfirm) {
      if (preview.absences.some((item) => item.blocked)) {
        throw new Error('受領済みの選手は欠席にできません。先に受領取消を行ってください。');
      }
      throw new Error('未確定の選手があります。名前・背番号を確認してください。');
    }
    if (preview.previewFingerprint !== String(payload.previewFingerprint)) {
      if (!preview.additions.length && !preview.absences.length) {
        return { ok: true, alreadyApplied: true, gameId: String(payload.gameId), added: 0, absent: 0 };
      }
      throw new Error('プレビュー後に参加者または受領状況が変わりました。最新の内容を確認し直してください。');
    }

    const memberRows = ss.getSheetByName(CONFIG.MEMBERS).getDataRange().getValues();
    const participantSheet = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
    preview.absences.forEach((item) => {
      const rowNumber = findParticipantRowNumber_(ss, payload.gameId, item.playerId);
      if (!rowNumber) throw new Error('参加者行が見つかりません。最新の内容を確認してください。');
      const currentMemo = String(participantSheet.getRange(rowNumber, 9).getValue() || '');
      participantSheet.getRange(rowNumber, 4, 1, 6).setValues([[0, '欠席', 0, 0, 0,
        currentMemo ? currentMemo + ' / 出欠確認で欠席' : '出欠確認で欠席']]);
    });

    preview.additions.forEach((item) => {
      let playerId = String(item.playerId || '');
      if (item.emergency && !playerId) {
        const emergency = resolveEmergencyMemberId_(memberRows, item.name);
        if (emergency.status === 'ambiguous') throw new Error('緊急参戦者名が重複しています。メンバー一覧を確認してください。');
        playerId = emergency.status === 'matched'
          ? emergency.memberId
          : reserveEmergencyMemberId_(memberRows.slice(1), PropertiesService.getScriptProperties());
        ensureMemberSnapshot_(ss, playerId, item.name, '');
        memberRows.push([playerId, item.name]);
      }
      if (!playerId) throw new Error('参加者IDを確認できません。');
      const charge = getGameCharge_(ss, payload.gameId);
      const received = getActiveReceiptTotal_(ss, payload.gameId, playerId);
      const existingRow = findParticipantRowNumber_(ss, payload.gameId, playerId);
      const existingMemo = existingRow ? String(participantSheet.getRange(existingRow, 9).getValue() || '') : '';
      const values = [[charge || 0, '対象', charge || 0, received, Math.max((charge || 0) - received, 0),
        existingMemo ? existingMemo + ' / 出欠確認で参加' : '出欠確認で参加']];
      if (existingRow) participantSheet.getRange(existingRow, 4, 1, 6).setValues(values);
      else participantSheet.appendRow([payload.gameId, playerId, item.name, charge || 0, '対象', charge || 0,
        received, Math.max((charge || 0) - received, 0), '画像名簿から登録']);
    });

    const affectedIds = new Set([
      ...preview.absences.map((item) => item.playerId),
      ...preview.additions.map((item) => item.playerId || resolveEmergencyMemberId_(memberRows, item.name).memberId),
    ]);
    affectedIds.forEach((playerId) => reconcileMemberInvoice_(ss, payload.gameId, playerId));
    reconcileMatchAccounting_(ss, payload.gameId);
    SpreadsheetApp.flush();
    return {
      ok: true,
      gameId: String(payload.gameId),
      added: preview.additions.length,
      absent: preview.absences.length,
      state: buildState_(getGames_(), String(payload.gameId)),
    };
  } finally {
    lock.releaseLock();
  }
}

function addEmergencyParticipant(payload) {
  if (!payload || !payload.gameId || !String(payload.name || '').trim()) {
    throw new Error('試合と参加者名を入力してください。');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    ensureFeeCollectorSchema_(ss);
    const game = getGames_().find((item) => String(item.id) === String(payload.gameId));
    if (!game) throw new Error('試合が見つかりません。');
    if (!isOpenGame_(game)) throw new Error('完了または中止した試合には参加者を追加できません。');
    const name = String(payload.name).trim();
    const rosterMatch = matchRosterCandidate_({ jerseyNumber: '', name }, getPlayerMasterRows_());
    if (rosterMatch.status === 'matched') throw new Error('選手マスター登録者です。背番号か名前で検索して追加してください。');
    if (rosterMatch.status === 'ambiguous') throw new Error('選手マスターの名前が特定できません。背番号で検索してください。');
    const memberSheet = ss.getSheetByName(CONFIG.MEMBERS);
    const memberRows = memberSheet.getDataRange().getValues();
    const emergency = resolveEmergencyMemberId_(memberRows, name);
    if (emergency.status === 'ambiguous') throw new Error('同じ名前の緊急参戦者が複数います。');
    const playerId = emergency.status === 'matched'
      ? emergency.memberId
      : reserveEmergencyMemberId_(memberRows.slice(1), PropertiesService.getScriptProperties());
    ensureMemberSnapshot_(ss, playerId, name, '');
    const existingRow = findParticipantRowNumber_(ss, game.id, playerId);
    if (existingRow && String(ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).getRange(existingRow, 5).getValue()) === '対象') {
      throw new Error('この緊急参戦者はすでに登録されています。');
    }
    const charge = getGameCharge_(ss, game.id) || 0;
    const received = getActiveReceiptTotal_(ss, game.id, playerId);
    const participantSheet = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
    const currentMemo = existingRow ? String(participantSheet.getRange(existingRow, 9).getValue() || '') : '';
    if (existingRow) {
      participantSheet.getRange(existingRow, 4, 1, 6).setValues([[
        charge, '対象', charge, received, Math.max(charge - received, 0),
        currentMemo ? currentMemo + ' / 緊急参戦で再登録' : '緊急参戦で再登録',
      ]]);
    } else {
      participantSheet.appendRow([game.id, playerId, name, charge, '対象', charge, received,
        Math.max(charge - received, 0), '緊急参戦で登録']);
    }
    reconcileMemberInvoice_(ss, game.id, playerId);
    reconcileMatchAccounting_(ss, game.id);
    SpreadsheetApp.flush();
    return { ok: true, playerId, state: buildState_(getGames_(), game.id) };
  } finally {
    lock.releaseLock();
  }
}

function markParticipantAbsent(payload) {
  return setParticipantAttendance_(payload, false);
}

function restoreParticipantAttendance(payload) {
  return setParticipantAttendance_(payload, true);
}

function setParticipantAttendance_(payload, attending) {
  if (!payload || !payload.gameId || !payload.playerId) throw new Error('試合と参加者を指定してください。');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    ensureFeeCollectorSchema_(ss);
    const game = getGames_().find((item) => String(item.id) === String(payload.gameId));
    if (!game || !isOpenGame_(game)) throw new Error('完了または中止した試合の参加者は変更できません。');
    const rowNumber = findParticipantRowNumber_(ss, game.id, payload.playerId);
    if (!rowNumber) throw new Error('参加者が見つかりません。');
    const sheet = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS);
    const row = sheet.getRange(rowNumber, 1, 1, 9).getValues()[0];
    if (!attending && getActiveReceipts_(ss, game.id, payload.playerId).length) {
      throw new Error('受領済みの選手は欠席にできません。先に受領取消を行ってください。');
    }
    const charge = attending ? (getGameCharge_(ss, game.id) || 0) : 0;
    const received = attending ? getActiveReceiptTotal_(ss, game.id, payload.playerId) : 0;
    const memo = String(row[8] || '');
    sheet.getRange(rowNumber, 4, 1, 6).setValues([[
      charge, attending ? '対象' : '欠席', charge, received, Math.max(charge - received, 0),
      memo ? memo + (attending ? ' / 出席へ復帰' : ' / 当日欠席') : (attending ? '出席へ復帰' : '当日欠席'),
    ]]);
    reconcileMemberInvoice_(ss, game.id, payload.playerId);
    reconcileMatchAccounting_(ss, game.id);
    SpreadsheetApp.flush();
    return buildState_(getGames_(), game.id);
  } finally {
    lock.releaseLock();
  }
}

function findParticipantRowNumber_(ss, gameId, playerId) {
  const rows = ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][0]) === String(gameId) && String(rows[index][1]) === String(playerId)) return index + 1;
  }
  return 0;
}

function addParticipant(payload) {
  if (!payload || !payload.gameId || !payload.playerId) throw new Error('試合と選手を指定してください。');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    ensureFeeCollectorSchema_(ss);
    const game = getGames_().find((item) => item.id === String(payload.gameId));
    if (!game) throw new Error('試合が見つかりません。');
    if (!isOpenGame_(game)) throw new Error('完了または中止した試合には参加者を追加できません。');
    const player = resolveMasterPlayer_(getPlayerMasterRows_(), payload.playerId);
    if (!player) throw new Error('選手マスターに見つかりません。背番号か名前で検索し直してください。');
    if (findParticipantRow_(ss, game.id, player.playerId)) throw new Error('この試合にはすでに登録されています。');
    const charge = getGameCharge_(ss, game.id);
    ss.getSheetByName(CONFIG.SHEET_PARTICIPANTS).appendRow([
      game.id, player.playerId, player.name, charge || '', '対象', charge || '', 0, charge || '', 'アプリから登録',
    ]);
    reconcileMemberInvoice_(ss, game.id, player.playerId);
    reconcileMatchAccounting_(ss, game.id);
    SpreadsheetApp.flush();
    return buildState_(getGames_(), game.id);
  } finally {
    lock.releaseLock();
  }
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

function installMemberLookupTrigger() {
  const ss = getSpreadsheet_();
  const membersSheet = ss.getSheetByName(CONFIG.MEMBERS);
  membersSheet.getRange(2, 8, membersSheet.getMaxRows() - 1, 1).setNumberFormat('@');
  const installed = ScriptApp.getProjectTriggers().some((trigger) =>
    trigger.getHandlerFunction() === 'handleMemberRosterEdit' &&
    trigger.getTriggerSourceId() === CONFIG.SPREADSHEET_ID
  );
  if (installed) return 'メンバー照合トリガーは設定済みです。';

  ScriptApp.newTrigger('handleMemberRosterEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  return 'メンバー照合トリガーを設定しました。';
}

function handleMemberRosterEdit(e) {
  if (!e || !e.range || !e.source || e.source.getId() !== CONFIG.SPREADSHEET_ID) return;
  const range = e.range;
  const sheet = range.getSheet();
  const column = range.getColumn();
  if (sheet.getName() === CONFIG.MEMBER_INVOICES && column === 3 &&
      range.getNumColumns() === 1 && range.getLastRow() >= 2) {
    handleMemberInvoiceNameEdit_(e, range);
    return;
  }
  if (sheet.getName() !== CONFIG.MEMBERS || range.getNumColumns() !== 1 ||
      ![1, 2, 8].includes(column) || range.getLastRow() < 2) return;

  const field = column === 1 ? 'memberId' : column === 2 ? 'name' : 'jerseyNumber';
  const masterRows = getPlayerMasterRows_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let notFound = 0;
  let ambiguous = 0;
  let matched = 0;
  let manualNames = 0;

  try {
    for (let row = Math.max(2, range.getRow()); row <= range.getLastRow(); row += 1) {
      const editedCell = sheet.getRange(row, column);
      const input = String(editedCell.getDisplayValue() || '').trim();
      if (!input) continue;

      const result = resolveMemberLookup_(masterRows, field, input);
      if (result.status === 'matched') {
        sheet.getRange(row, 1, 1, 2).setValues([[result.memberId, result.name]]);
        sheet.getRange(row, 8).setValue(result.jerseyNumber);
        editedCell.clearNote();
        matched += 1;
        continue;
      }

      if (column !== 1) sheet.getRange(row, 1).clearContent();
      if (column !== 2) sheet.getRange(row, 2).clearContent();
      if (column !== 8) sheet.getRange(row, 8).clearContent();
      const manualName = column === 2 && result.status === 'not_found';
      editedCell.setNote(result.status === 'ambiguous'
        ? '同じ値に一致する選手が複数います。背番号など別の値で検索してください。'
        : manualName
          ? '選手マスター未登録の名前です。名前は保持され、会計IDと背番号は空欄です。緊急参戦者として利用できます。'
          : '選手マスターに一致する選手がありません。入力値を確認してください。');
      if (result.status === 'ambiguous') ambiguous += 1;
      else if (manualName) manualNames += 1;
      else notFound += 1;
    }
  } finally {
    lock.releaseLock();
  }

  if (ambiguous || notFound) {
    const message = ambiguous
      ? '同じ値に一致する選手が複数います。背番号など別の値で入力してください。'
      : '選手マスターに一致しません。入力値を確認してください。';
    e.source.toast(message, 'メンバー照合', 5);
  } else if (manualNames) {
    e.source.toast('名簿外の名前を保持しました。会計IDと背番号は未設定です。', '緊急参戦者', 5);
  } else if (matched) {
    e.source.toast('名前・背番号・メンバーIDを選手マスターから反映しました。', 'メンバー照合', 3);
  }
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
  return row ? (resolveGameCharge_(row[9]) || CONFIG.BASE_PER_PERSON_CHARGE) : null;
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
  const masterRows = getPlayerMasterRows_();
  const currentRows = sheet.getDataRange().getValues();
  const rowByMemberId = {};
  currentRows.slice(1).forEach((row, index) => {
    if (row[0]) rowByMemberId[String(row[0])] = index + 2;
  });
  const newMembers = [];
  masterRows.forEach((row) => {
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

function handleMemberInvoiceNameEdit_(e, range) {
  const invoiceSheet = range.getSheet();
  const memberSheet = e.source.getSheetByName(CONFIG.MEMBERS);
  if (!memberSheet) return;
  const masterRows = getPlayerMasterRows_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let assignedEmergency = 0;
  let matchedRoster = 0;

  try {
    let memberRows = memberSheet.getDataRange().getValues();
    for (let row = Math.max(2, range.getRow()); row <= range.getLastRow(); row += 1) {
      // App-generated invoices are maintained by the collector and must not be edited here.
      if (String(invoiceSheet.getRange(row, 1).getValue() || '').trim()) continue;
      const nameCell = invoiceSheet.getRange(row, 3);
      const input = String(nameCell.getDisplayValue() || '').trim();
      if (!input) {
        invoiceSheet.getRange(row, 2).clearContent();
        nameCell.clearNote();
        continue;
      }

      const rosterMatch = resolveMemberLookup_(masterRows, 'name', input);
      if (rosterMatch.status === 'matched') {
        invoiceSheet.getRange(row, 2).setValue(rosterMatch.memberId);
        nameCell.setValue(rosterMatch.name);
        nameCell.clearNote();
        matchedRoster += 1;
        continue;
      }
      if (rosterMatch.status === 'ambiguous') {
        invoiceSheet.getRange(row, 2).clearContent();
        nameCell.setNote('選手マスターに同じ名前が複数あります。選手マスターで確認してください。');
        continue;
      }

      const emergency = resolveEmergencyMemberId_(memberRows.slice(1), input);
      if (emergency.status === 'ambiguous') {
        invoiceSheet.getRange(row, 2).clearContent();
        nameCell.setNote('同じ名前の緊急参戦者が複数登録されています。会計メンバー一覧を確認してください。');
        continue;
      }
      if (emergency.status === 'new') {
        emergency.memberId = reserveEmergencyMemberId_(memberRows.slice(1), PropertiesService.getScriptProperties());
        ensureMemberSnapshot_(e.source, emergency.memberId, emergency.name, '');
        memberRows.push([emergency.memberId, emergency.name]);
        assignedEmergency += 1;
      }
      invoiceSheet.getRange(row, 2).setValue(emergency.memberId);
      nameCell.setValue(emergency.name);
      nameCell.setNote(emergency.status === 'new'
        ? '緊急参戦者として仮登録しました。会計IDは継続利用でき、背番号は未設定です。'
        : '緊急参戦者の既存会計IDを再利用しました。');
    }
  } finally {
    lock.releaseLock();
  }

  if (assignedEmergency) {
    e.source.toast('緊急参戦者に専用会計IDを付けました。', '仮登録', 5);
  } else if (matchedRoster) {
    e.source.toast('選手マスターの会計IDを反映しました。', 'メンバー照合', 3);
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
  const memberId = resolveFinanceMemberId_(ss, playerId);
  const attending = String(row[4]) === '対象';
  const charge = attending ? getParticipantCharge_(ss, row) : 0;
  upsertMemberInvoice_(ss, gameId, playerId, memberId, name, jerseyNumber, charge,
    attending ? getActiveReceiptTotal_(ss, gameId, playerId) : 0);
}

function resolveFinanceMemberId_(ss, playerId) {
  const rosterMemberId = toFeeMemberId_(playerId);
  if (rosterMemberId) return rosterMemberId;
  const emergencyId = String(playerId || '').trim();
  return /^E\d{3,}$/.test(emergencyId) && findDataRow_(ss.getSheetByName(CONFIG.MEMBERS), 1, emergencyId)
    ? emergencyId
    : null;
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
  const accountingRows = accounting.getDataRange().getValues();
  const defaultedRows = accountingRows.slice(1).map((sourceRow) => {
    const row = [...sourceRow];
    if (!row[0] || resolveGameCharge_(row[9]) !== null) return row;
    row[9] = CONFIG.BASE_PER_PERSON_CHARGE;
    return row;
  });
  const defaultsWereApplied = defaultedRows.some((row, index) => row[9] !== accountingRows[index + 1][9]);
  if (defaultsWereApplied) {
    accounting.getRange(2, 10, defaultedRows.length, 1)
      .setValues(defaultedRows.map((row) => [row[9]]));
  }
  return projectGames_(
    [accountingRows[0], ...defaultedRows],
    operations.getDataRange().getValues(),
    CONFIG.BASE_PER_PERSON_CHARGE
  )
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
      absentParticipants: [],
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
      const charge = resolveParticipantCharge_(selected.charge, row[5]);
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

  const absentParticipants = participantRows
    .filter((row) => String(row[0]) === selected.id && String(row[4]) === '欠席')
    .map((row) => {
      const masterPlayer = resolveMasterPlayer_(masterRows, row[1]);
      return {
        playerId: String(row[1]),
        name: masterPlayer ? masterPlayer.name : String(row[2] || ''),
        jerseyNumber: masterPlayer ? masterPlayer.jerseyNumber : '',
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
    absentParticipants,
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

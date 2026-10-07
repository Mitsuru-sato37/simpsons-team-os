import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const logicSource = readFileSync(new URL('../fee-collector/Logic.gs', import.meta.url), 'utf8');
const logicContext = {};
vm.runInNewContext(logicSource, logicContext);
const {
  isPaymentMethodAllowed_,
  pickNextOpenGame_,
  projectReceiptAccounting_,
  projectReceipts_,
  projectGames_,
  resolveGameCharge_,
  resolveParticipantCharge_,
  toFeeMemberId_,
  resolveEmergencyMemberId_,
  reserveEmergencyMemberId_,
  resolveMemberLookup_,
  resolveMasterPlayer_,
  searchMasterPlayers_,
  buildFeeInvoiceId_,
  filterLegacyRows_,
  parseRosterPaste_,
  normalizeRosterIdentity_,
  matchRosterCandidate_,
  buildRosterPreview_,
} = logicContext;
const codeGs = readFileSync(new URL('../fee-collector/Code.gs', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../fee-collector/Index.html', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../fee-collector/App.html', import.meta.url), 'utf8');
const stylesHtml = readFileSync(new URL('../fee-collector/Styles.html', import.meta.url), 'utf8');
const documentation = [
  readFileSync(new URL('../README.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../docs/PROJECT_CONTEXT.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../docs/PROGRESS.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../fee-collector/README.md', import.meta.url), 'utf8'),
].join('\n');

function simulateMemberEdit(column, value, masterRows) {
  const cells = new Map([[`${2}:${column}`, String(value)]]);
  const notes = new Map();
  const toasts = [];
  const sheet = {
    getName: () => 'メンバー',
    getRange(row, col, rowCount, columnCount) {
      if (rowCount && columnCount) {
        return { setValues: (values) => values.forEach((line, rowOffset) => line.forEach((item, colOffset) => {
          cells.set(`${row + rowOffset}:${col + colOffset}`, item);
        })) };
      }
      const key = `${row}:${col}`;
      return {
        getDisplayValue: () => cells.get(key) || '',
        setValue: (item) => cells.set(key, item),
        clearContent: () => cells.set(key, ''),
        clearNote: () => notes.delete(key),
        setNote: (note) => notes.set(key, note),
      };
    },
  };
  const source = { getId: () => '1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ', toast: (...args) => toasts.push(args) };
  const context = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => masterRows }) }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };
  vm.runInNewContext(`${logicSource}\n${codeGs}`, context);
  context.handleMemberRosterEdit({
    source,
    range: { getSheet: () => sheet, getColumn: () => column, getNumColumns: () => 1, getRow: () => 2, getLastRow: () => 2 },
  });
  return { cells, notes, toasts };
}

function simulateTriggerInstall(existingTrigger) {
  const created = [];
  const formats = [];
  const ss = {
    getSheetByName: () => ({
      getMaxRows: () => 1000,
      getRange: (...args) => ({ setNumberFormat: (format) => formats.push([args, format]) }),
    }),
  };
  const context = {
    SpreadsheetApp: { openById: () => ss },
    ScriptApp: {
      getProjectTriggers: () => existingTrigger ? [{
        getHandlerFunction: () => 'handleMemberRosterEdit',
        getTriggerSourceId: () => '1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ',
      }] : [],
      newTrigger: (handler) => ({
        forSpreadsheet: () => ({
          onEdit: () => ({ create: () => created.push(handler) }),
        }),
      }),
    },
  };
  vm.runInNewContext(`${logicSource}\n${codeGs}`, context);
  return { result: context.installMemberLookupTrigger(), created, formats };
}

function createRosterSheet(rows) {
  const values = rows.map((row) => [...row]);
  const formulas = new Map();
  const ensure = (row, column) => {
    while (values.length < row) values.push([]);
    while (values[row - 1].length < column) values[row - 1].push('');
  };
  return {
    values,
    getLastRow: () => values.length,
    getMaxRows: () => 1000,
    getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
    appendRow(row) { values.push([...row]); },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getValues() {
          return Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, colOffset) =>
              values[row + rowOffset - 1]?.[column + colOffset - 1] ?? ''
            )
          );
        },
        getValue() { return values[row - 1]?.[column - 1] ?? ''; },
        getDisplayValue() { return String(values[row - 1]?.[column - 1] ?? ''); },
        getFormula() { return formulas.get(`${row}:${column}`) || ''; },
        setValue(value) { ensure(row, column); values[row - 1][column - 1] = value; },
        setValues(rowsToSet) {
          rowsToSet.forEach((line, rowOffset) => line.forEach((value, colOffset) => {
            ensure(row + rowOffset, column + colOffset);
            values[row + rowOffset - 1][column + colOffset - 1] = value;
          }));
        },
        setFormula(value) { formulas.set(`${row}:${column}`, value); },
      };
    },
  };
}

function createRosterApiFixture({ participants, receipts, members } = {}) {
  const make = (headers, rows = []) => createRosterSheet([headers, ...rows]);
  const sheets = new Map([
    ['試合会計', make(['試合ID', '日付', '対戦相手', '場所', '費用', 'その他', '合計', '人数', '徴収額', '実徴収額/人'], [
      ['G1', '2026/10/07', 'Opponent', 'Venue', 0, 0, 0, 0, 0, 300],
    ])],
    ['集金_試合', make(['試合ID', '日付', '対戦相手', '場所', '集合時刻', '試合時刻', 'グラウンド費', '状態', 'メモ'], [
      ['G1', '2026/10/07', 'Opponent', 'Venue', '', '', 0, '予定', ''],
    ])],
    ['集金_参加者', make(['試合ID', '選手ID', '選手名', '参加費', '対象', '請求額', '受領額', '残額', 'メモ'], participants || [])],
    ['集金_受領履歴', make(['受領ID', '試合ID', '選手ID', '選手名', '受領日時', '金額', '支払方法', '状態', 'メモ'], receipts || [])],
    ['メンバー', make(['メンバーID', '名前', '区分', '会費', '入金額', '未払い額', '状態', '背番号'], members || [])],
    ['メンバー請求', make(['請求ID', 'メンバーID', '名前', '種類', '関連ID', '請求日', '請求額', '入金額（請求管理用）', '未払い額', '状態', '最終入金日'])],
    ['取引台帳', make(['取引ID', '日付', '種別', 'カテゴリ', '内容', '金額', '口座', '対象者', '関連ID', '方法', '集計額', '状態', 'メモ'])],
  ]);
  const target = {
    getSheetByName: (name) => sheets.get(name) || null,
    getUrl: () => 'https://docs.google.com/spreadsheets/d/accounting/edit',
    setSpreadsheetTimeZone() {},
  };
  const masterSheet = make(['選手ID', '背番号', '氏名', '表示名'], [
    ['001', '23', '渡部 琉斗', '渡部琉斗'],
    ['002', '4', '渡邉 匠', '渡邉'],
  ]);
  const master = { getSheetByName: (name) => name === '選手マスター' ? masterSheet : null };
  const properties = new Map();
  const context = {
    SpreadsheetApp: {
      openById: (id) => id === '1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4' ? master : target,
      flush() {},
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value),
    }) },
    Utilities: { formatDate: (date) => String(date), getUuid: () => 'uuid-test' },
  };
  vm.runInNewContext(`${logicSource}\n${codeGs}`, context);
  return { context, sheets, masterSheet };
}

function simulateInvoiceNameEdit(invoiceName, memberRows, masterRows, invoiceIds = ['', ''], invoiceNames = [invoiceName, invoiceName], invoiceMemberIds = ['', '']) {
  const makeSheet = (name, initialRows) => {
    const values = initialRows.map((row) => [...row]);
    const notes = new Map();
    const ensure = (row, column) => {
      while (values.length < row) values.push([]);
      while (values[row - 1].length < column) values[row - 1].push('');
    };
    return {
      values,
      getName: () => name,
      getLastRow: () => values.length,
      getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
      getRange(row, column, rowCount = 1, columnCount = 1) {
        return {
          getValue: () => values[row - 1]?.[column - 1] || '',
          getDisplayValue: () => String(values[row - 1]?.[column - 1] || ''),
          setValue(value) { ensure(row, column); values[row - 1][column - 1] = value; },
          clearContent() { ensure(row, column); values[row - 1][column - 1] = ''; },
          setValues(rows) {
            rows.forEach((line, r) => line.forEach((value, c) => {
              ensure(row + r, column + c);
              values[row + r - 1][column + c - 1] = value;
            }));
          },
          clearNote() { notes.delete(`${row}:${column}`); },
          setNote(value) { notes.set(`${row}:${column}`, value); },
        };
      },
    };
  };
  const invoices = makeSheet('メンバー請求', [
    ['請求ID', 'メンバーID', '名前'],
    [invoiceIds[0], invoiceMemberIds[0], invoiceNames[0]],
    [invoiceIds[1], invoiceMemberIds[1], invoiceNames[1]],
  ]);
  const members = makeSheet('メンバー', [['メンバーID', '名前'], ...memberRows]);
  const source = {
    getId: () => '1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ',
    getSheetByName: (name) => name === 'メンバー請求' ? invoices : members,
    toast() {},
  };
  const propertyValues = new Map();
  const context = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => masterRows }) }) }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => propertyValues.get(key) || null,
      setProperty: (key, value) => propertyValues.set(key, value),
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };
  vm.runInNewContext(`${logicSource}\n${codeGs}`, context);
  [2, 3].forEach((row) => context.handleMemberRosterEdit({
    source,
    range: { getSheet: () => invoices, getColumn: () => 3, getNumColumns: () => 1, getRow: () => row, getLastRow: () => row },
  }));
  return { invoices, members };
}

const games = [
  { id: 'G1', status: '完了' },
  { id: 'G2', status: '予定' },
  { id: 'G3', status: '予定' },
  { id: 'G4', status: '中止' },
];

test('searches players by jersey number or partial name without exposing internal IDs in labels', () => {
  const results = searchMasterPlayers_([
    ['P023', '23', '渡部 琉斗'],
    ['P004', '4', '佐藤 太郎'],
  ], '23');
  assert.equal(results.length, 1);
  assert.deepEqual({ jerseyNumber: results[0].jerseyNumber, name: results[0].name },
    { jerseyNumber: '23', name: '渡部 琉斗' });
  assert.equal(searchMasterPlayers_([['P023', '23', '渡部 琉斗']], '渡部')[0].name, '渡部 琉斗');
});

test('participant picker is present and submits selected master player to the server', () => {
  assert.match(indexHtml, /playerSearch/);
  assert.match(appHtml, /\.searchPlayers\(/);
  assert.match(appHtml, /\.addParticipant\(/);
  assert.match(codeGs, /function addParticipant\(/);
});

test('selects the first open game after the completed game', () => {
  assert.equal(pickNextOpenGame_(games, 'G2').id, 'G3');
});

test('falls back to the first open game', () => {
  assert.equal(pickNextOpenGame_(games, 'G3').id, 'G2');
  assert.equal(pickNextOpenGame_(games, 'missing').id, 'G2');
});

test('separates cancelled receipts', () => {
  const result = projectReceipts_([
    ['R1', 'G2', 'P1', '選手A', '2026/10/18 08:00', 300, '現金', '有効', ''],
    ['R2', 'G2', 'P2', '選手B', '2026/10/18 08:01', 300, 'PayPay', '取消', '画面から取消'],
  ], 'G2');

  assert.equal(result.active.length, 1);
  assert.equal(result.cancelled.length, 1);
  assert.equal(result.cancelled[0].status, '取消');
  assert.equal(result.byPlayer.P1.length, 1);
  assert.equal(result.byPlayer.P2.length, 1);
});

test('does not project active amount above the source row amount', () => {
  const result = projectReceipts_([
    ['R1', 'G2', 'P1', '選手A', '2026/10/18 08:00', 300, '現金', '有効', ''],
  ], 'G2');

  assert.equal(result.byPlayer.P1[0].amount, 300);
});

test('backend delegates receipt projection and returns cancelled state', () => {
  assert.match(codeGs, /projectReceipts_\(/);
  assert.match(codeGs, /cancelled:/);
});

test('game completion uses a script lock and next-open selection', () => {
  const completeGame = codeGs.slice(codeGs.indexOf('function completeGame'));
  assert.match(completeGame, /LockService\.getScriptLock\(\)/);
  assert.match(completeGame, /pickNextOpenGame_\(/);
});

test('payment path keeps the active-receipt recheck', () => {
  const recordPayment = codeGs.slice(
    codeGs.indexOf('function recordPayment'),
    codeGs.indexOf('function cancelReceipt')
  );
  assert.match(recordPayment, /getActiveReceipts_\(/);
  assert.match(recordPayment, /ALREADY_PAID/);
});

test('accepts bank transfer as a manual payment method', () => {
  assert.equal(isPaymentMethodAllowed_('銀行振込'), true);
  assert.equal(isPaymentMethodAllowed_('unknown'), false);
});

test('uses a larger full-width layout and touch targets on narrow screens', () => {
  assert.match(stylesHtml, /@media\s*\(max-width:\s*559px\)/);
  assert.match(stylesHtml, /\.shell\s*\{[^}]*width:\s*100%/s);
  assert.match(stylesHtml, /\.shell\s*\{[^}]*padding:\s*16px\s+12px/s);
  assert.match(stylesHtml, /\.primary-button,\s*\.cash-button,[^}]*min-height:\s*56px/s);
  assert.match(stylesHtml, /\.game-meta[^}]*font-size:\s*16px/s);
});

test('adapts touch sizing when the embedded viewport is wider than the phone', () => {
  assert.match(stylesHtml, /@media\s*\(max-width:\s*1024px\)\s*and\s*\(pointer:\s*coarse\)/);
  assert.match(stylesHtml, /font-size:\s*4\.5vw/);
  assert.match(stylesHtml, /min-height:\s*14vw/);
});

test('resolves legacy participant IDs through the player master', () => {
  const player = resolveMasterPlayer_([
    ['001', '23', '渡部 琉斗'],
    ['002', '4', '渡邉 匠'],
  ], 'P001');

  assert.equal(player.playerId, '001');
  assert.equal(player.jerseyNumber, '23');
  assert.equal(player.name, '渡部 琉斗');
});

test('UI exposes cancelled receipt history', () => {
  assert.match(indexHtml, /cancelledList/);
  assert.match(indexHtml, /取消履歴/);
  assert.match(appHtml, /state\.data\.cancelled/);
  assert.match(appHtml, /PayPay確認/);
  assert.match(appHtml, /受領票を表示/);
  assert.match(appHtml, /取り消す/);
});

test('UI labels cash collection with the full current outstanding balance', () => {
  assert.match(appHtml, /現金' \+ escapeHtml\(String\(player\.outstanding\)\) \+ '円/);
});

test('UI exposes a manual bank transfer confirmation action', () => {
  assert.match(appHtml, /data-method="銀行振込"/);
  assert.match(appHtml, /銀行振込確認/);
});

test('UI displays the jersey number from the player master', () => {
  assert.match(appHtml, /player\.jerseyNumber/);
  assert.match(appHtml, /player\.name/);
});

test('Apps Script config points to the native player master spreadsheet', () => {
  assert.match(codeGs, /PLAYER_MASTER_SPREADSHEET_ID/);
  assert.match(codeGs, /1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4/);
});

test('completed and cancelled games cannot be completed again', () => {
  assert.match(appHtml, /selectedGame\.status === '完了' \|\| selectedGame\.status === '中止'/);
  assert.match(codeGs, /\['完了', '中止'\]\.includes\(status\)/);
});

test('documentation names the current repository and spreadsheet contract', () => {
  assert.match(documentation, /simpsons-team-os/);
  assert.match(documentation, /1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E/);
  assert.match(documentation, /試合/);
  assert.match(documentation, /参加者/);
  assert.match(documentation, /受領履歴/);
  assert.match(documentation, /取消/);
  assert.match(documentation, /現金/);
  assert.match(documentation, /PayPay/);
  assert.match(documentation, /codex\/fee-collector/);
});

test('Apps Script helper uses the deployable .gs extension', () => {
  assert.equal(existsSync(new URL('../fee-collector/Logic.gs', import.meta.url)), true);
  assert.match(documentation, /Logic\.gs/);
});

test('configured game charge is accepted and missing or invalid charge has no fallback', () => {
  assert.equal(resolveGameCharge_(450), 450);
  assert.equal(resolveGameCharge_('1250'), 1250);
  assert.equal(resolveGameCharge_(0), null);
  assert.equal(resolveGameCharge_(''), null);
  assert.equal(resolveGameCharge_('not-money'), null);
});

test('match accounting charge overrides a historical participant charge, with history fallback only', () => {
  assert.equal(resolveParticipantCharge_(650, 300), 650);
  assert.equal(resolveParticipantCharge_(null, 300), 300);
  assert.equal(resolveParticipantCharge_(null, ''), null);
});

test('maps roster IDs to internal finance IDs and leaves unsupported IDs unmapped', () => {
  assert.equal(toFeeMemberId_('P001'), 'M001');
  assert.equal(toFeeMemberId_('040'), 'M040');
  assert.equal(toFeeMemberId_('051'), null);
  assert.equal(toFeeMemberId_('custom-player'), null);
});

test('finance member snapshots retain the player name and jersey number for human lookup', () => {
  assert.match(codeGs, /ensureMemberSnapshot_\(ss, memberId, name, jerseyNumber\)/);
  assert.match(codeGs, /sheet\.getRange\(row, 8\)\.setValue\(jerseyNumber\)/);
  assert.match(codeGs, /sheet\.getRange\(row, 3\)\.setValue\(name\)/);
  assert.match(codeGs, /syncPlayerMasterMembers_\(ss\)/);
});

test('member lookup fills the finance identity from a unique master name or jersey number', () => {
  const roster = [
    ['001', '23', '渡部 琉斗'],
    ['002', '4', '渡邉 匠'],
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'name', '渡部 琉斗'))), {
    status: 'matched', playerId: '001', memberId: 'M001', name: '渡部 琉斗', jerseyNumber: '23',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'name', '渡部琉斗'))), {
    status: 'matched', playerId: '001', memberId: 'M001', name: '渡部 琉斗', jerseyNumber: '23',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'jerseyNumber', '4'))), {
    status: 'matched', playerId: '002', memberId: 'M002', name: '渡邉 匠', jerseyNumber: '4',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'memberId', 'M002'))), {
    status: 'matched', playerId: '002', memberId: 'M002', name: '渡邉 匠', jerseyNumber: '4',
  });
});

test('member lookup refuses missing or ambiguous names and jersey numbers', () => {
  const roster = [
    ['001', '23', '佐藤 太郎'],
    ['002', '7', '別人'],
    ['003', '23', '佐藤 太郎'],
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'name', '佐藤 太郎'))), { status: 'ambiguous' });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'jerseyNumber', '23'))), { status: 'ambiguous' });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveMemberLookup_(roster, 'name', '不在'))), { status: 'not_found' });
});

test('finance member edits use an installed trigger and resolve IDs, names, and jersey numbers', () => {
  assert.match(codeGs, /function installMemberLookupTrigger\(\)/);
  assert.match(codeGs, /getRange\(2, 8, membersSheet\.getMaxRows\(\) - 1, 1\)\.setNumberFormat\('@'\)/);
  assert.match(codeGs, /ScriptApp\.newTrigger\('handleMemberRosterEdit'\)/);
  assert.match(codeGs, /function handleMemberRosterEdit\(e\)/);
  assert.match(codeGs, /resolveMemberLookup_\(/);
});

test('trigger installation is idempotent and preserves jersey numbers as text', () => {
  const first = simulateTriggerInstall(false);
  assert.deepEqual(first.created, ['handleMemberRosterEdit']);
  assert.equal(first.formats[0][1], '@');
  assert.match(first.result, /設定しました/);

  const existing = simulateTriggerInstall(true);
  assert.deepEqual(existing.created, []);
  assert.match(existing.result, /設定済み/);
});

test('editing a name or jersey number fills all three finance identity fields from the master', () => {
  const master = [['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'], ['002', '00', '河野 聖人']];
  const byName = simulateMemberEdit(2, '渡部 琉斗', master);
  assert.equal(byName.cells.get('2:1'), 'M001');
  assert.equal(byName.cells.get('2:2'), '渡部 琉斗');
  assert.equal(byName.cells.get('2:8'), '23');

  const byJersey = simulateMemberEdit(8, '00', master);
  assert.equal(byJersey.cells.get('2:1'), 'M002');
  assert.equal(byJersey.cells.get('2:2'), '河野 聖人');
  assert.equal(byJersey.cells.get('2:8'), '00');
});

test('manual emergency names stay visible without inventing an ID or jersey number', () => {
  const result = simulateMemberEdit(2, '緊急参戦者', [['001', '23', '渡部 琉斗']]);
  assert.equal(result.cells.get('2:2'), '緊急参戦者');
  assert.equal(result.cells.get('2:1'), '');
  assert.equal(result.cells.get('2:8'), '');
  assert.match(result.notes.get('2:2'), /緊急参戦/);
});

test('emergency members receive a stable E ID and the next unused E ID', () => {
  const existing = [
    ['M001', '渡部 琉斗'],
    ['E001', '緊急参戦者'],
    ['E003', '別の緊急参戦者'],
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(resolveEmergencyMemberId_(existing, '緊急参戦者'))), {
    status: 'matched', memberId: 'E001', name: '緊急参戦者',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resolveEmergencyMemberId_(existing, '新しい緊急参戦者'))), {
    status: 'new', memberId: 'E004', name: '新しい緊急参戦者',
  });
});

test('emergency ID allocation never reuses IDs recorded by the persistent counter', () => {
  const state = { next: '5' };
  const properties = {
    getProperty: () => state.next,
    setProperty: (_key, value) => { state.next = value; },
  };
  assert.equal(reserveEmergencyMemberId_([['E001', '以前の臨時参加者']], properties), 'E005');
  assert.equal(state.next, '6');
});

test('typing a new emergency name in an empty invoice row creates one reusable member ID', () => {
  const result = simulateInvoiceNameEdit('緊急参戦者', [['M001', '渡部 琉斗']], [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'],
  ]);
  assert.equal(result.invoices.values[1][1], 'E001');
  assert.equal(result.invoices.values[2][1], 'E001');
  assert.ok(result.members.values.some((row) => row[0] === 'E001' && row[1] === '緊急参戦者'));
});

test('choosing a roster name fills its M ID but never overwrites an app-generated invoice', () => {
  const result = simulateInvoiceNameEdit('渡部 琉斗', [['M001', '渡部 琉斗']], [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'],
  ], ['APP-GENERATED', '']);
  assert.equal(result.invoices.values[1][1], '');
  assert.equal(result.invoices.values[2][1], 'M001');
  assert.equal(result.members.values.some((row) => String(row[0]).startsWith('E')), false);
});

test('clearing a manual invoice name also clears its old member ID', () => {
  const result = simulateInvoiceNameEdit('', [['M001', '渡部 琉斗']], [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'],
  ], ['', ''], ['', ''], ['', 'M001']);
  assert.equal(result.invoices.values[2][1], '');
});

test('fee invoice key is stable for the same game and player', () => {
  assert.equal(buildFeeInvoiceId_('G1', 'P002'), buildFeeInvoiceId_('G1', 'P002'));
  assert.notEqual(buildFeeInvoiceId_('G1', 'P002'), buildFeeInvoiceId_('G2', 'P002'));
  assert.notEqual(buildFeeInvoiceId_('G1', 'P002'), buildFeeInvoiceId_('G1', 'P003'));
});

test('accounting projection totals active receipt IDs once and ignores cancelled receipts', () => {
  const result = projectReceiptAccounting_([
    ['R1', 'G1', 'P1', 'Player', '2026/10/07 12:00', 450, '現金', '有効', ''],
    ['R1', 'G1', 'P1', 'Player', '2026/10/07 12:00', 450, '現金', '有効', 'duplicate'],
    ['R2', 'G1', 'P1', 'Player', '2026/10/07 12:01', 100, 'PayPay', '取消', ''],
    ['R3', 'G1', 'P2', 'Another', '2026/10/07 12:02', 300, '現金', '有効', ''],
  ], 'G1');

  assert.equal(result.active.length, 2);
  assert.equal(result.cancelled.length, 1);
  assert.equal(result.activeTotalByPlayer.P1, 450);
  assert.equal(result.activeTotalByPlayer.P2, 300);
});

test('fee collector points to Simpsons会計, keeps its six accounting tabs, and adds app tabs', () => {
  assert.match(codeGs, /SPREADSHEET_ID:\s*'1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ'/);
  for (const title of ['集金_試合', '集金_参加者', '集金_受領履歴']) {
    assert.ok(codeGs.includes(title), `expected schema to include ${title}`);
  }
  assert.match(codeGs, /実徴収額\/人/);
  assert.match(codeGs, /PLAYER_MASTER_SPREADSHEET_ID/);
});

test('payments use only the outstanding balance and synchronize accounting projections', () => {
  const recordPayment = codeGs.slice(
    codeGs.indexOf('function recordPayment'),
    codeGs.indexOf('function cancelReceipt')
  );
  assert.match(recordPayment, /resolveGameCharge_\(/);
  assert.match(recordPayment, /const amount = outstanding/);
  assert.match(recordPayment, /syncReceiptAccounting_\(/);
  assert.match(codeGs, /BASE_PER_PERSON_CHARGE:\s*300/);
});

test('cancellation retains the receipt and reverses its linked financial projections', () => {
  const cancelReceipt = codeGs.slice(
    codeGs.indexOf('function cancelReceipt'),
    codeGs.indexOf('function completeGame')
  );
  assert.match(cancelReceipt, /setValue\('取消'\)/);
  assert.match(cancelReceipt, /cancelReceiptAccounting_\(/);
  assert.match(cancelReceipt, /setValue\('取消'\)/);
  assert.doesNotMatch(cancelReceipt, /deleteRow\(/);
});

test('the app applies a 300-yen default while preserving match-specific overrides', () => {
  assert.match(codeGs, /resolveGameCharge_\(row\[9\]\) \|\| CONFIG\.BASE_PER_PERSON_CHARGE/);
  assert.match(codeGs, /row\[9\] = CONFIG\.BASE_PER_PERSON_CHARGE/);
  assert.match(codeGs, /chargeConfigured:\s*resolveGameCharge_\(charge\) !== null/);
});

test('legacy migration uses stable keys and skips rows already copied or repeated in source', () => {
  const result = filterLegacyRows_('participant', [
    ['G1', 'P001', 'Player', 300, '対象', 450, 0, 450, ''],
    ['G1', 'P001', 'Player duplicate', 300, '対象', 450, 0, 450, ''],
    ['G1', 'P002', 'Other', 300, '対象', 450, 0, 450, ''],
    ['', '', '', '', '', '', '', '', ''],
  ], [
    ['G1', 'P001', 'Player', 300, '対象', 450, 0, 450, ''],
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0][1], 'P002');
});

test('games listed in 試合会計 appear in the collector with operational status when available', () => {
  const games = projectGames_([
    ['試合ID', '日付', '対戦相手', 'グラウンド'],
    ['G1', '2026/10/10', 'Tigers', '球場A'],
    ['G2', '2026/10/11', 'Bears', '球場B'],
  ], [
    ['試合ID', '日付', '対戦相手', '場所', '集合時刻', '試合時刻', 'グラウンド費', '状態', 'メモ'],
    ['G1', '2026/10/10', 'Tigers', '球場A', '08:00', '09:00', 0, '完了', 'note'],
  ]);

  assert.deepEqual(games.map((game) => [game.id, game.status]), [['G1', '完了'], ['G2', '予定']]);
  assert.equal(games[1].location, '球場B');
});

test('copy-ready roster lines preserve jersey, full name, and uncertainty', () => {
  assert.equal(typeof parseRosterPaste_, 'function');
  assert.deepEqual(JSON.parse(JSON.stringify(parseRosterPaste_('#23 渡部 琉斗\n00\t河野 聖人\n? 4 渡邉 匠'))), [
    { lineNumber: 1, jerseyNumber: '23', name: '渡部 琉斗', uncertain: false },
    { lineNumber: 2, jerseyNumber: '00', name: '河野 聖人', uncertain: false },
    { lineNumber: 3, jerseyNumber: '4', name: '渡邉 匠', uncertain: true },
  ]);
});

test('roster identity normalization ignores whitespace', () => {
  assert.equal(typeof normalizeRosterIdentity_, 'function');
  assert.equal(normalizeRosterIdentity_(' 渡部　琉斗 '), '渡部琉斗');
});

test('roster candidate matches by both jersey and full name', () => {
  assert.equal(typeof matchRosterCandidate_, 'function');
  const result = matchRosterCandidate_({ jerseyNumber: '23', name: '渡部琉斗' }, [
    ['選手ID', '背番号', '氏名', '表示名'],
    ['001', '23', '渡部 琉斗', '渡部琉斗'],
    ['023', '4', '渡邉 匠', '渡邉'],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: 'matched', playerId: '001', jerseyNumber: '23', name: '渡部 琉斗',
  });
});

test('conflicting name and jersey stays unresolved', () => {
  assert.equal(typeof matchRosterCandidate_, 'function');
  const result = matchRosterCandidate_({ jerseyNumber: '4', name: '渡部琉斗' }, [
    ['選手ID', '背番号', '氏名', '表示名'],
    ['001', '23', '渡部 琉斗', '渡部琉斗'],
    ['002', '4', '渡邉 匠', '渡邉'],
  ]);
  assert.equal(result.status, 'conflict');
});

test('ambiguous roster names and duplicate master jerseys are not guessed', () => {
  assert.equal(typeof matchRosterCandidate_, 'function');
  const duplicateNames = matchRosterCandidate_({ jerseyNumber: '', name: '渡部' }, [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'], ['017', '13', '渡部 瑶士'],
  ]);
  assert.equal(duplicateNames.status, 'ambiguous');
  const duplicateJerseys = matchRosterCandidate_({ jerseyNumber: '23', name: '' }, [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'], ['041', '23', '別の選手'],
  ]);
  assert.equal(duplicateJerseys.status, 'ambiguous');
});

test('roster preview proposes additions and absences for the selected game', () => {
  assert.equal(typeof buildRosterPreview_, 'function');
  const preview = buildRosterPreview_(
    { id: 'G1', status: '予定' },
    [{ jerseyNumber: '4', name: '渡邉 匠', uncertain: false }],
    [['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'], ['002', '4', '渡邉 匠']],
    [['G1', '001', '渡部 琉斗', 300, '対象', 300, 0, 300, '']],
    []
  );
  assert.deepEqual(JSON.parse(JSON.stringify(preview.additions)), [
    { playerId: '002', jerseyNumber: '4', name: '渡邉 匠' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.absences)), [
    { playerId: '001', name: '渡部 琉斗', blocked: false },
  ]);
  assert.equal(preview.readyToConfirm, true);
});

test('roster preview blocks absent players who have an active receipt and does not mutate inputs', () => {
  assert.equal(typeof buildRosterPreview_, 'function');
  const participants = [['G1', '001', '渡部 琉斗', 300, '対象', 300, 300, 0, '']];
  const receipts = [['R1', 'G1', '001', '渡部 琉斗', '2026/10/07', 300, '現金', '有効', '']];
  const before = JSON.stringify([participants, receipts]);
  const preview = buildRosterPreview_(
    { id: 'G1', status: '予定' }, [],
    [['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗']], participants, receipts
  );
  assert.deepEqual(JSON.parse(JSON.stringify(preview.absences)), [
    { playerId: '001', name: '渡部 琉斗', blocked: true },
  ]);
  assert.equal(preview.readyToConfirm, false);
  assert.equal(JSON.stringify([participants, receipts]), before);
});

test('roster import resolves an existing emergency member by name without a jersey', () => {
  const result = matchRosterCandidate_({ jerseyNumber: '', name: '緊急参加者' }, [
    ['選手ID', '背番号', '氏名'], ['001', '23', '渡部 琉斗'],
  ], [
    ['メンバーID', '名前'], ['E003', '緊急 参加者'],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: 'matched', playerId: 'E003', jerseyNumber: '', name: '緊急 参加者', emergency: true,
  });
});

test('roster import accepts player master data rows without a header row', () => {
  const result = matchRosterCandidate_({ jerseyNumber: '23', name: '渡部琉斗' }, [
    ['001', '23', '渡部 琉斗', '渡部琉斗'],
  ]);
  assert.equal(result.status, 'matched');
  assert.equal(result.playerId, '001');
});

test('empty pasted roster cannot confirm an absence proposal', () => {
  const preview = buildRosterPreview_(
    { id: 'G1', status: '予定' }, [], [['選手ID', '背番号', '氏名']],
    [['G1', '001', '渡部 琉斗', 300, '対象', 300, 0, 300, '']], [],
    [['メンバーID', '名前']]
  );
  assert.equal(preview.readyToConfirm, false);
});

test('roster preview includes an unmatched name only after explicit emergency selection', () => {
  const args = [
    { id: 'G1', status: '予定' },
    [{ lineNumber: 1, jerseyNumber: '', name: '臨時参加者', uncertain: false }],
    [['選手ID', '背番号', '氏名']], [], [], [['メンバーID', '名前']],
  ];
  const unresolved = buildRosterPreview_(...args);
  const confirmedAsEmergency = buildRosterPreview_(...args, [1]);
  assert.equal(unresolved.readyToConfirm, false);
  assert.equal(confirmedAsEmergency.readyToConfirm, true);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmedAsEmergency.additions)), [
    { playerId: '', jerseyNumber: '', name: '臨時参加者', emergency: true },
  ]);
});

test('server roster preview matches the player master and does not write any sheet', () => {
  const { context, sheets } = createRosterApiFixture();
  assert.equal(typeof context.previewRosterImport, 'function');
  const before = JSON.stringify([...sheets].map(([name, sheet]) => [name, sheet.values]));
  const preview = context.previewRosterImport({ gameId: 'G1', rosterText: '23 渡部 琉斗' });
  assert.equal(preview.readyToConfirm, true);
  assert.equal(preview.additions[0].playerId, '001');
  assert.equal(JSON.stringify([...sheets].map(([name, sheet]) => [name, sheet.values])), before);
});

test('server rejects a roster preview for an unknown game', () => {
  const { context } = createRosterApiFixture();
  assert.equal(typeof context.previewRosterImport, 'function');
  assert.throws(() => context.previewRosterImport({ gameId: 'UNKNOWN', rosterText: '23 渡部 琉斗' }), /試合が見つかりません/);
});

test('confirmed roster writes are idempotent and reconcile one member invoice', () => {
  const { context, sheets } = createRosterApiFixture();
  assert.equal(typeof context.previewRosterImport, 'function');
  assert.equal(typeof context.applyConfirmedRoster, 'function');
  const payload = { gameId: 'G1', rosterText: '23 渡部 琉斗' };
  const preview = context.previewRosterImport(payload);
  const confirmation = { ...payload, previewFingerprint: preview.previewFingerprint };
  const first = context.applyConfirmedRoster(confirmation);
  const second = context.applyConfirmedRoster(confirmation);
  const participantRows = sheets.get('集金_参加者').values.slice(1);
  const invoiceRows = sheets.get('メンバー請求').values.slice(1).filter((row) => row[0]);
  assert.equal(first.ok, true);
  assert.equal(second.alreadyApplied, true);
  assert.equal(participantRows.length, 1);
  assert.equal(participantRows[0][1], '001');
  assert.equal(invoiceRows.length, 1);
  assert.equal(invoiceRows[0][1], 'M001');
});

test('confirmed roster cannot mark a player absent when an active receipt exists', () => {
  const { context, sheets } = createRosterApiFixture({
    participants: [['G1', '001', '渡部 琉斗', 300, '対象', 300, 300, 0, '']],
    receipts: [['R1', 'G1', '001', '渡部 琉斗', '2026/10/07', 300, '現金', '有効', '']],
  });
  assert.equal(typeof context.previewRosterImport, 'function');
  const payload = { gameId: 'G1', rosterText: '' };
  const preview = context.previewRosterImport(payload);
  assert.equal(preview.readyToConfirm, false);
  assert.equal(preview.absences[0].blocked, true);
  assert.throws(() => context.applyConfirmedRoster({ ...payload, previewFingerprint: preview.previewFingerprint }), /受領済み/);
  assert.equal(sheets.get('集金_参加者').values[1][4], '対象');
  assert.equal(sheets.get('集金_受領履歴').values[1][7], '有効');
});

test('emergency app participant receives a persistent E ID without a master player row', () => {
  const { context, sheets, masterSheet } = createRosterApiFixture();
  assert.equal(typeof context.addEmergencyParticipant, 'function');
  const result = context.addEmergencyParticipant({ gameId: 'G1', name: '臨時参加者' });
  assert.equal(result.playerId, 'E001');
  assert.equal(sheets.get('集金_参加者').values[1][1], 'E001');
  assert.equal(sheets.get('メンバー').values[1][0], 'E001');
  assert.equal(masterSheet.values.some((row) => row[2] === '臨時参加者'), false);
});

test('emergency participant invoice keeps its E finance ID and stored name', () => {
  const { context, sheets } = createRosterApiFixture({
    participants: [['G1', 'E003', '緊急 参加者', 300, '対象', 300, 0, 300, '']],
    members: [['E003', '緊急 参加者', '', '', '', '', '', '']],
  });
  context.reconcileMemberInvoice_(context.getSpreadsheet_(), 'G1', 'E003');
  const invoice = sheets.get('メンバー請求').values[1];
  assert.equal(invoice[1], 'E003');
  assert.equal(invoice[2], '緊急 参加者');
  assert.equal(invoice[6], 300);
});

test('absent participant invoice is retained with a zero balance due', () => {
  const { context, sheets } = createRosterApiFixture({
    participants: [['G1', '001', '渡部 琉斗', 0, '欠席', 0, 0, 0, '当日欠席']],
  });
  context.reconcileMemberInvoice_(context.getSpreadsheet_(), 'G1', '001');
  const invoice = sheets.get('メンバー請求').values[1];
  assert.equal(invoice[1], 'M001');
  assert.equal(invoice[6], 0);
});

test('stale roster confirmation is rejected without changing the newer participant state', () => {
  const { context, sheets } = createRosterApiFixture();
  const payload = { gameId: 'G1', rosterText: '23 渡部 琉斗' };
  const preview = context.previewRosterImport(payload);
  sheets.get('集金_参加者').values.push(['G1', '002', '渡邉 匠', 300, '対象', 300, 0, 300, '別端末で追加']);
  assert.throws(() => context.applyConfirmedRoster({ ...payload, previewFingerprint: preview.previewFingerprint }), /変わりました/);
  assert.equal(sheets.get('集金_参加者').values[1][4], '対象');
});

test('cancelled receipt history remains when its participant is marked absent', () => {
  const { context, sheets } = createRosterApiFixture({
    participants: [['G1', '001', '渡部 琉斗', 300, '対象', 300, 0, 300, '']],
    receipts: [['R1', 'G1', '001', '渡部 琉斗', '2026/10/07', 300, '現金', '取消', '取消済み']],
  });
  const payload = { gameId: 'G1', rosterText: '4 渡邉 匠' };
  const preview = context.previewRosterImport(payload);
  assert.equal(preview.readyToConfirm, true);
  context.applyConfirmedRoster({ ...payload, previewFingerprint: preview.previewFingerprint });
  assert.equal(sheets.get('集金_受領履歴').values[1][0], 'R1');
  assert.equal(sheets.get('集金_受領履歴').values[1][7], '取消');
  assert.equal(sheets.get('集金_参加者').values[1][4], '欠席');
});

test('attendance actions mark absent and restore a participant through server reconciliation', () => {
  const { context } = createRosterApiFixture({
    participants: [['G1', '001', '渡部 琉斗', 300, '対象', 300, 0, 300, '']],
  });
  const absentState = context.markParticipantAbsent({ gameId: 'G1', playerId: '001' });
  assert.equal(absentState.participants.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(absentState.absentParticipants)), [
    { playerId: '001', name: '渡部 琉斗', jerseyNumber: '23' },
  ]);
  const restoredState = context.restoreParticipantAttendance({ gameId: 'G1', playerId: '001' });
  assert.equal(restoredState.participants.length, 1);
  assert.equal(restoredState.participants[0].charge, 300);
});

test('emergency entry refuses a name already in the player master', () => {
  const { context, sheets } = createRosterApiFixture();
  assert.throws(() => context.addEmergencyParticipant({ gameId: 'G1', name: '渡部 琉斗' }), /選手マスター/);
  assert.equal(sheets.get('集金_参加者').values.length, 1);
});

test('phone app provides paste, preview, and explicit roster confirmation controls', () => {
  assert.match(indexHtml, /id="rosterText"/);
  assert.match(indexHtml, /id="previewRosterButton"/);
  assert.match(indexHtml, /id="rosterPreview"/);
  assert.match(appHtml, /\.previewRosterImport\(/);
  assert.match(appHtml, /\.applyConfirmedRoster\(/);
});

test('phone app exposes separate emergency name entry and server allocation', () => {
  assert.match(indexHtml, /id="emergencyName"/);
  assert.match(appHtml, /\.addEmergencyParticipant\(/);
});

test('phone app can mark unpaid participants absent and restore them', () => {
  assert.match(indexHtml, /id="absentList"/);
  assert.match(appHtml, /\.markParticipantAbsent\(/);
  assert.match(appHtml, /\.restoreParticipantAttendance\(/);
});

test('roster review controls remain large enough for phone use', () => {
  assert.match(stylesHtml, /\.roster-control[\s\S]*?min-height:\s*52px/);
  assert.match(stylesHtml, /\.attendance-action[\s\S]*?min-height:\s*44px/);
});

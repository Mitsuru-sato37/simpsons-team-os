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
  resolveMemberLookup_,
  resolveMasterPlayer_,
  searchMasterPlayers_,
  buildFeeInvoiceId_,
  filterLegacyRows_,
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
  assert.doesNotMatch(codeGs, /DEFAULT_FEE/);
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

test('unconfigured game charges show a clear participant state without payment buttons', () => {
  assert.match(codeGs, /chargeConfigured:\s*resolveGameCharge_\(charge\) !== null/);
  assert.match(appHtml, /!player\.chargeConfigured/);
  assert.match(appHtml, /請求額未設定/);
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

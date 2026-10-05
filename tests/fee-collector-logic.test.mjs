import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const logicSource = readFileSync(new URL('../fee-collector/Logic.gs', import.meta.url), 'utf8');
const logicContext = {};
vm.runInNewContext(logicSource, logicContext);
const { isPaymentMethodAllowed_, pickNextOpenGame_, projectReceipts_ } = logicContext;
const codeGs = readFileSync(new URL('../fee-collector/Code.gs', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../fee-collector/Index.html', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../fee-collector/App.html', import.meta.url), 'utf8');
const documentation = [
  readFileSync(new URL('../README.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../docs/PROJECT_CONTEXT.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../docs/PROGRESS.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../fee-collector/README.md', import.meta.url), 'utf8'),
].join('\n');

const games = [
  { id: 'G1', status: '完了' },
  { id: 'G2', status: '予定' },
  { id: 'G3', status: '予定' },
  { id: 'G4', status: '中止' },
];

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

test('UI exposes cancelled receipt history', () => {
  assert.match(indexHtml, /cancelledList/);
  assert.match(indexHtml, /取消履歴/);
  assert.match(appHtml, /state\.data\.cancelled/);
  assert.match(appHtml, /PayPay確認/);
  assert.match(appHtml, /受領票を表示/);
  assert.match(appHtml, /取り消す/);
});

test('UI labels the standard cash collection action as 現金300円', () => {
  assert.match(appHtml, /現金300円/);
});

test('UI exposes a manual bank transfer confirmation action', () => {
  assert.match(appHtml, /data-method="銀行振込"/);
  assert.match(appHtml, /銀行振込確認/);
});

test('completed and cancelled games cannot be completed again', () => {
  assert.match(appHtml, /selectedGame\.status === '完了' \|\| selectedGame\.status === '中止'/);
  assert.match(codeGs, /\['完了', '中止'\]\.includes\(String\(values\[i\]\[7\]\)\)/);
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

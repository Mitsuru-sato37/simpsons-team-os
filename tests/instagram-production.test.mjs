import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schemaPath = new URL('../instagram/match-context.schema.json', import.meta.url);
const readmePath = new URL('../instagram/README.md', import.meta.url);
const workflowPath = new URL('../instagram/AGENTS.md', import.meta.url);
const designsPath = new URL('../instagram/designs.json', import.meta.url);
const rootAgentsPath = new URL('../AGENTS.md', import.meta.url);
const rootReadmePath = new URL('../README.md', import.meta.url);
const projectContextPath = new URL('../docs/PROJECT_CONTEXT.md', import.meta.url);
const progressPath = new URL('../docs/PROGRESS.md', import.meta.url);

test('MatchContext requires shared match identity and location fields', () => {
  assert.equal(existsSync(schemaPath), true, 'MatchContext schema must exist');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  assert.deepEqual(schema.required, ['matchId', 'date', 'opponent', 'venue']);
  assert.equal(schema.properties.matchId.type, 'string');
  assert.equal(schema.properties.date.format, 'date');
  assert.equal(schema.properties.opponent.type, 'string');
  assert.equal(schema.properties.venue.type, 'string');
});

test('MatchContext exposes Simpsons fixed game statistics with nonnegative values', () => {
  assert.equal(existsSync(schemaPath), true, 'MatchContext schema must exist');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const stats = schema.properties.stats.properties;
  assert.deepEqual(Object.keys(stats), [
    'runs', 'hits', 'walksHbp', 'stolenBases', 'extraBaseHits', 'rbis',
  ]);
  for (const definition of Object.values(stats)) {
    assert.equal(definition.type, 'integer');
    assert.equal(definition.minimum, 0);
  }
});

test('Instagram module documents separate pre-game and post-game entry points', () => {
  assert.equal(existsSync(readmePath), true, 'Instagram module README must exist');
  const readme = readFileSync(readmePath, 'utf8');
  assert.match(readme, /starting-lineup/);
  assert.match(readme, /post-game/);
  assert.match(readme, /fee-collector/);
});

test('Codex workflow defines independent starting-lineup and post-game entry points', () => {
  assert.equal(existsSync(workflowPath), true, 'Instagram Codex workflow must exist');
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /starting-lineup/);
  assert.match(workflow, /post-game/);
  assert.match(workflow, /fee-collector/);
  assert.match(workflow, /MatchContext/);
});

test('Canva workflow duplicates the required master and saves only after user preview approval', () => {
  assert.equal(existsSync(workflowPath), true, 'Instagram Codex workflow must exist');
  const workflow = readFileSync(workflowPath, 'utf8');
  const sequenceSection = workflow.slice(workflow.indexOf('## Canva操作と保存'));
  const sequence = [
    'canva_get_design',
    'canva_copy_design',
    'canva_start_editing_transaction',
    'canva_perform_editing_operations',
    'canva_get_design_thumbnail',
    'canva_commit_editing_transaction',
  ].map((step) => sequenceSection.indexOf(step));
  assert.ok(sequence.every((index) => index >= 0), 'all required Canva operations must be documented');
  assert.deepEqual(sequence, [...sequence].sort((a, b) => a - b));
  assert.match(workflow, /明示的な承認/);
  assert.match(workflow, /複製/);
});

test('design registry fixes master IDs and limits GAME STATS to its six approved metrics', () => {
  assert.equal(existsSync(designsPath), true, 'design registry must exist');
  const designs = JSON.parse(readFileSync(designsPath, 'utf8'));
  assert.equal(designs.gameResult.canva.designId, 'DAHWk9bIJ3U');
  assert.equal(designs.gameStats.canva.designId, 'DAHWxMb6kxg');
  assert.deepEqual(designs.gameStats.canva.editableStats, [
    'runs', 'hits', 'walksHbp', 'stolenBases', 'extraBaseHits', 'rbis',
  ]);
  assert.deepEqual(designs.gameStats.canva.fixedLabels, [
    '得点', '安打', '四死球', '盗塁', '長打', '打点',
  ]);
  assert.ok(designs.gameStats.canva.fixedElements.includes('background'));
  assert.ok(designs.gameStats.canva.fixedElements.includes('mascot'));
  assert.equal(designs.startingLineup.canvaDesignId, null);
  assert.equal(designs.startingLineup.requiresConfirmationWhenSourceUnresolved, true);
  assert.equal(designs.featurePlayer.canva.method, 'convert-approved-drive-reference-image-to-editable-design-per-match');
});

test('workflow stops on uncertain sources and forbids generated-image fallback', () => {
  assert.equal(existsSync(workflowPath), true, 'Instagram Codex workflow must exist');
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /不明.*確認/);
  assert.match(workflow, /複製できない.*停止/);
  assert.match(workflow, /AI画像生成.*禁止/);
  assert.match(workflow, /STARTING LINEUP.*新規MASTERを作らず/s);
});

test('design registry points to checked Drive references and does not invent STARTING LINEUP source', () => {
  assert.equal(existsSync(designsPath), true, 'design registry must exist');
  const designs = JSON.parse(readFileSync(designsPath, 'utf8'));
  assert.equal(designs.guide.driveFileId, '1wx-wUouhFd2-HZxAFxuAy9S-atoBn0A9oEzODPv3V3c');
  assert.equal(designs.gameResult.drive.sampleFileId, '1gtgWq39tAxcbLo7BxzT5JKirB8VwzHpR');
  assert.equal(designs.gameStats.drive.sampleFileId, '1QX_fHNN5PEXIvA-acXS7Jz7GivHLHoJZ');
  assert.equal(designs.featurePlayer.drive.referenceFileId, '1coH8OyXgS44gUrH5lskFbl8eQfblOqFk');
  assert.equal(designs.startingLineup.sourceCurrentlyLocated, false);
  assert.equal(designs.startingLineup.canvaDesignId, null);
});

test('workflow requires a confirmed Drive destination and reports export or upload failure honestly', () => {
  assert.equal(existsSync(workflowPath), true, 'Instagram Codex workflow must exist');
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /保存先が特定できなければ.*保存先を確認/);
  assert.match(workflow, /google_drive_upload_file/);
  assert.match(workflow, /Drive保存済みと報告しない/);
});

test('root Codex instructions route starting-lineup and post-game requests separately', () => {
  assert.equal(existsSync(rootAgentsPath), true);
  const instructions = readFileSync(rootAgentsPath, 'utf8');
  assert.match(instructions, /starting-lineup/);
  assert.match(instructions, /post-game/);
  assert.match(instructions, /instagram\/AGENTS\.md/);
});

test('repository README explains the two Codex invocation paths', () => {
  assert.equal(existsSync(rootReadmePath), true);
  const readme = readFileSync(rootReadmePath, 'utf8');
  assert.match(readme, /STARTING LINEUP/);
  assert.match(readme, /GAME RESULT/);
  assert.match(readme, /Codex/);
  assert.match(readme, /MatchContext/);
});

test('project context and progress record approved masters, independence, and handoff state', () => {
  assert.equal(existsSync(projectContextPath), true);
  assert.equal(existsSync(progressPath), true);
  const context = readFileSync(projectContextPath, 'utf8');
  const progress = readFileSync(progressPath, 'utf8');
  assert.match(context, /DAHWk9bIJ3U/);
  assert.match(context, /DAHWxMb6kxg/);
  assert.match(context, /集金.*独立/s);
  assert.match(progress, /codex\/instagram-production/);
  assert.match(progress, /node --test tests\/instagram-production\.test\.mjs/);
});

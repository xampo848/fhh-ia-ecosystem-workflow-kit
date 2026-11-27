// The kit text of an adapter can change without taking `split` away from an
// install made before the block markers existed: every text the kit shipped
// stays recognizable by its fingerprint. Also: an adapter with no kit text at
// all gets the block added to it, and one with an edited kit text still does
// not get split.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan, applyJournalRelativePath } from '../src/apply.mjs';
import { findKnownKitText, fingerprintOf, holdsKitLines, loadAdapterKitTexts } from '../src/adapter-kit-texts.mjs';
import { runCli } from '../src/cli.mjs';
import { extractManagedBlock } from '../src/kit-manifest.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, kitBody, splitUnmarkedAdapter } from '../src/planner.mjs';
import { recordAdapterKitTexts, validateAdapterKitTexts } from '../scripts/sync-adapter-kit-texts.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blockName = 'workflow-kit:managed';
const claudeTemplate = () => fs.readFile(path.join(root, 'templates/runtime-adapters/claude/CLAUDE.md'), 'utf8');
const cli = async (...args) => {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
};

test('the recorded fingerprints are those of the adapter templates, and the check says how to record a change', async () => {
  const result = await validateAdapterKitTexts();
  assert.deepEqual(result.failures, []);
  assert.ok(result.adapterCount >= 5);

  // A template whose text changed fails the check until it is recorded.
  const copy = path.join(await makeTempRepo(), 'adapter-kit-texts.json');
  const recorded = structuredClone(loadAdapterKitTexts());
  const old = recorded.adapters['CLAUDE.md'].current;
  recorded.adapters['CLAUDE.md'].current = { ...old, sha256: 'a'.repeat(64) };
  await fs.writeFile(copy, JSON.stringify(recorded));
  const changed = await validateAdapterKitTexts({ file: copy });
  assert.deepEqual(changed.failures, ['CLAUDE.md: its kit text changed since the recorded fingerprint.']);
  // Recording keeps the text it replaces, and never drops an earlier one.
  const after = await recordAdapterKitTexts({ file: copy, lastVersion: '9.9.9-test' });
  assert.equal(after.adapters['CLAUDE.md'].current.sha256, old.sha256);
  assert.deepEqual(after.adapters['CLAUDE.md'].previous.at(-1), { ...old, sha256: 'a'.repeat(64), lastVersion: '9.9.9-test' });
  assert.deepEqual((await validateAdapterKitTexts({ file: copy })).failures, []);
});

test('split finds an earlier kit text by its fingerprint and keeps the own text around it', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const current = kitBody(template, blockName);
  const lines = current.split('\n');
  const earlier = [...lines.slice(0, 3), 'A sentence only the earlier kit text had, long enough to count.', ...lines.slice(3)].join('\n');
  const known = [fingerprintOf(earlier)];
  const existing = `Intro del equipo\n\n${earlier}\n\nNota del equipo.\n`;

  assert.deepEqual(findKnownKitText(existing, known), { start: 'Intro del equipo\n\n'.length, length: earlier.length });
  // Without the fingerprint the earlier text is an edited kit text: no split.
  assert.equal(splitUnmarkedAdapter(existing, template, blockName, []), null);
  const split = splitUnmarkedAdapter(existing, template, blockName, known);
  assert.equal(split.wholeFileOwn, false);
  assert.equal(split.content, `${block}\n\nIntro del equipo\n\nNota del equipo.\n`);
  // One byte off and it is no longer that text.
  assert.equal(findKnownKitText(existing.replace('only the earlier', 'only an earlier'), known), null);
});

test('an adapter with no kit text gets the block added; one with an edited kit text does not get split', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const own = '# CLAUDE.md\n\nReglas propias del equipo.\n';
  const added = splitUnmarkedAdapter(own, template, blockName, []);
  assert.equal(added.wholeFileOwn, true);
  assert.equal(added.content, `${block}\n\n${own}`);
  assert.equal(holdsKitLines(own, kitBody(template, blockName), []), false);

  const edited = kitBody(template, blockName).replace(/apply `\.agents\/instructions\.md`/, 'apply `.agents/instructions.md` (ours)');
  assert.notEqual(edited, kitBody(template, blockName));
  assert.equal(splitUnmarkedAdapter(`${edited}\n\nNota.\n`, template, blockName, []), null);
  assert.equal(splitUnmarkedAdapter('   \n', template, blockName, []), null);
});

test('after rollback --from-backups an own CLAUDE.md gets split, keeps its text and leaves doctor ok', async () => {
  const target = await makeTempRepo();
  await fs.writeFile(path.join(target, '.gitignore'), 'node_modules\n');
  await fs.writeFile(path.join(target, 'CLAUDE.md'), '# CLAUDE.md\n\nReglas propias del equipo.\n');
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  await fs.rm(path.join(target, applyJournalRelativePath));
  assert.equal((await cli('rollback', '--target', target, '--from-backups', '--apply', '--yes')).code, 0);
  assert.equal((await cli('doctor', '--target', target, '--runtime', 'claude')).code, 1);

  const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
  assert.match(text, /^- skip_modified: CLAUDE\.md \(unmarked_adapter\): keep \| discard \| split; split keeps the whole file as your own text and adds the kit block \(no kit text was found in it\)$/m);
  const updated = await cli('update', '--target', target, '--edited', 'CLAUDE.md=split', '--apply', '--yes');
  assert.equal(updated.code, 0, updated.stderr);
  const claude = await fs.readFile(path.join(target, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /<!-- workflow-kit:managed:start -->[\s\S]*<!-- workflow-kit:managed:end -->\n\n# CLAUDE\.md\n\nReglas propias del equipo\.\n$/);
  assert.equal((await cli('doctor', '--target', target, '--runtime', 'claude')).code, 0);
});

test('a 0.18.1 install still gets split for every adapter, with the text it has on disk', async () => {
  const adapters = ['CLAUDE.md', 'AGENTS.md', 'ANTIGRAVITY.md', '.github/copilot-instructions.md'];
  const target = await makeTempRepo();
  await installLegacy0181(target, { runtimes: ['claude', 'codex', 'copilot', 'antigravity'] });
  for (const adapter of adapters) await fs.appendFile(path.join(target, adapter), '\nLocal edit.\n');
  const applied = await cli('update', '--target', target, ...adapters.flatMap((adapter) => ['--edited', `${adapter}=split`]), '--edited', 'all=keep', '--apply', '--yes');
  assert.equal(applied.code, 0, applied.stderr || applied.stdout.slice(-600));
  for (const adapter of adapters) {
    const content = await fs.readFile(path.join(target, adapter), 'utf8');
    assert.match(content, /<!-- workflow-kit:managed:end -->/, adapter);
    assert.match(content, /Local edit\./, adapter);
    // The old kit text is gone: only the new block and the own line remain.
    assert.equal((content.match(/Level pre-filter \(apply to every new user prompt/g) ?? []).length, 1, adapter);
  }
});

test('the generated pre-filter carries the N1 file rule in every adapter, and the text it replaced is still recognized', async () => {
  const { extractPrefilterBlock, prefilterTargets } = await import('../scripts/sync-level-prefilter.mjs');
  const block = extractPrefilterBlock(await fs.readFile(path.join(root, '.agents/instructions.md'), 'utf8'));
  assert.match(block, /\| Behavior-changing edit in 1–2 production files with clear scope \| N1 \|/);
  assert.match(block, /edit only the target files \(the test file of each one goes with it and does not count toward the 1–2\)/);
  for (const target of prefilterTargets) {
    assert.equal(extractPrefilterBlock(await fs.readFile(path.join(root, target), 'utf8'), target), block, target);
  }
  // The text every adapter carried up to 0.24.2 is listed as a previous one.
  const texts = loadAdapterKitTexts();
  for (const adapter of ['CLAUDE.md', 'AGENTS.md', 'ANTIGRAVITY.md', '.github/copilot-instructions.md']) {
    assert.ok(texts.adapters[adapter].previous.some((item) => item.lastVersion === '0.24.2-pilot-followup'), adapter);
  }
});

test('an adapter that holds the kit text with Windows line endings is still an edited kit text: no split', async () => {
  const template = await claudeTemplate();
  const crlf = `${kitBody(template, blockName)}\n\nNota del equipo.\n`.replace(/\n/g, '\r\n');
  assert.equal(holdsKitLines(crlf, kitBody(template, blockName), []), true);
  assert.equal(splitUnmarkedAdapter(crlf, template, blockName, []), null);
  // Indented or re-wrapped kit lines count too.
  const indented = kitBody(template, blockName).split('\n').map((line) => `  ${line}`).join('\n');
  assert.equal(splitUnmarkedAdapter(indented, template, blockName, []), null);
});

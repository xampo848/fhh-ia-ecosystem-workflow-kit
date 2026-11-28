import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan } from '../src/apply.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { buildInstallPlan, buildUpdatePlan, detectStackPack, installStateRelativePath, normalizeStackPack } from '../src/planner.mjs';
import { validateStackNeutrality } from '../scripts/validate-stack-neutrality.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stackPath = '.agents/project/stack.md';
const readState = async (target) => JSON.parse(await fs.readFile(path.join(target, installStateRelativePath), 'utf8'));

test('workflow core is stack-neutral and the stack pack keeps every moved rule', async () => {
  const result = await validateStackNeutrality({ root });
  assert.deepEqual(result.failures, []);
  assert.ok(result.ruleCount >= 25);
});

test('stack neutrality validation fails for a framework rule in a core skill and for a rule missing from the pack', async () => {
  const fixture = await makeTempRepo('workflow-kit-stack-');
  await fs.cp(path.join(root, '.agents'), path.join(fixture, '.agents'), { recursive: true });
  await fs.cp(path.join(root, 'templates/stack-packs'), path.join(fixture, 'templates/stack-packs'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'scripts'));
  await fs.copyFile(path.join(root, 'scripts/stack-rule-inventory.json'), path.join(fixture, 'scripts/stack-rule-inventory.json'));
  await fs.appendFile(path.join(fixture, '.agents/skills/02-implement/validation-runner/SKILL.md'), '\n- Always use Minitest.\n- Other runners exist, for example Vitest.\n');
  const pack = path.join(fixture, 'templates/stack-packs/rails-react/stack.md');
  await fs.writeFile(pack, (await fs.readFile(pack, 'utf8')).replace('- Use Zustand only for cross-feature client state.\n', ''), 'utf8');

  const result = await validateStackNeutrality({ root: fixture });
  assert.equal(result.failures.filter((failure) => failure.includes('validation-runner/SKILL.md')).length, 1, 'the example line is allowed');
  assert.ok(result.failures.some((failure) => failure.includes('"Minitest" as a rule')));
  assert.ok(result.failures.some((failure) => failure.includes('"zustand"')));
});

test('a new install has no stack pack unless asked; --stack installs it once and never overwrites it', async () => {
  assert.equal(normalizeStackPack(undefined), 'none');
  assert.throws(() => normalizeStackPack('django'), /Unsupported --stack/);
  assert.equal(parseArgs(['init', '--stack', 'rails-react']).stack, 'rails-react');

  const plain = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: plain, runtime: 'neutral' }));
  await assert.rejects(fs.access(path.join(plain, stackPath)));
  assert.equal((await readState(plain)).stackPack, 'none');
  // The recorded "none" is respected by later updates.
  const later = await buildUpdatePlan({ targetPath: plain, runtime: 'neutral' });
  assert.equal(later.stackPack, 'none');
  assert.equal(later.operations.some((item) => item.relativePath === stackPath), false);

  const rails = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: rails, runtime: 'neutral', stack: 'rails-react' }));
  assert.match(await fs.readFile(path.join(rails, stackPath), 'utf8'), /Use Minitest, not RSpec/);
  assert.equal((await readState(rails)).stackPack, 'rails-react');
  await fs.writeFile(path.join(rails, stackPath), '# Our own stack rules\n', 'utf8');
  const update = await buildUpdatePlan({ targetPath: rails, runtime: 'neutral' });
  assert.equal(update.operations.some((item) => item.relativePath === stackPath), false, 'the project owns the file');
});

// An install-state written before stack packs existed has no stackPack.
async function makeLegacyInstall() {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral' }));
  const state = await readState(target);
  delete state.stackPack;
  await fs.writeFile(path.join(target, installStateRelativePath), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return target;
}
const writeFile = async (target, relativePath, content) => {
  await fs.mkdir(path.dirname(path.join(target, relativePath)), { recursive: true });
  await fs.writeFile(path.join(target, relativePath), content, 'utf8');
};

test('update does not install the rails-react pack in a legacy repository that is not Rails + React', async () => {
  const target = await makeLegacyInstall();
  await writeFile(target, 'package.json', JSON.stringify({ dependencies: { vue: '^3.0.0' } }));

  const plan = await buildUpdatePlan({ targetPath: target, runtime: 'neutral' });
  assert.equal(plan.stackPack, 'none');
  assert.equal(plan.operations.some((item) => item.relativePath === stackPath), false);
  const notice = plan.migrations.find((item) => item.id === '0.15.0-stack-pack');
  assert.match(notice.summary, /No stack pack/);
  assert.match(notice.summary, /--stack rails-react/);
  await applyInstallPlan(plan);
  assert.equal((await readState(target)).stackPack, 'none', 'the decision is recorded');
});

test('update installs rails-react in a legacy repository detected as Rails + React', async () => {
  const target = await makeLegacyInstall();
  await writeFile(target, 'Gemfile', "gem 'rails'\n");
  await writeFile(target, 'frontend/package.json', JSON.stringify({ devDependencies: { react: '^19.0.0' } }));

  const plan = await buildUpdatePlan({ targetPath: target, runtime: 'neutral' });
  assert.equal(plan.stackPack, 'rails-react');
  assert.equal(plan.operations.find((item) => item.relativePath === stackPath).operation, 'create');
  assert.match(plan.migrations.find((item) => item.id === '0.15.0-stack-pack').summary, /detected/);
  await applyInstallPlan(plan);
  assert.match(await fs.readFile(path.join(target, stackPath), 'utf8'), /`Bullet` must be active in tests/);

  // An explicit --stack wins over detection.
  const optOut = await buildUpdatePlan({ targetPath: await makeLegacyInstall(), runtime: 'neutral', stack: 'none' });
  assert.equal(optOut.operations.some((item) => item.relativePath === stackPath), false);
});

test('detectStackPack needs both a Gemfile and react in a root or first-level package.json', async () => {
  const repo = await makeTempRepo();
  assert.equal(await detectStackPack(repo), 'none', 'empty repository');
  await writeFile(repo, 'Gemfile', "gem 'rails'\n");
  assert.equal(await detectStackPack(repo), 'none', 'Gemfile alone');
  await writeFile(repo, 'node_modules/x/package.json', JSON.stringify({ dependencies: { react: '1' } }));
  await writeFile(repo, 'a/b/package.json', JSON.stringify({ dependencies: { react: '1' } }));
  await writeFile(repo, 'broken/package.json', '{ not json');
  assert.equal(await detectStackPack(repo), 'none', 'node_modules, deeper folders and invalid JSON do not count');
  await writeFile(repo, 'package.json', JSON.stringify({ dependencies: { react: '^19.0.0' } }));
  assert.equal(await detectStackPack(repo), 'rails-react');
});

test('doctor warns when the recorded stack pack file is missing', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'neutral', stack: 'rails-react' }));
  let doctor = await runDoctor({ targetPath: target });
  assert.equal(doctor.stackPack, 'rails-react');
  assert.equal(doctor.diagnostics.some((item) => item.code === 'stack-pack/missing'), false);
  await fs.rm(path.join(target, stackPath));
  doctor = await runDoctor({ targetPath: target });
  const finding = doctor.diagnostics.find((item) => item.code === 'stack-pack/missing');
  assert.ok(finding);
  // A recorded seed is never recreated: update --stack cannot bring it back.
  assert.match(finding.message, /restore `\.agents\/project\/stack\.md` from Git \(`git checkout -- \.agents\/project\/stack\.md`\), or copy the file templates\/stack-packs\/rails-react\/stack\.md of the workflow-kit package to that path/);
  assert.doesNotMatch(finding.message, /--stack/);
});

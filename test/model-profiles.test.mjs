import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { loadDelegateCatalog, parseProfileOption, resolveModelProfiles } from '../src/model-profiles.mjs';
import { buildInstallPlan, buildUpdatePlan, installStateRelativePath } from '../src/planner.mjs';
import { makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function readCatalog() {
  return JSON.parse(await fs.readFile(path.join(root, 'scripts/delegate-agent-catalog.json'), 'utf8'));
}

async function readTarget(target, relativePath) {
  return fs.readFile(path.join(target, relativePath), 'utf8');
}

test('catalog defines calidad and costo profiles per D-05a', async () => {
  const catalog = await readCatalog();
  const { profiles, defaultByRuntime, runtimeTierSettings } = catalog.modelProfiles;
  assert.deepEqual(defaultByRuntime, { claude: 'calidad', codex: 'calidad', copilot: 'costo', antigravity: 'costo' });
  for (const agent of catalog.agents) {
    assert.ok(profiles.calidad.agentTiers[agent.slug], `calidad tier for ${agent.slug}`);
    assert.ok(profiles.costo.agentTiers[agent.slug], `costo tier for ${agent.slug}`);
  }
  assert.equal(Object.values(profiles.calidad.agentTiers).includes('Liviano'), false, 'calidad never uses Liviano');
  for (const slug of ['turbo-backend', 'pixel-ninja', 'testinator-5000', 'guardia-contrato', 'arquitecta-fases', 'qa-relampago']) {
    assert.equal(profiles.calidad.agentTiers[slug], 'Grande', slug);
  }
  assert.deepEqual(profiles.costo.agentTiers, catalog.copilotModelRouting.agentTiers, 'costo matches the Copilot routing tiers');
  assert.deepEqual(runtimeTierSettings.claude, { Liviano: 'haiku', Mediano: 'sonnet', Grande: 'opus' });
  assert.equal(catalog.runtimeCapabilities.claude.pinSubagentModel, true);
  assert.equal(catalog.runtimeCapabilities.codex.pinSubagentTier, true);
});

test('profile option parsing and resolution precedence', async () => {
  assert.deepEqual(parseProfileOption('claude=costo, codex=calidad'), { claude: 'costo', codex: 'calidad' });
  assert.deepEqual(parseProfileOption(undefined), {});
  assert.throws(() => parseProfileOption('claude=cheap'), /calidad or costo/);
  assert.throws(() => parseProfileOption('antigravity=costo'), /Unsupported --profile runtime/);
  assert.equal(parseArgs(['update', '--profile', 'claude=costo']).profile, 'claude=costo');

  const catalog = await loadDelegateCatalog();
  assert.deepEqual(resolveModelProfiles({ catalog, runtimes: ['claude', 'copilot', 'neutral'] }), { claude: 'calidad', copilot: 'costo' });
  assert.deepEqual(resolveModelProfiles({ catalog, runtimes: ['claude'], stored: { claude: 'costo' } }), { claude: 'costo' });
  assert.deepEqual(resolveModelProfiles({ catalog, runtimes: ['claude'], stored: { claude: 'costo' }, requested: { claude: 'calidad' } }), { claude: 'calidad' });
});

test('install renders agents for the chosen profile, update keeps it, and --profile switches it', async () => {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({ targetPath: target, runtime: 'claude,codex', profile: 'claude=costo' });
  assert.deepEqual(plan.modelProfiles, { claude: 'costo', codex: 'calidad' });
  await applyInstallPlan(plan);

  let state = JSON.parse(await readTarget(target, installStateRelativePath));
  assert.deepEqual(state.modelProfiles, { claude: 'costo', codex: 'calidad' });
  assert.match(await readTarget(target, '.claude/agents/sherlock-estructura.md'), /^model: haiku$/m);
  assert.match(await readTarget(target, '.claude/agents/turbo-backend.md'), /^model: sonnet$/m);
  assert.match(await readTarget(target, '.codex/agents/turbo-backend.toml'), /^model_reasoning_effort = "xhigh"$/m);

  const keep = await buildUpdatePlan({ targetPath: target, runtime: 'claude,codex' });
  assert.deepEqual(keep.modelProfiles, { claude: 'costo', codex: 'calidad' });
  assert.equal(keep.operations.find((item) => item.relativePath === '.claude/agents/sherlock-estructura.md').operation, 'unchanged');

  const switched = await buildUpdatePlan({ targetPath: target, runtime: 'claude,codex', profile: 'claude=calidad' });
  const sherlock = switched.operations.find((item) => item.relativePath === '.claude/agents/sherlock-estructura.md');
  assert.equal(sherlock.operation, 'overwrite_with_backup');
  assert.match(sherlock.content, /^model: sonnet$/m);
  await applyInstallPlan(switched);
  state = JSON.parse(await readTarget(target, installStateRelativePath));
  assert.deepEqual(state.modelProfiles, { claude: 'calidad', codex: 'calidad' });

  const healthy = await runDoctor({ targetPath: target, runtime: 'claude,codex' });
  assert.deepEqual(healthy.modelProfiles, { claude: 'calidad', codex: 'calidad' });
  assert.equal(healthy.diagnostics.some((item) => item.code === 'model-profile/agent-mismatch'), false);
});

test('doctor fails when an agent model does not match the project profile', async () => {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  const agentPath = path.join(target, '.claude/agents/turbo-backend.md');
  const content = await fs.readFile(agentPath, 'utf8');
  await fs.writeFile(agentPath, content.replace(/^model: opus$/m, 'model: haiku'), 'utf8');

  const result = await runDoctor({ targetPath: target, runtime: 'claude' });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'model-profile/agent-mismatch' && item.path === '.claude/agents/turbo-backend.md'));
});

test('update and doctor without --runtime reuse the runtimes stored at install', async () => {
  const { runCli } = await import('../src/cli.mjs');
  const { createMemoryIo } = await import('./helpers.mjs');
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude,copilot' }));

  const io = createMemoryIo();
  assert.equal(await runCli(['update', '--target', target], io), 0);
  assert.match(io.output.stdout, /Runtimes: claude,copilot/);
  assert.match(io.output.stdout, /Model profiles: claude=calidad,copilot=costo/);

  const doctor = await runDoctor({ targetPath: target });
  assert.deepEqual(doctor.runtimes, ['claude', 'copilot']);
  assert.equal(doctor.ok, true);
});

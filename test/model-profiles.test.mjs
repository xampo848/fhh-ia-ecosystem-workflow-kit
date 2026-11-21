import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { parseArgs } from '../src/cli/args.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { agentTierFor, loadDelegateCatalog, parseProfileOption, resolveModelProfiles } from '../src/model-profiles.mjs';
import { decideContextualTier } from '../scripts/copilot-model-routing.mjs';
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
  assert.equal(Object.values(defaultByRuntime).includes('equilibrado'), false, 'equilibrado is opt-in, never a runtime default');
  assert.deepEqual(runtimeTierSettings.claude, { Liviano: 'haiku', Mediano: 'sonnet', Grande: 'opus' });
  assert.equal(catalog.runtimeCapabilities.claude.pinSubagentModel, true);
  assert.equal(catalog.runtimeCapabilities.codex.pinSubagentTier, true);
});

test('profile option parsing and resolution precedence', async () => {
  assert.deepEqual(parseProfileOption('claude=costo, codex=calidad'), { claude: 'costo', codex: 'calidad' });
  assert.deepEqual(parseProfileOption(undefined), {});
  assert.throws(() => parseProfileOption('claude=cheap'), /Use one of: calidad, equilibrado, costo/);
  assert.deepEqual(parseProfileOption('claude=equilibrado,codex=equilibrado'), { claude: 'equilibrado', codex: 'equilibrado' });
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

// T02: equilibrado keeps Grande for planning and final QA and moves the
// writers and the test/contract roles to Mediano. Never Liviano.
const equilibradoMediano = ['turbo-backend', 'pixel-ninja', 'testinator-5000', 'guardia-contrato'];
const equilibradoGrande = ['arquitecta-fases', 'qa-relampago'];

test('catalog defines the equilibrado profile between calidad and costo', async () => {
  const catalog = await readCatalog();
  const { calidad, equilibrado } = catalog.modelProfiles.profiles;
  assert.equal(equilibrado.billing, 'subscription');
  assert.deepEqual(equilibrado.allowedTiers, ['Mediano', 'Grande']);
  assert.deepEqual(Object.keys(equilibrado.agentTiers).sort(), catalog.agents.map((agent) => agent.slug).sort());
  for (const slug of equilibradoMediano) assert.equal(equilibrado.agentTiers[slug], 'Mediano', slug);
  for (const slug of equilibradoGrande) assert.equal(equilibrado.agentTiers[slug], 'Grande', slug);
  for (const [slug, tier] of Object.entries(equilibrado.agentTiers)) {
    assert.ok(equilibrado.allowedTiers.includes(tier), `${slug} uses an allowed tier`);
    if (![...equilibradoMediano, ...equilibradoGrande].includes(slug)) {
      assert.equal(tier, calidad.agentTiers[slug], `${slug} keeps its calidad tier`);
    }
  }
});

test('update --profile claude=equilibrado renders sonnet writers and opus planning/QA, and update keeps it', async () => {
  const { runCli } = await import('../src/cli.mjs');
  const { createMemoryIo } = await import('./helpers.mjs');
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  assert.match(await readTarget(target, '.claude/agents/turbo-backend.md'), /^model: opus$/m, 'existing install starts on calidad');

  const io = createMemoryIo();
  assert.equal(await runCli(['update', '--target', target, '--profile', 'claude=equilibrado', '--apply', '--yes'], io), 0);
  for (const slug of equilibradoMediano) {
    assert.match(await readTarget(target, `.claude/agents/${slug}.md`), /^model: sonnet$/m, slug);
  }
  for (const slug of equilibradoGrande) {
    assert.match(await readTarget(target, `.claude/agents/${slug}.md`), /^model: opus$/m, slug);
  }
  assert.match(await readTarget(target, '.claude/agents/sherlock-estructura.md'), /^model: sonnet$/m, 'never haiku');
  assert.match(await readTarget(target, '.claude/agents/turbo-backend.md'), /Model profile: equilibrado · tier: Mediano\./);
  let state = JSON.parse(await readTarget(target, installStateRelativePath));
  assert.deepEqual(state.modelProfiles, { claude: 'equilibrado' });

  const keep = await buildUpdatePlan({ targetPath: target });
  assert.deepEqual(keep.modelProfiles, { claude: 'equilibrado' });
  for (const slug of [...equilibradoMediano, ...equilibradoGrande]) {
    assert.equal(keep.operations.find((item) => item.relativePath === `.claude/agents/${slug}.md`).operation, 'unchanged', slug);
  }
  const keepIo = createMemoryIo();
  assert.equal(await runCli(['update', '--target', target, '--apply', '--yes'], keepIo), 0);
  assert.match(keepIo.output.stdout, /Model profiles: claude=equilibrado/);
  state = JSON.parse(await readTarget(target, installStateRelativePath));
  assert.deepEqual(state.modelProfiles, { claude: 'equilibrado' });
  assert.match(await readTarget(target, '.claude/agents/turbo-backend.md'), /^model: sonnet$/m);

  const doctor = await runDoctor({ targetPath: target });
  assert.equal(doctor.ok, true);
  assert.deepEqual(doctor.modelProfiles, { claude: 'equilibrado' });
});

test('criticalConcerns still escalate equilibrado Mediano roles to Grande', async () => {
  const catalog = await loadDelegateCatalog();
  const routing = catalog.copilotModelRouting;
  const slice = (overrides = {}) => ({
    objective: 'Implement the owned backend slice',
    workKind: 'implementation',
    risk: 'medium',
    ambiguity: 'low',
    contextCompleteness: 'complete',
    bounded: true,
    ...overrides
  });
  for (const slug of equilibradoMediano) {
    const agentDefaultTier = agentTierFor(catalog, 'equilibrado', slug);
    assert.equal(agentDefaultTier, 'Mediano', slug);
    assert.equal(decideContextualTier({ routing, agentDefaultTier, taskContext: slice() }).tier, 'Mediano', `${slug} without concerns`);
    for (const concern of routing.contextPolicy.criticalConcerns) {
      const decision = decideContextualTier({ routing, agentDefaultTier, taskContext: slice({ criticalConcerns: [concern] }) });
      assert.equal(decision.tier, 'Grande', `${slug} with ${concern}`);
      assert.equal(decision.posture, 'critical');
    }
  }
});

// The generated Claude Code agent pins the profile tier, so the escalation has
// to happen at launch time: the N3 runtime-parity rule and the routing policy
// must tell the orchestrator to pass `model: opus` for a critical concern.
test('Claude Code escalates criticalConcerns at launch time for roles below Grande', async () => {
  for (const base of ['', 'templates/repo-overlay-fhh-ia-ecosystem-full/']) {
    const levelN3 = await fs.readFile(path.join(root, base, '.agents/skills/02-implement/implement-change/reference/level-n3.md'), 'utf8');
    const claudeRule = levelN3.split('\n- **').find((item) => item.startsWith('Claude Code:**'));
    assert.ok(claudeRule, `${base}level-n3.md has a Claude Code launch rule`);
    assert.match(claudeRule, /`criticalConcern`/);
    assert.match(claudeRule, /pass `model: opus` in the launch call/);

    const policy = await fs.readFile(path.join(root, base, '.agents/model-routing/README.md'), 'utf8');
    const section = policy.split('### Claude Code critical-concern escalation')[1]?.split('\n## ')[0];
    assert.ok(section, `${base}model-routing README has the Claude Code escalation section`);
    assert.match(section, /launches it with `model: opus`/);
    assert.match(section, /`requested_model: opus`/);
    assert.match(section, /`equilibrado` and `costo`/);
  }

  const catalog = await loadDelegateCatalog();
  assert.equal(catalog.runtimeCapabilities.claude.pinSubagentModel, true, 'the rule relies on per-call model pinning');
  assert.equal(catalog.modelProfiles.runtimeTierSettings.claude.Grande, 'opus', 'Grande maps to the model the rule passes');
});

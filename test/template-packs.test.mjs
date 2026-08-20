import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateDelegateRuntimeAdapters } from '../scripts/sync-delegate-runtime-adapters.mjs';
import { validateTemplatePacks } from '../scripts/validate-template-packs.mjs';
import manifest from '../templates/template-manifest.json' with { type: 'json' };

test('template manifest declares expected packs', () => {
  const ids = manifest.packs.map((pack) => pack.id).sort();
  assert.deepEqual(ids, ['adapter-agents-md', 'adapter-antigravity', 'adapter-claude', 'adapter-codex', 'adapter-copilot', 'repo-overlay-fhh-ia-ecosystem-full']);
});

test('shared AGENTS adapter owns the root bootstrap', () => {
  const shared = manifest.packs.find((pack) => pack.id === 'adapter-agents-md');
  const codex = manifest.packs.find((pack) => pack.id === 'adapter-codex');

  assert.deepEqual(shared.required_files, ['AGENTS.md']);
  assert.equal(codex.required_files.includes('AGENTS.md'), false);
});

test('validateTemplatePacks passes for bundled packs', async () => {
  const result = await validateTemplatePacks();
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('validateTemplatePacks catches forbidden adapter terms', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/runtime-adapters/copilot/.github/copilot-instructions.md');
  await fs.appendFile(target, '\nFHH IA Ecosystem measures DORA with backend/ rules.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Forbidden portable/adapter term')));
});

test('validateTemplatePacks catches adapters that do not reference neutral instructions', async () => {
  const root = await copyFixturePackage();
  const target = path.join(root, 'templates/runtime-adapters/codex/AGENTS.md');
  await fs.writeFile(target, '# AGENTS.md\n\nRuntime-only rules with no neutral reference.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Adapter file must reference .agents/instructions.md')));
});

test('validateTemplatePacks catches runtime wrapper drift against templates', async () => {
  const root = await copyFixtureRepository();
  const target = path.join(root, 'AGENTS.md');
  await fs.appendFile(target, '\nDrifted content.\n', 'utf8');

  const result = await validateTemplatePacks({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('Runtime adapter drift for agents-md')));
});

test('validateDelegateRuntimeAdapters catches manual edits to generated adapters', async () => {
  const root = await copyFixtureRepository();
  const target = path.join(root, '.claude/agents/capitana-alcance.md');
  await fs.appendFile(target, '\nLocal change.\n', 'utf8');

  const result = await validateDelegateRuntimeAdapters({ root });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('Generated delegate adapter drift: .claude/agents/capitana-alcance.md'));
});

test('generated delegate artifacts publish model routing capabilities', async () => {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const catalog = JSON.parse(await fs.readFile(path.join(sourceRoot, 'scripts/delegate-agent-catalog.json'), 'utf8'));
  const matrix = await fs.readFile(
    path.join(sourceRoot, '.agents/skills/02-implement/implement-prd/reference/delegate-skill-matrix.md'),
    'utf8'
  );
  const routingPolicy = await fs.readFile(path.join(sourceRoot, '.agents/model-routing/README.md'), 'utf8');
  const copilotAdapter = await fs.readFile(path.join(sourceRoot, '.github/agents/capitana-alcance.agent.md'), 'utf8');

  assert.equal(catalog.runtimeCapabilities.copilot.pinSubagentModel, true);
  assert.equal(catalog.runtimeCapabilities.copilot.autoFallback, false);
  assert.match(matrix, /## Runtime Model Routing Capabilities/);
  assert.match(routingPolicy, /\| Readiness and implementation slicing delegates \|/);
  assert.match(copilotAdapter, /subagent model pinning=true/);
  assert.match(copilotAdapter, /automatic fallback=false/);
});

async function copyFixturePackage() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-template-pack-'));
  await fs.cp(path.join(sourceRoot, 'templates'), path.join(targetRoot, 'templates'), { recursive: true });
  await fs.mkdir(path.join(targetRoot, 'scripts'), { recursive: true });
  await fs.copyFile(
    path.join(sourceRoot, 'scripts/delegate-agent-catalog.json'),
    path.join(targetRoot, 'scripts/delegate-agent-catalog.json')
  );
  return targetRoot;
}

async function copyFixtureRepository() {
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-repo-pack-'));
  await fs.cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(sourceRoot, source);
      if (relative === '') return true;
      if (relative.startsWith('.git')) return false;
      if (relative.startsWith('node_modules')) return false;
      return true;
    }
  });
  return targetRoot;
}

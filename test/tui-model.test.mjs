import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCapabilityGuide,
  defaultIntentFor,
  installPackageDetails,
  modelProfileQuestions,
  runtimeSet,
  selectedCapabilityList,
  selectedRuntimeList,
  toInquirerChoices
} from '../src/tui/model.mjs';

test('installPackageDetails returns recommended metadata for full overlay', () => {
  assert.deepEqual(installPackageDetails('fhh-ia-ecosystem-full'), {
    label: 'FHH IA Ecosystem completo (recomendado)',
    summary: 'Flujo completo de FHH IA Ecosystem elegido (recomendado).',
    tone: 'copper'
  });
});

test('installPackageDetails returns error metadata for unsupported overlays', () => {
  assert.deepEqual(installPackageDetails('starter'), {
    label: 'FHH IA Ecosystem completo (recomendado)',
    summary: 'Se pidió un overlay no soportado: "starter".',
    tone: 'copperInk'
  });

  assert.deepEqual(installPackageDetails('none'), {
    label: 'FHH IA Ecosystem completo (recomendado)',
    summary: 'Se pidió un overlay no soportado: "none".',
    tone: 'copperInk'
  });
});

test('runtimeSet normalizes comma separated runtime lists', () => {
  assert.deepEqual(
    [...runtimeSet(' codex, copilot , ,claude ')],
    ['codex', 'copilot', 'claude']
  );
});

test('defaultIntentFor keeps attach-only only for capabilities that are commonly preinstalled', () => {
  assert.equal(defaultIntentFor('context7'), 'attach-only');
  assert.equal(defaultIntentFor('engram'), 'attach-only');
  assert.equal(defaultIntentFor('codebase-memory-mcp'), 'install+attach');
});

test('selectedRuntimeList supports combining Copilot and Antigravity and installing every adapter', () => {
  assert.deepEqual(selectedRuntimeList(['copilot', 'antigravity']), ['copilot', 'antigravity']);
  assert.deepEqual(selectedRuntimeList(['neutral', 'copilot']), ['copilot']);
  assert.deepEqual(selectedRuntimeList(['all']), ['codex', 'copilot', 'claude', 'antigravity']);
});

test('selectedCapabilityList expands the all choice', () => {
  assert.deepEqual(selectedCapabilityList(['all']), ['context7', 'engram', 'codebase-memory-mcp']);
  assert.deepEqual(selectedCapabilityList(['context7', 'engram']), ['context7', 'engram']);
});

test('createCapabilityGuide builds context7 guidance with official source and runtime hint', () => {
  const guide = createCapabilityGuide({
    capability: 'context7',
    intent: 'attach-only',
    runtimes: runtimeSet('codex,copilot')
  });

  assert.equal(guide.source, 'upstash/context7 (packages/mcp/README.md)');
  assert.equal(guide.intent, 'attach-only');
  assert.equal(guide.runtimeHint, 'Runtimes detectados: codex, copilot');
  assert.match(guide.commands.join('\n'), /@upstash\/context7-mcp/);
});

test('createCapabilityGuide builds engram guidance with memory tool effect', () => {
  const guide = createCapabilityGuide({
    capability: 'engram',
    intent: 'attach-only',
    runtimes: runtimeSet('neutral')
  });

  assert.equal(guide.source, 'gentleman-programming/engram (docs/INSTALLATION.md + docs/AGENT-SETUP.md)');
  assert.match(guide.effect, /herramientas de memoria persistente/);
  assert.match(guide.commands.join('\n'), /engram setup codex/);
});

test('toInquirerChoices preserves label value and description fields', () => {
  assert.deepEqual(
    toInquirerChoices([
      { value: 'codex', label: 'Codex', description: 'Neutral core + Codex adapter.' }
    ]),
    [
      { name: 'Codex', value: 'codex', description: 'Neutral core + Codex adapter.' }
    ]
  );
});
test('modelProfileQuestions offers equilibrado and keeps calidad and costo as the preselections', () => {
  const [question] = modelProfileQuestions('claude', {});
  assert.deepEqual(question.options.map((option) => option.value), ['calidad', 'equilibrado', 'costo']);
  assert.match(question.options[1].label, /equilibrado/);
  assert.equal(question.options[question.defaultIndex].value, 'calidad');

  const [withKey] = modelProfileQuestions('claude', { ANTHROPIC_API_KEY: 'test-only-not-a-real-key' });
  assert.equal(withKey.options[withKey.defaultIndex].value, 'costo');
});

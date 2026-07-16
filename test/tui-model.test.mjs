import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCapabilityGuide,
  defaultIntentFor,
  installPackageDetails,
  runtimeSet,
  toInquirerChoices
} from '../src/tui/model.mjs';

test('installPackageDetails returns recommended metadata for full overlay', () => {
  assert.deepEqual(installPackageDetails('fhh-ia-ecosystem-full'), {
    label: 'Full FHH IA Ecosystem (recommended)',
    summary: 'Full FHH IA Ecosystem flow selected (recommended).',
    tone: 'green'
  });
});

test('installPackageDetails returns fallback metadata for starter and portable core', () => {
  assert.deepEqual(installPackageDetails('starter'), {
    label: 'Starter overlay',
    summary: 'Starter overlay selected.',
    tone: 'yellow'
  });

  assert.deepEqual(installPackageDetails('none'), {
    label: 'Portable core only',
    summary: 'Portable core only selected.',
    tone: 'yellow'
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

test('createCapabilityGuide builds context7 guidance with official source and runtime hint', () => {
  const guide = createCapabilityGuide({
    capability: 'context7',
    scope: 'hybrid',
    intent: 'attach-only',
    runtimes: runtimeSet('codex,copilot')
  });

  assert.equal(guide.source, 'upstash/context7 (packages/mcp/README.md)');
  assert.equal(guide.scope, 'hybrid');
  assert.equal(guide.intent, 'attach-only');
  assert.equal(guide.runtimeHint, 'Detected runtimes: codex, copilot');
  assert.match(guide.commands.join('\n'), /@upstash\/context7-mcp/);
});

test('createCapabilityGuide builds engram guidance with memory tool effect', () => {
  const guide = createCapabilityGuide({
    capability: 'engram',
    scope: 'repo/project',
    intent: 'attach-only',
    runtimes: runtimeSet('neutral')
  });

  assert.equal(guide.source, 'gentleman-programming/engram (docs/INSTALLATION.md + docs/AGENT-SETUP.md)');
  assert.match(guide.effect, /durable memory tools/);
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
// Findings the pilot run on 0.25.0 left for later: a kit text that appears
// twice, block markers quoted inside a code fence, what the plan says about
// `discard` and about an edit inside the block, a byte-order mark after split,
// a temporary file after a killed run, and smaller text alignments.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyInstallPlan } from '../src/apply.mjs';
import { runCli } from '../src/cli.mjs';
import { extractManagedBlock, replaceManagedBlock } from '../src/kit-manifest.mjs';
import { buildInstallPlan, buildUpdatePlan, formatPlan, kitBody, splitUnmarkedAdapter } from '../src/planner.mjs';
import { createMemoryIo, makeTempRepo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const blockName = 'workflow-kit:managed';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const bothCopies = (file) => [file, `${overlay}/${file}`];
const claudeTemplate = () => read('templates/runtime-adapters/claude/CLAUDE.md');
const cli = async (...args) => {
  const io = createMemoryIo();
  const code = await runCli(args, io);
  return { code, ...io.output };
};
async function installed() {
  const target = await makeTempRepo();
  await applyInstallPlan(await buildInstallPlan({ targetPath: target, runtime: 'claude' }));
  return target;
}

test('D1: split removes every whole copy of the kit text, not only the first', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const body = kitBody(template, blockName);
  const twice = `Intro del equipo\n\n${body}\n\nNota entre copias.\n\n${body}\n\nNota final.\n`;
  const split = splitUnmarkedAdapter(twice, template, blockName, []);
  assert.equal(split.content, `${block}\n\nIntro del equipo\n\nNota entre copias.\n\nNota final.\n`);
  assert.equal((split.content.match(/Level pre-filter \(apply to every new user prompt/g) ?? []).length, 1);
});

test('D2: block markers quoted inside a code fence are own text, not the block', async () => {
  const template = await claudeTemplate();
  const { block } = extractManagedBlock(template, blockName);
  const quoted = '```md\n<!-- workflow-kit:managed:start -->\nexample\n<!-- workflow-kit:managed:end -->\n```\n';
  // Only a quoted block: there is no real block to replace.
  assert.equal(extractManagedBlock(`# Notes\n\n${quoted}`, blockName).error, 'missing');
  assert.equal(replaceManagedBlock(`# Notes\n\n${quoted}`, template, blockName), null);
  // A real block and a quoted one: the real one is found, the quote stays.
  const both = `${block}\n\n# Notes\n\n${quoted}`;
  assert.equal(extractManagedBlock(both, blockName).block, block);
  const older = both.replace('1–2 production files', '1–2 files');
  assert.equal(replaceManagedBlock(older, template, blockName), both);
  // Tilde fences and longer fences count too.
  assert.equal(extractManagedBlock(`~~~~\n<!-- workflow-kit:managed:start -->\nx\n<!-- workflow-kit:managed:end -->\n~~~~\n`, blockName).error, 'missing');
});

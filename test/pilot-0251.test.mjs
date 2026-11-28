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

test('D3: a plan with pending decisions says what each decision does', async () => {
  const target = await installed();
  await fs.appendFile(path.join(target, '.agents/instructions.md'), '\nedited\n');
  const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
  assert.match(text, /^Decisions: keep leaves the file as it is \(the next update lists it again\); discard takes the kit version and moves your version to a backup file next to it[^\n]*$/m);
  // A plan with nothing pending has no such line.
  const clean = await installed();
  assert.doesNotMatch(formatPlan(await buildUpdatePlan({ targetPath: clean })), /^Decisions:/m);
});

test('D4: the plan says that an edit inside the kit block is replaced, also when the kit block changed too', async () => {
  const target = await installed();
  const adapter = path.join(target, 'CLAUDE.md');
  const statePath = path.join(target, '.agents/workflow-kit/install-state.json');
  const { checksumOf } = await import('../src/fs-safety.mjs');
  const current = await fs.readFile(adapter, 'utf8');
  // The install recorded an older kit block; the team then edited a line inside it.
  const olderKit = current.replace('1–2 production files', '1–2 files');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.files['CLAUDE.md'].sha256 = checksumOf(extractManagedBlock(olderKit, blockName).block);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  await fs.writeFile(adapter, olderKit.replace('| N0 |', '| N0 (edited by the team) |'));
  const text = formatPlan(await buildUpdatePlan({ targetPath: target }));
  assert.match(text, /^- overwrite_with_backup: CLAUDE\.md \(its kit block was edited; the kit version replaces it and the backup keeps the edit\)$/m);
  // Not edited, only older: the block-only note.
  await fs.writeFile(adapter, olderKit);
  assert.match(formatPlan(await buildUpdatePlan({ targetPath: target })), /CLAUDE\.md \(only its kit block changes; the rest of the file stays\)$/m);
});

test('D5: a byte-order mark stays at the start of the file after split, and doctor names a temporary file a killed run left', async () => {
  const template = await claudeTemplate();
  const bom = '﻿';
  const split = splitUnmarkedAdapter(`${bom}# CLAUDE.md\n\nReglas propias del equipo.\n`, template, blockName, []);
  assert.ok(split.content.startsWith(`${bom}<!-- workflow-kit:managed:start -->`), JSON.stringify(split.content.slice(0, 50)));
  assert.equal(split.content.indexOf(bom, 1), -1, 'no byte-order mark in the middle');

  const target = await installed();
  await fs.writeFile(path.join(target, '.agents/workflow-kit/.workflow-kit-tmp-99999'), 'x');
  await fs.writeFile(path.join(target, '.agents/skills/.workflow-kit-tmp-4242'), 'x');
  const doctor = await cli('doctor', '--target', target, '--runtime', 'claude');
  assert.doesNotMatch(doctor.stdout, /boundary\/unowned-path\] [^\n]*\.workflow-kit-tmp-/);
  assert.match(doctor.stdout, /\[workspace\/temporary-leftover\] \.agents\/skills\/\.workflow-kit-tmp-4242: A temporary file a stopped workflow-kit run left\. Run `workflow-kit rollback --target \S+ --apply --yes` to remove it, or delete it by hand\. \(warning\)/);
});

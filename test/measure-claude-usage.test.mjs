import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { makeTempRepo } from './helpers.mjs';
import {
  MAIN_AGENT,
  UNKNOWN_SUBAGENT,
  encodeProjectPath,
  isProjectDirectory,
  measureUsage,
  parseTranscript,
  runMeasureCli
} from '../scripts/measure-claude-usage.mjs';

const now = Date.parse('2026-11-20T12:00:00.000Z');
const inWindow = '2026-11-19T10:00:00.000Z';
const outOfWindow = '2026-11-01T10:00:00.000Z';
const projectPath = '/work/my_repo';

function usage({ input = 0, read = 0, write1h = 0, write5m = 0, output = 0 }) {
  return {
    input_tokens: input,
    cache_read_input_tokens: read,
    cache_creation_input_tokens: write1h + write5m,
    cache_creation: { ephemeral_1h_input_tokens: write1h, ephemeral_5m_input_tokens: write5m },
    output_tokens: output
  };
}

function assistant(id, tokens, { timestamp = inWindow, model = 'claude-opus-5-5', toolUse } = {}) {
  const content = toolUse ? [{ type: 'tool_use', id: toolUse.id, name: toolUse.name, input: {} }] : [{ type: 'text', text: 'secret answer' }];
  return { type: 'assistant', timestamp, message: { id, model, role: 'assistant', content, usage: usage(tokens) } };
}

function toolResult(toolUseId, text, timestamp = inWindow) {
  return { type: 'user', timestamp, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: text }] } };
}

function jsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

async function writeFixture() {
  const root = await makeTempRepo('measure-usage-');
  const encoded = encodeProjectPath(projectPath);
  const main = path.join(root, encoded);
  const worktree = path.join(root, `${encoded}--claude-worktrees-feature`);
  const sibling = path.join(root, `${encoded}-kit`);
  const subagents = path.join(main, 'session-a', 'subagents');
  for (const directory of [main, worktree, sibling, subagents]) await fs.mkdir(directory, { recursive: true });

  await fs.writeFile(path.join(main, 'session-a.jsonl'), jsonl([
    { type: 'user', timestamp: inWindow, message: { role: 'user', content: 'private prompt text' } },
    // The same response is written once per content block: count it once.
    assistant('msg_1', { input: 10, read: 1000, write1h: 100, output: 20 }, { toolUse: { id: 'tool_1', name: 'Bash' } }),
    assistant('msg_1', { input: 10, read: 1000, write1h: 100, output: 20 }, { toolUse: { id: 'tool_1', name: 'Bash' } }),
    toolResult('tool_1', 'x'.repeat(300)),
    assistant('msg_2', { input: 10, read: 199_990, output: 10 }),
    // Zero usage is ignored.
    assistant('msg_3', {}),
    { type: 'system', subtype: 'compact_boundary', timestamp: inWindow },
    // Outside the window: ignored.
    assistant('msg_old', { input: 5, read: 5, output: 5 }, { timestamp: outOfWindow })
  ]));
  await fs.writeFile(path.join(subagents, 'agent-x.jsonl'), jsonl([
    assistant('msg_s1', { input: 2, read: 500, output: 4 }, { model: 'claude-sonnet-5-5', toolUse: { id: 'tool_s1', name: 'Read' } }),
    toolResult('tool_s1', 'y'.repeat(50))
  ]));
  await fs.writeFile(path.join(subagents, 'agent-x.meta.json'), JSON.stringify({ agentType: 'turbo-backend' }));
  await fs.writeFile(path.join(subagents, 'agent-y.jsonl'), jsonl([assistant('msg_y1', { input: 1, output: 1 })]));
  await fs.writeFile(path.join(worktree, 'session-b.jsonl'), jsonl([assistant('msg_w1', { input: 100, read: 900, output: 1 })]));
  await fs.writeFile(path.join(sibling, 'session-c.jsonl'), jsonl([assistant('msg_k1', { input: 999, output: 999 })]));
  return root;
}

test('measure-claude-usage selects the project and its worktrees, not sibling repositories', () => {
  const encoded = encodeProjectPath('/Users/me/projects/my_app');
  assert.equal(encoded, '-Users-me-projects-my-app');
  assert.equal(isProjectDirectory(encoded, encoded), true);
  assert.equal(isProjectDirectory(`${encoded}--claude-worktrees-sad-zhukovsky-b2988e`, encoded), true);
  assert.equal(isProjectDirectory(`${encoded}-workflow-kit`, encoded), false);
});

test('measure-claude-usage deduplicates by message id, skips zero usage, and honors the window', () => {
  const text = jsonl([
    assistant('msg_1', { input: 1, output: 1 }),
    assistant('msg_1', { input: 1, output: 1 }),
    assistant('msg_2', {}),
    assistant('msg_3', { input: 1, output: 1 }, { timestamp: outOfWindow })
  ]);
  const parsed = parseTranscript(text, { sinceMs: now - 7 * 24 * 60 * 60 * 1000 });
  assert.equal(parsed.requests.length, 1);
});

test('measure-claude-usage attributes agent types and summarizes cost', async () => {
  const root = await writeFixture();
  const summary = await measureUsage({ projectsRoot: root, projectPath, days: 7, now });
  const byType = Object.fromEntries(summary.agents.map((row) => [row.agentType, row]));

  assert.deepEqual(summary.projectDirectories.length, 2);
  assert.deepEqual(Object.keys(byType).sort(), [MAIN_AGENT, 'turbo-backend', UNKNOWN_SUBAGENT].sort());

  const main = byType[MAIN_AGENT];
  assert.equal(main.runs, 2);
  assert.equal(main.sessions, 2);
  assert.equal(main.requests, 3);
  assert.equal(main.compactions, 1);
  // Initial contexts 1110 (session-a) and 1000 (worktree session-b).
  assert.equal(main.medianInitialContext, 1055);
  assert.deepEqual(main.toolResultChars, { Bash: 300 });

  const backend = byType['turbo-backend'];
  assert.equal(backend.requests, 1);
  assert.deepEqual(backend.toolResultChars, { Read: 50 });

  // msg_2 has 200k context: its whole cost counts above the 150k threshold.
  const msg2Cost = 10 + 199_990 * 0.1 + 10 * 5;
  const mainCost = msg2Cost + (10 + 1000 * 0.1 + 100 * 2 + 20 * 5) + (100 + 900 * 0.1 + 5);
  assert.equal(main.highContextCostShare, Math.round((msg2Cost / mainCost) * 1000) / 10);
  assert.ok(summary.modelCostShare['claude-opus-5-5'] > summary.modelCostShare['claude-sonnet-5-5']);
  assert.equal(summary.mainContextBuckets.at(-1).fromTokens, 200_000);
});

test('measure-claude-usage --json is stable and prints counts only', async () => {
  const root = await writeFixture();
  const args = ['--project', projectPath, '--projects-root', root, '--json'];
  const first = await runMeasureCli(args, { now });
  const second = await runMeasureCli(args, { now });
  assert.equal(first.exitCode, 0);
  assert.equal(first.stdout, second.stdout);
  const summary = JSON.parse(first.stdout);
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.window.until, new Date(now).toISOString());
  assert.doesNotMatch(first.stdout, /private prompt text|secret answer|xxxx/);

  const table = await runMeasureCli(['--project', projectPath, '--projects-root', root], { now });
  assert.equal(table.exitCode, 0);
  assert.match(table.stdout, /\| MAIN \|/);
  assert.doesNotMatch(table.stdout, /private prompt text|secret answer/);
});

test('measure-claude-usage rejects bad input', async () => {
  const root = await writeFixture();
  assert.equal((await runMeasureCli(['--days', '0', '--projects-root', root], { now })).exitCode, 2);
  assert.equal((await runMeasureCli(['--unknown'], { now })).exitCode, 2);
  assert.equal((await runMeasureCli(['--project', '/nowhere', '--projects-root', root], { now })).exitCode, 1);
  assert.equal((await runMeasureCli(['--projects-root', path.join(root, 'missing')], { now })).exitCode, 1);
});

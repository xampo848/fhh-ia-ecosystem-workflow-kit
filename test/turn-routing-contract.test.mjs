import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlay = path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full');

async function read(relativePath, base = root) {
  return fs.readFile(path.join(base, relativePath), 'utf8');
}

test('neutral instructions define mandatory per-turn intake', async () => {
  const instructions = await read('.agents/instructions.md');

  assert.match(instructions, /## Mandatory per-turn intake/);
  assert.match(instructions, /\.agents\/skills\/index\.md/);
  assert.match(instructions, /every new user prompt/i);
  assert.match(instructions, /explicitly invokes a skill/i);
  assert.match(instructions, /direct answer/i);
  assert.match(instructions, /For any non-trivial request \(N2 or N3\) that does not continue the active workflow, run `workflow-router`/);
  assert.match(instructions, /(?:do|must) not assume.*previous prompt[\s\S]*keep that workflow only through the continuation\s+fast-path/i);
  assert.match(instructions, /reuse.*context/is);
  assert.match(instructions, /cannot load.*workflow-router/is);
  assert.match(instructions, /Execution authorization gate/i);
  assert.match(instructions, /intent language[\s\S]*not execution authorization/i);
  assert.match(instructions, /awaiting-user-choice/i);
  assert.match(instructions, /must not inspect product code[\s\S]*must not edit files/i);
});

test('router distinguishes intake from full routing and visible traces', async () => {
  const router = await read('.agents/skills/00-router/workflow-router/SKILL.md');

  assert.match(router, /intake runs for every new user prompt/i);
  assert.match(router, /full router.*non-trivial/is);
  assert.match(router, /direct answer.*without.*visible.*trace/is);
  assert.match(router, /workflow,[\s\S]*skill,[\s\S]*capability,[\s\S]*cost,[\s\S]*delegation,[\s\S]*risk decision/i);
  assert.match(router, /Execution authorization gate/i);
  assert.match(router, /stay in `awaiting-user-choice`/i);
  assert.match(router, /do not inspect product implementation files[\s\S]*do not edit code/i);
});

test('delegated context policy requires role reads, observable reuse, and directed resume validation', async () => {
  const [instructions, router, flow, validation] = await Promise.all([
    read('.agents/instructions.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md'),
    Promise.all(['orchestration-flow.md', 'orchestration-flow-execution.md'].map((file) => read(`.agents/skills/02-implement/implement-prd/reference/${file}`))).then((parts) => parts.join('\n')),
    read('.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md')
  ]);

  const contract = await read('.agents/delegation/delegate-contract.md');
  assert.match(instructions, /`\.agents\/delegation\/delegate-contract\.md`, the single source of delegate rules/);
  assert.match(instructions, /Delegates do not load this file or\s+`workflow-router`/);
  assert.match(contract, /A new delegate reads its complete required skill, applicable instructions,/);
  assert.match(contract, /complete content,\s+its provenance, and its current freshness observable/);
  assert.match(contract, /revalidates the relevant delta and affected dependencies/);
  assert.match(contract, /must not restart those parent stages or recursively\s+reroute/s);
  assert.match(contract, /`unknown` is a record of unavailable evidence, not permission/);
  assert.match(router, /do not rerun\s+router intake, readiness, discovery, or route selection/s);
  assert.match(flow, /## Delegated Context Preflight/);
  assert.match(flow, /Do not paste the\s+full PRD, tracker, or unrelated agent matrix/s);
  assert.match(flow, /parent read, summary, or source\s+reference does not satisfy that requirement/s);
  assert.match(flow, /pre-injected its complete\s+content and makes both provenance and current freshness observable/s);
  assert.match(flow, /must not restart intake, readiness,\s+discovery, slicing, matching, or router selection/s);
  assert.match(validation, /A new delegate must read its\s+role-required skill, applicable instructions, and controlling source/s);
  assert.match(validation, /present, non-`none`, matching, complete immutable slice `execution_lock_id`/);
  assert.match(validation, /unknown lock state blocks `VERIFIED`/);
});

test('canonical instructions and router match the installable overlay', async () => {
  for (const relativePath of [
    '.agents/instructions.md',
    '.agents/skills/00-router/workflow-router/SKILL.md'
  ]) {
    assert.equal(await read(relativePath), await read(relativePath, overlay), relativePath);
  }
});

const adapterPairs = [
  ['CLAUDE.md', 'templates/runtime-adapters/claude/CLAUDE.md'],
  ['AGENTS.md', 'templates/runtime-adapters/agents-md/AGENTS.md'],
  ['ANTIGRAVITY.md', 'templates/runtime-adapters/antigravity/ANTIGRAVITY.md'],
  ['.github/copilot-instructions.md', 'templates/runtime-adapters/copilot/.github/copilot-instructions.md'],
  ['.github/instructions/ai-workflow.instructions.md', 'templates/runtime-adapters/copilot/.github/instructions/ai-workflow.instructions.md'],
  ['.codex/README.md', 'templates/runtime-adapters/codex/.codex/README.md']
];

function sharedBootstrap(content, label) {
  const start = content.indexOf('Shared bootstrap for every new user prompt:');
  const end = content.indexOf('Runtime notes:');
  assert.ok(start >= 0 && end > start, `${label} must carry the shared bootstrap block`);
  return content.slice(start, end);
}

test('every runtime entrypoint carries the identical shared bootstrap and its template twin', async () => {
  const blocks = new Set();
  for (const [canonical, twin] of adapterPairs) {
    const content = await read(canonical);
    assert.equal(content, await read(twin), `${canonical} must match ${twin}`);
    assert.match(content, /`\.agents\/instructions\.md`\nis the source of truth/, canonical);
    const block = sharedBootstrap(content, canonical);
    blocks.add(block);
    assert.match(block, /Classify every new prompt with the level pre-filter\. If it continues the\s+active workflow, apply the continuation fast-path from\s+`\.agents\/instructions\.md`; re-route only on a break signal\./, canonical);
    assert.match(block, /\.agents\/skills\/index\.md/, canonical);
    assert.match(block, /explicitly invokes a skill/, canonical);
    assert.match(block, /emit its routing decision trace before loading the\s+selected skill/, canonical);
    assert.match(block, /for routes that write \(code, PRDs, tickets,\s+installs\), intent-only phrasing \("quiero", "necesito"\) is\s+not implementation authorization/, canonical);
    assert.match(block, /Exceptions: N0 acts on intent, N1 needs a short "yes", and read-only routes\s+or an explicit imperative naming the work/, canonical);
  }
  assert.equal(blocks.size, 1, 'the shared bootstrap must be identical in every adapter');
});

test('adapters carry no contradicting re-route rule and no route-specific safeguard', async () => {
  for (const pair of adapterPairs) {
    for (const relativePath of pair) {
      const content = await read(relativePath);
      assert.doesNotMatch(content, /Re-run structured intake on every/i, relativePath);
      assert.doesNotMatch(content, /do not reuse or cache the previous workflow decision/i, relativePath);
      assert.doesNotMatch(content, /never assume the workflow selected in a previous turn/i, relativePath);
      assert.doesNotMatch(content, /PR comments hard trigger safeguard/i, relativePath);
      assert.doesNotMatch(content, /Project formation continuity safeguard/i, relativePath);
      assert.doesNotMatch(content, /`implement-prd`/, relativePath);
    }
  }
});

test('Copilot scoped instructions apply globally', async () => {
  for (const relativePath of [
    '.github/instructions/ai-workflow.instructions.md',
    'templates/runtime-adapters/copilot/.github/instructions/ai-workflow.instructions.md'
  ]) {
    const content = await read(relativePath);
    assert.match(content, /^---\napplyTo: "\*\*"\n---\n/, relativePath);
    assert.match(content, /routing decision trace/i, relativePath);
  }
});

test('route-specific safeguards live in the router hard triggers', async () => {
  const router = await read('.agents/skills/00-router/workflow-router/SKILL.md');
  assert.match(router, /Route to `pr-comments-resolution` when the user intent is to resolve, process, close, or work through PR\/review comments/);
  assert.match(router, /Inside another active workflow it is a break signal: re-route in that turn/);
  assert.match(router, /Route to `project-formation` as the recommended option/);
  assert.match(router, /Once authorized, it stays binding across its stages/);
  assert.match(router, /\| Irreversible operational action \|[^\n]*name the concrete risk, wait for explicit confirmation, then act directly; no workflow skill/);
});

test('one authorization gate: writing routes ask, read-only routes and naming imperatives do not', async () => {
  const [instructions, router] = await Promise.all([
    read('.agents/instructions.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md')
  ]);
  for (const content of [instructions, router]) {
    assert.match(content, /applies to routes that write/);
    assert.match(content, /Read-only routes \(review, audit, explanation,? (?:or )?discovery the user asked for\)/);
    assert.match(content, /"audita X", "revisa este PR"/);
  }
  assert.match(instructions, /\| N2 Standard \|[^\n]*Only for routes that write/);
  assert.match(router, /- High: one workflow clearly fits\.[^\n]*proceed when the route is read-only or the imperative names the work/);
  assert.match(router, /If the route writes and explicit route authorization is missing, stop in `awaiting-user-choice`/);
});

test('session memory is the visible routing trace, not a required tool', async () => {
  const [instructions, router, memory] = await Promise.all([
    read('.agents/instructions.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md'),
    read('.agents/memory/README.md')
  ]);
  assert.match(instructions, /Session memory is the conversation itself: the latest routing trace still\s+visible in context/);
  assert.match(instructions, /no routing trace for an\s+active workflow is visible in the current context \(new session or\s+compacted away\)/);
  assert.doesNotMatch(instructions, /missing\/stale session\s+memory/);
  assert.match(router, /latest routing trace visible in the\s+conversation \(session memory\)/);
  assert.match(memory, /latest routing\s+trace still visible in context/);
});

test('workflow router offers solution-sketch as a hard trigger without a fifth product menu option', async () => {
  const [core, menus] = await Promise.all([
    read('.agents/skills/00-router/workflow-router/SKILL.md'),
    read('.agents/skills/00-router/workflow-router/reference/route-menus.md')
  ]);
  const router = `${core}\n${menus}`;

  assert.match(router, /#### Solution sketch hard trigger/);
  assert.match(router, /never auto-start/);
  assert.match(router, /dibujemos las clases/);
  assert.match(router, /Do not add `solution-sketch` as a fifth standing option in the product-shaping menu/);
  assert.match(router, /`solution-sketch` hard trigger \(offer only; never auto-start\)/);
  assert.match(router, /1\) Formación integral del proyecto \(`project-formation`\)/);
  assert.match(router, /4\) Épica multi-fase \(`create-epic`\)/);
  assert.doesNotMatch(router, /5\) .*solution-sketch/);
});

test('adapter validation accepts the shared bootstrap and only warns on the previous wording', async () => {
  const { validateAdapterContracts } = await import('../src/workflow-contract/adapters.mjs');
  const os = await import('node:os');
  const target = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-contract-'));
  await fs.writeFile(path.join(target, 'CLAUDE.md'), await read('CLAUDE.md'), 'utf8');
  assert.deepEqual(await validateAdapterContracts({ root: target, runtimes: ['claude'] }), []);

  const legacy = '# CLAUDE.md\n\nUse `.agents/instructions.md` for every new user prompt.\n<!-- workflow-kit:level-prefilter:start -->\n<!-- workflow-kit:level-prefilter:end -->\nEmit the routing decision trace.\n- Do not reuse or cache the previous workflow decision across turns.\n- Intent-only phrasing is not implementation authorization.\n';
  await fs.writeFile(path.join(target, 'CLAUDE.md'), legacy, 'utf8');
  const diagnostics = await validateAdapterContracts({ root: target, runtimes: ['claude'] });
  assert.deepEqual(diagnostics.map((item) => `${item.code}:${item.severity}`).sort(), ['claude/missing-execution-gate:warning', 'claude/missing-rerouting-guarantee:warning']);
  await fs.rm(target, { recursive: true, force: true });
});

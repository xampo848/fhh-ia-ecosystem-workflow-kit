import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changeDir = '.agents/skills/02-implement/implement-change';

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('implement-change core stays under 200 lines and declares when each reference is read', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  assert.ok(core.split('\n').length <= 200, 'implement-change SKILL.md must stay at or under 200 lines');
  assert.match(core, /^name: implement-change$/m);
  for (const reference of ['level-n1.md', 'level-n2.md', 'level-n3.md', 'input-types.md', 'modifiers.md', 'session-checkpoint.md']) {
    assert.match(core, new RegExp(`\\[reference/${reference.replace('.', '\\.')}\\]\\(reference/${reference.replace('.', '\\.')}\\) \\| \\S`), reference);
    await fs.access(path.join(root, changeDir, 'reference', reference));
  }
});

test('one classification: former modes map to levels and modifiers', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  assert.match(core, /\| N1 \| `small\/local` \|/);
  assert.match(core, /\| N2 \| `controlled-lite`, `controlled-implementation` \|/);
  assert.match(core, /\| N3 \| `standard` \|/);
  assert.match(core, /`autonomous-safe` and `resume` are no longer modes: they are modifiers/);
  assert.match(core, /two or more listed hazards MUST run at N3/);
  for (const type of ['PRD', 'Bug', 'Ticket', 'Iteration']) {
    assert.match(core, new RegExp(`^\\| ${type} \\|`, 'm'), type);
  }
});

test('invariants and closure by level live in the core so no level skips them', async () => {
  const core = await read(`${changeDir}/SKILL.md`);
  const invariants = core.slice(core.indexOf('## Invariants'), core.indexOf('## Closure by level'));
  for (const rule of ['Authorization', 'Escalation', 'Tests of the delta and regression', 'Quality gate', 'Stop conditions', 'No closure without evidence']) {
    assert.match(invariants, new RegExp(rule), rule);
  }
  assert.match(core, /\| N1 \| delta tests, regression of the touched area/);
  assert.match(core, /\| N3 \| the 12-point Mandatory Closure Contract/);
});

test('iteration and bug inputs keep quality while dropping ceremony', async () => {
  const inputs = await read(`${changeDir}/reference/input-types.md`);
  assert.match(inputs, /The map is the PRD and its `## 10\. Evidencia de Implementación`/);
  assert.match(inputs, /Freshness is measured by changes, not time/);
  assert.match(inputs, /git diff <ref> -- <files>/);
  assert.match(inputs, /regression of the original feature by running the existing tests that\s+section 10 lists/);
  assert.match(inputs, /"Iteración N" subsection/);
  assert.match(inputs, /No reproduction possible[\s\S]*do not fix blindly[\s\S]*explicitly authorizes/);
});

test('autonomous execution is an explicit per-run choice that never removes brakes', async () => {
  const modifiers = await read(`${changeDir}/reference/modifiers.md`);
  assert.match(modifiers, /\*\*Supervised\*\* \(default\)/);
  assert.match(modifiers, /never stored as a project\s+preference/);
  assert.match(modifiers, /Autonomy\s+removes pauses, not brakes/);
  assert.match(modifiers, /exhausts its repair rounds, stop there/);
});

test('implement-prd stays as a permanent alias and the router binds to implement-change', async () => {
  const [alias, registry, router, gates] = await Promise.all([
    read('.agents/skills/02-implement/implement-prd/SKILL.md'),
    read('.agents/skills/registry.md'),
    read('.agents/skills/00-router/workflow-router/SKILL.md'),
    read('.agents/skills/00-router/workflow-router/reference/route-gates.md')
  ]);
  assert.match(alias, /permanent alias of `implement-change`/);
  assert.match(alias, /\.\.\/implement-change\/SKILL\.md/);
  assert.match(registry, /\| `implement-change` \| Workflow \| `\.agents\/skills\/02-implement\/implement-change\/SKILL\.md`/);
  assert.match(registry, /\| `implement-prd` \| Workflow \| `\.agents\/skills\/02-implement\/implement-prd\/SKILL\.md` \|[^\n]*Permanent alias of `implement-change`/);
  assert.match(router, /"implementa este\s+PRD" runs `implement-change` \(alias `implement-prd`\)/);
  assert.match(gates, /load `\.agents\/skills\/02-implement\/implement-change\/SKILL\.md`/);
});

test('one N1 procedure per entry path and a placeholder project context never blocks', async () => {
  const [core, n1, n2] = await Promise.all([
    read(`${changeDir}/SKILL.md`),
    read(`${changeDir}/reference/level-n1.md`),
    read(`${changeDir}/reference/level-n2.md`)
  ]);
  assert.match(core, /An N1 reached through the level pre-filter \(no workflow files loaded\) follows\s+only the pre-filter's N1 rule/);
  assert.match(n1, /N1 reached through the level pre-filter, with no workflow files loaded, follows\s+only the pre-filter's N1 rule and never loads this file/);
  assert.doesNotMatch(n1, /replaces the\s+N1 rules of the pre-filter/);
  assert.match(core, /when it exists and is filled in; if it still\s+carries its template marker \(`<!-- workflow-kit:project-context:template -->`\), say once that the project context is not set up and\s+continue/);
  assert.doesNotMatch(core, /before exploring code at any level/);
  assert.match(n2, /The N2 default is `avoided`/);
  assert.match(n2, /Tracker and execution locks are N3 coordination\. At N2 keep the tracker only\s+when the change has more than one slice/);
  assert.match(n2, /every delegated coding slice, even a single one/);
  assert.doesNotMatch(n2, /Code-writing defaults to the specialized implementers/);
});

test('both implement skills name the session cut point and link the single checkpoint reference', async () => {
  const [core, alias, checkpoint, tracker, resume, handoffs, instructions] = await Promise.all([
    read(`${changeDir}/SKILL.md`),
    read('.agents/skills/02-implement/implement-prd/SKILL.md'),
    read(`${changeDir}/reference/session-checkpoint.md`),
    read('.agents/skills/02-implement/implement-prd/reference/task-tracker-template.md'),
    read('.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md'),
    read('.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md'),
    read('.agents/instructions.md')
  ]);
  assert.match(core, /\*\*Session cut point \(N2\/N3\)\.\*\*[\s\S]*?`reference\/session-checkpoint\.md`/);
  assert.match(core, /The cut is proposed, never imposed, and\s+never interrupts a wait for delegates/);
  assert.match(alias, /Session cut point:[\s\S]*?\[\.\.\/implement-change\/reference\/session-checkpoint\.md\]\(\.\.\/implement-change\/reference\/session-checkpoint\.md\)/);
  for (const text of [resume, handoffs, instructions]) assert.match(text, /implement-change\/reference\/session-checkpoint\.md/);
  assert.match(tracker, /^checkpoint:$/m);
  assert.match(tracker, /route_trace: /);

  assert.match(checkpoint, /^## Cut point$/m);
  assert.match(checkpoint, /terminal handoff was read/);
  assert.match(checkpoint, /no other delegate is `PENDING_SUBAGENT`/);
  assert.match(checkpoint, /^## Size brake$/m);
  assert.match(checkpoint, /about 150k tokens/);
  assert.match(checkpoint, /If it does not, use an observable substitute/);
  assert.match(checkpoint, /never report a context size the\s+runtime did not show/);
  assert.match(checkpoint, /Never cut, compact, or start a session silently/);
  assert.match(checkpoint, /Never propose it while a delegate is `PENDING_SUBAGENT`/);
  assert.match(checkpoint, /No parallel file or\s+format/);
  const reads = checkpoint.slice(checkpoint.indexOf('## What the resumed session reads'), checkpoint.indexOf('## What it does not repeat'));
  assert.match(reads, /The lock of `next_slice`/);
  const skipped = checkpoint.slice(checkpoint.indexOf('## What it does not repeat'));
  assert.match(skipped, /`implement-change · continuing · no reroute`/);
  assert.match(skipped, /Readiness, discovery, slicing, and matching while their evidence stays fresh/);
});

test('the N2/N3 orchestrator does not read raw: rule, level exception, and visual delegation template', async () => {
  const [core, levelN2, prompts, qa, frontend, instructions] = await Promise.all([
    read(`${changeDir}/SKILL.md`),
    read(`${changeDir}/reference/level-n2.md`),
    read('.agents/skills/02-implement/implement-prd/reference/subagent-prompts.md'),
    read('.agents/skills/02-implement/qa-handoff-review/SKILL.md'),
    read('.agents/skills/02-implement/frontend-phase-implementer/SKILL.md'),
    read('.agents/instructions.md')
  ]);

  const rule = core.slice(core.indexOf('**Orchestrator reads (N2/N3).**'), core.indexOf('## Invariants'));
  assert.ok(rule.length > 40, 'implement-change must keep the "Orchestrator reads (N2/N3)" rule');
  assert.match(rule, /reads the tracker, locks, handoffs, the input, and specific snippets/);
  assert.match(rule, /A bounded search \(exact\s+symbol, short output\) may stay inline/);
  assert.match(rule, /Broad exploration and whole-file\s+reads[\s\S]*?are delegated: `cavecrew-investigator`[\s\S]*?`sherlock-estructura`/);
  assert.match(rule, /opens the\s+browser, reads the screenshots, and returns a verdict per criterion, the\s+screenshot path, and its findings/);
  assert.match(rule, /The orchestrator does not `Read` images or\s+drive the browser unless the user asks directly/);
  assert.match(rule, /Level exception: N0 and N1 do\s+not\s+delegate[\s\S]*?applies to N2 and N3 only/);
  assert.match(rule, /Visual Verification Delegate/);
  assert.match(rule, /\*\*Spot-check:\*\* when a criterion is critical or a verdict conflicts with\s+other evidence, it may open one specific screenshot or snippet/);
  assert.match(rule, /\*\*Visual fallback:\*\* when the verifier returns `blocked` with\s+`blocked_reason: no_browser_tools`, the orchestrator verifies inline and\s+records why/);

  assert.match(levelN2, /orchestrator read\s+rule in `\.\.\/SKILL\.md`/);
  assert.match(instructions, /Compressed delegation preference:[\s\S]*?"Orchestrator reads \(N2\/N3\)" in `\.agents\/skills\/02-implement\/implement-change\/SKILL\.md`/);
  for (const [name, text] of [['qa-handoff-review', qa], ['frontend-phase-implementer', frontend]]) {
    assert.match(text, /read the screenshots yourself/, name);
    assert.match(text, /"Orchestrator reads"/, name);
  }

  const start = prompts.indexOf('## Visual Verification Delegate');
  assert.ok(start >= 0, 'subagent-prompts.md must keep the Visual Verification Delegate template');
  const template = prompts.slice(start, prompts.indexOf('## Prompt Card Files'));
  assert.match(template, /N0 and N1\s+do\s+not\s+delegate/);
  assert.match(template, /Salida obligatoria/);
  assert.match(template, /^status: success \| partial \| blocked$/m);
  assert.match(template, /^criteria\[N\]\{id,verdict,screenshot,finding\}:$/m);
  assert.match(template, /^findings\[N\]\{severity,criterion,observation\}:$/m);
  assert.match(template, /^blocked_reason: <no_browser_tools \| server \| login \| data \| none>$/m);
  assert.match(template, /`blocked_reason: no_browser_tools` y nada mas: el orquestador verificara\s+inline y dejara registrado el motivo/);
  assert.match(template, /spot-check one\s+screenshot when a criterion is critical or a verdict conflicts/);
});

test('N2/N3 delegation prefers catalog delegates over general-purpose and names only catalog agents', async () => {
  const [instructions, catalogText] = await Promise.all([
    read('.agents/instructions.md'),
    read('scripts/delegate-agent-catalog.json')
  ]);
  const section = instructions.slice(instructions.indexOf('Compressed delegation preference:'), instructions.indexOf('## Model routing'));
  const rule = section.split('\n').find((line) => line.includes('general-purpose'));
  assert.ok(rule, 'Compressed delegation preference must keep the catalog-delegate rule (from a usage analysis of `general-purpose` runs)');
  assert.match(rule, /^- in N2\/N3, when delegating, pick one of the delegates installed for your runtime by role/);
  assert.match(rule, /Use `general-purpose` only when no catalog delegate fits the role, and state why before launching it/);

  const catalogAgents = new Set(JSON.parse(catalogText).agents.map((agent) => agent.slug));
  const named = [...rule.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map((match) => match[1]).filter((name) => name !== 'general-purpose');
  for (const role of ['sherlock-estructura', 'turbo-backend', 'pixel-ninja', 'testinator-5000', 'lint-ranger', 'qa-relampago', 'cavecrew-investigator', 'cavecrew-builder', 'cavecrew-reviewer']) {
    assert.ok(named.includes(role), `rule must name ${role}`);
  }
  for (const name of named) assert.ok(catalogAgents.has(name), `${name} is not in scripts/delegate-agent-catalog.json`);
});

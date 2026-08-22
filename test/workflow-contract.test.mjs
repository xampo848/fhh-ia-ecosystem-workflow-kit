import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildInstallPlan } from '../src/planner.mjs';
import { validateOverlayDrift } from '../src/workflow-contract/drift.mjs';
import { validateWorkflowContract } from '../src/workflow-contract/index.mjs';
import { makeTempRepo } from './helpers.mjs';

async function installedTarget() {
  const target = await makeTempRepo();
  const plan = await buildInstallPlan({
    targetPath: target,
    runtime: 'codex,copilot,claude,antigravity'
  });
  await applyInstallPlan(plan);
  return target;
}

test('valid all-runtime installation satisfies workflow contract', async () => {
  const target = await installedTarget();
  const result = await validateWorkflowContract({
    root: target,
    runtimes: ['codex', 'copilot', 'claude', 'antigravity']
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
});

test('validator reports invalid Copilot front matter', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.github/instructions/ai-workflow.instructions.md');
  await fs.writeFile(file, '# no front matter\n', 'utf8');
  const result = await validateWorkflowContract({ root: target, runtimes: ['copilot'] });
  assert.ok(result.diagnostics.some((item) => item.code === 'copilot/missing-apply-to'));
});

test('validator reports unregistered skills', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.agents/skills/local/example/SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '# Example\n', 'utf8');
  const result = await validateWorkflowContract({ root: target });
  assert.ok(result.diagnostics.some((item) => item.code === 'skills/unregistered-file'));
});

test('validator reports malformed capability manifests', async () => {
  const target = await installedTarget();
  const file = path.join(target, '.agents/capabilities/manifests/broken.md');
  await fs.writeFile(file, '# Capability manifest: broken\n', 'utf8');
  const result = await validateWorkflowContract({ root: target });
  assert.ok(result.diagnostics.some((item) => item.code === 'capabilities/malformed-manifest'));
});

test('package canonical files match the installable overlay', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const result = await validateWorkflowContract({ root, checkOverlayDrift: true });
  assert.equal(
    result.diagnostics.some((item) => item.code === 'overlay/content-drift'),
    false,
    JSON.stringify(result.diagnostics, null, 2)
  );
});

test('overlay drift detects divergence in mirrored third-party skills', async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-overlay-drift-'));
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  await fs.cp(path.join(sourceRoot, '.agents'), path.join(root, '.agents'), { recursive: true });
  await fs.cp(
    path.join(sourceRoot, 'templates/repo-overlay-fhh-ia-ecosystem-full'),
    path.join(root, 'templates/repo-overlay-fhh-ia-ecosystem-full'),
    { recursive: true }
  );
  const canonicalSkill = path.join(root, '.agents/skills/04-crosscutting/frontend-design/SKILL.md');
  await fs.appendFile(canonicalSkill, '\nUnmirrored content.\n', 'utf8');

  const diagnostics = await validateOverlayDrift({ root });

  assert.ok(diagnostics.some((item) => item.path.includes('frontend-design/SKILL.md')));
  await fs.rm(root, { recursive: true, force: true });
});

test('workflow router keeps deterministic PR comments hard trigger policy', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const routerPath = path.join(root, '.agents/skills/00-router/workflow-router/SKILL.md');
  const router = await fs.readFile(routerPath, 'utf8');

  assert.match(router, /Deterministic intent resolution \(required in every route\)/);
  assert.match(router, /PR comments hard trigger/);
  assert.match(router, /Route to `pr-comments-resolution` when the user intent is to resolve, process, close, or work through PR\/review comments/);
});

test('workflow router keeps deterministic project-formation trigger and route-options menu', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const routerPath = path.join(root, '.agents/skills/00-router/workflow-router/SKILL.md');
  const registryPath = path.join(root, '.agents/skills/registry.md');
  const [router, registry] = await Promise.all([
    fs.readFile(routerPath, 'utf8'),
    fs.readFile(registryPath, 'utf8')
  ]);

  assert.match(router, /Project formation hard trigger/);
  assert.match(router, /Route to `project-formation` as the recommended option/);
  assert.match(router, /Mandatory route-options block/);
  assert.match(router, /Elige una opción por número o por nombre de skill/);
  assert.match(registry, /`project-formation` \| Workflow \| `\.agents\/skills\/01-product\/project-formation\/SKILL\.md`/);
});

test('implement-prd keeps PRD-local coordination artifacts ignored and cleans them at closure', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const skillPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const gitignorePath = path.join(root, '.gitignore');
  const [skill, gitignore] = await Promise.all([
    fs.readFile(skillPath, 'utf8'),
    fs.readFile(gitignorePath, 'utf8')
  ]);

  assert.match(gitignore, /docs\/prd\/\*\*\/_meta\//);
  assert.match(skill, /ignored execution lock at `<prd-directory>\/_meta\/execution-lock\.toon`/);
  assert.match(skill, /<prd-directory>\/_meta\/task_tracker\.toon/);
  assert.match(skill, /<prd-directory>\/_meta\/` is removed/);
  assert.match(skill, /Complete `## 10\. Evidencia de Implementacion` in the PRD/);
});

test('QA handoff workflow keeps explicit rerun and controlled-lite closure rules', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const slicingPath = path.join(root, '.agents/skills/02-implement/implementation-slicing/SKILL.md');
  const [qaSkill, slicingSkill] = await Promise.all([
    fs.readFile(qaPath, 'utf8'),
    fs.readFile(slicingPath, 'utf8')
  ]);

  assert.match(qaSkill, /## Executable Procedure/);
  assert.match(qaSkill, /### Decision And Re-entry/);
  assert.match(qaSkill, /The reviewer does not retry automatically/);
  assert.match(qaSkill, /## Permitted Exceptions/);
  assert.match(slicingSkill, /final QA checklist, closure gates, and TOON handoff remain mandatory/);
});

test('create-prd requires use cases, test strategy, and edge-case matrix before a PRD is ready', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const skillPath = path.join(root, '.agents/skills/01-product/create-prd/SKILL.md');
  const templatePath = path.join(root, '.agents/skills/01-product/create-prd/PRD_TEMPLATE.md');
  const [skill, template] = await Promise.all([
    fs.readFile(skillPath, 'utf8'),
    fs.readFile(templatePath, 'utf8')
  ]);

  assert.match(skill, /Hard Gate: Use Cases, Test Strategy, and Edge Cases Are Non-Optional/);
  assert.match(skill, /Every acceptance criterion must link to at least one use case; every use case must link to at least one AC/);
  assert.match(skill, /datos vac[íi]os, l[íi]mites, errores, permisos\/tenancy, concurrencia\/orden, rollout\/rollback/);
  assert.match(skill, /### Casos de Uso \(mandatory\)/);
  assert.match(skill, /### Estrategia de Tests \(mandatory\)/);
  assert.match(skill, /### Matriz de Edge Cases \(mandatory\)/);

  assert.match(template, /### 2\.4 Casos de Uso/);
  assert.match(template, /### 2\.5 Estrategia de Tests/);
  assert.match(template, /### 2\.6 Matriz de Edge Cases/);
  assert.match(template, /\| Use cases \| Tests \| Edge cases \| Validation \| Evidence \|/);
  assert.match(skill, /Hard Gate: Class Diagram Is Non-Optional/);
  assert.match(template, /### 3\.2 Diagrama de Clases/);
  assert.match(template, /classDiagram/);
  assert.match(template, /## 10\. Evidencia de Implementacion/);
  assert.match(template, /\| Referencia de cambio \|/);
});

test('create-epic locks live path and phase cut before the PRD queue', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const epicSkillPath = path.join(root, '.agents/skills/01-product/create-epic/SKILL.md');
  const epicTemplatePath = path.join(root, '.agents/skills/01-product/create-epic/references/epic-template.md');
  const playbookPath = path.join(root, '.agents/skills/01-product/create-epic/references/research-playbook.md');
  const prdSkillPath = path.join(root, '.agents/skills/01-product/create-prd/SKILL.md');
  const prdTemplatePath = path.join(root, '.agents/skills/01-product/create-prd/PRD_TEMPLATE.md');
  const [epicSkill, epicTemplate, playbook, prdSkill, prdTemplate] = await Promise.all([
    fs.readFile(epicSkillPath, 'utf8'),
    fs.readFile(epicTemplatePath, 'utf8'),
    fs.readFile(playbookPath, 'utf8'),
    fs.readFile(prdSkillPath, 'utf8'),
    fs.readFile(prdTemplatePath, 'utf8')
  ]);

  assert.match(epicSkill, /### 6\. Lock Live Path And Phase Cut/);
  assert.match(epicSkill, /Do not ask the user to pick a named strategy/);
  assert.match(epicSkill, /A domain example from a prior conversation is not a standing rule/);
  assert.match(epicSkill, /Writes a PRD queue before locking the live path and phase cut/);
  assert.doesNotMatch(epicSkill, /id_bak|foundation-first|big-bang|Adapter-first/);

  assert.match(epicTemplate, /### Path vivo y corte de fases/);
  assert.match(epicTemplate, /INV-CUT-01/);
  assert.match(playbook, /Ask the user to choose between two sequences, not named strategies/);

  assert.match(prdSkill, /inherit the parent epic's locked live path and phase-cut sequence/);
  assert.match(prdSkill, /Inverting a parent epic's locked live path or phase-cut sequence/);
  assert.match(prdTemplate, /Path vivo heredado/);
  assert.match(prdTemplate, /Este PRD respeta el corte/);

  assert.match(epicSkill, /Use web research only when the epic depends on a vendor, regulation, public standard/);
  assert.match(epicSkill, /Persist a reusable evidence pack/);
  assert.doesNotMatch(epicSkill, /Use web research unless the user explicitly forbids it/);
  assert.match(playbook, /Use web research only when the epic depends on a vendor, regulation, public standard/);
});

test('token-efficiency cuts keep quality gates and compact discovery', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const calibrationPath = path.join(root, '.agents/skills/01-product/create-prd/reference/calibration.md');
  const createPrdPath = path.join(root, '.agents/skills/01-product/create-prd/SKILL.md');
  const matcherPath = path.join(root, '.agents/skills/02-implement/implementation-skill-matcher/SKILL.md');
  const implementPrdPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const orchestrationPath = path.join(root, '.agents/skills/02-implement/implement-prd/reference/orchestration-flow.md');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const backendPath = path.join(root, '.agents/skills/02-implement/backend-phase-implementer/SKILL.md');
  const frontendPath = path.join(root, '.agents/skills/02-implement/frontend-phase-implementer/SKILL.md');

  const [
    calibration,
    createPrd,
    matcher,
    implementPrd,
    orchestration,
    qa,
    backend,
    frontend
  ] = await Promise.all([
    fs.readFile(calibrationPath, 'utf8'),
    fs.readFile(createPrdPath, 'utf8'),
    fs.readFile(matcherPath, 'utf8'),
    fs.readFile(implementPrdPath, 'utf8'),
    fs.readFile(orchestrationPath, 'utf8'),
    fs.readFile(qaPath, 'utf8'),
    fs.readFile(backendPath, 'utf8'),
    fs.readFile(frontendPath, 'utf8')
  ]);

  assert.match(calibration, /Use exists-or-skip/);
  assert.match(calibration, /only when this PRD changes workflow skills, capabilities, or integrations/);
  assert.match(createPrd, /### Compact Path Gate/);
  assert.match(createPrd, /Split by failure, rollback, ownership, contract, or validation boundary/);
  assert.doesNotMatch(createPrd, /at least two execution slices/);
  assert.match(createPrd, /`implement-prd` must read `## Calibration`, `## Pattern Lock`, and `## Self-Audit`/);
  assert.match(matcher, /\.agents\/skills\/06-patterns\/index\.md` as the first candidate catalog/);
  assert.match(matcher, /`\.agents\/skills\/registry\.md` only after the compact index yields at least one/);
  assert.match(implementPrd, /Required stage pipeline \(every mode except `small\/local`\)/);
  assert.match(implementPrd, /Capitana Alcance → Sherlock Estructura → Arquitecta Fases → matcher → writer → validation → QA Relampago/);
  assert.match(implementPrd, /Do not omit a stage to save tokens/);
  assert.match(orchestration, /Do not omit a named stage/);
  assert.match(qa, /`## Self-Audit` residual risks/);
  assert.match(backend, /Use exists-or-skip for product docs/);
  assert.match(frontend, /only when it exists and the slice is cross-layer/);
});

test('implementation-slicing and implement-prd enforce use-case/edge-case traceability at closure', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const slicingPath = path.join(root, '.agents/skills/02-implement/implementation-slicing/SKILL.md');
  const implementPrdPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const [slicingSkill, implementPrdSkill] = await Promise.all([
    fs.readFile(slicingPath, 'utf8'),
    fs.readFile(implementPrdPath, 'utf8')
  ]);

  assert.match(slicingSkill, /Map every PRD use case \(`UC-N`\) to at least one slice/);
  assert.match(slicingSkill, /is a traceability gap; resolve it before handoff or report it as a stop condition/);
  assert.match(slicingSkill, /- Use cases:\n- Tests:\n- Edge cases:/);

  assert.match(implementPrdSkill, /every PRD edge-case matrix row is either verified with evidence or marked `No aplica`/);
  assert.match(implementPrdSkill, /An orphan acceptance criterion, use case, test-strategy row, or edge-case row blocks closure/);
});

test('qa-handoff-review reports edge-case coverage by mandatory category', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const qaSkill = await fs.readFile(qaPath, 'utf8');

  assert.match(qaSkill, /### Edge-Case Coverage Gate/);
  assert.match(qaSkill, /A category is `PASS` only when every PRD row for it has concrete validation evidence/);
  assert.match(qaSkill, /`ready_to_close: yes` is not allowed while a critical-category gap is open and unaccepted/);
  assert.match(qaSkill, /Use cases: every PRD use case links to an implemented\/verified slice and at least one executed test; report orphans by ID/);
});

test('implement-prd closure loop keeps a persistent findings ledger and blocks on open critical/high findings', async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const implementPrdPath = path.join(root, '.agents/skills/02-implement/implement-prd/SKILL.md');
  const orchestrationFlowPath = path.join(root, '.agents/skills/02-implement/implement-prd/reference/orchestration-flow.md');
  const stopConditionsPath = path.join(root, '.agents/skills/02-implement/implement-prd/reference/validation-and-stop-conditions.md');
  const handoffSchemasPath = path.join(root, '.agents/skills/02-implement/implement-prd/reference/handoff-schemas.md');
  const trackerTemplatePath = path.join(root, '.agents/skills/02-implement/implement-prd/reference/task-tracker-template.md');
  const qaPath = path.join(root, '.agents/skills/02-implement/qa-handoff-review/SKILL.md');
  const validationRunnerPath = path.join(root, '.agents/skills/02-implement/validation-runner/SKILL.md');

  const [
    implementPrdSkill,
    orchestrationFlow,
    stopConditions,
    handoffSchemas,
    trackerTemplate,
    qaSkill,
    validationRunnerSkill
  ] = await Promise.all([
    fs.readFile(implementPrdPath, 'utf8'),
    fs.readFile(orchestrationFlowPath, 'utf8'),
    fs.readFile(stopConditionsPath, 'utf8'),
    fs.readFile(handoffSchemasPath, 'utf8'),
    fs.readFile(trackerTemplatePath, 'utf8'),
    fs.readFile(qaPath, 'utf8'),
    fs.readFile(validationRunnerPath, 'utf8')
  ]);

  // findings ledger: persisted, never overwritten, consumed on QA re-entry
  assert.match(trackerTemplate, /# findings_ledger/);
  assert.match(trackerTemplate, /findings_ledger\[N\]\{id,severity,file,description,pattern_protected,status,source,first_reported,resolved_in_slice\}/);
  assert.match(trackerTemplate, /never overwrite or delete a row/);
  assert.match(orchestrationFlow, /append every finding from the previous handoff to `findings_ledger`/);
  assert.match(orchestrationFlow, /a finding missing from the ledger on re-entry is treated as still open, not as resolved/);

  // severity-blocking gate
  assert.match(handoffSchemas, /blocking_findings_open: yes \| no/);
  assert.match(qaSkill, /### Severity-Blocking Gate/);
  assert.match(qaSkill, /`ready_to_close: yes` is never allowed while `blocking_findings_open: yes`/);
  assert.match(implementPrdSkill, /which requires `blocking_findings_open: no`/);
  assert.match(stopConditions, /Findings gate: `findings_ledger` has no `critical`\/`high` row with `status: open`/);

  // waiver floor
  assert.match(qaSkill, /### Waiver Floor/);
  assert.match(qaSkill, /A generic acknowledgement \("ok", "proceed", "waived"\) without a named risk does not satisfy this floor/);
  assert.match(stopConditions, /### Waiver Floor/);

  // pre-existing/unrelated failures require an explicit user decision
  assert.match(validationRunnerSkill, /If `bin\/validate-slice` does not exist in the target repository, its absence is not a failure/);
  assert.match(validationRunnerSkill, /present exactly these three options to the user — \(A\) repair it now inside this PRD's scope, \(B\) log it as an explicit residual risk/);
  assert.match(handoffSchemas, /unrelated_failures\[N\]\{description,user_decision\}: <description>,<repair_now\|log_as_risk\|block\|pending> \| none/);
  assert.match(stopConditions, /A failure is classified as pre-existing\/unrelated to the current slice or PRD scope/);

  // closure evidence persisted before _meta/ cleanup
  assert.match(implementPrdSkill, /Include a "Resumen del Ledger de Hallazgos" subsection listing every `findings_ledger` row/);
  assert.match(orchestrationFlow, /Include a "Resumen del Ledger de Hallazgos" subsection listing every row from `findings_ledger`/);
});


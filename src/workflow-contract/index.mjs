import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAdapterContracts } from './adapters.mjs';
import { validateCapabilityRegistry } from './capabilities.mjs';
import { diagnostic, finalizeDiagnostics } from './diagnostics.mjs';
import { validateOverlayDrift } from './drift.mjs';
import { validateSkillRegistry } from './skills.mjs';

async function exists(root, relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function validateWorkflowContract({
  root,
  runtimes = ['neutral'],
  checkOverlayDrift = false
}) {
  const diagnostics = [];
  if (!await exists(root, '.agents/instructions.md')) {
    diagnostics.push(diagnostic({
      code: 'neutral/missing-instructions',
      path: '.agents/instructions.md',
      message: 'Neutral workflow instructions are missing.'
    }));
  }
  if (!await exists(root, '.agents/skills/00-router/workflow-router/SKILL.md')) {
    diagnostics.push(diagnostic({
      code: 'router/missing-skill',
      path: '.agents/skills/00-router/workflow-router/SKILL.md',
      message: 'Workflow router skill is missing.'
    }));
  }

  diagnostics.push(...await validateAdapterContracts({ root, runtimes }));
  const skillDiagnostics = await validateSkillRegistry({ root });
  diagnostics.push(...skillDiagnostics);
  if (!skillDiagnostics.some((item) => item.code === 'skills/invalid-registry')) {
    try {
      const registry = JSON.parse(await fs.readFile(path.join(root, '.agents/skills/registry.json'), 'utf8'));
      const entries = [...(registry.skills ?? []), ...(registry.pattern_skills ?? [])];
      if (!entries.some((entry) => entry.name === 'workflow-router')) {
        diagnostics.push(diagnostic({
          code: 'router/missing-registry-entry',
          path: '.agents/skills/registry.json',
          message: 'workflow-router is not registered.'
        }));
      }
    } catch {
      // Invalid JSON is already reported by validateSkillRegistry.
    }
  }
  diagnostics.push(...await validateCapabilityRegistry({ root }));
  if (checkOverlayDrift) diagnostics.push(...await validateOverlayDrift({ root }));
  return finalizeDiagnostics(diagnostics);
}

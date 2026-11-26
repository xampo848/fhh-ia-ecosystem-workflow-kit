import fs from 'node:fs/promises';
import path from 'node:path';
import { runtimeEntrypoints } from '../runtime-matrix.mjs';
import { updateAdvice } from '../plugin-mode.mjs';
import { diagnostic } from './diagnostics.mjs';

function pushIfMissing({ diagnostics, relativePath, content, pattern, code, message }) {
  if (!pattern.test(content)) {
    diagnostics.push(diagnostic({ code, path: relativePath, message }));
  }
}

async function read(root, relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Always-loaded adapters that must carry the generated N0–N3 level pre-filter.
const levelPrefilterEntrypoints = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'ANTIGRAVITY.md'
]);
const levelPrefilterStart = '<!-- workflow-kit:level-prefilter:start -->';
const levelPrefilterEnd = '<!-- workflow-kit:level-prefilter:end -->';

// The runtime entrypoint that carries the shared bootstrap block for each runtime.
const primaryEntrypoints = {
  codex: '.codex/README.md',
  copilot: '.github/copilot-instructions.md',
  claude: 'CLAUDE.md',
  antigravity: 'ANTIGRAVITY.md'
};

const continuationPattern = /continuation fast-path[\s\S]*re-route only on a break signal/i;
const legacyReroutingPattern = /do not reuse or cache the previous workflow decision across turns/i;
const gatePattern = /Intent-only phrasing[\s\S]*not implementation authorization/i;
const gateExceptionsPattern = /N0 acts on intent, N1 needs a short "yes", and read-only routes\s+or an explicit imperative naming the work/i;
// adviceTarget is the project doctor checks; kit validation has none, so its advice stays generic.
const staleAdapterHint = (adviceTarget) => `Run ${updateAdvice(adviceTarget)} to accept the current adapter, or copy its "Shared bootstrap" block from the template.`;

function checkSharedBootstrap({ diagnostics, runtime, relativePath, content, adviceTarget }) {
  pushIfMissing({
    diagnostics,
    relativePath,
    content,
    pattern: /routing decision trace/i,
    code: `${runtime}/missing-routing-trace`,
    message: 'Expected explicit routing decision trace guidance for non-trivial work.'
  });

  if (!continuationPattern.test(content)) {
    if (legacyReroutingPattern.test(content)) {
      diagnostics.push(diagnostic({
        code: `${runtime}/missing-rerouting-guarantee`,
        path: relativePath,
        severity: 'warning',
        message: `Uses the previous "re-route every turn" wording, which contradicts the continuation fast-path in .agents/instructions.md. ${staleAdapterHint(adviceTarget)}`
      }));
    } else {
      diagnostics.push(diagnostic({
        code: `${runtime}/missing-rerouting-guarantee`,
        path: relativePath,
        message: 'Expected the continuation line: classify every new prompt, apply the continuation fast-path when it continues the active workflow, and re-route only on a break signal.'
      }));
    }
  }

  if (!gatePattern.test(content)) {
    diagnostics.push(diagnostic({
      code: `${runtime}/missing-execution-gate`,
      path: relativePath,
      message: 'Expected the execution authorization gate line.'
    }));
  } else if (!gateExceptionsPattern.test(content)) {
    diagnostics.push(diagnostic({
      code: `${runtime}/missing-execution-gate`,
      path: relativePath,
      severity: 'warning',
      message: `The execution authorization gate lacks its N0/N1 and read-only exceptions. ${staleAdapterHint(adviceTarget)}`
    }));
  }
}

export async function validateAdapterContracts({ root, runtimes = [], adviceTarget }) {
  const diagnostics = [];
  const checkedPrefilter = new Set();

  for (const runtime of runtimes.filter((item) => item !== 'neutral')) {
    for (const relativePath of runtimeEntrypoints[runtime] ?? []) {
      const content = await read(root, relativePath);
      if (content === null) continue;
      if (levelPrefilterEntrypoints.has(relativePath) && !checkedPrefilter.has(relativePath)) {
        checkedPrefilter.add(relativePath);
        const start = content.indexOf(levelPrefilterStart);
        const end = content.indexOf(levelPrefilterEnd);
        if (start < 0 || end < start) {
          diagnostics.push(diagnostic({
            code: 'adapter/missing-level-prefilter',
            path: relativePath,
            severity: 'warning',
            message: `Missing the generated N0–N3 level pre-filter block. Every prompt will load the full workflow. Accept the updated adapter from ${updateAdvice(adviceTarget)}, or copy the block between the workflow-kit:level-prefilter markers from .agents/instructions.md.`
          }));
        }
      }
      if (!content.includes('.agents/instructions.md')) {
        diagnostics.push(diagnostic({
          code: 'adapter/missing-neutral-reference',
          path: relativePath,
          message: 'Expected a reference to .agents/instructions.md.'
        }));
      }
      if (!/every new user prompt/i.test(content)) {
        diagnostics.push(diagnostic({
          code: 'adapter/missing-turn-intake',
          path: relativePath,
          message: 'Expected an explicit per-turn intake bootstrap.'
        }));
      }
    }
  }

  // Shared-bootstrap checks on each runtime's primary entrypoint. Each rule
  // accepts the previous adapter wording so installs that have not run
  // `update` yet (or keep a customized protected adapter) only get a warning.
  for (const [runtime, relativePath] of Object.entries(primaryEntrypoints)) {
    if (!runtimes.includes(runtime)) continue;
    const content = await read(root, relativePath);
    if (content === null) continue;
    checkSharedBootstrap({ diagnostics, runtime, relativePath, content, adviceTarget });
  }

  if (runtimes.includes('copilot')) {
    const relativePath = '.github/instructions/ai-workflow.instructions.md';
    const content = await read(root, relativePath);
    if (content !== null && !/^---\napplyTo: "\*\*"\n---\n/.test(content)) {
      diagnostics.push(diagnostic({
        code: 'copilot/missing-apply-to',
        path: relativePath,
        message: 'Expected applyTo: "**" front matter.'
      }));
    }
  }

  return diagnostics;
}

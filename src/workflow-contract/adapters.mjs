import fs from 'node:fs/promises';
import path from 'node:path';
import { runtimeEntrypoints } from '../runtime-matrix.mjs';
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

export async function validateAdapterContracts({ root, runtimes = [] }) {
  const diagnostics = [];

  for (const runtime of runtimes.filter((item) => item !== 'neutral')) {
    for (const relativePath of runtimeEntrypoints[runtime] ?? []) {
      const content = await read(root, relativePath);
      if (content === null) continue;
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

  if (runtimes.includes('copilot')) {
    const wrapperPath = '.github/copilot-instructions.md';
    const wrapper = await read(root, wrapperPath);
    if (wrapper !== null) {
      pushIfMissing({
        diagnostics,
        relativePath: wrapperPath,
        content: wrapper,
        pattern: /routing decision trace/i,
        code: 'copilot/missing-routing-trace',
        message: 'Expected explicit routing decision trace guidance.'
      });
      pushIfMissing({
        diagnostics,
        relativePath: wrapperPath,
        content: wrapper,
        pattern: /do not reuse or cache the previous workflow decision across turns/i,
        code: 'copilot/missing-rerouting-guarantee',
        message: 'Expected explicit follow-up re-routing guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath: wrapperPath,
        content: wrapper,
        pattern: /Intent-only phrasing[\s\S]*not implementation authorization/i,
        code: 'copilot/missing-execution-gate',
        message: 'Expected explicit execution authorization guarantee.'
      });
    }

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

  if (runtimes.includes('claude')) {
    const relativePath = 'CLAUDE.md';
    const content = await read(root, relativePath);
    if (content !== null) {
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /routing decision trace/i,
        code: 'claude/missing-routing-trace',
        message: 'Expected explicit routing decision trace guidance for non-trivial work.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /do not reuse or cache the previous workflow decision across turns/i,
        code: 'claude/missing-rerouting-guarantee',
        message: 'Expected explicit follow-up re-routing guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /Intent-only phrasing[\s\S]*not implementation authorization/i,
        code: 'claude/missing-execution-gate',
        message: 'Expected explicit execution authorization guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /resolve, review, process, or close PR\/review comments/i,
        code: 'claude/missing-pr-comments-trigger',
        message: 'Expected explicit PR comments hard trigger safeguard.'
      });
    }
  }

  if (runtimes.includes('antigravity')) {
    const relativePath = 'ANTIGRAVITY.md';
    const content = await read(root, relativePath);
    if (content !== null) {
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /routing decision trace/i,
        code: 'antigravity/missing-routing-trace',
        message: 'Expected explicit routing decision trace guidance for non-trivial work.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /do not reuse or cache the previous workflow decision across turns/i,
        code: 'antigravity/missing-rerouting-guarantee',
        message: 'Expected explicit follow-up re-routing guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /Intent-only phrasing[\s\S]*not implementation authorization/i,
        code: 'antigravity/missing-execution-gate',
        message: 'Expected explicit execution authorization guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /Project formation continuity safeguard/i,
        code: 'antigravity/missing-project-formation-continuity',
        message: 'Expected explicit project-formation continuity safeguard.'
      });
    }
  }

  if (runtimes.includes('codex')) {
    const relativePath = '.codex/README.md';
    const content = await read(root, relativePath);
    if (content !== null) {
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /routing decision trace/i,
        code: 'codex/missing-routing-trace',
        message: 'Expected explicit routing decision trace guidance for non-trivial work.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /do not reuse or cache the previous workflow decision across turns/i,
        code: 'codex/missing-rerouting-guarantee',
        message: 'Expected explicit follow-up re-routing guarantee.'
      });
      pushIfMissing({
        diagnostics,
        relativePath,
        content,
        pattern: /Intent-only phrasing[\s\S]*not implementation authorization/i,
        code: 'codex/missing-execution-gate',
        message: 'Expected explicit execution authorization guarantee.'
      });
    }
  }

  return diagnostics;
}

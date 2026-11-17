import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Relative Markdown links inside skills must resolve from the file that holds
// them: a broken link silently drops a hard gate (create-prd self-audit).
function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

test('relative links inside skills resolve to existing files', () => {
  const broken = [];
  for (const file of markdownFiles('.agents/skills')) {
    const content = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const [, target] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|#|\/)/i.test(target) || target.includes('<')) continue;
      const resolved = path.resolve(path.dirname(file), target.split('#')[0]);
      if (!existsSync(resolved)) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

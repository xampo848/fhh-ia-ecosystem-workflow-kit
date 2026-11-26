import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateDocs } from '../scripts/validate-docs.mjs';
import { makeTempRepo } from './helpers.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function copyDocs() {
  const target = await makeTempRepo('workflow-kit-docs-');
  for (const entry of ['README.md', 'RELEASE.md', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'docs', 'examples']) {
    await fs.cp(path.join(packageRoot, entry), path.join(target, entry), { recursive: true });
  }
  return target;
}
const withoutLines = (content, pattern) => content.split('\n').filter((line) => !pattern.test(line)).join('\n');

// Plugin-mode pilot AC-20: the 4 guides explain plugin mode.
const pluginGuides = ['docs/README.md', 'docs/quickstart.md', 'docs/github-install.md', 'docs/workflow/cross-runtime-capability-matrix.md'];

test('AC-20: check:docs fails for each guide once every line about plugin mode is gone', async () => {
  for (const guide of pluginGuides) {
    const root = await copyDocs();
    const file = path.join(root, guide);
    await fs.writeFile(file, withoutLines(await fs.readFile(file, 'utf8'), /plugin|mode\/|--mode/i), 'utf8');

    const result = await validateDocs({ root });

    assert.equal(result.ok, false, guide);
    assert.ok(result.failures.some((failure) => failure.startsWith(`${guide} must mention`)), `${guide}: ${result.failures.join('\n')}`);
  }
});

test('AC-20: check:docs fails when a guide loses the install command, the switch commands or a mode/* code', async () => {
  const marks = [
    ['docs/quickstart.md', 'claude plugin install fhh@fhh-ia-ecosystem --scope project'],
    ['docs/quickstart.md', 'copilot plugin install fhh@fhh-ia-ecosystem'],
    ['docs/quickstart.md', 'update --mode plugin'],
    ['docs/quickstart.md', 'update --mode repo'],
    ['docs/quickstart.md', 'mode/plugin-install-unverified'],
    ['docs/quickstart.md', 'mode/repo-and-plugin'],
    ['docs/github-install.md', '--mode plugin'],
    ['docs/github-install.md', 'claude plugin install fhh@fhh-ia-ecosystem --scope project'],
    ['docs/workflow/cross-runtime-capability-matrix.md', '\n## Plugin mode'],
    ['docs/README.md', 'quickstart.md#11-plugin-mode-pilot']
  ];
  for (const [guide, marker] of marks) {
    const root = await copyDocs();
    const file = path.join(root, guide);
    const content = await fs.readFile(file, 'utf8');
    assert.ok(content.includes(marker), `${guide} carries ${marker}`);
    await fs.writeFile(file, content.split(marker).join('\n'), 'utf8');

    const result = await validateDocs({ root });

    assert.equal(result.ok, false, `${guide} without ${marker}`);
  }
});

test('docs/migration.md must keep its "Rollback" and "Deciding edited files" sections', async () => {
  for (const heading of ['## Rollback', '### Deciding edited files']) {
    const root = await copyDocs();
    const file = path.join(root, 'docs/migration.md');
    const content = await fs.readFile(file, 'utf8');
    assert.ok(content.includes(`\n${heading}\n`), heading);
    await fs.writeFile(file, content.replace(`\n${heading}\n`, '\n'), 'utf8');

    const result = await validateDocs({ root });

    assert.equal(result.ok, false, heading);
    assert.ok(result.failures.some((failure) => failure.includes('docs/migration.md must mention')), result.failures.join('\n'));
  }
});

test('a missing plugin guide is reported', async () => {
  const root = await copyDocs();
  await fs.rm(path.join(root, 'docs/README.md'));

  const result = await validateDocs({ root });

  assert.ok(result.failures.includes('Required documentation file missing: docs/README.md'));
});

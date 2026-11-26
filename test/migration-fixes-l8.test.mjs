// Layout migration follow-ups (PRD manifest-updater, section 10, rounds 5 and 6):
// the stop for an index the migration cannot extend names the one cause that
// applies, and a section is never added inside an unclosed comment or fence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyInstallPlan } from '../src/apply.mjs';
import { buildUpdatePlan } from '../src/planner.mjs';
import { installLegacy0181 } from './fixtures/legacy-0.18.1/install.mjs';
import { hashTree, makeTempRepo } from './helpers.mjs';

const projectIndexPath = '.agents/project/index.md';
const skillsHeader = '| Skill name | Class | Trigger | Physical path | Cost hint |\n| --- | --- | --- | --- | --- |';

// A 0.18.x project whose index is `index`; the migration must stop on it.
async function stopFor(index) {
  const target = await makeTempRepo();
  await installLegacy0181(target);
  await fs.mkdir(path.dirname(path.join(target, projectIndexPath)), { recursive: true });
  await fs.writeFile(path.join(target, projectIndexPath), index);
  const before = await hashTree(target);
  let stop = null;
  // Dry run and apply plan through the same code: both stop alike.
  await assert.rejects(buildUpdatePlan({ targetPath: target }), (error) => ((stop = error), true));
  assert.equal(stop.code, 'PROJECT_INDEX_UNEXPECTED');
  assert.match(stop.message, /^\.agents\/project\/index\.md /);
  assert.match(stop.message, / and run `workflow-kit update --target .+` again\. Nothing was written\.$/s);
  assert.deepEqual(await hashTree(target), before, 'nothing is written');
  return stop.message;
}

const only = (message, present, absent) => {
  for (const text of present) assert.ok(message.includes(text), `${text} in: ${message}`);
  for (const text of absent) assert.ok(!message.includes(text), `${text} not in: ${message}`);
};

test('S4: an index without ## Skills that ends in an unclosed HTML comment stops instead of hiding the new section in it', async () => {
  const message = await stopFor('# Catalog\n\nNotes.\n\n<!-- old rows\n');
  only(message, ['has no ## Skills section', 'ends inside an HTML comment that is never closed', 'the last line is 5', 'Close the HTML comment'], ['mixes line endings', 'repeats', 'separator', 'header']);
});

test('S4: an index without ## Skills that ends in an unclosed code fence stops instead of hiding the new section in it', async () => {
  const message = await stopFor('# Catalog\n\n```markdown\n## Notes\n');
  only(message, ['has no ## Skills section', 'ends inside a code block that is never closed', 'Close the code block'], ['HTML comment', 'mixes line endings']);
});

test('S4: a closed comment at the end of an index without ## Skills still gets the new section', async () => {
  const target = await makeTempRepo();
  await installLegacy0181(target);
  await fs.mkdir(path.dirname(path.join(target, projectIndexPath)), { recursive: true });
  await fs.writeFile(path.join(target, projectIndexPath), '# Catalog\n\n<!-- old rows -->\n');
  const plan = await buildUpdatePlan({ targetPath: target });
  await applyInstallPlan(plan);
  const content = await fs.readFile(path.join(target, projectIndexPath), 'utf8');
  assert.ok(content.startsWith('# Catalog\n\n<!-- old rows -->\n\n## Skills\n'));
});

test('S4b: a header with the right columns but no separator row is not reported as a missing header', async () => {
  const message = await stopFor(`## Skills\n\n| Skill name | Class | Trigger | Physical path | Cost hint |\n| retry | Pattern | when | \`a\` | lean |\n`);
  only(message, ['no separator row', 'after the ## Skills header on line 3', 'Add the separator row'], ['lacks', 'is not | Skill name', 'repeats', 'mixes line endings']);
});

test('S4a: a first table with other columns names the line and the expected header', async () => {
  const message = await stopFor('# Catalog\n\n## Skills\n\n| Skill | Trigger | Path |\n| --- | --- | --- |\n| `x` | y | `z` |\n');
  only(message, ['has a header on line 5', 'the first table under ## Skills', '| Skill name | Class | Trigger | Physical path | Cost hint |', 'Fix that header'], ['separator row', 'mixes line endings', 'repeats']);
});

test('S4a: a second ## Skills heading names both lines', async () => {
  const message = await stopFor(`## Skills\n\n${skillsHeader}\n\n## Skills\n`);
  only(message, ['line 6 repeats the ## Skills heading of line 1', 'Keep one ## Skills heading'], ['separator row', 'mixes line endings', 'inside a']);
});

test('S4a: a heading inside a code block names the block and the line', async () => {
  const message = await stopFor(`# Catalog\n\n\`\`\`markdown\n## Skills\n\n${skillsHeader}\n\`\`\`\n`);
  only(message, ['only ## Skills heading (line 4) inside a code block', 'Move the heading out of the code block'], ['HTML comment', 'repeats', 'mixes line endings']);
});

test('S4a: a heading inside an HTML comment names the comment and the line', async () => {
  const message = await stopFor(`# Catalog\n\n<!--\n## Skills\n\n${skillsHeader}\n-->\n`);
  only(message, ['only ## Skills heading (line 4) inside an HTML comment', 'Move the heading out of the HTML comment'], ['code block', 'repeats', 'mixes line endings']);
});

test('S4a: mixed line endings name the first line that breaks the CRLF file', async () => {
  const message = await stopFor(`# Catalog\r\n\n## Skills\n\n${skillsHeader}\n`);
  only(message, ['mixes line endings (line 2 ends without a carriage return', 'Make every line end the same way'], ['separator row', 'repeats', 'inside a']);
});

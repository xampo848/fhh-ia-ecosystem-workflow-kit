// Third round of kit text fixes found by the pilot: where project standards
// live, the route for the initial Discovery, template detection by marker, and
// the moment calibration tells the user. Structural checks over the kit tree
// and its overlay mirror.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'templates/repo-overlay-fhh-ia-ecosystem-full';
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const bothCopies = (file) => [file, `${overlay}/${file}`];
const calibrationFile = '.agents/skills/01-product/create-prd/reference/calibration.md';
const routerFile = '.agents/skills/00-router/workflow-router/SKILL.md';

test('calibration tells the agent not to read the setup guides and to follow pointers instead', async () => {
  for (const file of bothCopies(calibrationFile)) {
    const lines = (await read(file)).split('\n').filter((line) => /docs\/workflow\/standards\/(backend|frontend)\.md/.test(line));
    assert.equal(lines.length, 1, file);
    assert.match(lines[0], /docs\/workflow\/standards\/backend\.md/, file);
    assert.match(lines[0], /docs\/workflow\/standards\/frontend\.md/, file);
    assert.match(lines[0], /do not read/i, file);
    assert.doesNotMatch(lines[0], /only when/, file);
    assert.match(lines[0], /pointer/, file);
  }
});

test('the standards guides say agents read .agents/project files and reach longer standards by pointer', async () => {
  for (const guide of ['backend', 'frontend']) {
    for (const file of bothCopies(`docs/workflow/standards/${guide}.md`)) {
      const text = await read(file);
      const lines = text.split('\n');
      assert.doesNotMatch(text, /canonical \w+ standards location in this folder/, file);
      const section = text.slice(text.indexOf('## Runtime instruction file expected by skills'));
      assert.match(section, /pointer/, `${file}: runtime section`);
      const last = lines.filter((line) => line.trim()).at(-1);
      assert.match(last, new RegExp(`\\.agents/project/${guide}\\.md`), `${file}: last line`);
      assert.match(last, /pointer/, `${file}: last line`);
    }
  }
});

test('setup-and-migration checklist does not claim agents read docs/workflow/standards directly', async () => {
  for (const file of bothCopies('docs/workflow/standards/setup-and-migration.md')) {
    const lines = (await read(file)).split('\n').filter((line) => /^- (Backend|Frontend) standards/.test(line));
    assert.equal(lines.length, 2, file);
    for (const line of lines) assert.match(line, /pointer/, `${file}: ${line}`);
  }
});

test('the initial Discovery of the project has a route and the template says how to ask for it', async () => {
  for (const file of bothCopies(routerFile)) {
    const rows = (await read(file)).split('\n').filter((line) => line.startsWith('| Project context setup |'));
    assert.equal(rows.length, 1, file);
    assert.match(rows[0], /haz el Discovery inicial del proyecto/, file);
    assert.match(rows[0], /\.agents\/project\/context\.md/, file);
    assert.match(rows[0], /200-line/, file);
    assert.match(rows[0], /No when the imperative names it; else Yes/, file);
  }
  for (const file of bothCopies('.agents/project/context.md')) {
    const text = (await read(file)).replace(/\s+/g, ' ');
    assert.match(text, /initial Discovery of the project/, file);
    assert.match(text, /ask your agent for the initial Discovery of the project/i, file);
  }
  assert.ok((await read(routerFile)).split('\n').length <= 200, 'router stays within its line budget');
});

test('calibration detects a template by its marker, not by [TODO placeholders alone', async () => {
  for (const file of bothCopies(calibrationFile)) {
    const text = await read(file);
    assert.doesNotMatch(text, /still contains only `\[TODO`/, file);
    assert.ok(text.includes('<!-- workflow-kit:project-context:template -->'), file);
    assert.ok(text.includes('<!-- workflow-kit:project-instructions:template -->'), file);
    assert.match(text, /treat any remaining `\[TODO` field as unknown for that field only/, file);
  }
  // The strings calibration cites are the ones the templates really carry.
  assert.ok((await read('.agents/project/context.md')).includes('<!-- workflow-kit:project-context:template -->'));
  for (const guide of ['backend', 'frontend']) {
    assert.ok((await read(`.agents/project/${guide}.md`)).includes('<!-- workflow-kit:project-instructions:template -->'));
  }
});

test('calibration says when it tells the user and Summary Visibility agrees', async () => {
  for (const file of bothCopies(calibrationFile)) {
    const text = await read(file);
    const notice = text.split('\n').find((line) => /tell the user|notice/.test(line) && /template marker/.test(line));
    assert.ok(notice, `${file}: template notice bullet`);
    assert.match(notice, /first message/, file);
    assert.match(notice, /first question round or the draft, whichever comes first/, file);
    const visibility = text.slice(text.indexOf('## Summary Visibility'));
    assert.match(visibility, /template marker/, `${file}: Summary Visibility lists the marker`);
    assert.match(visibility, /one-line notice/, file);
  }
});

test('doctor, troubleshooting and the context template name the same route for the initial Discovery', async () => {
  const sources = ['src/workspace-diagnostics.mjs', 'docs/troubleshooting.md', ...bothCopies('.agents/project/context.md')];
  for (const file of sources) {
    const text = (await read(file)).replace(/\s+/g, ' ');
    assert.match(text, /initial Discovery of the project \([^)]*project context setup\)/, file);
  }
  for (const file of bothCopies('.agents/project/context.md')) {
    assert.match((await read(file)).replace(/\s+/g, ' '), /After the initial Discovery, only the orchestrator updates it/, file);
  }
  for (const file of bothCopies(routerFile)) {
    const row = (await read(file)).split('\n').find((line) => line.startsWith('| Project context setup'));
    assert.match(row, /once authorized, direct edit/, file);
  }
});

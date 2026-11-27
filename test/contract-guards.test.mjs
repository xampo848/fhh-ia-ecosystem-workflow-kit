import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mirror = 'templates/repo-overlay-fhh-ia-ecosystem-full/';

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

// Every guard reads the kit file and its overlay-template mirror: both ship to projects.
async function copiesOf(relativePath) {
  const [kit, template] = await Promise.all([read(relativePath), read(`${mirror}${relativePath}`)]);
  assert.equal(template, kit, `${relativePath} and its template mirror must be byte-identical`);
  return [relativePath, kit];
}

const flat = (text) => text.replace(/\s+/g, ' ');

test('the runbook template keeps the fields PRD project-runbooks AC-4 requires, in both copies', async () => {
  const [file, content] = await copiesOf('.agents/skills/06-patterns/authoring/runbook-template.md');
  const lines = content.split('\n');
  assert.ok(lines.length <= 200, `${file} stays at or under 200 lines`);
  assert.match(lines.slice(0, 6).join(' '), /Use this template when/, 'the first lines say when to use it');
  const body = /```markdown\n([\s\S]*?)```/.exec(content)?.[1];
  assert.ok(body, `${file} has the fenced runbook body`);

  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? '';
  assert.match(frontmatter, /^name: <runbook-name>$/m, 'frontmatter name is a placeholder');
  assert.match(frontmatter, /^description: ".*<operational-procedure>.*"$/m, 'frontmatter description is a placeholder');
  for (const heading of ['## Trigger', '## Owner', '## Preconditions', '## Steps', '## Verification', '## Rollback']) {
    assert.ok(body.split('\n').includes(heading), `${file} has the heading ${heading}`);
  }
  assert.match(body, /^- last_verified: <YYYY-MM-DD>$/m, '## Owner carries last_verified');
  assert.match(body, /— check: `<command-or-observation>`/, 'preconditions carry a check');

  // The irreversible step and the irreversible rollback step each carry both marks.
  const marks = [...body.matchAll(/^ {3}- confirm: required\n {3}- risk: <concrete-consequence>$/gm)];
  assert.ok(marks.length >= 2, `${file} marks an irreversible step and an irreversible rollback step with confirm: required and risk:`);

  // Secrets are placeholders only: names in angle brackets, never a value.
  assert.match(body, /reading `<SECRET_NAME>`\s+from `<secret-store-name>`/, 'the secret step names a placeholder and a store');
  assert.match(body, /never\s+as values/, 'the template says secrets are never values');
  assert.doesNotMatch(body, /(?:secret|token|password|api[_-]?key)\w*\s*[:=]\s*[^\s<`]/i, 'no secret-like assignment');
  assert.doesNotMatch(body, /\b(?:sk-|ghp_|AKIA)[A-Za-z0-9]/, 'no literal credential prefix');
  assert.doesNotMatch(body, /\.agents\/skills\//, 'the body names kit skills by name, never by path');
});

test('registry.schema.json enumerates exactly the six kit classes, in both copies', async () => {
  // PRD project-runbooks AC-2: Runbook is a class of the project catalog only.
  const [file, content] = await copiesOf('.agents/skills/registry.schema.json');
  const schema = JSON.parse(content);
  const found = [];
  const visit = (node, key) => {
    if (Array.isArray(node)) return node.forEach((item) => visit(item, key));
    if (node && typeof node === 'object') {
      for (const [name, value] of Object.entries(node)) {
        if (name === 'class' && value && Array.isArray(value.enum)) found.push(value.enum);
        else visit(value, name);
      }
    }
  };
  visit(schema);
  assert.ok(found.length > 0, `${file} enumerates class`);
  for (const values of found) {
    assert.deepEqual(values, ['Workflow', 'Delegate-only implementation', 'Quality/validation', 'Cross-cutting overlay', 'Mode/helper', 'Standards/pattern']);
  }
});

test('the delegate contract states the legacy context fallback and the kit-first reading order, in both copies', async () => {
  const [file, content] = await copiesOf('.agents/delegation/delegate-contract.md');
  const text = flat(content);
  // PRD kit-overlay-contract AC-8: read the new context file and, if missing, the old one.
  assert.match(text, /relevant section of `\.agents\/project\/context\.md` \(legacy: `\.agents\/project-context\.md`\)/, `${file} states the legacy fallback next to the current path`);
  // PRD kit-overlay-contract AC-7: the kit quality gate first, then the project additions.
  const kit = text.indexOf('kit default `.agents/delegation/quality-gate.md`, then the project additions in `.agents/project/quality-gate.md` when present');
  assert.ok(kit >= 0, `${file} reads the kit quality gate first, then the project additions`);
  assert.match(text, /The kit default always applies; if it is missing, report `quality gate: not configured`; never skip it silently\./);
});

test('the kit quality gate lets project additions tighten, never relax, in both copies', async () => {
  const [file, content] = await copiesOf('.agents/delegation/quality-gate.md');
  const text = flat(content);
  assert.match(text, /After it, read the project additions in `\.agents\/project\/quality-gate\.md` when that file exists: they may tighten these rules, never relax them/, `${file} keeps the tighten-never-relax rule`);
  assert.doesNotMatch(text, /tighten or relax|relax or tighten/i);
});

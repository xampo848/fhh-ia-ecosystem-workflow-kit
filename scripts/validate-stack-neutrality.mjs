#!/usr/bin/env node
// The workflow core is stack-neutral (roadmap D-30):
// 1. core skills do not state a framework, library, or project command as a
//    rule (a line may name one only as an explicit example);
// 2. every rule that left the core is present in its stack pack, so a project
//    that installs the pack keeps exactly the same rules.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreRoots = ['.agents/skills/00-router', '.agents/skills/01-product', '.agents/skills/02-implement', '.agents/skills/03-quality', '.agents/delegation'];
// Stack tools are loaded only when their stack is detected; they may name it.
const stackToolPrefixes = ['.agents/skills/03-quality/react-doctor/', '.agents/skills/03-quality/playwright-testing/'];
const stackTerms = /\b(Rails|Ruby|Minitest|RSpec|RuboCop|rubocop|Bullet|CanCanCan|Pundit|acts_as_tenant|enumerate_it|TanStack|Zustand|Formik|Yup|Vitest|Jest|MSW|Sidekiq|Django|Laravel)\b|\bTesting Library\b|\bmake test|\bbun run |\bbundle exec\b/;
const exampleMarker = /for example|e\.g\.|p\. ?ej\.|por ejemplo/i;

async function markdownFiles(root, directory) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await markdownFiles(root, relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
  }
  return files;
}

export async function validateStackNeutrality({ root = packageRoot } = {}) {
  const failures = [];
  for (const coreRoot of coreRoots) {
    for (const file of await markdownFiles(root, coreRoot)) {
      if (stackToolPrefixes.some((prefix) => file.startsWith(prefix))) continue;
      const lines = (await fs.readFile(path.join(root, file), 'utf8')).split('\n');
      lines.forEach((line, index) => {
        const match = line.match(stackTerms);
        if (match && !exampleMarker.test(line)) {
          failures.push(`${file}:${index + 1} states "${match[0].trim()}" as a rule — move it to a stack pack or mark the line as an example.`);
        }
      });
    }
  }

  const inventory = JSON.parse(await fs.readFile(path.join(root, 'scripts/stack-rule-inventory.json'), 'utf8'));
  const packPath = `templates/stack-packs/${inventory.pack}/stack.md`;
  let pack;
  try {
    pack = await fs.readFile(path.join(root, packPath), 'utf8');
  } catch {
    return { ok: false, failures: [...failures, `Missing stack pack: ${packPath}`] };
  }
  const seen = new Set();
  for (const rule of inventory.rules ?? []) {
    if (!rule.id || seen.has(rule.id)) failures.push(`Invalid or duplicate stack rule id: ${rule.id}`);
    seen.add(rule.id);
    if (!rule.packPattern || !new RegExp(rule.packPattern).test(pack)) {
      failures.push(`Rule "${rule.id}" (moved from ${rule.movedFrom}) is missing from ${packPath}.`);
    }
  }
  return { ok: failures.length === 0, failures, ruleCount: seen.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateStackNeutrality();
  if (!result.ok) {
    console.error('Stack neutrality validation failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Workflow core is stack-neutral; the stack pack keeps all ${result.ruleCount} moved rules.`);
}

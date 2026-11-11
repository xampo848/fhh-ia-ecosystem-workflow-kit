#!/usr/bin/env node
// Deterministic validation fingerprint and reuse decision (roadmap D-20, IA-09).
// The agent only invokes this script; it never computes a fingerprint by hand.
// If the script cannot run, the fingerprint is `unknown` and the check runs.
//
//   fingerprint  --scope <path>... [--config <path>...] [--generated <path>...]
//                [--migrations <path>...] [--tool <name=version>...] [--root <dir>]
//   decide       --registry <file> --kind <kind> --command <cmd> --scope-id <id>
//                --fingerprint <hash> [--mode shadow|active] [--critical] [--closure]
//                [--covers <wider-scope-id>...]
//   record       --registry <file> --kind <kind> --command <cmd> --scope-id <id>
//                --fingerprint <hash> --result PASS|FAIL --stage <stage>
//
// Needs only Node.js. Exit code 2 means a usage error.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const lockfileNames = [
  'bun.lock', 'bun.lockb', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'Gemfile.lock', 'poetry.lock', 'uv.lock', 'Pipfile.lock', 'go.sum', 'Cargo.lock', 'composer.lock'
];
// Expensive and deterministic: worth reusing. Cheap checks simply run, and
// integration/E2E depend on state the fingerprint cannot see.
export const reusableKinds = ['typecheck', 'unit', 'build'];
export const wideningKinds = ['lint', 'typecheck'];
const ignoredDirectories = new Set(['node_modules', '.git', '.ai-work', 'dist', 'tmp', 'log', 'coverage']);

function collectFiles(root, entry, files) {
  const absolute = path.resolve(root, entry);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch {
    files.push({ relative: path.relative(root, absolute).split(path.sep).join('/'), missing: true });
    return;
  }
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute).sort()) {
      if (ignoredDirectories.has(child)) continue;
      collectFiles(root, path.join(entry, child), files);
    }
  } else if (stat.isFile()) {
    files.push({ relative: path.relative(root, absolute).split(path.sep).join('/'), absolute });
  }
}

export function computeFingerprint({ root = process.cwd(), scope = [], config = [], generated = [], migrations = [], tools = [] } = {}) {
  if (scope.length === 0) throw new Error('At least one --scope path is required.');
  const lockfiles = lockfileNames.filter((name) => fs.existsSync(path.join(root, name)));
  const groups = { scope, config, generated, migrations, lockfiles };
  const hash = createHash('sha256');
  const summary = {};

  for (const [group, entries] of Object.entries(groups)) {
    const files = [];
    for (const entry of [...entries].sort()) collectFiles(root, entry, files);
    files.sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
    summary[group] = files.length;
    hash.update(`#${group}\n`);
    for (const file of files) {
      const content = file.missing ? 'MISSING' : createHash('sha256').update(fs.readFileSync(file.absolute)).digest('hex');
      hash.update(`${file.relative}\0${content}\n`);
    }
  }

  const toolEntries = [`node=${process.version}`, ...tools].sort();
  hash.update('#tools\n');
  for (const tool of toolEntries) hash.update(`${tool}\n`);

  return { fingerprint: hash.digest('hex'), files: summary, tools: toolEntries };
}

export function readRegistry(registryPath) {
  let content;
  try {
    content = fs.readFileSync(registryPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return content.split('\n').filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
}

export function recordEvidence({ registryPath, kind, command, scopeId, fingerprint, result, stage, now = new Date() }) {
  if (!['PASS', 'FAIL'].includes(result)) throw new Error('--result must be PASS or FAIL.');
  const entry = { time: now.toISOString(), stage, kind, command, scope_id: scopeId, fingerprint, result };
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.appendFileSync(registryPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

// Returns RUN, REUSE or KNOWN_FAIL. In shadow mode the answer is always RUN and
// `would` records what active mode would have decided, so equivalence can be
// proven with real runs before any saving is switched on.
export function decideReuse({ registry, kind, command, scopeId, fingerprint, mode = 'shadow', critical = false, closure = false, covers = [] }) {
  const run = (reason) => ({ decision: 'RUN', reason });
  if (!fingerprint || fingerprint === 'unknown') return run('fingerprint is unknown');
  if (critical) return run('slice touches a critical concern: nothing is reused');
  if (closure) return run('closure suite always runs');
  if (!reusableKinds.includes(kind) && !(wideningKinds.includes(kind) && covers.length > 0)) {
    return run(`kind "${kind}" is not reused (cheap, or depends on state outside the fingerprint)`);
  }

  const sameContent = registry.filter((entry) => entry.fingerprint === fingerprint && entry.kind === kind);
  const exact = sameContent.filter((entry) => entry.command === command && entry.scope_id === scopeId);
  // Exact-match reuse is only for expensive deterministic kinds; lint is cheap
  // and is reused only through a wider PASS.
  const latest = reusableKinds.includes(kind) ? exact[exact.length - 1] : undefined;
  // A PASS over a wider scope covers a narrower one only for lint and types.
  const wider = wideningKinds.includes(kind)
    ? sameContent.filter((entry) => entry.result === 'PASS' && covers.includes(entry.scope_id)).pop()
    : undefined;

  let active;
  if (latest?.result === 'PASS') active = { decision: 'REUSE', reason: `reutilizado de ${latest.stage}, huella ${fingerprint.slice(0, 12)}`, source: latest };
  else if (latest?.result === 'FAIL') active = { decision: 'KNOWN_FAIL', reason: `same command, scope and content already failed in ${latest.stage}; fix it instead of rerunning`, source: latest };
  else if (wider) active = { decision: 'REUSE', reason: `reutilizado de ${wider.stage} (alcance mayor ${wider.scope_id}), huella ${fingerprint.slice(0, 12)}`, source: wider };
  else return run('no matching evidence in the registry');

  if (mode === 'active') return active;
  return { decision: 'RUN', reason: 'shadow mode: run anyway and compare', would: active.decision, wouldReason: active.reason };
}

function parseArguments(argv) {
  const options = { _: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
    const key = name.slice(2);
    if (key === 'critical' || key === 'closure') { options[key] = true; continue; }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
    index += 1;
    (options[key] ??= []).push(value);
  }
  return options;
}

const one = (options, key) => options[key]?.[options[key].length - 1];

function main(argv) {
  const options = parseArguments(argv);
  if (options._ === 'fingerprint') {
    const result = computeFingerprint({
      root: one(options, 'root') ?? process.cwd(),
      scope: options.scope ?? [],
      config: options.config ?? [],
      generated: options.generated ?? [],
      migrations: options.migrations ?? [],
      tools: options.tool ?? []
    });
    console.log(`fingerprint: ${result.fingerprint}`);
    console.log(`inputs: ${Object.entries(result.files).map(([group, count]) => `${group}=${count}`).join(' ')} tools=${result.tools.join(',')}`);
    return 0;
  }
  const shared = {
    kind: one(options, 'kind'),
    command: one(options, 'command'),
    scopeId: one(options, 'scope-id'),
    fingerprint: one(options, 'fingerprint')
  };
  const registryPath = one(options, 'registry');
  if (!registryPath || !shared.kind || !shared.command || !shared.scopeId) throw new Error('--registry, --kind, --command and --scope-id are required.');
  if (options._ === 'decide') {
    const result = decideReuse({
      registry: readRegistry(registryPath),
      ...shared,
      mode: one(options, 'mode') ?? 'shadow',
      critical: Boolean(options.critical),
      closure: Boolean(options.closure),
      covers: options.covers ?? []
    });
    console.log(`decision: ${result.decision}`);
    console.log(`reason: ${result.reason}`);
    if (result.would) console.log(`would: ${result.would} (${result.wouldReason})`);
    return 0;
  }
  if (options._ === 'record') {
    recordEvidence({ registryPath, ...shared, result: one(options, 'result'), stage: one(options, 'stage') ?? 'unknown' });
    console.log('recorded');
    return 0;
  }
  throw new Error('Use one of: fingerprint, decide, record.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`validation-fingerprint: ${error.message}`);
    process.exitCode = 2;
  }
}

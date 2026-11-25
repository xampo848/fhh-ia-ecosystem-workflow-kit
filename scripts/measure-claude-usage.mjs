#!/usr/bin/env node
// Measures Claude Code token consumption per agent type from local transcripts.
//
// Read-only: it reads `~/.claude/projects/**` and prints counts. It never
// writes there, never sends data off the machine, and never prints prompt or
// tool-result content. It depends on local data, so it is not part of
// `check:workflow`.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isMainModule } from './is-main-module.mjs';

// Relative weights per token, used only to compare shares. They are
// proportions, not billed USD: input 1, cache read 0.1, cache write 1.25 (5 min)
// or 2 (1 h), output 5.
export const TOKEN_WEIGHTS = Object.freeze({
  input: 1,
  cacheRead: 0.1,
  cacheWrite5m: 1.25,
  cacheWrite1h: 2,
  output: 5
});

export const HIGH_CONTEXT_THRESHOLD = 150_000;
export const CONTEXT_BUCKET_SIZE = 50_000;
export const MAIN_AGENT = 'MAIN';
export const UNKNOWN_SUBAGENT = 'unknown-subagent';

const DAY_MS = 24 * 60 * 60 * 1000;

const usage = `Usage: node scripts/measure-claude-usage.mjs [--project <repo path>] [--days <n>] [--json] [--projects-root <dir>]

  --project        repository path whose Claude Code transcripts are measured (default: current directory)
  --days           window in days, counted back from now (default: 7)
  --json           print a stable JSON summary instead of tables
  --projects-root  transcript root (default: ~/.claude/projects)`;

// Claude Code names a project directory after its path with every
// non-alphanumeric character replaced by '-'.
export function encodeProjectPath(projectPath) {
  return path.resolve(projectPath).replace(/[^A-Za-z0-9]/g, '-');
}

// The project directory itself plus worktrees nested under a hidden directory
// of the project (for example `.claude/worktrees/<name>`), which encode as
// `<project>--<rest>`. A sibling repository such as `<project>-kit` is excluded.
export function isProjectDirectory(name, encodedProject) {
  return name === encodedProject || name.startsWith(`${encodedProject}--`);
}

export async function findProjectDirectories(projectsRoot, projectPath) {
  const encoded = encodeProjectPath(projectPath);
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && isProjectDirectory(entry.name, encoded))
    .map((entry) => path.join(projectsRoot, entry.name))
    .sort();
}

async function listFiles(directory, predicate) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => path.join(directory, entry.name)).sort();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

async function readAgentType(transcriptPath) {
  const metaPath = transcriptPath.replace(/\.jsonl$/, '.meta.json');
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    return typeof meta.agentType === 'string' && meta.agentType ? meta.agentType : UNKNOWN_SUBAGENT;
  } catch {
    // A subagent transcript without readable meta is still a subagent; keeping
    // it out of MAIN stops it from skewing the main-thread medians.
    return UNKNOWN_SUBAGENT;
  }
}

// Every main transcript `<session>.jsonl` and every subagent transcript
// `<session>/subagents/agent-*.jsonl` with its agent type.
export async function listTranscripts(projectDirectory) {
  const transcripts = [];
  for (const file of await listFiles(projectDirectory, (name) => name.endsWith('.jsonl'))) {
    const session = path.basename(file, '.jsonl');
    transcripts.push({ file, session, agentType: MAIN_AGENT });
    const subagentDirectory = path.join(projectDirectory, session, 'subagents');
    for (const subFile of await listFiles(subagentDirectory, (name) => name.startsWith('agent-') && name.endsWith('.jsonl'))) {
      transcripts.push({ file: subFile, session, agentType: await readAgentType(subFile) });
    }
  }
  return transcripts;
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function normalizeUsage(rawUsage) {
  const input = numberOrZero(rawUsage?.input_tokens);
  const cacheRead = numberOrZero(rawUsage?.cache_read_input_tokens);
  const cacheWriteTotal = numberOrZero(rawUsage?.cache_creation_input_tokens);
  const cacheWrite1h = numberOrZero(rawUsage?.cache_creation?.ephemeral_1h_input_tokens);
  const cacheWrite5m = rawUsage?.cache_creation ? numberOrZero(rawUsage.cache_creation.ephemeral_5m_input_tokens) : cacheWriteTotal;
  const output = numberOrZero(rawUsage?.output_tokens);
  return { input, cacheRead, cacheWrite5m, cacheWrite1h, output };
}

export function weightedCost(tokens, weights = TOKEN_WEIGHTS) {
  return {
    input: tokens.input * weights.input,
    read: tokens.cacheRead * weights.cacheRead,
    write: tokens.cacheWrite5m * weights.cacheWrite5m + tokens.cacheWrite1h * weights.cacheWrite1h,
    output: tokens.output * weights.output
  };
}

export function contextSize(tokens) {
  return tokens.input + tokens.cacheRead + tokens.cacheWrite5m + tokens.cacheWrite1h;
}

function toolResultLength(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  let length = 0;
  for (const block of content) {
    if (typeof block?.text === 'string') length += block.text.length;
    else if (typeof block?.source?.data === 'string') length += block.source.data.length;
  }
  return length;
}

// Parses one transcript into deduplicated requests, compactions, and
// tool-result sizes. The transcript repeats the same assistant response once
// per content block, so a request is counted once per `message.id`.
export function parseTranscript(text, { sinceMs = -Infinity } = {}) {
  const requests = [];
  const seenMessageIds = new Set();
  const toolNames = new Map();
  const toolResultChars = new Map();
  let compactions = 0;

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const timestampMs = Date.parse(record.timestamp);
    const inWindow = Number.isFinite(timestampMs) ? timestampMs >= sinceMs : sinceMs === -Infinity;

    if (record.type === 'system' && record.subtype === 'compact_boundary') {
      if (inWindow) compactions += 1;
      continue;
    }

    const content = record.message?.content;
    if (record.type === 'assistant') {
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'tool_use' && typeof block.id === 'string') toolNames.set(block.id, block.name ?? 'unknown');
        }
      }
      const messageId = record.message?.id;
      if (!inWindow || typeof messageId !== 'string' || seenMessageIds.has(messageId)) continue;
      const tokens = normalizeUsage(record.message?.usage);
      if (contextSize(tokens) + tokens.output === 0) continue;
      seenMessageIds.add(messageId);
      requests.push({ model: record.message?.model ?? 'unknown', tokens });
      continue;
    }

    if (record.type === 'user' && inWindow && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type !== 'tool_result') continue;
        const tool = toolNames.get(block.tool_use_id) ?? 'unknown';
        toolResultChars.set(tool, (toolResultChars.get(tool) ?? 0) + toolResultLength(block.content));
      }
    }
  }

  return { requests, compactions, toolResultChars };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(part, total) {
  return total > 0 ? round((part / total) * 100) : 0;
}

function newAgentAccumulator() {
  return {
    sessions: new Set(),
    runs: [],
    requests: 0,
    cost: { input: 0, read: 0, write: 0, output: 0 },
    highContextCost: 0,
    compactions: 0,
    toolResultChars: new Map()
  };
}

function totalCost(cost) {
  return cost.input + cost.read + cost.write + cost.output;
}

function addMap(target, source) {
  for (const [key, value] of source) target.set(key, (target.get(key) ?? 0) + value);
}

function sortedObject(map, valueOf = (value) => value) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, value]) => [key, valueOf(value)]));
}

export async function measureUsage({ projectsRoot, projectPath, days = 7, now = Date.now(), weights = TOKEN_WEIGHTS }) {
  const sinceMs = now - days * DAY_MS;
  const directories = await findProjectDirectories(projectsRoot, projectPath);
  const agents = new Map();
  const models = new Map();
  const mainBuckets = new Map();
  let transcriptCount = 0;

  for (const directory of directories) {
    for (const transcript of await listTranscripts(directory)) {
      const stat = await fs.stat(transcript.file);
      if (stat.mtimeMs < sinceMs) continue;
      const parsed = parseTranscript(await fs.readFile(transcript.file, 'utf8'), { sinceMs });
      if (parsed.requests.length === 0 && parsed.compactions === 0) continue;
      transcriptCount += 1;

      const agent = agents.get(transcript.agentType) ?? newAgentAccumulator();
      agents.set(transcript.agentType, agent);
      agent.compactions += parsed.compactions;
      addMap(agent.toolResultChars, parsed.toolResultChars);
      if (parsed.requests.length === 0) continue;

      agent.sessions.add(transcript.session);
      const contexts = [];
      for (const request of parsed.requests) {
        const cost = weightedCost(request.tokens, weights);
        const requestCost = totalCost(cost);
        const context = contextSize(request.tokens);
        contexts.push(context);
        agent.requests += 1;
        for (const key of Object.keys(agent.cost)) agent.cost[key] += cost[key];
        if (context > HIGH_CONTEXT_THRESHOLD) agent.highContextCost += requestCost;
        models.set(request.model, (models.get(request.model) ?? 0) + requestCost);
        if (transcript.agentType === MAIN_AGENT) {
          const bucket = Math.floor(context / CONTEXT_BUCKET_SIZE) * CONTEXT_BUCKET_SIZE;
          mainBuckets.set(bucket, (mainBuckets.get(bucket) ?? 0) + requestCost);
        }
      }
      agent.runs.push({ initialContext: contexts[0], peakContext: Math.max(...contexts), requests: contexts.length });
    }
  }

  const grandTotal = [...agents.values()].reduce((sum, agent) => sum + totalCost(agent.cost), 0);
  const agentRows = [...agents.entries()]
    .map(([agentType, agent]) => {
      const cost = totalCost(agent.cost);
      const toolChars = [...agent.toolResultChars.values()].reduce((sum, value) => sum + value, 0);
      return {
        agentType,
        sessions: agent.sessions.size,
        runs: agent.runs.length,
        requests: agent.requests,
        costShare: percent(cost, grandTotal),
        weightedCost: Math.round(cost),
        costMix: {
          input: percent(agent.cost.input, cost),
          cacheRead: percent(agent.cost.read, cost),
          cacheWrite: percent(agent.cost.write, cost),
          output: percent(agent.cost.output, cost)
        },
        highContextCostShare: percent(agent.highContextCost, cost),
        medianInitialContext: median(agent.runs.map((run) => run.initialContext)),
        medianPeakContext: median(agent.runs.map((run) => run.peakContext)),
        medianRequestsPerRun: median(agent.runs.map((run) => run.requests)),
        compactions: agent.compactions,
        toolResultChars: sortedObject(agent.toolResultChars),
        toolResultShare: sortedObject(agent.toolResultChars, (value) => percent(value, toolChars))
      };
    })
    .sort((a, b) => b.weightedCost - a.weightedCost || a.agentType.localeCompare(b.agentType));

  const mainCost = [...mainBuckets.values()].reduce((sum, value) => sum + value, 0);
  const mainContextBuckets = [...mainBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, cost]) => ({ fromTokens: from, toTokens: from + CONTEXT_BUCKET_SIZE, costShare: percent(cost, mainCost) }));

  return {
    schemaVersion: 1,
    window: { days, since: new Date(sinceMs).toISOString(), until: new Date(now).toISOString() },
    weights: { ...weights },
    highContextThreshold: HIGH_CONTEXT_THRESHOLD,
    projectDirectories: directories.map((directory) => path.basename(directory)),
    transcripts: transcriptCount,
    totalWeightedCost: Math.round(grandTotal),
    agents: agentRows,
    mainContextBuckets,
    modelCostShare: sortedObject(models, (value) => percent(value, grandTotal)),
    compactions: agentRows.reduce((sum, row) => sum + row.compactions, 0)
  };
}

function kilo(value) {
  return `${Math.round(value / 1000)}k`;
}

function table(headers, rows) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function topEntries(object, limit) {
  return Object.entries(object).slice(0, limit).map(([key, value]) => `${key} ${value}%`).join(', ');
}

export function formatReport(summary) {
  const sections = [
    `Window: ${summary.window.days} days (${summary.window.since} → ${summary.window.until})`,
    `Transcripts: ${summary.transcripts} in ${summary.projectDirectories.length} project directories. Compactions: ${summary.compactions}.`,
    'Weights are relative per-token proportions, not billed USD.',
    '',
    table(
      ['Agent', '% cost', 'Runs', 'Requests', 'Initial ctx (median)', 'Peak (median)', 'Req/run (median)', `% cost > ${kilo(summary.highContextThreshold)}`, 'read/write/output %'],
      summary.agents.map((row) => [
        row.agentType,
        row.costShare,
        row.runs,
        row.requests,
        kilo(row.medianInitialContext),
        kilo(row.medianPeakContext),
        row.medianRequestsPerRun,
        row.highContextCostShare,
        `${row.costMix.cacheRead}/${row.costMix.cacheWrite}/${row.costMix.output}`
      ])
    ),
    '',
    'Main thread cost by context size:',
    table(['Context', '% main cost'], summary.mainContextBuckets.map((bucket) => [`${kilo(bucket.fromTokens)}–${kilo(bucket.toTokens)}`, bucket.costShare])),
    '',
    table(['Model', '% cost'], Object.entries(summary.modelCostShare).map(([model, share]) => [model, share])),
    '',
    'Tool-result characters by tool (top 5):',
    table(['Agent', 'Share'], summary.agents.map((row) => [row.agentType, topEntries(row.toolResultShare, 5) || '—']))
  ];
  return sections.join('\n');
}

export async function runMeasureCli(argv, { home = os.homedir(), cwd = process.cwd(), now = Date.now() } = {}) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        project: { type: 'string' },
        days: { type: 'string' },
        json: { type: 'boolean', default: false },
        'projects-root': { type: 'string' },
        help: { type: 'boolean', default: false }
      },
      strict: true
    }));
  } catch (error) {
    return { exitCode: 2, stderr: `${error.message}\n${usage}` };
  }
  if (values.help) return { exitCode: 0, stdout: usage };

  const days = values.days === undefined ? 7 : Number(values.days);
  if (!Number.isFinite(days) || days <= 0) return { exitCode: 2, stderr: `--days must be a positive number\n${usage}` };

  const projectsRoot = values['projects-root'] ?? path.join(home, '.claude', 'projects');
  const projectPath = values.project ?? cwd;
  try {
    const summary = await measureUsage({ projectsRoot, projectPath, days, now });
    if (summary.projectDirectories.length === 0) {
      return { exitCode: 1, stderr: `No transcript directories for ${path.resolve(projectPath)} under ${projectsRoot}` };
    }
    return { exitCode: 0, stdout: values.json ? JSON.stringify(summary, null, 2) : formatReport(summary) };
  } catch (error) {
    if (error.code === 'ENOENT') return { exitCode: 1, stderr: `Transcript root not found: ${projectsRoot}` };
    throw error;
  }
}

if (isMainModule(import.meta.url)) {
  const { exitCode, stdout, stderr } = await runMeasureCli(process.argv.slice(2));
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  process.exitCode = exitCode;
}

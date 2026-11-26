import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const maxLineLength = 2000;
const idToken = '[A-Za-z0-9-]+';
const requestIdPattern = new RegExp(`^(${idToken})(?:\\.[A-Za-z]+)?$`);
const modelIdPattern = /^[A-Za-z0-9._:/-]+$/;
const timestampPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/;
const recordPattern = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}) \\[info\\] ccreq:(${idToken})(?:\\.[A-Za-z]+)? \\| ([a-z_]+) \\| ([A-Za-z0-9._:/ >-]+?) \\| (\\d+)ms \\| \\[tool/runSubagent-([^\\[\\]|]+)\\]$`
);

export function parseCcreqLine(line) {
  if (typeof line !== 'string' || line.length > maxLineLength) return null;
  const match = recordPattern.exec(line);
  if (!match) return null;

  const modelChain = match[4].split(' -> ').map((item) => item.trim());
  if (modelChain.some((item) => !modelIdPattern.test(item))) return null;

  return {
    timestamp: match[1],
    requestId: match[2],
    status: match[3],
    modelChain,
    durationMs: Number(match[5]),
    agent: match[6]
  };
}

function normalizeBound(value, fallbackMs) {
  const match = timestampPattern.exec(value ?? '');
  if (!match) throw new TypeError(`Invalid timestamp "${value}"; expected YYYY-MM-DD HH:MM:SS[.mmm]`);
  return `${match[1]} ${match[2]}.${(match[3] ?? fallbackMs).padEnd(3, '0')}`;
}

function assertNonEmptyList(values, name, pattern) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`At least one ${name} is required`);
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new TypeError(`Invalid ${name}: ${JSON.stringify(value)}`);
  }
}

function judge(requestId, records, malformedCount, { agent, expectedModels, since, until }) {
  const outcome = (verdict, reason, record = null) => ({ requestId, verdict, reason, record });

  if (malformedCount > 0) return outcome('NOT_VERIFIED', 'The request ID appears in a record that cannot be parsed as a complete runSubagent request.');
  if (records.length === 0) return outcome('NOT_VERIFIED', 'No record for this request ID.');

  const distinct = [...new Map(records.map((record) => [JSON.stringify(record), record])).values()];
  if (distinct.length > 1) return outcome('MISMATCH', 'Conflicting records share this request ID.');

  const [record] = distinct;
  if ((since && record.timestamp < since) || (until && record.timestamp > until)) {
    return outcome('NOT_VERIFIED', 'The record is outside the supplied invocation interval.', record);
  }
  if (record.agent !== agent) return outcome('MISMATCH', `Record belongs to agent "${record.agent}", expected "${agent}".`, record);
  if (record.status !== 'success') return outcome('NOT_VERIFIED', `Record status is "${record.status}", not success.`, record);
  if (record.modelChain.length > 2) return outcome('MISMATCH', 'Model chain has more than requested and served identifiers.', record);

  const unexpected = record.modelChain.filter((item) => !expectedModels.includes(item));
  if (unexpected.length > 0) {
    return outcome('MISMATCH', `Model identifier(s) not in the explicitly supplied set: ${unexpected.join(', ')}.`, record);
  }
  return outcome('VERIFIED', 'Successful request for the exact agent with only expected model identifiers.', record);
}

export function verifyCopilotModelEvidence({ logText, agent, modelIds, requestIds, since = null, until = null }) {
  if (typeof logText !== 'string') throw new TypeError('logText must be a string');
  if (typeof agent !== 'string' || agent.trim() === '') throw new TypeError('agent must be a non-empty string');
  assertNonEmptyList(modelIds, 'model ID', modelIdPattern);
  assertNonEmptyList(requestIds, 'request ID', requestIdPattern);

  const ids = [...new Set(requestIds.map((value) => requestIdPattern.exec(value)[1]))];
  const bounds = {
    agent,
    expectedModels: modelIds,
    since: since === null ? null : normalizeBound(since, '000'),
    until: until === null ? null : normalizeBound(until, '999')
  };

  const lines = logText.split(/\r?\n/);
  const results = ids.map((requestId) => {
    const mention = new RegExp(`ccreq:${requestId}(?![A-Za-z0-9-])`);
    const records = [];
    let malformedCount = 0;
    for (const line of lines) {
      if (!mention.test(line)) continue;
      const record = parseCcreqLine(line);
      if (!record) malformedCount += 1;
      else if (record.requestId === requestId) records.push(record);
    }
    return judge(requestId, records, malformedCount, bounds);
  });

  const verdict = results.some((item) => item.verdict === 'MISMATCH')
    ? 'MISMATCH'
    : results.every((item) => item.verdict === 'VERIFIED') ? 'VERIFIED' : 'NOT_VERIFIED';
  return { verdict, agent, expectedModelIds: modelIds, results };
}

const usage = `Usage: node verify-copilot-model-evidence.mjs --log <path> --agent <copilot agent name> --model-id <runtime id> [--model-id <runtime id>...] --request-id <id> [--request-id <id>...] [--since <time>] [--until <time>]
Every runtime model identifier that may appear in the request (requested and served variants) must be supplied explicitly.
Exit codes: 0 VERIFIED, 1 NOT_VERIFIED, 2 usage, 3 MISMATCH.`;

export async function runEvidenceCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        log: { type: 'string' },
        agent: { type: 'string' },
        'model-id': { type: 'string', multiple: true },
        'request-id': { type: 'string', multiple: true },
        since: { type: 'string' },
        until: { type: 'string' }
      }
    }));
    if (!values.log) throw new TypeError('--log is required');
    const logText = await fs.readFile(values.log, 'utf8');
    const report = verifyCopilotModelEvidence({
      logText,
      agent: values.agent,
      modelIds: values['model-id'],
      requestIds: values['request-id'],
      since: values.since ?? null,
      until: values.until ?? null
    });
    const exitCode = { VERIFIED: 0, NOT_VERIFIED: 1, MISMATCH: 3 }[report.verdict];
    return { exitCode, stdout: JSON.stringify(report, null, 2) };
  } catch (error) {
    if (error instanceof TypeError || (typeof error.code === 'string' && (/^E[A-Z]+$/.test(error.code) || error.code.startsWith('ERR_PARSE_ARGS')))) {
      return { exitCode: 2, stderr: `${error.message}\n${usage}` };
    }
    throw error;
  }
}

const invokedPath = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const { exitCode, stdout, stderr } = await runEvidenceCli(process.argv.slice(2));
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  process.exitCode = exitCode;
}

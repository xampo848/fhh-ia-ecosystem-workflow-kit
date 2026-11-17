#!/usr/bin/env node
// Counts the PRD size signals of roadmap D-25 so the split decision does not
// depend on an estimate. Usage:
//   node prd-size-signals.mjs --prd <prd.md> [--hazards <n>] [--question-rounds <n>] [--open-blocking]
// --open-blocking: blocking questions are still open after the last round.
// Exit codes: 0 fewer than two signals, 1 two or more (propose a split), 2 usage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const defaultThresholds = { slices: 8, acceptanceCriteria: 20, phases: 3, hazards: 4, questionRounds: 3, lines: 600 };

export function measurePrd(prd, { hazards = 0, questionRounds = 0, openBlockingQuestions = false } = {}) {
  const unique = (pattern) => new Set(prd.match(pattern) ?? []).size;
  return {
    // Ids may carry a letter suffix (P2-S2b, AC-1a) or omit the dash (AC1).
    slices: unique(/\bP\d+-S\d+[A-Za-z]?\b/g),
    acceptanceCriteria: unique(/\bAC-?\d+[A-Za-z]?\b/g),
    // Numbered phases only: a "Fase Futura" heading is out of this PRD's scope.
    phases: (prd.match(/^###\s+Fase\s+\d+/gim) ?? []).length,
    hazards,
    questionRounds,
    openBlockingQuestions,
    lines: prd.split('\n').length
  };
}

export function evaluatePrdSize(measures, thresholds = defaultThresholds) {
  const signals = [];
  if (measures.slices > thresholds.slices) signals.push(`${measures.slices} slices (more than ${thresholds.slices})`);
  if (measures.acceptanceCriteria > thresholds.acceptanceCriteria) signals.push(`${measures.acceptanceCriteria} acceptance criteria (more than ${thresholds.acceptanceCriteria})`);
  if (measures.phases > thresholds.phases) signals.push(`${measures.phases} phases (more than ${thresholds.phases})`);
  if (measures.hazards >= thresholds.hazards) signals.push(`${measures.hazards} distinct hazard types (${thresholds.hazards} or more)`);
  // ambiguity-detection allows no round after the last one, so reaching it with
  // blocking questions still open is the signal; resolved rounds are not.
  const roundsExhausted = measures.questionRounds > thresholds.questionRounds
    || (measures.questionRounds >= thresholds.questionRounds && measures.openBlockingQuestions);
  if (roundsExhausted) signals.push(`blocking questions still open after ${thresholds.questionRounds} rounds`);
  // Length is secondary: it only counts together with another signal.
  if (signals.length > 0 && measures.lines > thresholds.lines) signals.push(`${measures.lines} lines (more than about ${thresholds.lines})`);
  const verdict = signals.length >= 2 ? 'propose-split' : signals.length === 1 ? 'warning' : 'ok';
  return { signals, verdict };
}

function argument(name) {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prdPath = argument('--prd');
  if (!prdPath) {
    console.error('Usage: node prd-size-signals.mjs --prd <prd.md> [--hazards <n>] [--question-rounds <n>] [--open-blocking]');
    process.exit(2);
  }
  const measures = measurePrd(readFileSync(prdPath, 'utf8'), {
    hazards: Number.parseInt(argument('--hazards') ?? '0', 10),
    questionRounds: Number.parseInt(argument('--question-rounds') ?? '0', 10),
    openBlockingQuestions: process.argv.includes('--open-blocking')
  });
  const result = evaluatePrdSize(measures);
  console.log(`measures: ${Object.entries(measures).map(([key, value]) => `${key}=${value}`).join(' ')}`);
  console.log(`verdict: ${result.verdict}`);
  for (const signal of result.signals) console.log(`signal: ${signal}`);
  process.exit(result.verdict === 'propose-split' ? 1 : 0);
}

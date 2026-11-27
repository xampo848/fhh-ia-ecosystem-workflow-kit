#!/usr/bin/env node
// Keeps src/adapter-kit-texts.json in step with the adapter templates.
// Usage: node scripts/sync-adapter-kit-texts.mjs [--record]
//
// Without a flag it checks: the fingerprint recorded as `current` for every
// adapter must be the one of the kit text its template carries now. When a
// template's kit text changes, the check fails until `--record` runs: it moves
// the recorded `current` to `previous` (so an install that still has that
// text keeps getting `split`) and records the new one. Never delete an entry
// of `previous`: an older install somewhere still has that text.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { adapterKitTextsPath, fingerprintOf } from '../src/adapter-kit-texts.mjs';
import { classifyPath, defaultBlockName, loadKitManifest } from '../src/kit-manifest.mjs';
import { kitBody, selectedTemplateFiles } from '../src/planner.mjs';
import { supportedRuntimes } from '../src/runtime-matrix.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function currentAdapterFingerprints() {
  const manifest = await loadKitManifest();
  const fingerprints = {};
  for (const file of await selectedTemplateFiles({ runtimes: supportedRuntimes })) {
    const entry = classifyPath(manifest, file.relativePath);
    if (entry?.class !== 'adapter' || !file.sourcePath) continue;
    const body = kitBody(await fs.readFile(file.sourcePath, 'utf8'), entry.block ?? defaultBlockName);
    if (body !== '') fingerprints[file.relativePath] = fingerprintOf(body);
  }
  return fingerprints;
}

export async function validateAdapterKitTexts({ file = adapterKitTextsPath } = {}) {
  const recorded = JSON.parse(await fs.readFile(file, 'utf8'));
  const current = await currentAdapterFingerprints();
  const failures = [];
  for (const [relativePath, fingerprint] of Object.entries(current)) {
    const entry = recorded.adapters?.[relativePath];
    if (!entry) failures.push(`${relativePath}: no fingerprint recorded.`);
    else if (entry.current.sha256 !== fingerprint.sha256) failures.push(`${relativePath}: its kit text changed since the recorded fingerprint.`);
    else if ((entry.previous ?? []).some((previous) => previous.sha256 === fingerprint.sha256)) failures.push(`${relativePath}: the current kit text is also listed as a previous one.`);
  }
  for (const relativePath of Object.keys(recorded.adapters ?? {})) {
    if (!current[relativePath]) failures.push(`${relativePath}: recorded, but no adapter template carries it.`);
  }
  return { ok: failures.length === 0, failures, adapterCount: Object.keys(current).length, previousCount: Object.values(recorded.adapters ?? {}).reduce((sum, entry) => sum + (entry.previous ?? []).length, 0) };
}

export async function recordAdapterKitTexts({ file = adapterKitTextsPath, lastVersion = null } = {}) {
  let recorded;
  try {
    recorded = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    recorded = { adapters: {} };
  }
  const current = await currentAdapterFingerprints();
  const adapters = {};
  for (const [relativePath, fingerprint] of Object.entries(current)) {
    const entry = recorded.adapters?.[relativePath];
    const previous = [...(entry?.previous ?? [])];
    if (entry && entry.current.sha256 !== fingerprint.sha256 && !previous.some((item) => item.sha256 === entry.current.sha256)) {
      previous.push({ ...entry.current, ...(lastVersion ? { lastVersion } : {}) });
    }
    adapters[relativePath] = { current: fingerprint, previous };
  }
  const content = {
    description: 'Fingerprints of the kit text each adapter template carries (current) and has carried (previous). update offers split to an adapter without markers when it holds one of these texts whole. Written by scripts/sync-adapter-kit-texts.mjs --record; never delete an entry of previous.',
    adapters
  };
  await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return content;
}

if (isMainModule(import.meta.url)) {
  if (process.argv.includes('--record')) {
    const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    const content = await recordAdapterKitTexts({ lastVersion: packageJson.version });
    console.log(`Adapter kit texts recorded (${Object.keys(content.adapters).length} adapters).`);
  } else {
    const result = await validateAdapterKitTexts();
    if (!result.ok) {
      console.error('Adapter kit texts are out of step:');
      for (const failure of result.failures) console.error(`- ${failure}`);
      console.error('The kit text of an adapter changed. Run `node scripts/sync-adapter-kit-texts.mjs --record` once, before raising the version: it keeps the text it replaces recognizable, so an older install still gets `split`.');
      process.exit(1);
    }
    console.log(`Adapter kit texts are in step: ${result.adapterCount} adapters, ${result.previousCount} earlier text(s) still recognized.`);
  }
}

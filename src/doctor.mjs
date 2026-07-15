import fs from 'node:fs/promises';
import path from 'node:path';
import { selectedTemplateFiles, parseRuntimeList, normalizeOverlay } from './planner.mjs';

export async function runDoctor(options = {}) {
  const targetPath = path.resolve(options.targetPath ?? process.cwd());
  const runtimes = parseRuntimeList(options.runtime ?? 'neutral');
  const overlay = normalizeOverlay(options.overlay ?? 'all-metrics-full');
  const files = await selectedTemplateFiles({ runtimes, overlay });
  const missing = [];
  const present = [];

  for (const file of files) {
    const targetFile = path.join(targetPath, file.relativePath);
    try {
      await fs.access(targetFile);
      present.push(file.relativePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(file.relativePath);
    }
  }

  return {
    ok: missing.length === 0,
    targetPath,
    runtimes,
    overlay,
    present,
    missing
  };
}

export function formatDoctorResult(result) {
  const lines = [
    `Target: ${result.targetPath}`,
    `Runtimes: ${result.runtimes.join(',')}`,
    `Overlay: ${result.overlay}`,
    result.ok ? 'Doctor: ok' : 'Doctor: failed'
  ];

  if (result.missing.length > 0) {
    lines.push('Missing files:');
    for (const item of result.missing) lines.push(`- ${item}`);
  }

  return lines.join('\n');
}

// The kit text each adapter has carried. An adapter written before the block
// markers existed holds that text with no markers around it; `update` offers
// `split` only when it finds the text whole, byte for byte. So that the text
// can change without taking `split` away from an older install, the texts the
// kit shipped in its tagged versions stay recognizable here by fingerprint: the number of
// lines and the hash of the whole text, plus the hash of each of its longer
// lines (to tell a file that holds an edited kit text from one that holds
// none). The fingerprints live in adapter-kit-texts.json, written by
// scripts/sync-adapter-kit-texts.mjs.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
// A line this long is not shared by chance with a project's own text
// (a heading such as "# CLAUDE.md" is).
export const distinctiveLineLength = 30;
// Lines are compared without the white space around them, so a kit text
// with Windows line endings or an indent still counts as kit text.
const lineHash = (line) => sha256(line.trim()).slice(0, 16);
const distinctiveLines = (text) => text.split('\n').filter((line) => line.trim().length >= distinctiveLineLength);

export function fingerprintOf(body) {
  return { lines: body.split('\n').length, sha256: sha256(body), lineHashes: [...new Set(distinctiveLines(body).map(lineHash))].sort() };
}

export const adapterKitTextsPath = fileURLToPath(new URL('./adapter-kit-texts.json', import.meta.url));

let cached = null;
export function loadAdapterKitTexts() {
  cached ??= JSON.parse(readFileSync(adapterKitTextsPath, 'utf8'));
  return cached;
}

// The earlier kit texts of one adapter (not the current one).
export function previousKitTexts(relativePath, texts = loadAdapterKitTexts()) {
  return texts.adapters?.[relativePath]?.previous ?? [];
}

// Where an earlier kit text sits in a file, as whole lines: { start, length }
// in characters, or null.
export function findKnownKitText(content, fingerprints) {
  if (fingerprints.length === 0) return null;
  const lines = content.split('\n');
  // A file that lacks even one distinctive line of a text cannot hold it
  // whole: ruled out before any window is hashed.
  const present = new Set(distinctiveLines(content).map(lineHash));
  fingerprints = fingerprints.filter((fingerprint) => (fingerprint.lineHashes ?? []).every((hash) => present.has(hash)));
  if (fingerprints.length === 0) return null;
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  for (const fingerprint of fingerprints) {
    for (let first = 0; first + fingerprint.lines <= lines.length; first += 1) {
      const candidate = lines.slice(first, first + fingerprint.lines).join('\n');
      if (sha256(candidate) === fingerprint.sha256) return { start: offsets[first], length: candidate.length };
    }
  }
  return null;
}

// True when the file shares a distinctive line with the current kit text or
// with an earlier one: it holds kit text someone edited, not only own text.
export function holdsKitLines(content, currentBody, fingerprints) {
  const known = new Set([...distinctiveLines(currentBody).map(lineHash), ...fingerprints.flatMap((fingerprint) => fingerprint.lineHashes ?? [])]);
  return distinctiveLines(content).some((line) => known.has(lineHash(line)));
}

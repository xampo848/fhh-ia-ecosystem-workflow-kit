import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copies = ['.agents/workflow-kit', 'templates/repo-overlay-fhh-ia-ecosystem-full/.agents/workflow-kit'];
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));

// The repository has no JSON-schema dependency: this checks the subset of
// JSON Schema that manifest.schema.json uses, and refuses any other keyword so
// the checker cannot pass a rule it does not understand.
const supported = new Set(['$schema', '$id', 'title', 'description', 'type', 'additionalProperties', 'required', 'properties', 'items', 'enum', 'pattern', 'const']);
const typeOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);
function check(schema, value, where, errors) {
  for (const keyword of Object.keys(schema)) if (!supported.has(keyword)) errors.push(`${where}: schema keyword "${keyword}" is not supported by this checker`);
  if ('const' in schema && value !== schema.const) errors.push(`${where}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (schema.type && typeOf(value) !== schema.type) {
    errors.push(`${where}: must be ${schema.type}`);
    return;
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  if (schema.items && Array.isArray(value)) value.forEach((item, index) => check(schema.items, item, `${where}[${index}]`, errors));
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${where}: missing required "${key}"`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) check(schema.properties[key], child, `${where}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${where}: "${key}" is not declared by the schema`);
      else if (typeof schema.additionalProperties === 'object') check(schema.additionalProperties, child, `${where}.${key}`, errors);
    }
  }
}

test('the checker rejects what the schema forbids (so a pass means something)', () => {
  const schema = { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { const: '1' }, b: { type: 'array', items: { enum: ['x'] } }, c: { type: 'string', pattern: '^z' } } };
  const errors = [];
  check(schema, { b: ['y'], c: 'q', d: 1 }, '$', errors);
  assert.equal(errors.length, 4, errors.join('\n'));
});

// Updater AC-16: the manifest the CLI reads matches its schema, in both copies.
test('AC-16: manifest.json validates against manifest.schema.json in the kit and in the overlay, and the copies are identical', async () => {
  const [kitSchema, overlaySchema] = await Promise.all(copies.map((folder) => fs.readFile(path.join(root, folder, 'manifest.schema.json'), 'utf8')));
  assert.equal(overlaySchema, kitSchema, 'both manifest.schema.json copies are byte-identical');
  for (const folder of copies) {
    const [schema, manifest] = await Promise.all([readJson(`${folder}/manifest.schema.json`), readJson(`${folder}/manifest.json`)]);
    const errors = [];
    check(schema, manifest, '$', errors);
    assert.deepEqual(errors, [], `${folder}\n${errors.join('\n')}`);
    const undeclared = Object.keys(manifest).filter((key) => !(key in schema.properties));
    assert.deepEqual(undeclared, [], `${folder}: every top-level key of the manifest is declared by the schema`);
    for (const key of schema.required) assert.ok(key in schema.properties, `${folder}: required "${key}" is declared`);
  }
});

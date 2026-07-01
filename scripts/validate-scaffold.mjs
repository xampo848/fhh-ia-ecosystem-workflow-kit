#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const requiredPaths = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'package.json',
  'docs/project-boundaries.md',
  'docs/release-plan.md',
  'templates/portable-core/README.md',
  'templates/repo-overlay/README.md',
  'templates/runtime-adapters/README.md',
  'bin/workflow-kit.mjs',
  'src/cli.mjs',
  'src/planner.mjs',
  'src/apply.mjs',
  'src/doctor.mjs',
  'src/tui.mjs',
  'scripts/validate-template-packs.mjs',
  'templates/template-manifest.json',
  'docs/adapter-authoring.md',
  '.github/workflows/ci.yml',
  'RELEASE.md',
  'docs/versioning.md',
  'scripts/validate-release-readiness.mjs',
  'scripts/validate-docs.mjs',
  'docs/quickstart.md',
  'docs/troubleshooting.md',
  'docs/migration.md',
  'docs/private-github-install.md',
  'examples/fresh-codex/README.md',
  'examples/existing-copilot/README.md',
  'examples/neutral-core/README.md'
];

const failures = [];

for (const relativePath of requiredPaths) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required scaffold path: ${relativePath}`);
  }
}

const packageJsonPath = path.join(root, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.bin?.['workflow-kit']) {
    failures.push('package.json must expose the workflow-kit bin for the CLI MVP phase.');
  }

  if (packageJson.private !== true) {
    failures.push('package.json must remain private during the scaffold-only phase to prevent accidental publish.');
  }

  const suspiciousScripts = Object.entries(packageJson.scripts ?? {}).filter(([name, command]) => {
    return /npm publish|pnpm publish|yarn publish|gh release|gh repo create|git push|release-it|semantic-release|init --apply/.test(`${name} ${command}`);
  });

  if (suspiciousScripts.length > 0) {
    failures.push(`Scaffold scripts must not publish, release, create repos, or apply installs: ${suspiciousScripts.map(([name]) => name).join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error('Scaffold validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Scaffold validation passed. Required files exist and template-pack metadata is safe.');

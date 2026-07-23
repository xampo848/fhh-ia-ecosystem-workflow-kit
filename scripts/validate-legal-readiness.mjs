#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_COMPONENTS = new Map([
  ['impeccable', { license: 'Apache-2.0', commit: 'e587004ee42883dad40d14cd0f5e1b21ae1933df', status: 'VERIFIED' }],
  ['modern-screenshot', { license: 'MIT', commit: '792d6db7411839c62940a6e930161f8e376e817f', status: 'VERIFIED' }],
  ['typecraft-guide-skill', { license: 'MIT', commit: '8099648409ec73980bd693ac8d15fd3e3230072d', status: 'VERIFIED' }],
  ['caveman', { license: 'MIT', commit: '0d95a81d35a9f2d123a5e9430d1cfc43d55f1bb0', status: 'VERIFIED' }],
  ['frontend-design', { license: 'Apache-2.0', commit: 'd230a6dd6eb1a0dbee9fec55e2f00a96e28dff81', status: 'VERIFIED' }],
  ['product-manager-prompts', { license: 'MIT', commit: 'ddcd8b00deafe9f3a3f770df6b70a76692d8e0f1', status: 'VERIFIED' }]
]);

export function validateLegalReadiness({ root = process.cwd() } = {}) {
  const failures = [];
  const resolve = (file) => path.join(root, file);
  const fail = (message) => failures.push(message);
  let provenanceManifest = { components: [] };

  const requiredFiles = [
    'NOTICE',
    'THIRD_PARTY_NOTICES.md',
    'docs/legal/PROVENANCE-AUDIT.md',
    'docs/legal/OPEN-SOURCE-READINESS.md',
    'docs/legal/CORPORATE-CONTRIBUTIONS.md',
    '.github/CODEOWNERS',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'SECURITY.md',
    'GOVERNANCE.md',
    'TRADEMARKS.md',
    'CODE_OF_CONDUCT.md'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(resolve(file))) {
      fail(`Missing required compliance file: ${file}`);
    }
  }

  if (existsSync(resolve('THIRD_PARTY_NOTICES.md'))) {
    const notices = readFileSync(resolve('THIRD_PARTY_NOTICES.md'), 'utf-8');
    const expectedMarkers = [
      'modern-screenshot',
      'product-manager-prompts',
      'JuliusBrussee/caveman',
      'pbakaus/impeccable'
    ];
    for (const marker of expectedMarkers) {
      if (!notices.includes(marker)) {
        fail(`THIRD_PARTY_NOTICES.md missing marker: ${marker}`);
      }
    }
  }

  if (existsSync(resolve('docs/legal/PROVENANCE-AUDIT.md'))) {
    const provenance = readFileSync(resolve('docs/legal/PROVENANCE-AUDIT.md'), 'utf-8');
    const requiredClasses = [
      'UNKNOWN_PROVENANCE',
      'REQUIRES_AUTHOR_PERMISSION',
      'EMPLOYMENT_OWNERSHIP_RISK',
      'EXTERNAL_PERMISSIVE'
    ];
    for (const cls of requiredClasses) {
      if (!provenance.includes(cls)) {
        fail(`PROVENANCE-AUDIT.md missing classification: ${cls}`);
      }
    }
  }

  const provenanceManifestPath = 'docs/legal/third-party/provenance.json';
  if (!existsSync(resolve(provenanceManifestPath))) {
    fail(`Missing third-party provenance manifest: ${provenanceManifestPath}`);
  } else {
    try {
      const manifest = JSON.parse(readFileSync(resolve(provenanceManifestPath), 'utf-8'));
      provenanceManifest = manifest;
      if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.components)) {
        fail('Third-party provenance manifest must use schemaVersion 2 with a components array.');
      } else {
        for (const [name, expected] of EXPECTED_COMPONENTS) {
          const component = manifest.components.find((entry) => entry.name === name);
          if (!component) {
            fail(`Third-party provenance manifest missing component: ${name}`);
            continue;
          }
          if (component.license !== expected.license) {
            fail(`Third-party provenance manifest has wrong license for ${name}.`);
          }
          if (component.status !== expected.status) {
            fail(`Third-party provenance manifest has wrong status for ${name}.`);
          }
          if (expected.commit && component.upstream?.commit !== expected.commit) {
            fail(`Third-party provenance manifest has wrong pinned commit for ${name}.`);
          }
          if (expected.status === 'VERIFIED' && (!component.licenseFile || !existsSync(resolve(component.licenseFile)))) {
            fail(`Third-party provenance manifest has no readable license file for ${name}.`);
          }
          if (expected.status === 'EXTERNAL_UNVERIFIED' && component.publicReleaseBlocker !== true) {
            fail(`Unverified component must block public release: ${name}.`);
          }
          for (const localPath of component.localPaths ?? []) {
            if (!existsSync(resolve(localPath))) {
              fail(`Third-party provenance manifest references missing local path: ${localPath}`);
            }
          }
          for (const inventory of component.integrityInventories ?? []) {
            validateDirectoryInventory({ root, inventory, component: name, fail });
          }
          for (const inventory of component.integrityFiles ?? []) {
            validateFileInventory({ root, inventory, component: name, fail });
          }
          validateModificationNotices({ root, component, fail });
        }

        const impeccable = manifest.components.find((entry) => entry.name === 'impeccable');
        if (!impeccable?.noticeFile || !existsSync(resolve(impeccable.noticeFile))) {
          fail('Impeccable provenance must include a readable applicable NOTICE file.');
        } else {
          const notice = readFileSync(resolve(impeccable.noticeFile), 'utf-8');
          for (const marker of ['Paul Bakaus', 'Anthropic, PBC', 'typecraft-guide-skill']) {
            if (!notice.includes(marker)) fail(`Impeccable NOTICE missing marker: ${marker}`);
          }
        }

        const modernScreenshot = manifest.components.find((entry) => entry.name === 'modern-screenshot');
        const modernScreenshotPath = modernScreenshot?.localPaths?.[0];
        if (modernScreenshotPath && existsSync(resolve(modernScreenshotPath))) {
          const checksum = createHash('sha256').update(readFileSync(resolve(modernScreenshotPath))).digest('hex');
          if (checksum !== modernScreenshot.verification?.sha256) {
            fail('Vendored modern-screenshot checksum differs from the pinned provenance record.');
          }
        }
      }
    } catch (error) {
      fail(`Unable to validate third-party provenance manifest: ${error.message}`);
    }
  }

  const overlayAuthorshipPath = 'docs/legal/overlay-authorship.json';
  if (!existsSync(resolve(overlayAuthorshipPath))) {
    fail(`Missing overlay authorship record: ${overlayAuthorshipPath}`);
  } else {
    try {
      const authorship = JSON.parse(readFileSync(resolve(overlayAuthorshipPath), 'utf-8'));
      if (authorship.schemaVersion !== 2 || typeof authorship.scope !== 'string') {
        fail('Overlay authorship record must use schemaVersion 2 with a scope.');
      } else {
        validateDirectoryInventory({
          root,
          inventory: authorship.remainingInventory,
          component: 'maintainer-attested overlay',
          excludePaths: authorship.externalPathCoverage?.map((coverage) => coverage.path),
          fail
        });
        if (authorship.remainingFiles?.classification !== 'MAINTAINER_ATTESTED_INTERNAL') {
          fail('Overlay authorship record must classify remaining files as MAINTAINER_ATTESTED_INTERNAL.');
        }
        if (!authorship.remainingFiles?.authorizationStatement) {
          fail('Overlay authorship record requires a maintainer authorization statement.');
        }
        for (const coverage of authorship.externalPathCoverage ?? []) {
          if (!coverage.path || !coverage.component || !existsSync(resolve(coverage.path))) {
            fail(`Overlay authorship record references missing external path: ${coverage.path}`);
          } else if (!provenanceManifest.components.some((component) => component.name === coverage.component)) {
            fail(`Overlay authorship record references unknown component: ${coverage.component}`);
          }
        }
      }
    } catch (error) {
      fail(`Unable to validate overlay authorship record: ${error.message}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

function validateDirectoryInventory({ root, inventory, component, excludePaths = [], fail }) {
  if (!inventory?.path || !Number.isInteger(inventory.fileCount) || !/^[a-f0-9]{64}$/.test(inventory.pathContentSha256 ?? '')) {
    fail(`${component} must declare a directory inventory with a path, fileCount, and SHA-256 digest.`);
    return;
  }

  const inventoryRoot = path.join(root, inventory.path);
  if (!existsSync(inventoryRoot)) {
    fail(`${component} inventory root is missing: ${inventory.path}`);
    return;
  }

  const excludedRelativePaths = excludePaths.map((excludedPath) => (
    path.relative(inventoryRoot, path.join(root, excludedPath)).split(path.sep).join('/')
  ));
  const entries = collectDirectoryInventory(inventoryRoot, excludedRelativePaths);
  if (entries.length !== inventory.fileCount) {
    fail(`${component} file inventory changed; renew its provenance record before release.`);
  }
  if (digestInventory(entries) !== inventory.pathContentSha256) {
    fail(`${component} path/content inventory differs from its provenance record.`);
  }
}

function validateFileInventory({ root, inventory, component, fail }) {
  if (!inventory?.path || !/^[a-f0-9]{64}$/.test(inventory.sha256 ?? '')) {
    fail(`${component} must declare a file path and SHA-256 digest.`);
    return;
  }

  const file = path.join(root, inventory.path);
  if (!existsSync(file)) {
    fail(`${component} integrity file is missing: ${inventory.path}`);
    return;
  }
  const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (checksum !== inventory.sha256) {
    fail(`${component} checksum differs from the pinned provenance record.`);
  }
}

function validateModificationNotices({ root, component, fail }) {
  if (!component.modificationNotice) return;
  if (!Array.isArray(component.modifiedFiles) || component.modifiedFiles.length === 0) {
    fail(`${component.name} must list modified files when it declares a modification notice.`);
    return;
  }

  const inventoryRoot = component.integrityInventories?.[0]?.path;
  if (!inventoryRoot) {
    fail(`${component.name} must declare an inventory before modified files can be checked.`);
    return;
  }
  for (const relativePath of component.modifiedFiles) {
    const file = path.join(root, inventoryRoot, relativePath);
    if (!existsSync(file) || !readFileSync(file, 'utf-8').includes(component.modificationNotice)) {
      fail(`${component.name} modified file lacks the required Apache notice: ${relativePath}`);
    }
  }
}

function collectDirectoryInventory(inventoryRoot, excludedPrefixes) {
  const entries = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(inventoryRoot, absolutePath).split(path.sep).join('/');
        if (!excludedPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) {
          entries.push({
            path: relativePath,
            sha256: createHash('sha256').update(readFileSync(absolutePath)).digest('hex')
          });
        }
      }
    }
  }
  walk(inventoryRoot);
  return entries.sort((left, right) => {
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });
}

function digestInventory(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(entry.path).update('\0').update(entry.sha256).update('\n');
  }
  return hash.digest('hex');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateLegalReadiness();
  if (result.ok) {
    console.log('[legal-check] OK');
  } else {
    for (const failure of result.failures) console.error(`[legal-check] ${failure}`);
    process.exitCode = 1;
  }
}

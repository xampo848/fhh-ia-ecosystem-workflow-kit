// The repo-mode plans of workflow-kit 0.22.0 (commit 558e9fb, the last commit
// before plugin mode), as the AC-19 and T6 guards of test/plugin-mode.test.mjs
// compare them: for `init` on an empty repository and for `update` right after
// that init, the operation, path and class of every planned file, per runtime
// list. The same collector runs on this checkout's modules (the tests) and on
// the modules of that commit (to write the fixture), so both sides are shaped
// the same way.
//
// Regenerate the fixture (only when a template change is meant to change the
// repo-mode plan; then the fixture no longer describes 558e9fb and the
// comment of the guards has to say which commit it describes):
//
//   dir=$(mktemp -d) && git archive 558e9fb | tar -x -C "$dir"
//   node test/fixtures/plugin-mode/repo-mode-plans.mjs "$dir/src"
//   rm -rf "$dir"
//
// Without an argument (as `node --test` runs every file under test/) it does
// nothing.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repo-mode-plans-558e9fb.json');
export const guardedRuntimeLists = Object.freeze(['claude', 'copilot', 'claude,codex']);

// One line per planned file: "<operation> <class> <path>" (class "-" for a
// file without one, such as .gitignore).
export const planShape = (plan) => plan.operations.map(({ operation, relativePath, class: fileClass }) => `${operation} ${fileClass ?? '-'} ${relativePath}`);

// `planOptions` reaches both plans (for example `{ mode: 'repo' }`, which the
// modules of 558e9fb ignore).
export async function collectRepoModePlans(sourceDirectory, makeTarget, planOptions = {}) {
  const { buildInstallPlan, buildUpdatePlan } = await import(pathToFileURL(path.join(sourceDirectory, 'planner.mjs')).href);
  const { applyInstallPlan } = await import(pathToFileURL(path.join(sourceDirectory, 'apply.mjs')).href);
  const plans = { init: {}, update: {} };
  for (const runtime of guardedRuntimeLists) {
    const target = await makeTarget();
    const init = await buildInstallPlan({ targetPath: target, runtime, ...planOptions });
    plans.init[runtime] = planShape(init);
    await applyInstallPlan(init);
    plans.update[runtime] = planShape(await buildUpdatePlan({ targetPath: target, ...planOptions }));
  }
  return plans;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2]) {
  const created = [];
  const makeTarget = async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-kit-fixture-'));
    created.push(directory);
    return directory;
  };
  try {
    const plans = await collectRepoModePlans(path.resolve(process.argv[2]), makeTarget);
    await fs.writeFile(fixturePath, `${JSON.stringify(plans, null, 2)}\n`, 'utf8');
  } finally {
    for (const directory of created) await fs.rm(directory, { recursive: true, force: true });
  }
}

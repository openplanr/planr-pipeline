import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

import { createWatcher } from '../../lib/dashboard/watcher.mjs';

/** Build a task-file body with a given status (so successive writes "change" it). */
function taskFile(id, status) {
  return [
    '---',
    `id: "${id}"`,
    `title: "${id} task"`,
    'specId: "SPEC-001"',
    'type: "Tech"',
    'agent: "backend-agent"',
    `status: "${status}"`,
    '---',
    '',
    `# ${id}`,
    '',
  ].join('\n');
}

test('watcher debounces a burst of writes into exactly one patch', async () => {
  const home = mkdtempSync(join(tmpdir(), 'planr-watch-'));
  const planrDir = join(home, '.planr');
  const tasksDir = join(planrDir, 'specs', 'SPEC-001', 'tasks');
  mkdirSync(tasksDir, { recursive: true });
  const taskPath = join(tasksDir, 'T-001-thing.md');

  // Capture which scope the engine is asked to recompute, and how many patches fire.
  const scopes = [];
  const patches = [];

  // Fake fs.watch we drive ourselves: returns a handle whose `close`/`on` are
  // inert; we call the supplied listener directly to simulate save events. This
  // keeps the debounce assertion deterministic across platforms.
  let listener = null;
  const fakeWatchImpl = (_dir, _opts, cb) => {
    listener = cb;
    return { close() {}, on() {} };
  };

  // Stub buildGraph: records the `scope` it was given, and returns a graph whose
  // single node's status flips each call so every recompute is a real diff.
  let call = 0;
  const stubBuildGraph = (_dir, opts = {}) => {
    scopes.push(opts.scope ?? null);
    call += 1;
    return {
      nodes: [
        {
          id: 'T-001',
          type: 'task',
          title: 'T-001 task',
          status: call % 2 === 0 ? 'in-progress' : 'done',
          frontmatter: { id: 'T-001' },
        },
      ],
      edges: [],
    };
  };

  const watcher = createWatcher(planrDir, {
    debounceMs: 80,
    onPatch: (p) => patches.push(p),
    initialGraph: { nodes: [], edges: [] },
    buildGraph: stubBuildGraph,
    watchImpl: fakeWatchImpl,
  });

  try {
    watcher.start();
    assert.ok(typeof listener === 'function', 'watcher should have registered an fs listener');

    // Write the same task file three times within ~150ms; signal each write to
    // the watcher (the real fs.watch would emit one event per save).
    await writeFile(taskPath, taskFile('T-001', 'todo'));
    listener('change', 'specs/SPEC-001/tasks/T-001-thing.md');
    await delay(20);
    await writeFile(taskPath, taskFile('T-001', 'in-progress'));
    listener('change', 'specs/SPEC-001/tasks/T-001-thing.md');
    await delay(20);
    await writeFile(taskPath, taskFile('T-001', 'done'));
    listener('change', 'specs/SPEC-001/tasks/T-001-thing.md');

    // Wait past the debounce window for the single coalesced flush.
    await delay(160);

    // Exactly one patch event for the burst of three writes.
    assert.equal(patches.length, 1, `expected one coalesced patch, got ${patches.length}`);

    // The engine was asked to recompute exactly once, scoped to the changed id —
    // not a blanket full-graph recompute (the scope must be the node id).
    assert.equal(scopes.length, 1, `expected one scoped recompute, got ${scopes.length}`);
    assert.equal(scopes[0], 'T-001', `scope should be the changed node id, got ${JSON.stringify(scopes[0])}`);
  } finally {
    watcher.stop();
    rmSync(home, { recursive: true, force: true });
  }
});

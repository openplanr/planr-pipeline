import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  budgetFailures,
  checkWorkflowAliasParity,
  delegationFailures,
  DELEGATION_MARKER,
  DELEGATION_TARGETS,
  RUNTIME_DIFFERENTIATED_ALIASES,
  THIN_ROUTER_BUDGET,
} from '../../scripts/check-workflow-alias-parity.mjs';

// SPEC-007 FR1 — one implementation per workflow, proven at the file level: the command path
// and the skill path REACH THE SAME FILE. "Both succeed" is today's broken state (Trap E),
// so these tests key on the shared file pointer, not on both paths merely running.

test('workflow alias parity holds on the real repo: every convergent skill points at its command procedure', () => {
  const result = checkWorkflowAliasParity();
  assert.equal(result.ok, true);
  assert.deepEqual([...result.checked].sort(), ['dashboard', 'design', 'plan', 'ship', 'sync']);
});

test('operate is excluded from file-level pointer parity (runtime-differentiated per the runtime-binding NFR)', () => {
  assert.ok(RUNTIME_DIFFERENTIATED_ALIASES.has('operate'));
  assert.ok(!Object.prototype.hasOwnProperty.call(DELEGATION_TARGETS, 'operate'));
});

test('each delegation target is the exact one-procedure file its command reads', () => {
  assert.deepEqual(DELEGATION_TARGETS, {
    plan: 'commands/plan.md',
    sync: 'procedures/sync-workflow.md',
    ship: 'commands/ship.md',
    design: 'commands/design.md',
    dashboard: 'procedures/dashboard-preflight.md',
  });
});

// Non-vacuity (SPEC-007 Trap D) — a durable companion to the manual throwaway revert
// reported in the task summary: a skill reverted to its pre-task one-liner (which neither
// delegates nor names the procedure) MUST fail, naming the offending skill.
test('non-vacuous: a sync skill reverted to its pre-task one-liner fails, naming planr-sync', () => {
  const preTaskOneLiner = [
    '# Planr Sync',
    '',
    'Run `planr pipeline sync --json`, explain actionable drift, and change artifacts',
    'only when the user explicitly requests repair.',
  ].join('\n');
  const failures = delegationFailures('sync', 'planr-sync', preTaskOneLiner);
  assert.ok(failures.length >= 1, 'the reverted one-liner must produce at least one failure');
  assert.ok(failures.every((f) => f.startsWith('planr-sync:')), 'every failure names planr-sync');
  assert.ok(failures.some((f) => f.includes(DELEGATION_MARKER)), 'flags the missing delegation phrase');
  assert.ok(failures.some((f) => f.includes(DELEGATION_TARGETS.sync)), 'flags the missing procedure pointer');
});

test('non-vacuous: reintroducing an inline procedure into commands/sync.md busts the thin-router budget', () => {
  const bloated = 'x\n'.repeat(THIN_ROUTER_BUDGET.sync + 5);
  const failures = budgetFailures('sync', bloated);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /exceeds the thin-router budget/);
  assert.match(failures[0], /procedures\/sync-workflow\.md/);
});

test('a correctly-delegating skill body produces no failures', () => {
  assert.deepEqual(delegationFailures('ship', 'planr-ship', [
    'Run `planr pipeline prepare-ship <feature> --json`, then follow the portable procedure in',
    '`commands/ship.md` from the installed pipeline package.',
  ].join('\n')), []);
});

// DoD line 4 — planr-plan's existing delegation string still passes unchanged (regression).
test('the planr-plan precedent this task generalizes still delegates unchanged', () => {
  const planSkill = readFileSync(
    fileURLToPath(new URL('../../adapters/codex/skills/planr-plan/SKILL.md', import.meta.url)),
    'utf8',
  );
  assert.match(planSkill, /from\s+the\s+installed\s+pipeline\s+package/);
  assert.match(planSkill, /commands\/plan\.md/);
  assert.deepEqual(delegationFailures('plan', 'planr-plan', planSkill), []);
});

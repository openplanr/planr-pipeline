#!/usr/bin/env node

// FR1 — one implementation per workflow, made checkable.
//
// SPEC-007's diagnosis: six workflows shipped as both a Claude Code command and a
// Codex skill, and the skill re-derived the flow instead of pointing at the command's
// procedure. A grep from skill to command returned zero. "Both paths succeed" is exactly
// today's broken state (Trap E), so this checker proves the stronger property: the
// command path and the skill path REACH THE SAME FILE. Convergence is file-level (PO
// sign-off, clarification 2): each surface names the one procedure/command file, and each
// runtime executes it with whatever capability it has.
//
// This is a checker, not a generator: the delegation lines are short, stable templates,
// not derived content. It mirrors scripts/generate-guided-adapters.mjs's --check idiom
// (throw a coded error naming the offenders; exit non-zero).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The one procedure/command file that BOTH the Claude Code command and the Codex skill
// must point at, per workflow. This is "reach the same code" (FR1) made checkable as
// "point at the identical file path" (Trap E) — not merely "both succeed".
//   plan      already delegated (the proven precedent this task generalizes).
//   sync      its inline body was extracted into procedures/sync-workflow.md by this task.
//   ship      the command file is the umbrella procedure (it fans out to procedures/ship-*.md).
//   design    the command file is the umbrella procedure (it fans out to procedures/design-*.md).
//   dashboard the command's core step logic lives in procedures/dashboard-preflight.md.
export const DELEGATION_TARGETS = Object.freeze({
  plan: 'commands/plan.md',
  sync: 'procedures/sync-workflow.md',
  ship: 'commands/ship.md',
  design: 'commands/design.md',
  dashboard: 'procedures/dashboard-preflight.md',
});

// `operate` is deliberately excluded from the literal-pointer treatment. Its two texts
// are runtime-differentiated (Claude Code vs Codex flavor) by design; SPEC-007's
// runtime-binding NFR ("this spec changes packaging, not dispatch semantics") forbids
// collapsing them to a shared byte-identical pointer. Its cross-runtime shared surface is
// gated separately by scripts/generate-guided-adapters.mjs (npm run check:guided-adapters).
export const RUNTIME_DIFFERENTIATED_ALIASES = Object.freeze(new Set(['operate']));

// The canonical delegation phrase every file-level-convergent skill must carry. It is the
// exact fragment planr-plan's vendored skill already uses; the checker keys on it so a
// skill that re-derives the flow (no delegation) fails loudly.
export const DELEGATION_MARKER = 'from the installed pipeline package';

// Thin-router line budget. commands/sync.md is the router this convergence created; it must
// stay a delegation shell and never regrow the inline HARD RULES / Steps procedure that was
// extracted into procedures/sync-workflow.md. The pre-extraction body was ~100 lines; a
// delegation shell is ~26. 45 sits clearly between the two. plan/ship/design/dashboard/operate
// keep substantial command-level orchestration by design and are not thin routers, so the
// budget is scoped to the file this task thinned.
export const THIN_ROUTER_BUDGET = Object.freeze({ sync: 45 });

export class WorkflowAliasParityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WorkflowAliasParityError';
    this.code = code;
    this.details = details;
  }
}

const canonical = (bytes) => bytes.replace(/\r\n/gu, '\n');

// The delegation phrase and file pointer are prose that may wrap across lines (the
// planr-plan precedent wraps "from\n   the installed pipeline package"), so match against
// a whitespace-collapsed view rather than the raw bytes.
const collapseWhitespace = (text) => canonical(text).replace(/\s+/gu, ' ');

// Pure: does this skill body delegate to the one procedure file for `slug`? Returns the
// list of failures (empty = OK). Exported so the non-vacuity test can exercise it directly
// against a reverted one-liner without scaffolding a whole project tree.
export function delegationFailures(slug, skillName, skillBytes) {
  const failures = [];
  const target = DELEGATION_TARGETS[slug];
  if (!target) {
    failures.push(`${skillName}: no declared delegation target for aliased workflow "${slug}"`);
    return failures;
  }
  const text = collapseWhitespace(skillBytes);
  if (!text.includes(DELEGATION_MARKER)) {
    failures.push(
      `${skillName}: SKILL.md does not delegate — missing "${DELEGATION_MARKER}". `
      + 'It re-derives the workflow instead of pointing at the one procedure (FR1).',
    );
  }
  if (!text.includes(target)) {
    failures.push(
      `${skillName}: SKILL.md must name its command's procedure file "${target}" so the skill `
      + 'path and command path reach the same code (FR1, not merely "both succeed").',
    );
  }
  return failures;
}

// Pure: is this command file still a thin router (no reintroduced inline procedure)?
export function budgetFailures(slug, commandBytes) {
  if (!Object.prototype.hasOwnProperty.call(THIN_ROUTER_BUDGET, slug)) return [];
  const budget = THIN_ROUTER_BUDGET[slug];
  const lineCount = canonical(commandBytes).split('\n').length;
  if (lineCount > budget) {
    return [
      `commands/${slug}.md: ${lineCount} lines exceeds the thin-router budget of ${budget}. `
      + `The workflow procedure belongs in ${DELEGATION_TARGETS[slug]}, not inline in the command.`,
    ];
  }
  return [];
}

export function checkWorkflowAliasParity({ projectRoot = root } = {}) {
  const registryPath = resolve(projectRoot, 'registry/frozen-commands.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const failures = [];
  const checked = [];

  for (const entry of registry.commands) {
    if (!entry.hasSkillAlias) continue;
    const { slug, skillName } = entry;
    if (RUNTIME_DIFFERENTIATED_ALIASES.has(slug)) continue;

    const skillPath = resolve(projectRoot, `adapters/codex/skills/${skillName}/SKILL.md`);
    if (!existsSync(skillPath)) {
      failures.push(`${skillName}: missing adapters/codex/skills/${skillName}/SKILL.md`);
      continue;
    }
    failures.push(...delegationFailures(slug, skillName, readFileSync(skillPath, 'utf8')));

    const commandPath = resolve(projectRoot, `commands/${slug}.md`);
    if (Object.prototype.hasOwnProperty.call(THIN_ROUTER_BUDGET, slug)) {
      if (!existsSync(commandPath)) {
        failures.push(`commands/${slug}.md: missing (frozen alias command must exist)`);
      } else {
        failures.push(...budgetFailures(slug, readFileSync(commandPath, 'utf8')));
      }
    }
    checked.push(slug);
  }

  if (failures.length) {
    throw new WorkflowAliasParityError(
      'E_WORKFLOW_ALIAS_PARITY',
      `Workflow alias parity check failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`,
      { failures },
    );
  }
  return { ok: true, checked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkWorkflowAliasParity();
    process.stdout.write(`Workflow alias parity OK (${result.checked.join(', ')}).\n`);
  } catch (error) {
    process.stderr.write(`${error.code ?? 'E_WORKFLOW_ALIAS_PARITY'}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

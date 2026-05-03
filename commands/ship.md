---
description: Run the DEV Phase pipeline for a feature (frontend + backend agents per task, then qa, devops, doc-gen, then snapshot)
argument-hint: <slug> [--task T-NNN] [--yes] [--no-devops] [--no-docs]
---

# /planr-pipeline:ship {slug …}

Orchestrates the DEV Phase for `feat-${SLUG}` (see **`commands/procedures/ship-arguments-and-cost-gate.md`** for flag stripping rules). Generates production code from PO-Phase task files, runs the qa-agent gate, optionally generates infra and docs, then refreshes `CLAUDE.md` via the snapshot skill.

**Flags:**

| Flag | Behaviour |
|--|--|
| **`--task T-NNN`** | Run DEV + QA/doc stages only for **`id: T-NNN`** frontmatter *(validated post mode-detection)*. |
| **`--yes`** | Skip the COST **ESTIMATE** interactive gate (**still prints** the labelled estimate block once). |
| **`--no-devops`**, **`--no-docs`** | Step 4 opt-outs unchanged. |

Fatal errors obey **`fatal-error-format.md`**.

**Per `${CLAUDE_PLUGIN_ROOT}/docs/rules.md` R1, this command MUST NOT be auto-chained from `/planr-pipeline:plan`.** A human review step is mandatory between PO Phase and DEV Phase.

---

## Step 0 — Write snapshot sentinel

Touch `.claude/.snapshot-pending` so the Stop hook (in `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json`) fires a reminder if this command aborts before reaching Step 5.

---

## Step 0.5 — Parse argv (`ship-arguments-and-cost-gate.md` **Phase A**)

Execute **`${CLAUDE_PLUGIN_ROOT}/commands/procedures/ship-arguments-and-cost-gate.md` → Phase A only** before anything that needs **`${SLUG}`**.

---

## Step 1 — Mode detection + input validation

### 1a — Detect planr spec mode

Run procedure: `${CLAUDE_PLUGIN_ROOT}/commands/procedures/mode-detection.md` **using `${SLUG}` as the slug input variable** _(equivalent historically to stripping feature token from `$ARGUMENTS`)._ After it executes, `MODE` and (for spec-driven mode) `SPEC_DIR` / `FEAT_DIR` are bound. The procedure also handles the self-heal-on-missing-`stack.md` pathway and the path-resolution table.

### 1b — Validate required inputs

The procedure file at `${CLAUDE_PLUGIN_ROOT}/commands/procedures/mode-detection.md` (section "Required inputs (per command) → /ship") covers the required-inputs validation for both modes. The procedure's "Conditional / recommended inputs" section also covers the design-spec.md / `output/db/schema.json` warnings for both modes. After it returns, continue **Step 1.5**.

### 1.5 — TASK binding re-check + COST ESTIMATE (**Phase B**)

Re-enter **`commands/procedures/ship-arguments-and-cost-gate.md` → Phase B** (TASK existence validation + COST block + conditional halt).

### 1.6 — Bind run manifest path *(append-only `.run-manifest.jsonl`, SPEC-008)*

After `MODE` / `SPEC_DIR` / `FEAT_DIR` are bound:

| Mode | Manifest (`MANIFEST_PATH`) |
|---|---|
| Spec-driven | `<SPEC_DIR>/.run-manifest.jsonl` |
| Default | `output/feats/feat-${SLUG}/.run-manifest.jsonl` |

**Contract:** Append **one JSON object per newline** (JSONL). Validate each record against **`${CLAUDE_PLUGIN_ROOT}/schemas/v1.0.0/run-manifest.schema.json`**. **Append-only** — never truncate the file or erase prior rows.

Records include **`stage`**, **`agent`** (slug or **`null`**), **`started_at`/`ended_at`**, **`files_written`/`files_modified`** (arrays of repo-relative POSIX paths touched in that slice), **`exit_status`** (**`success`|`failure`|`skipped`**), **`error_summary`** (**`null` unless `failure`**), optional **`cost_hint`** surfaced read-only via **`/planr-pipeline:status`**.

Emit at minimum:

1. **`ship.bootstrap`** when Phase B clears entry into DEV (*`agent: null`* — starts last-run partitioning for **`/planr-pipeline:status`**);  
2. **`ship.phase1`** after §**1b** inputs validate;  
3. **`ship.task:<TASK_YAML_ID>`** per dispatched task (**success OR** `tasks/T-<YAML_ID>-error-report.md` after **R6**);  
4. **`qa-gate`**, **`devops-bundle`**, **`doc-gen-bundle`** (**`exit_status: skipped`** when **`--no-devops`/`--no-docs` applies), **`snapshot`**, **`marker-write`**.

Empty path lists ⇒ **`[]`**.

---

## Step 2 — Iterate User Stories in topological order

In default mode, iterate each `us-{N}` directory under `output/feats/feat-${SLUG}/` (sorted by US number).

In spec-driven mode, iterate each `<SPEC_DIR>/stories/US-*.md` (sorted by ID); the corresponding tasks live in the *flat* `<SPEC_DIR>/tasks/` directory and reference their parent story via the `storyId` frontmatter field.

If `$SHIP_TASK_ID` was bound during **Phase A**, **only** enqueue tasks whose frontmatter **`id`** matches that literal — skip all other tasks (even within the same US).

For each story, run its tasks:

1. Read the US file to identify which tasks belong to it (via `storyId` frontmatter on each task in spec-driven mode; via directory containment in default mode).
2. For each task:
   - Read the task's frontmatter `Type` field (always present in spec-driven mode; present as `Type: UI|Tech` in default mode).
   - If `Type: UI` → delegate to the **frontend-agent** subagent (Opus 4.7).
   - If `Type: Tech` → delegate to the **backend-agent** subagent (Opus 4.7).
   - The subagent receives MODE/SPEC_DIR context so it knows where to write the error-report on failure.
   - frontend-agent and backend-agent tasks within the SAME US may run in parallel (per `${CLAUDE_PLUGIN_ROOT}/docs/pipeline-overview.md`).
3. Each subagent applies the **3-iteration correction loop** (see `${CLAUDE_PLUGIN_ROOT}/docs/rules.md` R6):
   - Iteration 1: direct fix on build/test failure.
   - Iteration 2: re-read task spec + design-spec/schema, fix holistically.
   - Iteration 3: minimal safe fix, flag remaining issues.
   - On 3rd failure: write `${CLAUDE_PLUGIN_ROOT}/templates/error-report.md`-shaped content to **`tasks/${TASK_ID}-error-report.md`** (same folder that holds task markdown), where **`TASK_ID` exactly matches YAML `id`** (pattern `^T-\\d{3}$` — e.g., `tasks/T-007-error-report.md`). **Never** write the legacy singleton `tasks/error-report.md`.
     - **Default mode:** `output/feats/feat-${SLUG}/us-{N}/tasks/T-XXX-error-report.md`
     - **Spec-driven mode:** `<SPEC_DIR>/tasks/T-XXX-error-report.md`
     - Then STOP that task.
4. If a task fails after 3 iterations, ship continues with other independent tasks but flags the failed task in the final summary.

---

## Step 3 — QA Gate (Step 3.5)

After all dispatched US/task paths complete *(or halt after per-task **`T-*-error-report.md`** handoffs)*, delegate to the **qa-agent** subagent.

When **`--task`** targeted a subset, qa-agent **still runs**, but verifies **only** tasks that executed this turn **plus any companion tasks whose outputs are mandatory for local Build/Test coherence** *(default: strict subset flagged by orchestrator).* At minimum **every dispatched task MUST be audited.**

The qa-agent verifies, for each **in-scope** task:
- All "Create" files exist
- All "Modify" files were updated (and only as described)
- All "Preserve" files are unchanged (git diff vs base)
- Tests exist and pass (`BuildCommand` + `TestCommand` from stack.md)
- DoD checklist items are satisfied

If QA fails: flag the failure in summary; **still proceed to Step 5 snapshot** so state is recorded, but skip DevOps and Doc-Gen agents until the underlying task is fixed.

---

## Step 4 — DevOps + Doc-Gen Agents (Step 3.5, parallel, optional)

These run only if QA passes **and** `$SHIP_SKIP_DEVOPS` / `$SHIP_SKIP_DOCS` booleans *(from Phase A bindings)* honor these opt-outs individually.

- Delegate to the **devops-agent** subagent — generates `docker-compose.yml`, `.env.example`, Dockerfiles, and CI config matching the stack. Per non-goals: this subagent **does NOT deploy** (enforced at the tool layer — the agent has no Bash access).
- Delegate to the **doc-gen-agent** subagent — writes `Docs/feat-${SLUG}/` from the US, tasks (+ execution notes when `--task` ran), and generated source code *(doc-gen ALWAYS runs unless `--no-docs`; targeted ship still owes updated docs).* 

---

## Step 5 — Snapshot

Refresh `CLAUDE.md` at the project root with the current project state. Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md.tpl` and write a populated copy. Capture, in this order:

1. **Project Identity** — `AppName`, `Version`, `DatabaseType`, `Framework`, `Language` from `input/tech/stack.md`. Include the generation timestamp (ISO 8601 UTC).
2. **Phase Status** — scan filesystem to determine actual state:
   - DB Prep: `output/db/schema.json` exists and non-empty?
   - PO Phase: count US + task files under `output/feats/feat-*/` (default mode) or `.planr/specs/SPEC-*/` (spec-driven mode)
   - DEV Phase: count generated source files under `src/` for the feature
3. **Feature Registry** — for each feature folder:
   - Count US directories
   - Count task files
   - Detect presence of `design-spec.md`
   - Read `status` from US frontmatter
4. **Active Agents** — list all agents in `${CLAUDE_PLUGIN_ROOT}/agents/*.md`, with model assignments and tool restrictions.
5. **Build Log** — append the latest build / test outcomes (from this `/ship` run). **Append-only — never truncate prior entries.**
6. **Known Issues / Escalations** — recursively scan **`T-*-error-report.md`** beside task trees (never the legacy singleton `error-report.md`). For each failure handoff enumerate: feature, US, task id, agent role, suspected root cause, remediation bullet.
7. **Stack Summary** — embed full content of `input/tech/stack.md`.

### Snapshot integrity rules

- ✅ Always write a complete, valid `CLAUDE.md` — never partial
- ✅ Always include the generation timestamp
- ✅ Preserve existing build log entries (append only)
- ✅ If a scan section fails, write `[scan error]` rather than leaving it empty
- ❌ Never delete `CLAUDE.md`
- ❌ Never leave `CLAUDE.md` in a partially-written state

### Coexistence with planr-managed `CLAUDE.md`

Some projects use **planr CLI**'s agile-planning-protocol guide as their `CLAUDE.md` (planr generates one too, with its own Context-Gathering Protocol). If the existing `CLAUDE.md` opens with planr's signature header (`> Generated by OpenPlanr` or contains `## Context-Gathering Protocol`), do **not** overwrite. Instead:
- Skip the snapshot write
- Print a clear notice: *"CLAUDE.md is planr-managed; pipeline state recorded via `.pipeline-shipped` marker (Step 5.5) and qa-report.md."*
- Continue to Step 5.5

This preserves the user's existing planr context without losing pipeline audit trail (which lives in `.pipeline-shipped` + `qa-report.md`).

After writing (or skipping), remove the `.claude/.snapshot-pending` sentinel.

The Stop hook in `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` is a backup: if this command aborts before this step, the hook prints a reminder.

---

## Step 5.5 — Write the `.pipeline-shipped` marker

After Step 5 succeeds, write a marker file recording the pipeline run.

**Default mode:** `output/feats/feat-${SLUG}/.pipeline-shipped`
**Spec-driven mode:** `<SPEC_DIR>/.pipeline-shipped`

Contents (YAML):

```yaml
shipped_at: "<ISO 8601 UTC timestamp>"
pipeline_version: "<from ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json>"
mode: "<default | spec-driven>"
feature: "${SLUG}"
tasks_executed: <integer>
tasks_failed: <integer>
qa_gate_status: "<passed | failed | skipped>"
duration_seconds: <integer>
agents_invoked:
  - frontend-agent          # only list agents that actually ran this run
  - backend-agent
  - qa-agent
  - devops-agent
  - doc-gen-agent
devops_status: "<generated | skipped>"
docs_status: "<generated | skipped>"
snapshot_status: "<refreshed | skipped>"
error_reports:               # paths to any T-<NNN>-error-report.md files; empty list if none
  - <path>
```

If Step 5 (snapshot) failed but tasks shipped, still write the marker with
`snapshot_status: skipped` so the partial-success state is recorded.

---

## Step 6 — Print summary

```
✓ DEV Phase complete for feat-${SLUG}
  Mode:            <default | spec-driven>
  Output dir:      <output/feats/feat-${SLUG}/ | .planr/specs/SPEC-NNN-${SLUG}/>
  Tasks succeeded: X / Y
  Tasks failed:    Z (see T-<NNN>-error-report.md paths)
  QA gate:         <passed | failed>
  DevOps config:   <generated | skipped>
  Docs:            <generated | skipped>
  CLAUDE.md:       refreshed
  Marker:          <output dir>/.pipeline-shipped     ← proof of pipeline execution
```

If spec-driven mode was active, the spec's frontmatter `status` is updated to `in-pipeline` while ship runs and to `done` on full success.

If any task failed, enumerate every **`T-<NNN>-error-report.md`** path produced.

---

## Failure modes

| Condition | Action |
|-----------|--------|
| feat folder missing | Abort, suggest `/planr-pipeline:plan ${SLUG}` |
| No tasks | Abort, suggest re-run of PO Phase |
| Single task fails 3x | Continue with other tasks, surface in summary |
| All tasks fail | Skip QA + DevOps + Doc-Gen; still run snapshot to record state |
| QA gate fails | Skip DevOps + Doc-Gen; still run snapshot |

---

*Reads (default mode): `output/feats/feat-{name}/`, `stack.md`, `schema.json`, `design-spec.md`*
*Reads (spec-driven mode): `.planr/specs/SPEC-NNN-{slug}/`, `stack.md`, `schema.json`, `design-spec.md`*
*Writes: `src/features/{name}/`, tests, `docker-compose.yml` (optional), `Docs/` (optional), `CLAUDE.md` (via snapshot)*
*Per `${CLAUDE_PLUGIN_ROOT}/docs/rules.md` R1: must be invoked manually after human review of PO Phase output.*

**Bridge to planr CLI:** in spec-driven mode, this command reads/writes `.planr/specs/` directly — no conversion. The planr CLI is the *authoring* surface; planr-pipeline is the *executor*.

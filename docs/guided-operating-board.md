# Guided Operating Board

`planr operate` owns the questions, validation, previews, actions, and safety
boundaries. Claude Code, Codex, Cursor, and a terminal only present those
artifacts and return answers by canonical question ID.

## First use

```bash
planr operate inspect
planr operate init
planr operate run --preview
planr operate run
planr operate review
planr operate report
```

In an interactive terminal, the CLI asks the questions directly. In a coding
runtime, the installed `planr-operate` workflow requests `--json`, presents the
returned questionnaire through a verified native question surface or structured
chat, and sends the typed answer envelope on bounded stdin. If neither is
available, it returns the exact terminal handoff. Adapters never invent answers,
defaults, questions, commands, or consent.

One explicit request to run a cycle selects its exact cycle-start action and
authorizes the reversible local adapter lifecycle through independent advisors,
Chair consolidation, and a `reviewable`, `blocked`, or `failed` result. The
runtime does not ask the user to paste `adapter prepare`, `record`, `finalize`,
Chair, or report commands. Provider consent, finding disposition, route
application, planning artifacts, PLAN, SHIP, and external effects remain
separate named gates. `--preview` performs no writes and no provider calls.
`--dry-run` may use a provider after disclosure but commits no operating state.

Claude Code uses `native-isolated` advisor dispatch. Codex uses
`native-bounded`: each native advisor receives only one immutable role pack and
may not inspect the workspace, environment, network, or other tools. Cursor
uses the structured-provider path. All adapters return
`operating-advisor-response@1.2.0`; OpenPlanr owns canonical metadata and
digests.

## Evidence recovery

A safely redacted evidence item remains useful. An item that cannot be made
safe is quarantined individually, while unrelated evidence and ready lenses
continue. Only when required evidence is blocked should the runtime run the
exact value-free diagnostic action:

```bash
planr operate evidence diagnose <candidate-id>
```

The report contains a safe relative path, detector category, line/column, and
fingerprint—never the value. A confirmed credential must be removed or rotated.
Only eligible soft-pattern findings can be classified as a false positive, and
that classification is bound to the evidence digest and operating head. Private
keys, high-confidence token formats, and other hard categories cannot be
overridden.

## Privacy and retention

Raw evidence, prompts, responses, credentials, sessions, and diagnostics remain
machine-local under `~/.planr/operate/<project-hash>`. Commit-safe state contains
sanitized events and immutable metadata. Session and evidence cleanup is exposed
through `planr operate cache status|purge`; `planr doctor` reports expired guided
sessions and adapter interaction capability.

## Automation

`--json` is one versioned object on stdout and is non-interactive. Scripts must
choose a returned action ID and echo its exact confirmation digest. A runtime
may add `--yes` only to the exact cycle-start action selected by an explicit
cycle request. Do not parse human labels or add a broad `--yes`. Missing
pipeline/runtime capability fails before provider use with a named recovery
command.

The dashboard is optional. `planr operate report` prints the concise brief and
separate CEO, CTO, CPO, CMO, COO, and Chair reports as Markdown, while
`planr operate report --json` returns structured results and exact governed
conversion commands for findings, routes, specs, tasks, and quick tasks.

## Troubleshooting

- `E_OPERATE_NOT_INITIALIZED`: run `planr operate init`.
- `E_GUIDED_INTERACTION_UNAVAILABLE`: attach a terminal or use a certified
  runtime with structured questions/chat.
- `E_GUIDED_SESSION_EXPIRED`: restart the current guided command.
- `E_GUIDED_SESSION_STALE`: inspect changed project/config state, then restart.
- `E_OPERATE_SECRET_DETECTED`: use `operate evidence diagnose`; do not inspect or
  weaken private state.
- `E_PIPELINE_NOT_INSTALLED`: run the exact full-install command in the result.

The deterministic journey fixtures and canary are:

```bash
node --test tests/ecosystem/guided-operate-acceptance.test.mjs
node scripts/guided-operate-canary.mjs --fixtures
```

---
description: OpenPlanr Operating Board adapter policy
globs: [".planr/operate/**"]
alwaysApply: false
---

Use only the public `planr operate` command surface. Treat `--preview` as
provider-free and write-free; `--dry-run` is write-free but can be
provider-backed and billable. Never edit events, immutable records, journals,
projections, routes, or outcome links under `.planr/operate`.

Consume only schema-valid `questionnaire` and `actions` returned by the CLI.
Present questions through a verified runtime question surface, structured chat,
or an attached terminal. Submit typed answers through the bounded stdin/resume
lifecycle. Never copy questions, infer answers, or reconstruct commands.

An explicit request to run one Operating Board cycle authorizes the exact
CLI-returned cycle start and its reversible local adapter lifecycle through
`reviewable`, `blocked`, or `failed`. Preview first; continue prepare, record,
finalize, resume, Chair, and read-only report steps without asking the user to
paste commands. Ask separately for provider consent, finding acceptance, route
application or rollback, planning artifacts, PLAN, SHIP, and external effects.

Canonical advisory lenses: {{OPERATING_LENSES}}. They are read-only and separate
from delivery roles. Native advisor work must use the digest-bound `rolePacks`
returned by `planr operate adapter prepare` under the declared
`operatingAdvisorDispatch` mode. A `native-bounded` advisor uses only the
supplied pack and no workspace, environment, network, or tools; a
`native-isolated` advisor retains empty-tool isolation. Record compact
`operating-advisor-response@1.2.0` values through the CLI, finalize independent
results, and prepare the Chair separately. Never improvise or role-play beyond
the supplied evidence.

Keep finding acceptance and route application separate. Preserve
`awaiting-plan` and its exact PLAN handoff; resuming requires matching planning
provenance and leaves `shipInvoked` false. After a completed cycle, print the
brief and per-lens Markdown or JSON report with exact CLI-provided planning
conversion commands. The dashboard is optional.

Never auto-chain SHIP or perform deploy, publish, spend, customer-contact,
credential, or destructive-data actions.

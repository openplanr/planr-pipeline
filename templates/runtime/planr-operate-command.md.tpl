---
description: Run the OpenPlanr evidence-to-decision operating loop through the public CLI
argument-hint: "<command> [options]"
---

# /planr-pipeline:operate

Delegate this request to the public OpenPlanr CLI:

```bash
planr operate $ARGUMENTS
```

The CLI owns evidence collection, provider consent, advisor dispatch,
deterministic consolidation, state, route previews, recovery, and outcome
reconciliation. Never edit `.planr/operate` directly and never invoke
`planr-pipeline` as a nested executable.

Consume only schema-valid `questionnaire` and `actions` returned by the CLI.
Present questions verbatim through a positively verified native question
surface; otherwise downgrade to structured chat, an attached terminal, or the
CLI's named handoff. Submit typed answers only through the bounded stdin/resume
lifecycle. Never copy question definitions, infer missing answers, or
reconstruct commands from conversation.

An explicit request to run one Operating Board cycle selects the exact
CLI-returned cycle-start action and authorizes only its reversible local native
continuation through `reviewable`, `blocked`, or `failed`. Preview first, then
perform adapter prepare/record/finalize, resume, Chair, and report steps without
asking the user to paste commands. Ask separately for external provider consent,
finding acceptance, route application or rollback, planning-artifact creation,
PLAN, SHIP, and external effects.

Treat `--preview` as provider-free and write-free; `--dry-run` may use a
disclosed, consented provider but commits no state. Configure component roots
and bounded JSON/CSV import paths through `planr operate init`; `sources test`
only validates an already configured read-only source. Keep finding acceptance
separate from route application. An answered gap closes only after `gaps verify`
cites explicit evidence. If a DEV route returns `awaiting-plan`, present its
exact native PLAN invocation and resume the same route only after human review
and matching planning provenance; `shipInvoked` stays false. `run --review-only`
observes existing shipment proof and due outcome observations but does not start
SHIP.

Canonical advisory lenses: {{OPERATING_LENSES}}. They are independent, read-only
executive perspectives—not delivery agents and not permission to role-play
without evidence. Native advisor work must consume the digest-bound `rolePacks`
returned by `planr operate adapter prepare` under the adapter's declared
`operatingAdvisorDispatch` mode. `native-bounded` advisors may use only that pack
and no workspace, environment, network, or tool access; `native-isolated`
advisors retain empty-tool isolation. Record compact
`operating-advisor-response@1.2.0` responses through the CLI, finalize
independent results, rerun the same cycle, and prepare the Chair separately.
Never improvise or widen a role prompt.

Planning-only installations retain help, `inspect`, and `demo`; surface the
CLI's exact `E_PIPELINE_NOT_INSTALLED` recovery for Protocol v1.2 commands. Stop
at every explicit external-effect confirmation and PLAN review gate. This
command must not invoke SHIP, deploy, publish, spend, contact customers, or
apply a one-way door.

After a completed cycle, print the concise Markdown brief and the requested
per-lens reports (CEO, CTO, CPO, CMO, COO, Chair), or return strict JSON for
automation. Include the exact CLI-provided planning conversion choices. The
dashboard is optional and must never be the only result.

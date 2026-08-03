---
name: planr-sync
description: Audit OpenPlanr planning artifacts for graph and protocol drift.
---

# Planr Sync

1. Run `planr pipeline sync --json` to audit spec ↔ quick-task ↔ tracker alignment.
2. Follow the portable procedure in `procedures/sync-workflow.md` from the installed pipeline
   package — the same one procedure `commands/sync.md` reads, so this workflow has one
   implementation. It is read-only by default: change artifacts only when the user explicitly
   requests repair (`--apply`), and push to the tracker or git only with `--push` or explicit
   confirmation, always after a dry-run preview.

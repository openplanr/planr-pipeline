---
name: planr-ship
description: Execute the reviewed OpenPlanr pipeline DEV and QA phases for a feature.
---

# Planr SHIP

1. Confirm this is a separate user invocation after PLAN review.
2. Run `planr pipeline prepare-ship <feature> --json`, then follow the portable procedure in
   `commands/ship.md` from the installed pipeline package — the same one procedure the Claude
   Code command reads, so this workflow has one implementation. Execute ready tasks in
   `dependsOn` order (native subagents when available, otherwise the registry-defined roles
   sequentially), respect each task's Create/Modify/Preserve lists and role ownership, and retry
   a failing task at most three times before writing its error report and marking it blocked.
3. Run build and tests from `input/tech/stack.md`, perform the read-only QA gate, then run
   `planr pipeline finalize-ship <feature> --runtime codex --json` so manifests, provenance, and
   the `.pipeline-shipped` marker are written.

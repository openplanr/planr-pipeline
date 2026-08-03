---
name: planr-design
description: Run OpenPlanr design, design-loop, or design-review using portable board assets.
---

# Planr Design

1. Invoke `planr pipeline design-engine` with the user's design subcommand and arguments, using
   repository-relative artifact paths.
2. Follow the portable procedure in `commands/design.md` from the installed pipeline package —
   the same one procedure the Claude Code command reads, so this workflow has one implementation.
   Review returned annotations before applying changes, preserve existing visual behavior, keep
   review and sharing explicit (never auto-publish or auto-chain), and never launch a
   non-loopback server.

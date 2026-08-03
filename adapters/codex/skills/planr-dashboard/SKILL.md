---
name: planr-dashboard
description: Start or inspect the loopback-only OpenPlanr planning dashboard.
---

# Planr Dashboard

1. Run `planr pipeline dashboard` with the user's options.
2. Follow the portable procedure in `procedures/dashboard-preflight.md` from the installed
   pipeline package — the same one procedure `commands/dashboard.md` reads, so this workflow has
   one implementation. Keep the server bound to loopback, report the local URL, and use
   `--no-watch` when a one-shot view is requested.

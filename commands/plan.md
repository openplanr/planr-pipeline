---
description: DEPRECATED — this plugin was renamed to planr-pipeline. Install the new plugin and use /planr-pipeline:plan instead.
argument-hint: <feature-name>
---

# /openplanr-pipeline:plan — DEPRECATED

This plugin has been **renamed** to `planr-pipeline` (brand convergence on the `planr` CLI binary).

**You're running the v0.6.1 deprecation stub.** It does nothing except print this message.

## Migrate in 30 seconds

Run these two commands in your Claude Code session:

```
/plugin uninstall openplanr-pipeline
/plugin install planr-pipeline@openplanr
```

Then re-invoke as:

```
/planr-pipeline:plan {feature}
```

## Why the rename?

The CLI you run daily is `planr`. Having to type `/openplanr-pipeline:plan` for slash commands created friction. The rename aligns the brand: `planr` (CLI) ↔ `planr-pipeline` (the executor it pairs with).

The new plugin's behaviour is **byte-for-byte identical** to v0.6.0 of this one — only the name changed.

## Links

- New plugin: <https://github.com/openplanr/planr-pipeline>
- v0.7.0 release notes: <https://github.com/openplanr/planr-pipeline/releases/tag/v0.7.0>
- CLI: <https://www.npmjs.com/package/openplanr>

---

**STOP.** Do not run any of the original PO Phase logic. Print this message only.

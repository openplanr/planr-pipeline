# planr-pipeline has moved to openplanr/OpenPlanr

This repository is no longer maintained. `planr-pipeline` is now developed in the
[OpenPlanr repository](https://github.com/openplanr/OpenPlanr) under
[`packages/pipeline`](https://github.com/openplanr/OpenPlanr/tree/main/packages/pipeline),
and the [`planr-pipeline`](https://www.npmjs.com/package/planr-pipeline) npm package is
published from there.

- **Install OpenPlanr:** `npm install -g openplanr`, then `planr setup`. The
  [getting started guide](https://github.com/openplanr/OpenPlanr/blob/main/docs/getting-started.md)
  covers each coding agent.
- **Claude Code:** the pipeline plugin that used to install from this repository is replaced by
  the unified `planr` plugin, which `planr setup --runtime claude --scope user` installs.
- **Questions and bugs:** use
  [Discussions](https://github.com/openplanr/OpenPlanr/discussions) and
  [issues](https://github.com/openplanr/OpenPlanr/issues) in openplanr/OpenPlanr.

The last release from this repository is
[v0.42.0](https://github.com/openplanr/planr-pipeline/releases/tag/v0.42.0). Its history stays
here for reference.

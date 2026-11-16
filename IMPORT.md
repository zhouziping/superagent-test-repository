# Upstream import

This repository contains an unmodified source snapshot of
[deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)
at commit [`8c32a9dc5d72c033816c6a8110b37f40cf94fba4`](https://github.com/deepseek-ai/dsh-superagent-prototype/commit/8c32a9dc5d72c033816c6a8110b37f40cf94fba4).

All 216 upstream files are retained byte-for-byte with their original Git file modes,
including the upstream README, MIT license and copyright notice, documentation,
prompts, skills, source, tests and dependency lockfile. This file is the only
addition to that snapshot. The import replaces the destination repository's
initial placeholder README; its previous version remains in Git history.
Upstream Git history is not imported.

## Development

Use Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`, as declared by the upstream
package. From this repository's root:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs the upstream typecheck, test suite and build. The package is a
DSH bundle, not a standalone web application. See [README.md](README.md) for an
overview and [SETUP.md](SETUP.md) for optional deployment instructions.

Importing the code does not install the bundle into an existing DSH deployment,
configure GitHub or Feishu credentials, or start background services. The
upstream research-prototype limitations and warning in the README still apply.

Submit changes through a pull request for human review and manual merge.

# Upstream import

This repository imports the source snapshot of
[deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)
at commit [`8c32a9dc5d72c033816c6a8110b37f40cf94fba4`](https://github.com/deepseek-ai/dsh-superagent-prototype/commit/8c32a9dc5d72c033816c6a8110b37f40cf94fba4).

All 216 upstream files are included with their original Git file modes,
including the upstream README, MIT license and copyright notice, documentation,
prompts, skills, source, tests and dependency lockfile. Of these, 214 files are
byte-for-byte identical to upstream. The two local changes are listed below;
this provenance file is the only additional file. The import replaces the
destination repository's initial placeholder README; its previous version
remains in Git history. Upstream Git history is not imported.

## Local correction

- `src/sources/feishu-loops.ts`: keep a malformed event's error status when a
  readiness message arrives later on the independent stderr stream. Previously,
  that message could overwrite the error status because stdout and stderr
  delivery order is not guaranteed.
- `tests/sources.spec.ts`: add a regression that sends malformed stdout before
  allowing stderr readiness, then verifies readiness does not clear the error.

No other upstream code, client UI, dependency versions or deployment settings
are modified.

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

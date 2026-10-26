# AGENTS.md

## Tooling

Every development tool is declared in `mise.toml` and run through mise (`mise install`, then `mise exec` or `mise run`). Add a tool to `mise.toml`, pinned, before using it.

`mise run ci` runs every check CI runs.

Inside the workspace, tsc and Vitest resolve `@edity/*` imports to each package's `src/` through the `@edity/source` export condition. Anything else (Node, an Astro build) reads `dist/`, so run `mise run build` first.

## Releasing

`@edity/core` and `@edity/astro` share one version. To release, bump `version` in both `packages/*/package.json` and merge to `main`. `.github/workflows/publish.yml` then runs every check and stages each version not yet on npm (`mise run publish:stage`). A maintainer releases it with `npm stage approve <stage-id>` and 2FA, core first. npm trusts that workflow to stage only, never to publish directly. `mise run publish:stage --dry-run` shows what would be staged.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

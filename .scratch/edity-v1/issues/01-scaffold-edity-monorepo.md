# 01. Scaffold the edity monorepo

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M0

## What to build

Set up the `edity` repository as a pnpm workspace with `packages/core`, `packages/astro` and a `contracts/` folder. Add TypeScript, a test runner (Vitest), linting and formatting, and a GitHub Actions CI workflow that runs them. Every tool is declared in `mise.toml` (see `AGENTS.md`), and common commands are exposed as `mise run` tasks.

## Acceptance criteria

- [ ] `mise install && mise run ci` passes locally on a fresh clone
- [ ] CI runs lint, type-check and tests on pushes and pull requests
- [ ] `packages/core` and `packages/astro` are publishable as `@edity/core` and `@edity/astro`, with `"license": "MPL-2.0"` (ADR-0006)
- [ ] No tool is used that isn't declared in `mise.toml`

## Notes

The npm names already exist as `0.0.0` placeholders under the `edity` org. Publishing needs 2FA today; trusted publishing from GitHub Actions can come later.

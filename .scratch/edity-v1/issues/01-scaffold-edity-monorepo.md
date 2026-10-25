# 01. Scaffold the edity monorepo

Status: resolved
Repo: RMYPG/edity
Milestone: M0

## What to build

Set up the `edity` repository as a pnpm workspace with `packages/core`, `packages/astro` and a `contracts/` folder. Add TypeScript, a test runner (Vitest), linting and formatting, and a GitHub Actions CI workflow that runs them. Every tool is declared in `mise.toml` (see `AGENTS.md`), and common commands are exposed as `mise run` tasks.

## Acceptance criteria

- [x] `mise install && mise run ci` passes locally on a fresh clone
- [x] CI runs lint, type-check and tests on pushes and pull requests
- [x] `packages/core` and `packages/astro` are publishable as `@edity/core` and `@edity/astro`, with `"license": "MPL-2.0"` (ADR-0006)
- [x] No tool is used that isn't declared in `mise.toml`

## Notes

The npm names already exist as `0.0.0` placeholders under the `edity` org. Publishing needs 2FA today; trusted publishing from GitHub Actions can come later.

## Comments

2026-10-25: The repo is a pnpm workspace with `packages/core` (`@edity/core`), `packages/astro` (`@edity/astro`, which depends on `@edity/core` through `workspace:^`) and `contracts/` (a README until ticket 16). Both packages are ESM and MPL-2.0, built with `tsc` into `dist/`, and export their types from there. Inside the workspace the `@edity/source` export condition points tsc and Vitest at `src/`, so type-checking and tests need no build. Each package has a placeholder entry point and a test that imports it by its package name. ESLint (flat config, typescript-eslint) and Prettier (single quotes) follow the Site template. `pnpm-workspace.yaml` sets `strictDepBuilds`, `minimumReleaseAge` and `trustPolicy` as the template does. `mise.toml` keeps its pins, adds jactionlint and shellcheck (as `edity-server` does), and defines the tasks `deps`, `lint`, `format`, `format:check`, `typecheck`, `test`, `build`, `check:packages` and `ci`. `check:packages` packs each package with pnpm and checks the tarball with publint and arethetypeswrong.

Verified: `mise trust && mise install && mise run ci` passes in a fresh `git clone` of the branch, with empty mise and pnpm data directories and no Node or pnpm on `PATH`, so every tool came from `mise.toml`. Files under `.claude/` are ignored by git, ESLint, Prettier, Vitest and tsc. `.github/workflows/ci.yml` runs `mise run ci` through `jdx/mise-action` on a Blacksmith runner, for pushes to `main` and for pull requests. jactionlint and shellcheck pass on it, but it has not run on GitHub yet: its first real run happens on the pull request. The packages are not published yet: their version is `0.1.0`, above the `0.0.0` placeholders on npm, and publishing still needs 2FA.

Left over: Prettier ignores `.scratch/`, so the tracker keeps its compact tables. The packages have no README, and the repo has no Renovate config yet.

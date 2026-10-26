# 27. Release workflow for Publish commits

Status: ready-for-agent
Repo: RMYPG/static-astro-site-template
Milestone: M6
Covers: V3 (see the [spec](../spec.md))

## What to build

Add a workflow to the Site template that runs the existing release logic automatically when CI succeeds on `main` for a commit authored by the `edity-publisher` App (`edity-publisher[bot]`), so every Publish becomes a Release without the Developer. Read the allowed bot login(s) from a repository variable instead of hard-coding `edity-publisher[bot]`, since a separate dev App will commit to the sandbox later (ticket 28). Copy it to `edity-sandbox`.

## Acceptance criteria

- [ ] A bot-authored commit on `main` produces a `vX.Y.Z` tag and image after CI passes
- [x] Developer commits keep the manual release flow
- [x] The existing version checks in `release.yml` still pass, because the commit already bumped `package.json`

## Comments

2026-10-26: Built in two draft PRs with the same diff, both with `quality` and `build` green: [RMYPG/static-astro-site-template#12](https://github.com/RMYPG/static-astro-site-template/pull/12) and [RMYPG/edity-sandbox#1](https://github.com/RMYPG/edity-sandbox/pull/1).
- **`release-on-publish.yml`:** when CI succeeds on a push to `main`, it calls `release.yml` with the sha CI ran on. It does this only if the pushing login is listed in the `EDITY_PUBLISHER_LOGINS` repository variable (comma-separated, no spaces).
- **`release.yml`:** now accepts that sha. A called run whose commit an existing `vX.Y.Z` tag already contains ends green with a notice. The concurrency group moved to the job.
- **Checked:**
  - The trigger condition, with act against a stub `release.yml` (8 cases): Developer pushes, failed CI, pull requests, an unset variable and partial login matches release nothing.
  - The version step, on scratch git histories (7 cases).
- **Left open:** the first criterion needs a real run. `workflow_run` only fires from `main`, so merge the sandbox PR, then run `gh variable set EDITY_PUBLISHER_LOGINS --repo RMYPG/edity-sandbox --body 'edity-publisher[bot]'`. After that, the first commit the App pushes to `main` should produce a tag and image. Ticket 28 changes the value to `edity-publisher-dev[bot]`.

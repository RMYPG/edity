# 27. Release workflow for Publish commits

Status: ready-for-agent
Repo: RMYPG/static-astro-site-template
Milestone: M6
Covers: V3 (see the [spec](../spec.md))

## What to build

Add a workflow to the Site template that runs the existing release logic automatically when CI succeeds on `main` for a commit authored by the `edity-publisher` App (`edity-publisher[bot]`), so every Publish becomes a Release without the Developer. Copy it to `edity-sandbox`.

## Acceptance criteria

- [ ] A bot-authored commit on `main` produces a `vX.Y.Z` tag and image after CI passes
- [ ] Developer commits keep the manual release flow
- [ ] The existing version checks in `release.yml` still pass, because the commit already bumped `package.json`

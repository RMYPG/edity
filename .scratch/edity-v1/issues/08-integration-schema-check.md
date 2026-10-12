# 08. Astro integration: committed JSON Schema stays in sync

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M1
Blocked by: 03, 07
Covers: N3 (see the [spec](../spec.md))

## What to build

The integration regenerates each page's JSON Schema during `astro dev`, and fails `astro build` when the committed file is stale, like a lockfile.

## Acceptance criteria

- [ ] Changing a Limit in TS without regenerating fails `astro build` with the command to fix it
- [ ] `astro dev` rewrites the file automatically

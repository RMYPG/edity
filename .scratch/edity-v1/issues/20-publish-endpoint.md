# 20. Publish endpoint

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 04, 19, 21
Covers: V2, V3, V4, V5, S7, P3 (see the [spec](../spec.md))

## What to build

Implement `POST /_edity/api/publish`. As the `edity-publisher` GitHub App: read the page's content and generated JSON Schema from `main` HEAD, validate (ticket 19), detect Conflicts per Change (a structural List Change conflicts if any part of the stored List differs from `before`), apply the Changes that merge, bump the patch version in `package.json`, and create one commit on top of that exact HEAD. The commit message lists the changed Fields and ends with an `Edity-Client: <Zitadel user>` trailer. Write only to the Site's content files and `package.json`. Rate-limit per Site.

## Acceptance criteria

- [ ] Returns `202 { sha, version, conflicts? }`, `409`, `422` or `401` as in the spec
- [ ] If `main` moves between read and commit, the commit is retried or rejected, never written on a stale base
- [ ] Works end to end against `edity-sandbox`

## Notes

Login is ticket 25; until then, a development-only stub identity is fine.

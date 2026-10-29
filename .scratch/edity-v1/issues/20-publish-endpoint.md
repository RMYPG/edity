# 20. Publish endpoint

Status: resolved
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 04, 19, 21
Covers: V2, V3, V4, V5, S7, P3 (see the [spec](../spec.md))

## What to build

Implement `POST /_edity/api/publish`. As the `edity-publisher` GitHub App: read the page's content and generated JSON Schema from `main` HEAD, validate (ticket 19), detect Conflicts per Change (a structural List Change conflicts if any part of the stored List differs from `before`), apply the Changes that merge, bump the patch version in `package.json`, and create one commit on top of that exact HEAD. The commit message lists the changed Fields and ends with an `Edity-Client: <Zitadel user>` trailer. Write only to the Site's content files and `package.json`. Rate-limit per Site.

## Acceptance criteria

- [x] Returns `202 { sha, version, conflicts? }`, `409`, `422` or `401` as in the spec
- [x] If `main` moves between read and commit, the commit is retried or rejected, never written on a stale base
- [x] Works end to end against `edity-sandbox`

## Notes

Login is ticket 25; until then, a development-only stub identity is fine.

## Comments

2026-10-29: Built in [RMYPG/edity-server#3](https://github.com/RMYPG/edity-server/pull/3), with the standard library only (`encoding/json/v2` and `jsontext` from Go 1.27).
- **`internal/content`** reads a content file with its key order and the original text of every value, applies Changes by path, and writes the file exactly as Prettier 3.9 formats JSON. Line width is a port of Prettier's `getStringWidth`, generated from Prettier's own bundle (`emoji.mjs`). `testdata/prettier.json` holds Prettier's answers on 780 files, 9k texts and 900 numbers, and the Go tests match them all.
- **`internal/github`** calls GitHub as `edity-publisher`: an RS256 JWT, the installation of each repository, and a token scoped to that repository, cached until 5 minutes before it expires. It commits with GraphQL `createCommitOnBranch` and `expectedHeadOid`, so the HEAD check and the commit are one step on GitHub's side.
- **`internal/publish`** reads the content, the page's schema and `package.json` at `main` HEAD.
  - A Change whose stored value isn't its `before`, or whose Field or Item is gone, is a Conflict, even when the stored value already equals `after` (V2). A path that is neither a Field nor a List is a violation, `unknown`.
  - It applies the Changes that merge, validates the whole content (N3), bumps the patch version (only the `version` string), and commits only the content file and `package.json` (V4).
  - When `main` moved, it reads again and starts over, up to 3 times. After an uncertain failure it first checks whether that commit landed, so it never commits twice.
  - The message is `content: publish <page>`, then `Changed:` with one line per merged path, then the `Edity-Client: <name>` trailer.
- **The handler** checks, in order: `Origin` (403), the session (401), the body (400, or 413 over 1 MiB), then a per-Site rate limit (10 at once, then one every 2 minutes, so 429 with `Retry-After`). It answers 202, 409 or 422 as in the spec, and 500 or 503 when the repository or GitHub fails. The Publish finishes even if the browser leaves.
- **Login:** `Sessions` is an interface for ticket 25. Until then no request has a session, so a real request gets 401.
- **Checked:**
  - Every status goes through `apitest.Handler` against `api/openapi.yaml`, so the 422 body is checked against the file (ticket 19).
  - Tests cover `main` moving once (one commit on the new HEAD, Conflicts worked out again) and moving every time (503, no commit), a spurious STALE_DATA, and uncertain failures whether the commit landed or not.
  - `mise run check:sandbox` (build tag `sandbox`, not in CI) published twice on edity-sandbox, with the `dev` credentials through `infisical run`. It calls the Publish code (`publish.New`) directly, as the Developer chose: the HTTP route answers 401 to every real request until ticket 25, and its tests cover it through `apitest.Handler`. What it did:
    - `4bc9310` changed `hero.cta` and was released as `v1.0.1`.
    - `f50d2c4` put it back and was released as `v1.0.2`.
    - For each commit it confirmed the author `edity-publisher[bot]` with a verified signature, the HEAD read as its only parent, the trailer, only the two files changed, the sandbox's CI green (`prettier --check` included), and the tag from Release on Publish.
    - A stale `before` got 409 and a broken Limit 422, both leaving `main` unmoved.
    - After the round trip `home.json` is byte for byte the original.
- **Left over:**
  - ~~An uncertain commit that lands without GitHub saying so, with someone pushing on top before the next read, is answered as a Conflict instead of a success.~~ Fixed after review, below.
  - Only this route checks `Origin` so far; ticket 25 adds it to the others.
  - A content file whose objects were written collapsed gets them expanded on its first Publish, which still passes Prettier.

2026-10-29, after the code review (RMYPG/edity-server#3 and RMYPG/edity#3):
- **Already published (the Developer's decision):** a Change whose stored value already equals its `after` is no Conflict and has nothing to commit, whatever its `before`. When every Change is like that, the answer is 202 with the newest App commit that changed `src/content/<page>.json` and the version at that commit. So a Client who presses Publish again after a 202 that never reached the browser sees their Publish's progress, not Conflicts on their own Changes, and so does the uncertain-commit case above.
- **Origin (A4):** `https://` and one of the Site's hostnames, on any port; `http://` only for a loopback hostname such as `localhost`. Before, it took the scheme from the request, which is `http` behind Cloudflare Tunnel.
- **Prettier (N3):** edity-server writes content with Prettier 3.9's defaults for JSON. `@edity/astro`'s page loader now fails the Site's build when the Site's own Prettier config for the content file (`.prettierrc`, overrides, `.editorconfig`) or its Prettier version would format it differently, so a Developer's config change or a Prettier upgrade fails on their own commit, not on every Publish after it. edity-server's README, "Content files and Prettier", says what a Site keeps and how to move to another Prettier.

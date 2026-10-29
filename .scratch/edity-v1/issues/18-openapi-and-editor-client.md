# 18. OpenAPI contract and generated Editor client

Status: resolved
Repo: RMYPG/edity-server, RMYPG/edity
Milestone: M4
Blocked by: 17
Covers: N10 (see the [spec](../spec.md))

## What to build

Describe the API from the spec's API section in OpenAPI 3.1 in `edity-server`. Generate the Editor's typed TS client from it in `edity`, and test the server's handlers against it.

## Acceptance criteria

- [x] Every route, status code and body in the spec's API table is in the OpenAPI file
- [x] The Editor uses only the generated client
- [x] A change to the OpenAPI file that breaks the client fails `edity`'s CI

## Comments

2026-10-29: Built in two PRs: [RMYPG/edity-server#3](https://github.com/RMYPG/edity-server/pull/3) (the OpenAPI file) and [RMYPG/edity#3](https://github.com/RMYPG/edity/pull/3) (the client).
- **The file:** `api/openapi.yaml` in edity-server, OpenAPI 3.1.1, with every route of the spec's API table under an operationId (`login`, `finishLogin`, `logout`, `getSession`, `publish`, `getPublishStatus`).
  - The 422 body is `{ violations: [{ path, limit }] }` (ticket 19's names). Conflicts are `[{ path }]` in both the 202 and the 409.
  - Added beyond the table: 400 for a malformed Publish body, 403 from the `Origin` check (A4), 429 with `Retry-After` (V5), and 404 for an unknown host or sha.
  - Settled ahead of ticket 25, which can change them: the `edity_session` cookie, 302 to Zitadel, 303 back from the callback, and a `return` parameter on `/_edity/login` that brings the Client back to their page (A3).
  - vacuum 0.35.7 lints it in `mise run lint`.
- **Server tests:** `internal/apitest` wraps a handler in tests and fails on any response, or any answer to a request, that the file doesn't describe. The route tests read the routes from the file. Tickets 20 and 22 test their handlers through it, and ticket 25 will.
- **The client:** `packages/astro/api/openapi.yaml` is the file pinned at an edity-server commit, and `mise run api:pin <sha>` re-pins it. `mise run api:generate` writes `src/editor/openapi.ts` with openapi-typescript 7.13 (`--immutable`), through `api/generate.ts`, which works around its unresolvable recursive `ContentValue` array (TS2502).
  - `api.ts` calls the server through openapi-fetch 0.17 (2.3 KB gzipped on the Editor bundle) and takes `Session`, `PublishRequest` and `PublishedChange` from the generated types, by route.
- **Checked:**
  - `mise run ci` runs `api:generate --check` and the type-check. Renaming `Session.name`, dropping the session's 401 and renaming `Change.path` in the pinned file each failed it.
  - The page loader also fails the build for a page whose name the file's pattern refuses.
- **Left over:**
  - The pin is a commit of edity-server's PR branch. That repository squash-merges, so re-pin to the merged commit on `main` with `mise run api:pin` once the PR merges.
  - edity's CI sees the server's file only at its pin. A change on edity-server's side that breaks the Editor reaches edity's CI only at the next re-pin; ticket 24's Pact tests are what catch it in edity-server's CI.

# 18. OpenAPI contract and generated Editor client

Status: ready-for-agent
Repo: RMYPG/edity-server, RMYPG/edity
Milestone: M4
Blocked by: 17
Covers: N10 (see the [spec](../spec.md))

## What to build

Describe the API from the spec's API section in OpenAPI 3.1 in `edity-server`. Generate the Editor's typed TS client from it in `edity`, and test the server's handlers against it.

## Acceptance criteria

- [ ] Every route, status code and body in the spec's API table is in the OpenAPI file
- [ ] The Editor uses only the generated client
- [ ] A change to the OpenAPI file that breaks the client fails `edity`'s CI

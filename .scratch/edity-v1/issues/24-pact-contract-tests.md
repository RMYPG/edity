# 24. Pact contract tests

Status: ready-for-agent
Repo: RMYPG/edity, RMYPG/edity-server
Milestone: M4
Blocked by: 18
Covers: N11 (see the [spec](../spec.md))

## What to build

Write Pact consumer tests in `edity` (`pact-js`) for every API call the Editor makes, publish the pacts to the broker, and verify them in `edity-server`'s CI (`pact-go` v2, which needs CGO and the Pact FFI library in CI only). Gate releases with `can-i-deploy`.

## Acceptance criteria

- [ ] A breaking change to a handler fails the server's CI with the pact that broke
- [ ] Both sides record releases and deployments in the broker

## Notes

Needs the broker from [RMYPG/platform#41](https://github.com/RMYPG/platform/issues/41).

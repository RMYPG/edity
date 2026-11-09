# 26. Publish from the Editor

Status: ready-for-human
Repo: RMYPG/edity
Milestone: M5
Blocked by: 14, 18, 22, 25
Covers: P4, P5, P8, A3 (see the [spec](../spec.md))

## What to build

Wire Publish in the Editor: send the Draft, handle `202` (show progress, keep new values on the page, keep conflicting Changes in the Draft), `409`, `422` (mark the Fields) and `401` (send the Client to log in; on return the Draft is restored and they press Publish again). Poll the status endpoint and show Validating, Releasing and Released (Deploying and Live arrive with ticket 33), or Failed, surviving a reload. Every failure says what happened and that the Draft is safe, in the Client's language.

## Acceptance criteria

- [ ] A full Publish on `edity-sandbox` goes from click to Released with each stage shown
- [x] Publishing again during a Publish works (P8)
- [x] Each failure path has a message in `es` and `en`

## Comments

2026-11-09: Merged in [RMYPG/edity#5](https://github.com/RMYPG/edity/pull/5) as `65ce68c`, with the API pinned to edity-server's `4dfff74`. Every path ran against a mocked API. What's left is the first criterion, which needs `edity-server` deployed ([RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42)) and a real login. One local CI run hit a "Vite module runner has been closed" error in code this work doesn't touch; it hasn't been checked against `main`.

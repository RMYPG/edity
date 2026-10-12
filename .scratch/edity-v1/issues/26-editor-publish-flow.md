# 26. Publish from the Editor

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M5
Blocked by: 14, 18, 22, 25
Covers: P4, P5, P8, A3 (see the [spec](../spec.md))

## What to build

Wire Publish in the Editor: send the Draft, handle `202` (show progress, keep new values on the page, keep conflicting Changes in the Draft), `409`, `422` (mark the Fields) and `401` (send the Client to log in; on return the Draft is restored and they press Publish again). Poll the status endpoint and show Validating, Releasing, Deploying, Live or Failed, surviving a reload. Every failure says what happened and that the Draft is safe, in the Client's language.

## Acceptance criteria

- [ ] A full Publish on `edity-sandbox` goes from click to Live with each stage shown
- [ ] Publishing again during a Publish works (P8)
- [ ] Each failure path has a message in `es` and `en`

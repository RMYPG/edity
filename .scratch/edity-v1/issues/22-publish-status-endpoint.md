# 22. Publish status endpoint

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 20
Covers: V8, P4 (see the [spec](../spec.md))

## What to build

Implement `GET /_edity/api/publish/:sha` for the stages GitHub can answer. Work out the stage on every request, with nothing stored: `validating` while CI runs on the sha, `releasing` once CI passed and until the `vX.Y.Z` tag and image exist, then `released`. Any failed check makes it `failed`. The `deploying` and `live` stages come with ticket 33.

## Acceptance criteria

- [ ] Each stage has a test against recorded GitHub responses
- [ ] Polling stays within the installation's rate limit for a Publish polled every 5 seconds


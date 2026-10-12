# 23. Failure issues on the Site repository

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 22
Covers: V6, V7, P5 (see the [spec](../spec.md))

## What to build

When a Publish's Release fails, open or update one GitHub issue on the Site repository with what failed and a link to the run. When a Publish ships Developer commits that are not content, add a note to an issue as well.

## Acceptance criteria

- [ ] Repeated failures update the same open issue instead of creating new ones
- [ ] The Client-facing message for a failed Release says the changes are saved and that the Developer has been notified

## Notes

V7 (non-content commits) is a Should.

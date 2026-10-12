# 14. Draft in the browser

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 11, 13
Covers: P1, P2, P3 (see the [spec](../spec.md))

## What to build

Keep the Draft in `localStorage`, per Site and page, and restore it after a reload or a closed tab. On restore, drop Changes to Fields or Lists that no longer exist in the page's markup and tell the Client how many were dropped. Discard clears the Draft. Build the Publish payload: only the Changes, each with its `before` and `after` values.

## Acceptance criteria

- [ ] Reloading mid-edit restores every Change and the count
- [ ] A Draft with a Change to a removed Field restores the rest and shows "1 change no longer applies"
- [ ] The payload matches the OpenAPI request schema (ticket 18) once it exists

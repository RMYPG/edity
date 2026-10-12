# 10. Editor shell

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 09
Covers: N4, N6, P7, A4 (see the [spec](../spec.md))

## What to build

Build the Editor's frame with Preact 11 and `@preact/signals`, rendered into one shadow root so its CSS and the Site's never affect each other. On load it calls `GET /_edity/api/session` (a mock is fine until the server exists): on 200 it shows the bar with the Client's name; on 401 it clears `edity=1` and removes itself. The bar shows the Change count, Discard and Publish (disabled for now) and a toggle for the visitor view. The Editor's text is translatable, with `es` and `en`, chosen from the session's `locale`, then the browser, then English.

## Acceptance criteria

- [ ] Site CSS does not leak into the bar and the bar's CSS does not leak out
- [ ] A 401 leaves the page exactly as a visitor sees it
- [ ] Switching the session locale switches all Editor text
- [ ] The visitor view hides every Editor control

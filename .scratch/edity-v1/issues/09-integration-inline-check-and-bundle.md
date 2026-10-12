# 09. Astro integration: inline check and Editor bundle

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M1
Blocked by: 07
Covers: N1, A4 (see the [spec](../spec.md))

## What to build

Inject an inline script of 300 bytes or less into every page: when the `edity=1` cookie is present, it loads `/_edity/editor.<hash>.js`. Build the Editor bundle and write it into the Site's `dist/_edity/`. Visitors never request it.

## Acceptance criteria

- [ ] The inline script is at most 300 bytes minified
- [ ] Without the cookie, the page makes no extra requests
- [ ] With the cookie, the Editor bundle loads from the Site's own origin

## Notes

Only `/_edity/login` and `/_edity/api/*` are routed to the server; everything else under `/_edity/` is static (ADR-0001).

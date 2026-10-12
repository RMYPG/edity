# 17. Scaffold edity-server

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4

## What to build

Set up the Go service: module, HTTP server on `net/http` (or a thin router), configuration listing Sites (id, hostnames, GitHub repo, locale, Zitadel role, Kubernetes namespace and Deployment), a health endpoint, structured logs, a distroless Dockerfile and CI that lints, tests and pushes `ghcr.io/rmypg/edity-server`. Every tool is declared in `mise.toml`.

## Acceptance criteria

- [ ] `mise install && mise run ci` passes on a fresh clone
- [ ] The image is a static binary on a distroless base
- [ ] Unknown Site hostnames get 404 on every `/_edity/api/*` route

## Notes

Deployment is the platform issue [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42).

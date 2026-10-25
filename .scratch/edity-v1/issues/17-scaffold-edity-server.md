# 17. Scaffold edity-server

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4

## What to build

Set up the Go service: module, HTTP server on `net/http` (or a thin router), configuration listing Sites (id, hostnames, GitHub repo, locale, Zitadel role, Kubernetes namespace and Deployment), a health endpoint, structured logs, a distroless Dockerfile and CI that lints, tests and pushes `ghcr.io/rmypg/edity-server`. Every tool is declared in `mise.toml`, including the Infisical CLI (pinned to the same version as `platform`). Local development reads secrets as the Developer's own Infisical user, with no machine identity: add the `edity` project's `.infisical.json` and a `mise run dev` task that wraps the server in `infisical run --env=dev --path=/github --`.

## Acceptance criteria

- [ ] `mise install && mise run ci` passes on a fresh clone
- [ ] The image is a static binary on a distroless base
- [ ] Unknown Site hostnames get 404 on every `/_edity/api/*` route
- [ ] `mise run dev` starts the server with the `dev` secrets from Infisical

## Notes

Deployment is the platform issue [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42).

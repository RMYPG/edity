# 17. Scaffold edity-server

Status: resolved
Repo: RMYPG/edity-server
Milestone: M4

## What to build

Set up the Go service: module, HTTP server on `net/http` (or a thin router), configuration listing Sites (id, hostnames, GitHub repo, locale, Zitadel role, Kubernetes namespace and Deployment), a health endpoint, structured logs, a distroless Dockerfile and CI that lints, tests and pushes `ghcr.io/rmypg/edity-server`. Every tool is declared in `mise.toml`, including the Infisical CLI (pinned to the same version as `platform`). Local development reads secrets as the Developer's own Infisical user, with no machine identity: add the `edity` project's `.infisical.json` and a `mise run dev` task that wraps the server in `infisical run --env=dev --path=/github --`.

## Acceptance criteria

- [x] `mise install && mise run ci` passes on a fresh clone
- [x] The image is a static binary on a distroless base
- [x] Unknown Site hostnames get 404 on every `/_edity/api/*` route
- [x] `mise run dev` starts the server with the `dev` secrets from Infisical

## Notes

Deployment is the platform issue [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42).

## Comments

2026-10-26: Built in [RMYPG/edity-server#1](https://github.com/RMYPG/edity-server/pull/1), open for review, with its `check` and `image` CI jobs green.
- **What's in it:** a standard-library Go service on `net/http`. It has a JSON Sites file (`internal/site`), `GET /healthz` on any host, and the spec's six API routes behind a Site lookup. Those routes answer 404 for unknown hosts and 501 until their tickets land. Each request writes one JSON log line.
- **Config:** read from `EDITY_*` environment variables, with the `edity-publisher` App's credentials required at startup.
- **Image and CI:** a `CGO_ENABLED=0` image on `distroless/static-debian13:nonroot`. CI runs `mise run ci`, then smoke-tests the image. Pushes to `ghcr.io/rmypg/edity-server` happen only on `main`, so the first push is at merge.
- **Tooling:** pinned in `mise.toml`, with the Infisical CLI at 0.43.132, the same as `platform`. `mise run dev` ran once with the Developer's Infisical login: it injected the 2 `dev` secrets from `/github` and served `edity-sandbox` on `localhost` from `sites.dev.json`.
- **How the criteria were checked:** the session that built it ticked each one, after a fresh clone, the CI smoke test and route tests for unknown, IP and empty hosts. The PR description lists the decisions to review.

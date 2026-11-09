# 33. Deploying and Live stages

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 22
Covers: P4, P8, V8 (see the [spec](../spec.md))

## What to build

Extend `GET /_edity/api/publish/:sha` past `released`, asking the platform's rollout status service about the Site's `production` environment (ADR-0003). It answers `target`, the newest version the platform has picked up; `running`, the version the Site serves; `phase`; and `reason`, when something failed. `reason` can be set while `phase` is `live`, because a failing image scan leaves `target` behind without touching what runs. Work out the stage on every request, with nothing stored:

- `released`: the tag exists, `target` is older than this version, and `reason` is empty.
- `deploying`: `target` is this version or newer, `running` is older, and `phase` is not `failed`.
- `live`: `running` is this version or newer. Like `released` today, it wins over everything else.
- `failed`: `phase` is `failed` while `target` is this version or newer and `running` is older; or `target` is older than this version and `reason` is set, because the platform can't see the new version; or `running` is still older 60 minutes after the tag. It opens or updates ticket 23's issue, with the service's `reason`.

Also:

- Read the service's address from a new setting, and ask it by each Site's `id`.
- Treat a failed call to the service like a failed look at GitHub: the request answers an error so the Editor asks again, and the 60 minutes can't make a Publish `failed` without an answer from the service.
- Remove `kubernetes` from the Sites file (`internal/site`, the README and the test fixtures), and the "on hold" note from `api/openapi.yaml`.
- In the Editor (`RMYPG/edity`), show `released` and `deploying` as one step, Deploying, then Live (P4).

## Acceptance criteria

- [ ] A second Publish that overtakes the first makes both report `live` once the newer version runs
- [ ] A rollout that fails makes the Publish `failed` without waiting for the 60 minutes
- [ ] A failing image scan makes a Publish newer than `target` `failed` without waiting for the 60 minutes
- [ ] A Publish the Site isn't running 60 minutes after its tag turns `failed`, and a later rollout of it or a newer version still makes it `live`
- [ ] A status service that can't be reached never makes a Publish `failed`
- [ ] Each stage has a test against recorded responses from the status service
- [ ] The Sites file has no `kubernetes` key, and the server holds no Kubernetes credentials
- [ ] The Editor's bar shows the four steps of P4

## Notes

Needs [RMYPG/platform#142](https://github.com/RMYPG/platform/issues/142), which serves the status. Real responses can only be recorded once it runs, against `edity-sandbox`.

`RMYPG/platform#42`'s Site config must drop the same `kubernetes` key: the server refuses a Sites file with unknown keys, so the two changes have to land in order.

## Comments

2026-11-09: Moved from reading GitHub Deployments to the platform's rollout status service, following RMYPG/platform#142 and the amended ADR-0003. The `edity-publisher` App needs no Deployments permission. With no stored record of a rollout, a Publish no longer stays `live` once production is rolled back below its version. Rollbacks are manual and rare.

2026-11-09: A failing image scan stops `target` from moving, so comparing `running` and `target` can't show it. The service now reports it in `reason` while `phase` stays `live`, and a Publish newer than `target` fails on that `reason`.

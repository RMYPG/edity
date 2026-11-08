# 33. Deploying and Live stages

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 22
Covers: P4, P8, V8 (see the [spec](../spec.md))

## What to build

Extend `GET /_edity/api/publish/:sha` past `released`, reading the GitHub Deployments the platform writes for `production` on the Site's repository (ADR-0003). Work out the stage on every request, with nothing stored:

- `released`: the tag exists, but no production Deployment carries this version or a newer one yet.
- `deploying`: a production Deployment of this version or newer is `queued` or `in_progress`.
- `live`: a production Deployment of this version or newer is `success`. Like `released` today, it wins over everything else. A Publish that has reached `live` stays there, even if production is later rolled back.
- `failed`: this version's Deployment ended in `failure` or `error` and nothing newer succeeded, or nothing has been reported 60 minutes after the tag. It opens or updates ticket 23's issue.

Also:

- Add Deployments read to the `edity-publisher` App, and accept the change on its installations.
- Remove `kubernetes` from the Sites file (`internal/site`, the README and the test fixtures), and the "on hold" note from `api/openapi.yaml`.
- In the Editor (`RMYPG/edity`), show `released` and `deploying` as one step, Deploying, then Live (P4).

## Acceptance criteria

- [ ] A second Publish that overtakes the first makes both report `live` once the newer version runs
- [ ] A rollout that fails makes the Publish `failed` without waiting for the 60 minutes
- [ ] A Publish nothing has reported on turns `failed` 60 minutes after its tag, and a later `success` still makes it `live`
- [ ] Each stage has a test against recorded responses from GitHub's Deployments API
- [ ] The Sites file has no `kubernetes` key, and the server needs no access to the cluster
- [ ] The Editor's bar shows the four steps of P4

## Notes

Needs [RMYPG/platform#142](https://github.com/RMYPG/platform/issues/142), which writes the Deployments. Real responses can only be recorded once it runs, against `fisioindoor` or `vertex-glow` until `edity-sandbox` is deployed.

`RMYPG/platform#42`'s Site config must drop the same `kubernetes` key: the server refuses a Sites file with unknown keys, so the two changes have to land in order.

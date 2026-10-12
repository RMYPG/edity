# 22. Publish status endpoint

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 20
Covers: V8, P4, P8 (see the [spec](../spec.md))

## What to build

Implement `GET /_edity/api/publish/:sha`. Work out the stage on every request, with nothing stored: `validating` while CI runs on the sha, `releasing` once CI passed and until the `vX.Y.Z` tag exists, `deploying` until VictoriaMetrics shows every ready replica of the Site's Deployment running that version or a newer one (kube-state-metrics `kube_pod_container_info` and rollout counters), then `live`. Any failed check makes it `failed`.

## Acceptance criteria

- [ ] A second Publish that overtakes the first makes both report `live` once the newer version runs
- [ ] Each stage has a test against recorded GitHub and VictoriaMetrics responses

## Notes

`deploying` only ends once Releases deploy automatically ([RMYPG/platform#39](https://github.com/RMYPG/platform/issues/39)) and the server can reach `vmsingle` ([RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42)).

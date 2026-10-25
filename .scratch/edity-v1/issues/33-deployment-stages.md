# 33. Deploying and Live stages

Status: needs-info
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 22
Covers: P4, P8 (see the [spec](../spec.md))

On hold: the platform's deployment model is changing.

## What to build

Extend `GET /_edity/api/publish/:sha` past `released`: report `deploying` until every ready replica of the Site runs that Release or a newer one, then `live`. ADR-0003 planned to read this from VictoriaMetrics (kube-state-metrics `kube_pod_container_info` and rollout counters); revisit the source once the new deployment model is known.

## Acceptance criteria

- [ ] A second Publish that overtakes the first makes both report `live` once the newer version runs
- [ ] Each stage has a test against recorded responses from whatever the deployment source turns out to be

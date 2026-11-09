# 35. Release a given commit from the shared workflows

Status: resolved
Repo: RMYPG/workflows
Milestone: M6
Blocked by: 27
Covers: V3 (see the [spec](../spec.md))

## What to build

Ticket 27's Release on Publish logic lives in the template's and `edity-sandbox`'s own `release.yml`. `fisioindoor` and `vertex-glow` call `RMYPG/workflows/.github/workflows/app-release.yml`, which is built for a manual click: it always releases the `main` commit it was dispatched on, fails when the commit is already released, and its callers' `release` concurrency group can cancel a pending run.

Bring that logic into the shared workflow:

- An optional `sha` input. When set, the job checks out that commit, promotes its `sha-<sha>` image and tags that commit.
- With `sha` set, a commit that an existing `vX.Y.Z` tag already contains ends green with a notice.
- Pending runs queue instead of cancelling each other, whether a run came from a manual dispatch or a Publish. The file warns that GitHub cancels a run whose called workflow waits on a group its caller holds, so decide where the group sits with that in mind.

Publish it as a new tag of `RMYPG/workflows`, without moving an existing one, and document the thin `release-on-publish.yml` caller a Site adds: triggered by CI completing on `main`, titled `Release <sha>` (ticket 22 finds a Publish's Release run by that title), and limited to the logins in `EDITY_PUBLISHER_LOGINS`.

## Acceptance criteria

- [x] A called run with `sha` releases that commit, even if `main` has moved on
- [x] A called run for a commit an existing tag already contains ends green with a notice
- [x] Two Publishes in quick succession are both released, with no pending run cancelled
- [x] A manual dispatch with no `sha` behaves as it does today, on `fisioindoor` and `vertex-glow`
- [x] No published tag of `RMYPG/workflows` was moved

## Notes

The call to the webhook Receiver after the tag is part of [RMYPG/platform#143](https://github.com/RMYPG/platform/issues/143).

## Comments

2026-11-09: Merged in [RMYPG/workflows#8](https://github.com/RMYPG/workflows/pull/8) as `82754de`. `v1.3.0` is not published yet, and the README's examples pin it. Every criterion needs a real run, so none is ticked; offline tests cover the first three and the manual path. Whether `queue: max` works on a job called across repositories stays unknown until a real pair of Publishes.

After tagging, `fisioindoor` and `vertex-glow` have to re-pin `release.yml` and delete its workflow-level `release` group, or pending dispatches keep cancelling each other. A Site must not add `release-on-publish.yml` before that, because the two would not share a queue.

2026-11-09: `v1.3.0` is published on `82754de`, and the existing tags didn't move. `vertex-glow` re-pinned in [RMYPG/vertex-glow#44](https://github.com/RMYPG/vertex-glow/pull/44) and a real manual dispatch released `v0.1.3` ([run 42613518846](https://github.com/RMYPG/vertex-glow/actions/runs/42613518846)). The manual dispatch criterion still needs `fisioindoor`, which is pinned to `v1.0.0`. The other three criteria need real Publish commits on `edity-sandbox`, using the `dev` App.

2026-11-09: Every criterion has now run for real, on `app-release.yml@v1.3.0`:
- **A given commit, with `main` moved on:** two Publishes on `edity-sandbox` a few seconds apart. The first commit, `63c9984`, was tagged `v1.0.6` after `main` had moved to the second.
- **Already released:** a re-run of the Release on Publish for `55fea96` ended green with "already released in v1.0.3", and the image and tag steps were skipped.
- **Quick succession:** the same two Publishes were tagged `v1.0.6` and `v1.0.7` with no run cancelled, so `queue: max` works on a job called across repositories.
- **Manual dispatch:** `vertex-glow` released `v0.1.3`, and `fisioindoor`, re-pinned in [RMYPG/fisioindoor#48](https://github.com/RMYPG/fisioindoor/pull/48), released `v1.0.3`.

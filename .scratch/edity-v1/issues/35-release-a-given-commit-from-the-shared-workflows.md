# 35. Release a given commit from the shared workflows

Status: ready-for-human
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

- [ ] A called run with `sha` releases that commit, even if `main` has moved on
- [ ] A called run for a commit an existing tag already contains ends green with a notice
- [ ] Two Publishes in quick succession are both released, with no pending run cancelled
- [ ] A manual dispatch with no `sha` behaves as it does today, on `fisioindoor` and `vertex-glow`
- [ ] No published tag of `RMYPG/workflows` was moved

## Notes

The call to the webhook Receiver after the tag is part of [RMYPG/platform#143](https://github.com/RMYPG/platform/issues/143).

## Comments

2026-11-09: Merged in [RMYPG/workflows#8](https://github.com/RMYPG/workflows/pull/8) as `82754de`. `v1.3.0` is not published yet, and the README's examples pin it. Every criterion needs a real run, so none is ticked; offline tests cover the first three and the manual path. Whether `queue: max` works on a job called across repositories stays unknown until a real pair of Publishes.

After tagging, `fisioindoor` and `vertex-glow` have to re-pin `release.yml` and delete its workflow-level `release` group, or pending dispatches keep cancelling each other. A Site must not add `release-on-publish.yml` before that, because the two would not share a queue.

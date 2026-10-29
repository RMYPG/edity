# 22. Publish status endpoint

Status: resolved
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 20
Covers: V8, P4 (see the [spec](../spec.md))

## What to build

Implement `GET /_edity/api/publish/:sha` for the stages GitHub can answer. Work out the stage on every request, with nothing stored: `validating` while CI runs on the sha, `releasing` once CI passed and until the `vX.Y.Z` tag and image exist, then `released`. Any failed check makes it `failed`. The `deploying` and `live` stages come with ticket 33.

## Acceptance criteria

- [x] Each stage has a test against recorded GitHub responses
- [x] Polling stays within the installation's rate limit for a Publish polled every 5 seconds

## Comments

2026-10-29: Built in `internal/progress` of [RMYPG/edity-server#3](https://github.com/RMYPG/edity-server/pull/3), with an ETag cache in `internal/github`. The stage is worked out from GitHub on every request:
- **404** for anything but a Publish's commit, one the App authored. A Developer's commit never triggers Release on Publish, so it would otherwise sit in `releasing` and then fail.
- **`released`** when the highest `vX.Y.Z` tag contains the commit (`compare` is `ahead` or `identical`). It wins over everything else, so a newer Release covers an older Publish, even a failed one (P8).
- **`validating`** while the runs the push started are missing or not completed. **`failed`** when one of them completed with anything but success, neutral or skipped.
- **`releasing`** after CI passed, until a tag contains the commit. Its Release run is the newest one titled `Release <sha>`, created after CI last started. That title comes from [RMYPG/static-astro-site-template#15](https://github.com/RMYPG/static-astro-site-template/pull/15) and [RMYPG/edity-sandbox#4](https://github.com/RMYPG/edity-sandbox/pull/4).
  - A `cancelled` or `skipped` Release run was superseded; any other failure is `failed`.
  - A run's `head_sha` and check runs are never read, so another Publish's failed Release can't fail this one.
  - Until those PRs merge, no run has that title, and the tag alone decides, with no Release deadline (below).
- **Deadlines** (not in the ticket): no CI run 10 minutes after the commit is `failed`. So is no Release 30 minutes after CI passed, but only on a Site whose Release runs carry the `Release <sha>` title, and never while any Release run is under way, since a newer Publish's Release contains this one (changed after review). A CI run stuck `queued` stays `validating`. Without them a disabled workflow or an unset `EDITY_PUBLISHER_LOGINS` would leave a Publish in `releasing` forever.
- **Requests** for one Site and sha within 5 seconds share one look at GitHub. The route needs a session, so it answers 401 until ticket 25, and it refuses a GET only when it carries a foreign `Origin`.
- `api/openapi.yaml` gained 500 and 503 on this route. The body is unchanged.
- **Checked:**
  - `testdata/record.sh` recorded 13 real responses from edity-sandbox with read-only `gh api -i` calls: the two Publish commits, `package.json`, both CI runs, the tags, the compares and the Release runs.
  - `TestEachStageFromGitHubsAnswers` runs 18 cases across the four stages, on those files and on copies the test edits, each edit named: runs in progress, failed or cancelled, a CI re-run, an earlier tag list, and a failed Release whose `head_sha` is another Publish's.
  - `mise run check:progress` (not in CI) reads both sandbox Publishes as `released`, at 1.0.1 and 1.0.2.
- **Rate limit:** one poll makes 4 calls, 5 while `releasing`. 5 seconds later they are all 304s, which GitHub doesn't count (seen in `X-RateLimit-Used`). `TestPollingStaysWithinTheRateLimit` simulates an hour of polling one Publish from push to Release: 2,889 calls, 17 counted. Even without ETags, 720 polls an hour make at most 3,600 calls, within the 5,000 an hour that every Site shares.
- **Left over:**
  - It isn't documented whether 304s count toward GitHub's secondary limit of 900 points a minute. If they do, about 15 Publishes polled at once would reach it.
  - `check:progress` expects the `dev` secrets to be `edity-publisher`. Once ticket 28 moves `dev` to `edity-publisher-dev`, those two commits answer 404.

2026-10-29, after the code review: the Release deadline above used to fire on every Site, whose Release runs have no title yet, so a Release still running at 30 minutes read `failed`, opened an issue (ticket 23) and then turned `released`. It now applies only as described. The Origin check takes `https://` and the Site's hostnames, as ticket 20's does. `mise run check:progress` still reads both sandbox Publishes as `released`; asked again, all 8 calls were 304s.

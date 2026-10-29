# 23. Failure issues on the Site repository

Status: resolved
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 22
Covers: V6, V7, P5 (see the [spec](../spec.md))

## What to build

When a Publish's Release fails, open or update one GitHub issue on the Site repository with what failed and a link to the run. When a Publish ships Developer commits that are not content, add a note to an issue as well.

## Acceptance criteria

- [x] Repeated failures update the same open issue instead of creating new ones
- [x] The Client-facing message for a failed Release says the changes are saved and that the Developer has been notified

## Notes

V7 (non-content commits) is a Should.

## Comments

2026-10-29: Built in `internal/issues` of [RMYPG/edity-server#3](https://github.com/RMYPG/edity-server/pull/3), and the Client's message in [RMYPG/edity#3](https://github.com/RMYPG/edity/pull/3).
- **One issue per Site and kind**, opened by the App and found by a hidden marker in its body: `<!-- edity:release-failures -->` for failed Releases (V6) and `<!-- edity:developer-commits -->` for V7. A second marker lists what the issue has already told, so the server stores nothing.
  - One ETag-cached call finds both: the App's 30 most recently updated issues, closed ones included.
  - The first failure opens the issue and later ones comment on it, so a run is never told twice: an ID per run and attempt, or per missed deadline (ticket 22).
  - A failure on an issue the Developer closed isn't told again, and the next new failure opens a new issue.
  - A lock per Site keeps two failures at once to one issue.
- **What a failure says:** the reason, a link to the run, the version and commit, the page, the Fields and Lists changed, and the Client. Names and commit headlines are escaped, so they can't @-mention anyone.
- **P5:** the status route answers `failed` only once the issue for that failure is written, so the Editor's claim that the Developer has been notified is always true. Until the issue is written it answers 503, or 500 when GitHub refuses the write, such as with the repository's Issues turned off.
  - The Client's message is `releaseFailed` in `packages/astro/src/editor/i18n.ts`, for ticket 26 to show:
    - es: "Tus cambios están guardados, pero aún no se ven en la web: algo ha fallado por el camino. Ya se ha avisado a quien mantiene tu web."
    - en: "Your changes are saved, but they are not live yet: something went wrong on the way. Your developer has been notified."
- **V7:** after answering 202, the Publish handler compares the latest Release's tag with the new commit, in the background with a 1-minute limit. It notes each commit that isn't the App's and changes files outside `src/content/`, or `package.json` beyond `version`: once per commit, at most 10 per Publish. A failure there is only logged and never touches the Publish.
- `api/openapi.yaml` changed descriptions only.
- **Checked** against a fake GitHub with recorded shapes, never writing to GitHub:
  - `TestRepeatedFailuresUpdateTheSameOpenIssue` covers repeated polls, a restarted server, a new failure, a failed re-run, and a closed issue followed by a new one. `TestTwoFailuresAtOnceOpenOneIssue` covers two at once.
  - Removing the lock or the skip of pull requests fails them.
  - The P5 and V7 tests check that `failed` waits for the issue and that a Publish's 202 doesn't wait for the V7 note.
- **Left over:**
  - ~~The issue opens only while something asks for the Publish's status.~~ Fixed after review, below.
  - A comment that GitHub created but whose answer was lost is written again once.
  - A V7 note is lost if the server stops while it runs.

2026-10-29, after the code review: **a sweep per Site** now tells the Developer of a failed Release even when no Client asks (V6 is a Must, and a Client usually closes the tab). Every 5 minutes, one Site after another, it asks the progress of the App's newest 10 commits on `main` since the last Release, and the Reporter tells what failed with its duplicate checks as they are. It stores nothing, uses the ETag cache, and stops with the server. `TestSweepingStaysWithinTheRateLimit` measures a Site with nothing since its last Release at 25 calls an hour, 5 of them counted, and a Site with a Publish under way all hour at 85, 13 counted. The Client's message is still shown only once ticket 26 wires Publish.

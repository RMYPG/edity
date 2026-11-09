# 28. Connect fisioindoor to Edity

Status: ready-for-human
Repo: RMYPG/fisioindoor
Milestone: M6
Blocked by: 06, 26, 27, 33, 35
Covers: N8 (see the [spec](../spec.md))

## What to build

First split the GitHub App: create `edity-publisher-dev` (same permissions, no webhook, installable only on this account), install it on `edity-sandbox` only, and move the `dev` credentials in Infisical to it; `edity-publisher` then gets a fresh key in `prod` and is the only App installed on client Sites. Then follow the N8 steps for the pilot Site: install the `edity-publisher` App on `fisioindoor`, add its Site entry, tunnel routes and Zitadel role, add a `release-on-publish.yml` caller of the shared release workflow (ticket 35), and do a real Publish with the Client.

This connects version one's direct Publish. The flow in [`edity-v2`](../../edity-v2/spec.md) comes after the pilot.

## Acceptance criteria

- [ ] No key stored in Infisical `dev` can write to a client Site
- [ ] A Client changes a price on fisioindoor.com and sees it go live without contacting you
- [ ] The steps took under an hour; anything slower is noted under `## Comments`, including how long the rollout took

## Notes

Needs [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42) done for `fisioindoor`'s hostname, and [RMYPG/platform#142](https://github.com/RMYPG/platform/issues/142) so the Publish reaches Live. [RMYPG/platform#143](https://github.com/RMYPG/platform/issues/143) is not a blocker: without it, a rollout can take up to about 20 minutes to start.

## Comments

2026-10-26: Ticket 27's workflow releases a Publish only if the `EDITY_PUBLISHER_LOGINS` repository variable lists the App's login. Add these to the steps:
- On `fisioindoor`: `gh variable set EDITY_PUBLISHER_LOGINS --repo RMYPG/fisioindoor --body 'edity-publisher[bot]'`.
- On `edity-sandbox`, once it moves to the dev App: change its value to `edity-publisher-dev[bot]`, or `edity-publisher[bot],edity-publisher-dev[bot]` while both Apps are installed.

Ticket 34 replaces these manual steps with `platform` code.

2026-11-09: To handle when connecting the Site:
- **Blank Items:** `byKey` in `src/data/by-key.ts`, from [RMYPG/fisioindoor#43](https://github.com/RMYPG/fisioindoor/pull/43), will throw on a blank Item's empty key once the keyed Lists go through `<Items>`, because `list().render()` renders a blank Item whenever the integration is enabled. Decide what a blank Item should render.
- **The release caller:** before adding `release-on-publish.yml`, publish `v1.3.0` of `RMYPG/workflows`, re-pin the Site's `release.yml` to it and delete its workflow-level `release` group (ticket 35).
- **Zitadel:** the project, roles, client and service user will be set up as code under their own issue, and a real login waits on it.

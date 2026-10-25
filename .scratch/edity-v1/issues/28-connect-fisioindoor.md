# 28. Connect fisioindoor to Edity

Status: needs-info
Repo: RMYPG/fisioindoor
Milestone: M6
Blocked by: 06, 26, 27
Covers: N8 (see the [spec](../spec.md))

On hold: the platform's deployment model is changing.

## What to build

First split the GitHub App: create `edity-publisher-dev` (same permissions, no webhook, installable only on this account), install it on `edity-sandbox` only, and move the `dev` credentials in Infisical to it; `edity-publisher` then gets a fresh key in `prod` and is the only App installed on client Sites. Then follow the N8 steps for the pilot Site: install the `edity-publisher` App on `fisioindoor`, add its Site entry, tunnel routes and Zitadel role, add the release workflow, and do a real Publish with the Client.

## Acceptance criteria

- [ ] No key stored in Infisical `dev` can write to a client Site
- [ ] A Client changes a price on fisioindoor.com and sees it go live without contacting you
- [ ] The steps took under an hour; anything slower is noted under `## Comments`

## Notes

Needs [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42) done for `fisioindoor`'s hostname.

# 25. Zitadel login

Status: resolved
Repo: RMYPG/edity-server
Milestone: M5
Blocked by: 17
Covers: A1, A2, A4, A5, N6 (see the [spec](../spec.md))

## What to build

Implement login with Zitadel (OIDC authorization code with PKCE): `GET /_edity/login` redirects, `/_edity/api/auth/callback` checks the Site's role (`site:<id>`), then sets an HttpOnly session cookie scoped to `/_edity/api` for 30 days and the readable `edity=1` marker. `POST /_edity/api/auth/logout` clears both. `GET /_edity/api/session` returns the Client's name, `locale` claim and Site. Every API call checks the session and the request's `Origin`. Every Publish also asks Zitadel whether the Client still holds the Site's role.

## Acceptance criteria

- [x] A user without the Site's role gets no session
- [x] Cross-origin requests are rejected
- [x] The session survives a server restart (signed or verifiable, not in memory)
- [x] A Client whose role was removed can't Publish with the session they already hold

## Notes

Needs the Zitadel project, roles, client and read-only service user from [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42). Email-code login also needs SMTP in Zitadel, which isn't configured yet; passkey works without it.

## Comments

2026-11-09: Merged in [RMYPG/edity-server#4](https://github.com/RMYPG/edity-server/pull/4) as `4dfff74`. All four criteria are shown against a fake Zitadel. A real login waits on the Zitadel setup, which will be done as code under its own issue. The role was first checked only at login, so a removed Client could have kept Publishing for up to 30 days. Each Publish now asks Zitadel (A5), which makes publishing depend on Zitadel being up. Two limits remain, both noted in the pull request:
- Zitadel's list can lag behind a removal. Its default refresh is 60 seconds, and the real lag hasn't been measured. The Developer accepted this on 2026-11-09.
- A Zitadel user who is deactivated or locked without losing the role still passes the check.

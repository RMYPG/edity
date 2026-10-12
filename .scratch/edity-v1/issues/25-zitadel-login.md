# 25. Zitadel login

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M5
Blocked by: 17
Covers: A1, A2, A4, N6 (see the [spec](../spec.md))

## What to build

Implement login with Zitadel (OIDC authorization code with PKCE): `GET /_edity/login` redirects, `/_edity/api/auth/callback` checks the Site's role (`site:<id>`), then sets an HttpOnly session cookie scoped to `/_edity/api` for 30 days and the readable `edity=1` marker. `POST /_edity/api/auth/logout` clears both. `GET /_edity/api/session` returns the Client's name, `locale` claim and Site. Every API call checks the session and the request's `Origin`.

## Acceptance criteria

- [ ] A user without the Site's role gets no session
- [ ] Cross-origin requests are rejected
- [ ] The session survives a server restart (signed or verifiable, not in memory)

## Notes

Needs the Zitadel project, roles and client from [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42). Email-code login also needs SMTP in Zitadel, which isn't configured yet; passkey works without it.

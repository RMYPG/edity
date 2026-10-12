# 19. Server-side Draft validation

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 16, 17
Covers: V1, N3, N9 (see the [spec](../spec.md))

## What to build

Validate a Draft in Go against a page's generated JSON Schema plus the Edity vocabulary, using a JSON Schema 2020-12 library with custom keywords and grapheme counting (`rivo/uniseg`). Return violations per path. Reject Changes to paths that aren't known Fields or Lists.

## Acceptance criteria

- [ ] Every conformance fixture from `github.com/RMYPG/edity/contracts` passes in CI
- [ ] Violations come back as `{ path, limit }`, matching the OpenAPI `422` body

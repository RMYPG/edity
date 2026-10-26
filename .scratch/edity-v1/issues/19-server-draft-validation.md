# 19. Server-side Draft validation

Status: ready-for-agent
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 16, 17
Covers: V1, N3, N9 (see the [spec](../spec.md))

## What to build

Validate a Draft in Go against a page's generated JSON Schema plus the Edity vocabulary, using a JSON Schema 2020-12 library with custom keywords and grapheme counting (`github.com/clipperhouse/uax29/v2`). Return violations per path. Reject Changes to paths that aren't known Fields or Lists.

## Acceptance criteria

- [ ] Every conformance fixture from `github.com/RMYPG/edity/contracts` passes in CI
- [ ] Violations come back as `{ path, limit }`, matching the OpenAPI `422` body

## Notes

`x-edity-maxGraphemes` counts grapheme clusters by Unicode 15.1 or later, as the browser's `Intl.Segmenter` does. `rivo/uniseg` v0.4.7, named here before, is on Unicode 15.0. It counts an Indic conjunct such as "क्षि" as two clusters, so it fails the GB9c case in `contracts/fixtures/keywords/maxGraphemes.json`. `clipperhouse/uax29/v2` is on Unicode 17, the same as Node 24, and passes it. See "The dialect and the Limits vocabulary" in `contracts/README.md`.

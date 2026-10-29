# 19. Server-side Draft validation

Status: resolved
Repo: RMYPG/edity-server
Milestone: M4
Blocked by: 16, 17
Covers: V1, N3, N9 (see the [spec](../spec.md))

## What to build

Validate a Draft in Go against a page's generated JSON Schema plus the Edity vocabulary, using a JSON Schema 2020-12 library with custom keywords and grapheme counting (`github.com/clipperhouse/uax29/v2`). Return violations per path. Reject Changes to paths that aren't known Fields or Lists.

## Acceptance criteria

- [x] Every conformance fixture from `github.com/RMYPG/edity/contracts` passes in CI
- [x] Violations come back as `{ path, limit }`, matching the OpenAPI `422` body

## Notes

`x-edity-maxGraphemes` counts grapheme clusters by Unicode 15.1 or later, as the browser's `Intl.Segmenter` does. `rivo/uniseg` v0.4.7, named here before, is on Unicode 15.0. It counts an Indic conjunct such as "क्षि" as two clusters, so it fails the GB9c case in `contracts/fixtures/keywords/maxGraphemes.json`. `clipperhouse/uax29/v2` is on Unicode 17, the same as Node 24, and passes it. See "The dialect and the Limits vocabulary" in `contracts/README.md`.

## Comments

2026-10-29: Built in `internal/fields` of [RMYPG/edity-server#3](https://github.com/RMYPG/edity-server/pull/3), with contracts v0.1.0, santhosh-tekuri/jsonschema v6 and clipperhouse/uax29 v2 (Unicode 17).
- **`Compile(schema)`** reads a page's `src/content/<page>.schema.json` in the Edity dialect, with the contracts' meta-schemas and the server's own Limits vocabulary. A schema in another dialect is refused, and nothing is ever fetched: the loader refuses every `$ref` outside the schema.
- **`KindOf(path)`** says whether a Change's path is a Field, a List or neither, through `properties` and `items` only. An Item that is an object (`plans.1`), a group and the page are neither. It reads the schema alone, so whether the Item exists in the content is ticket 20's check.
- **`Violations(content)`** lists `{ path, limit }`, with core's rule names as `limit` (`type`, `unknown`, `oneLine`, `maxChars`, `min`, `max`, `decimals`, `minItems`, `maxItems`), sorted by path. A missing Field is `type` and an unknown key is `unknown`, as in core.
  - `"type": "integer"` is read as a number with no decimals, so 25.5 in a 1 to 20 whole-number Field gives `max` and `decimals`, as core does, rather than a type error.
  - Any error the mapping doesn't know becomes `type`, so content that fails is never accepted.
- **Checked:** every fixture file of contracts v0.1.0 (165 tests, the GB9c Indic conjunct included) runs through `Compile` and `Violations` in `mise run ci`. `testdata/core-violations.json`, written by `testdata/core-violations.mjs` from core's `violations()`, holds what core finds on all 86 page-fixture Drafts, and the test compares both ways. The 422 body's shape is the one in `api/openapi.yaml` (ticket 18).

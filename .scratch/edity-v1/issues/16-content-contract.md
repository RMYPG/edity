# 16. Content contract: vocabulary, fixtures and Go module

Status: resolved
Repo: RMYPG/edity
Milestone: M3
Blocked by: 03
Covers: N9 (see the [spec](../spec.md))

## What to build

In `contracts/`, publish the content contract both validators must follow (ADR-0005): the meta-schema for the Edity vocabulary and conformance fixtures in the JSON Schema Test Suite format (`{ description, schema, tests: [{ description, data, valid }] }`). Make `contracts/` a Go module (`github.com/RMYPG/edity/contracts`) that embeds the files with `go:embed`, tagged `contracts/vX.Y.Z`. `packages/core` runs every fixture in CI.

## Acceptance criteria

- [x] Fixtures cover grapheme counting (emoji, combining accents), number ranges and decimals, List bounds, nesting, unknown Fields and wrong types
- [x] `core` passes every fixture in CI
- [x] Go is declared in `edity`'s `mise.toml` for the module's own tests
- [x] A tagged version can be fetched with `go get github.com/RMYPG/edity/contracts@vX.Y.Z`

## Comments

2026-10-25: `contracts/meta/schema.json` is the Edity dialect of JSON Schema 2020-12, with the `$id` ticket 03 writes in `$schema`. It lists the Limits vocabulary (`…/contracts/v1/vocab/limits`) as required. `meta/limits.json` gives the keyword values: `x-edity-decimals` has a minimum of 0 and no maximum, so every `decimals` that `number()` accepts generates a valid schema. Any other `x-edity-` keyword makes a schema invalid, so a validator that predates a keyword refuses it. The dialect URI stays an identifier that does not resolve: validators load the embedded meta-schemas, and VS Code warns that it cannot load the dialect when someone opens a generated file.

The fixtures follow the test suite format. `fixtures/keywords/` tests each keyword alone and the meta-schema. `fixtures/pages/` holds page schemas exactly as core generates them, with Drafts: blank text and line breaks, number ranges and decimals, List bounds, Lists in Items, groups, unknown and missing Fields, and wrong types. `contracts/` is the Go module `github.com/RMYPG/edity/contracts` (`contracts.go`: embedded files, URIs, `MetaSchemas()`, `Fixtures()`). Its tests run every fixture with santhosh-tekuri/jsonschema and a reference vocabulary implementation (uax29 for graphemes), and check the fixtures against the test suite's schema. They also check that every file is embedded and that the dialect is refused without the vocabulary.

`packages/core/src/contract.test.ts` runs every fixture with Ajv (strict), counting with core's `graphemeCount` and `number()`. It also runs the differential test: for each page fixture it reads the Field definitions back from the schema, checks that core generates the same schema, and checks that Zod gives each Draft the same verdict as the JSON Schema. `mise.toml` pins Go 1.27.2 with `GOTOOLCHAIN=local`. `lint`, `format`, `format:check` and `test` now cover the Go module, so `mise run ci` runs both sides (verified in a fresh clone with an empty module cache).

Left over: the last criterion needs this branch on `main` and a pushed `contracts/v0.1.0` tag. The steps are in `contracts/README.md` ("Releasing"). `mise run contracts:fetch --local v0.1.0` already fetches the committed HEAD with `go get` from a scratch clone tagged `contracts/v0.1.0`, the way the Go proxy would from GitHub, and loads its files in a scratch module. After the push, `mise run contracts:fetch v0.1.0` checks it through `proxy.golang.org`. Ticket 19 should count graphemes with `github.com/clipperhouse/uax29/v2`, not `rivo/uniseg`, which is on Unicode 15.0 and fails the Indic conjunct fixture.

2026-10-26: `contract.test.ts` counts `x-edity-decimals` with core's exported `decimalPlaces()`, and its differential test also checks core's `violations()` on every page fixture's Drafts. `number()` now refuses a negative `min`, so `fixtures/pages/numbers.json` gives `sessions` a minimum of 1; the keyword fixtures still test negative numbers.

2026-10-27: `contracts/v0.1.0` is pushed, on `332c0c6` (RMYPG/edity#1 merged into `main`). `mise run contracts:fetch v0.1.0` fetches it through `proxy.golang.org` with `go get` and loads its 2 meta-schemas and 8 fixture files (165 tests), so the last criterion is met.

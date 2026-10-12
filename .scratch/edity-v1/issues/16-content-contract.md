# 16. Content contract: vocabulary, fixtures and Go module

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M3
Blocked by: 03
Covers: N9 (see the [spec](../spec.md))

## What to build

In `contracts/`, publish the content contract both validators must follow (ADR-0005): the meta-schema for the Edity vocabulary and conformance fixtures in the JSON Schema Test Suite format (`{ description, schema, tests: [{ description, data, valid }] }`). Make `contracts/` a Go module (`github.com/RMYPG/edity/contracts`) that embeds the files with `go:embed`, tagged `contracts/vX.Y.Z`. `packages/core` runs every fixture in CI.

## Acceptance criteria

- [ ] Fixtures cover grapheme counting (emoji, combining accents), number ranges and decimals, List bounds, nesting, unknown Fields and wrong types
- [ ] `core` passes every fixture in CI
- [ ] Go is declared in `edity`'s `mise.toml` for the module's own tests
- [ ] A tagged version can be fetched with `go get github.com/RMYPG/edity/contracts@vX.Y.Z`

# 03. Generate JSON Schema from Field definitions

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M0
Blocked by: 02
Covers: V1, N3 (see the [spec](../spec.md))

## What to build

Generate a JSON Schema 2020-12 document from a page's Field definitions, through Zod 4's `toJSONSchema`, extended with an Edity vocabulary for the Limits JSON Schema cannot express: `x-edity-maxGraphemes`, `x-edity-maxLines`, `x-edity-maxLinesNarrow` and `x-edity-decimals` (or `multipleOf` if exact). This file is what the server validates against (ADR-0002).

## Acceptance criteria

- [ ] Output is deterministic (stable key order), so a stale-check can compare bytes
- [ ] Every Limit from ticket 02 appears in the schema, using standard keywords where they mean exactly the same thing and Edity keywords otherwise
- [ ] A helper reports whether a committed schema file matches the current definitions

## Notes

The vocabulary's meta-schema and conformance fixtures are ticket 16.

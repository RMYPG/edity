# 05. Move edity-sandbox content to JSON and Field definitions

Status: ready-for-agent
Repo: RMYPG/edity-sandbox
Milestone: M0
Blocked by: 03, 04

## What to build

Do the Migration of `edity-sandbox` by hand: its editable content moves into one JSON file per page, loaded through an Astro content collection (`file()` loader), with Field definitions written using `@edity/core`. Commit the generated JSON Schema next to them.

## Acceptance criteria

- [ ] The page renders identically from JSON content
- [ ] Breaking a Limit in the JSON fails the build with a clear message
- [ ] Notes on any friction are added under `## Comments` here (input for the migration skill, ticket 31)

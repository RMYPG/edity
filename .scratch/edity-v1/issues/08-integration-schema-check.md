# 08. Astro integration: committed JSON Schema stays in sync

Status: resolved
Repo: RMYPG/edity
Milestone: M1
Blocked by: 03, 07
Covers: N3 (see the [spec](../spec.md))

## What to build

The integration regenerates each page's JSON Schema during `astro dev`, and fails `astro build` when the committed file is stale, like a lockfile.

## Acceptance criteria

- [x] Changing a Limit in TS without regenerating fails `astro build` with the command to fix it
- [x] `astro dev` rewrites the file automatically

## Comments

2026-10-25: `edityPage(fields)` from `@edity/astro/loaders` (`packages/astro/src/loaders.ts`) is the loader of a page's content collection: `home: defineCollection({ loader: edityPage(homeFields) })`. It loads `src/content/<page>.json` as one entry through `glob()`, and it carries the Field definitions as the collection schema, so `entry.data` stays typed without `schema:`. It treats `src/content/<page>.schema.json` like a lockfile, using `schemaFileMatches` from core. `astro dev`, the only command that gives loaders a file watcher, writes the file when it is missing or stale. `astro build`, `astro check` and `astro sync` fail instead (exit code 1, verified with the CLI) with `src/content/home.schema.json does not match the Field definitions of page "home".` and the hint ``Run `astro dev` to write it from the Field definitions, then commit it.`` A missing file fails the same way. The integration in `index.ts` is unchanged: a loader is how the definitions reach Astro's content sync without the integration loading TS. The fixture Site uses the loader and commits its page's file. `test/schema-file.test.ts` builds copies of the fixture with a changed Limit and with no file. `test/schema-file-dev.test.ts` runs `dev()` on a copy and checks the file is rewritten when the server starts and when `content.config.ts` changes. Left over: a running `astro dev` loads content again only when `content.config.ts` itself changes, because Astro hashes that file alone. Field definitions kept in a file it imports reach the JSON Schema only when dev restarts (verified), and the build still catches a stale file. So keep definitions in `content.config.ts`, which ticket 31's migration skill should say.

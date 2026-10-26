# 05. Move edity-sandbox content to JSON and Field definitions

Status: resolved
Repo: RMYPG/edity-sandbox
Milestone: M0
Blocked by: 03, 04

## What to build

Do the Migration of `edity-sandbox` by hand: its editable content moves into one JSON file per page, loaded through an Astro content collection (`edityPage()` loader from `@edity/astro/loaders`, ticket 08), with Field definitions written using `@edity/core`. Commit the generated JSON Schema next to them.

## Acceptance criteria

- [x] The page renders identically from JSON content
- [x] Breaking a Limit in the JSON fails the build with a clear message
- [x] Notes on any friction are added under `## Comments` here (input for the migration skill, ticket 31)

## Comments

2026-10-26: Done in [RMYPG/edity-sandbox#2](https://github.com/RMYPG/edity-sandbox/pull/2). The ticket asked for the `file()` loader; it uses `edityPage()` instead, which loads `src/content/home.json` and keeps `src/content/home.schema.json` in step (ticket 08).

The Field definitions are in `src/content.config.ts`. The PR also marks the page up for the Editor and adds a dev-only login, so the Editor can be tried with `node --run dev` before edity-server's login exists (ticket 25).

**How the criteria were checked**
- **Identical page:** the built `index.html` from JSON is byte-identical to the one built from `src/data/home.ts` before.
- **Broken Limits fail the build**, naming the path and the Limit:
  - `services.0: Too long: expected at most 40 visible characters, got 49`
  - `plans.0.price: Too many decimals: expected at most 2, got 3`
  - `services: Too big: expected array to have <=8 items`
- **Missing schema file:** the build says to run `astro dev` to write it.
- **Marked up for the Editor:** the page differs from the one before only by `data-edity-*` attributes, one `<template>` per List and the inline check (N2).

**Friction, for the migration skill (ticket 31)**
1. **Packages.** `@edity/*` 0.1.0 isn't on npm yet, so the Site uses tarballs in `vendor/`. A pnpm `overrides` entry is needed for `@edity/astro`'s own dependency on `@edity/core`. Once on npm, Sites made from the template refuse releases younger than three days (`minimumReleaseAge`), so a fresh `@edity/*` release needs `minimumReleaseAgeExclude`.
2. **Moving the content.** A one-off `node` import of `src/data/home.ts` with `JSON.stringify` did it. Prettier then reflows `home.json`, so run it afterwards.
3. **The schema file.** It only appears by running `astro dev` once: `astro build` and `astro sync` refuse a missing file. The message says what to do, but the skill should start `astro dev` (with `--ignore-lock` when an agent runs it, or Astro backgrounds it) and wait for the file. A dedicated command that writes it would be simpler.
4. **Where the definitions live.** They must stay in `content.config.ts`: `astro dev` doesn't rewrite the schema when an imported file changes (ticket 08).
5. **The page marker.** Sites put `<body>` in a shared Layout, so the Layout needed a prop to pass `editable(...).page` to `<body data-edity-page>`.
6. **Lists.** `.map()` becomes `<Items of={list}>{(item) => …}</Items>`. The Item's root element must come first and carry `data-edity-item`, and a nested List is reached with `item.list('features')`.
7. **Whitespace around inline Fields.** Adding `data-edity-field` to inline elements such as `<strong>` and `<span>` makes Prettier rewrap them. Keep the whitespace around them as it was, or the page changes. Checking N2 with a script (strip `data-edity-*`, the templates and the inline check, then compare with the build from before) caught any difference; the skill should run that check.
8. **Astro's dev toolbar** sits under the Editor's bar, both bottom-centred, so the sandbox turns it off (`devToolbar: { enabled: false }`). Either the skill does that, or the Editor moves its bar while the toolbar is there.
9. **The dev login.** Until ticket 25, a Site needs its own `/_edity/login` and `/_edity/api/session` stand-in to try the Editor. The sandbox copies the fixture's. If more Sites need it before the server exists, it could move into `@edity/astro` as a dev-only option.
10. **Browser tests on a busy machine.** The template's Playwright config reused any server on port 4321, and another Site's dev server was there. The sandbox now reads `PLAYWRIGHT_PORT` and runs preview with `--ignore-lock`. The template could take the same change.

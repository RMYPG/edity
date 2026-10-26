# 09. Astro integration: inline check and Editor bundle

Status: resolved
Repo: RMYPG/edity
Milestone: M1
Blocked by: 07
Covers: N1, A4 (see the [spec](../spec.md))

## What to build

Inject an inline script of 300 bytes or less into every page: when the `edity=1` cookie is present, it loads `/_edity/editor.<hash>.js`. Build the Editor bundle and write it into the Site's `dist/_edity/`. Visitors never request it.

## Acceptance criteria

- [x] The inline script is at most 300 bytes minified
- [x] Without the cookie, the page makes no extra requests
- [x] With the cookie, the Editor bundle loads from the Site's own origin

## Notes

Only `/_edity/login` and `/_edity/api/*` are routed to the server; everything else under `/_edity/` is static (ADR-0001).

## Comments

2026-10-25: Built in `packages/astro`. The Editor's source is `src/editor/` (Preact 11 and `@preact/signals`, with its own browser `tsconfig.json`); for now it only renders a placeholder into an open shadow root on `<edity-root>`, which ticket 10 replaces with the shell. The package build bundles it with Vite (`vite.editor.config.ts`) into `dist/editor.js`, 20.7 KB (8.2 KB gzip). `edity()` adds a second integration (`src/editor-bundle.ts`) that hashes the bundle, injects an 82-byte inline check into every page's head (`/(^|; )edity=1(;|$)/.test(document.cookie)&&import("/_edity/editor.<hash>.js")`), copies the bundle to `dist/_edity/` on `astro build`, and serves it from memory under `astro dev`, restarting when the bundle is rebuilt. `enabled: false` adds none of it. Vitest checks the size, the hashed file and the N2 diff, which now strips the inline check. Playwright (`playwright.config.ts`, specs in `test/browser/`) runs against the built fixture Site in Chromium, Firefox, WebKit and an iPhone 13 profile. It checks that without the cookie, or with lookalikes such as `xedity=1` and `edity=10`, the page requests nothing beyond itself, and that with `edity=1` the bundle loads from the page's own origin and runs. New mise tasks: `browsers` (with `--with-deps` in CI) and `test:browser`. Both are part of `mise run ci`. `test` now depends on `build`, because the integration's Vitest tests read `dist/editor.js`.

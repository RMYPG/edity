# 10. Editor shell

Status: resolved
Repo: RMYPG/edity
Milestone: M2
Blocked by: 09
Covers: N4, N6, P7, A4 (see the [spec](../spec.md))

## What to build

Build the Editor's frame with Preact 11 and `@preact/signals`, rendered into one shadow root so its CSS and the Site's never affect each other. On load it calls `GET /_edity/api/session` (a mock is fine until the server exists): on 200 it shows the bar with the Client's name; on 401 it clears `edity=1` and removes itself. The bar shows the Change count, Discard and Publish (disabled for now) and a toggle for the visitor view. The Editor's text is translatable, with `es` and `en`, chosen from the session's `locale`, then the browser, then English.

## Acceptance criteria

- [x] Site CSS does not leak into the bar and the bar's CSS does not leak out
- [x] A 401 leaves the page exactly as a visitor sees it
- [x] Switching the session locale switches all Editor text
- [x] The visitor view hides every Editor control

## Comments

2026-10-25: Built in `packages/astro/src/editor/`. The bundle first calls `GET /_edity/api/session` through `api.ts`, the one module ticket 18 swaps for the generated client. On 200 it renders the bar into an open shadow root on `<edity-root>`, appended after `<body>`. The bar shows the Client's name, the Change count, Discard, Publish (disabled while the Draft is empty, with no action until ticket 26) and the visitor view, which leaves only a "Back to editing" button. On 401 it clears `edity=1` and attaches nothing; any other failure leaves the marker and does not start the Editor. A frame never starts the Editor, which ticket 15 relaxes for its preview frame. The state (`state.ts`, `draft.ts`) holds the session, the parsed page marker, the locale and its messages (`i18n.ts`, `es` and `en`: session locale, then browser, then English), the Draft with its Change count, the view and the Publish button's disabled state. Playwright checks all four criteria plus the frame guard in Chromium, Firefox, WebKit and an iPhone, using shared fixtures in `test/browser/editor.ts`; Vitest covers the Draft and the locale choice. `test/fixture/mock-api.mjs` mocks login, session and logout under `astro dev` for trying the Editor by hand. Bundle: 27.3 KB, 10.9 KB gzip. Left as `TODO(ticket NN)` for later tickets: making Fields editable and putting them back on Discard (11), Limits blocking Publish (12), restoring the Draft (14), the preview frame (15), the generated client (18) and sending Publish (26).

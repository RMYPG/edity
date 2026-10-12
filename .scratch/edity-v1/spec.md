# Edity v1: Inline Editor for Astro Sites

Oct 11, 2026 · @Mario Rojas Padrón · revised Oct 12, 2026 after a design session

Edity is a small inline editor that lets a Client change text, numbers and Lists directly on their own Astro landing page, without any control over styles. Each Publish is validated against the page's Field definitions and becomes one Git commit and a new Release of the Site. The Site stays fully static.

Terms are defined in [`CONTEXT.md`](../../CONTEXT.md). Decisions and their reasons are in [`docs/adr/`](../../docs/adr/).

## Goals

The tool exists so Clients stop asking you for small content changes, and so you can try an editing experience you think is better than the existing ones.

**What it must achieve**

- A Client changes a price, a paragraph or a list of services and publishes it without contacting you.
- A Client cannot break the build, the layout or the styles, whatever they type.
- Adding Edity to a new Site takes you under an hour once the first one works.
- The live Site stays static HTML, and visitors load no Editor code.

**Where the experience should differ from existing tools**

- Limits are visible while typing, measured in lines as well as characters. Existing tools use a form that rejects on save.
- Lists are edited on the page itself: drag to reorder, add within fixed bounds, Enter for the next bullet.
- One Publish button with a count of Changes, instead of saving field by field.
- After Publish, the Client watches their change go live, step by step.

**What it is not**

- Not a product to sell, and not feature parity with CloudCannon or TinaCMS.
- Not a page builder. Clients never add sections, move blocks or touch styles.
- Not built for Sites you did not write. You control the Site code, so each Site follows Edity's conventions through a Migration.
- Not a deployment tool. Edity cuts a Release and watches it go live, but deploying it is the platform's job.

## Architecture in one paragraph

Edity is made of two public repositories. `edity` is a TypeScript monorepo with three parts: `core` (the Field definition primitives and Draft validation), `astro` (the Astro integration and the Editor, built with Preact 11) and `contracts` (the content contract, which is also a Go module). These are published on npm as `@edity/*`, or as `@rmypg/edity-*` if the npm org name is taken. `edity-server` is a Go service running once in the cluster for every Site. Each Site's hostname routes `/_edity/login` and `/_edity/api/*` to it through Cloudflare Tunnel, and everything else under `/_edity/` is static files from the Site's own build. On Publish, the server reads the content and Field definitions from the Site repository at `main` HEAD, validates the Draft and commits on top of that sha. A workflow in the Site repository then cuts the Release once CI passes, and Flux deploys it. The server reports progress from GitHub and from rollout metrics in VictoriaMetrics, and stores no Publish state. Clients log in with Zitadel.

## Scope

Version one covers plain text, numbers and bounded Lists, edited inline and published as one commit that becomes a Release. Everything else is deferred or excluded.

| Area | In version one | Deferred to a later version | Excluded |
| --- | --- | --- | --- |
| Text | Single-paragraph plain text, edited in place | Optional Fields that can be left empty | Bold, links inside text, multiple paragraphs |
| Numbers | Whole and decimal numbers, formatted by the template in the Site's locale |  | Currency or unit chosen by the Client |
| Lists | Add, remove and reorder within fixed bounds, one level of nesting, undo after removing if time allows |  | Lists with no upper bound |
| Limits | Maximum visible characters, maximum lines per screen width, number range and decimals, List size | Automatic check at several widths on Publish |  |
| Images |  | Replacing an image in a fixed slot, with alt text | Adding images, cropping tools, galleries |
| Links and contact |  | Button targets, phone and email as structured values |  |
| Invisible content |  | Page title, meta description, share image |  |
| Structure |  | Show or hide a section, values shared across pages | Adding sections or pages, changing layout or styles |
| Preview | Phone-width preview of the Draft | Dev-server preview that renders new Items for real |  |
| Publishing | Local Draft, Change count, discard, Publish, progress until live | Restore a previous Release | Scheduled publishing, approval steps |
| Deployment | Watching the rollout of a Release |  | Performing deployments (platform's job) |
| People | Zitadel login, one role per Site |  | Roles beyond "can edit this Site", live co-editing |
| Languages | One content language per page; Editor in Spanish and English, following the Client's Zitadel locale | Language switcher in the Editor | Keeping translations in sync |
| Notifications | A GitHub issue on the Site repository when a Release fails | Alerts to you (Flux notifications, chat, email) |  |

**Assumptions.**
- You write every Site Edity runs on, and each Site has one or two Clients who are known to you.
- Sites come from `static-astro-site-template`: CI builds an image to GHCR, `release.yml` promotes it to a `vX.Y.Z` tag, and the Site runs on the Hetzner cluster behind Cloudflare Tunnel.
- `main` is always releasable on a Site with Edity, because a Client's Publish ships whatever is on `main`. Work that should not ship yet stays on branches (ADR-0003).

## Requirements

Must means version one is not usable without it. Should means it belongs in version one if time allows.

**Editing**

| ID | Requirement | Priority |
| --- | --- | --- |
| E1 | In edit mode, hovering shows which elements are editable; on touch screens they are always faintly marked | Must |
| E2 | Clicking an editable text puts the caret in it, with no popover or sidebar | Must |
| E3 | Text is plain: pasted formatting is removed and line breaks become spaces | Must |
| E4 | Enter leaves the Field, Escape restores the value it had when the caret entered | Must |
| E5 | Number Fields accept digits and one decimal separator (comma or dot) and are stored as numbers | Must |
| E6 | Text inside a link or button can be edited without the link being followed | Must |
| E7 | A value shown in two places on the page updates in both while typing | Should |
| E8 | Tab moves to the next editable Field | Should |

**Limits**

| ID | Requirement | Priority |
| --- | --- | --- |
| L1 | Each text Field has a maximum character count, counted as visible characters (grapheme clusters, so an emoji or an accented letter counts as one) | Must |
| L2 | Each text Field can have a maximum line count, with a separate value for narrow screens | Must |
| L3 | Going over a Limit is never blocked while typing: the Field turns red, a counter shows the excess, and Publish is disabled | Must |
| L4 | The counter appears only when the text is at 80% of its Limit or over it | Must |
| L5 | Number Fields have a minimum, a maximum and a fixed number of decimals | Must |
| L6 | Limits are re-checked when the width changes, when fonts finish loading and in phone preview | Must |
| L7 | Only Fields changed in the current Draft can block publishing; older content that breaks a Limit shows a warning | Must |

**Lists**

| ID | Requirement | Priority |
| --- | --- | --- |
| S1 | Each List has a minimum and maximum number of Items; add and remove controls are disabled at the bounds, with the reason shown | Must |
| S2 | Items are reordered by dragging (mouse: anywhere outside text; touch: a handle) and by arrow buttons | Must |
| S3 | A new Item is rendered from a blank template produced by the build, so it has the real markup | Must |
| S4 | In simple Lists, Enter adds an Item below and Backspace on an empty Item removes it | Must |
| S5 | A List can sit inside an Item, one level deep (a plan card with its own bullet list) | Should |
| S6 | Removing an Item shows a short Undo option | Should |
| S7 | Adding, removing or reordering Items makes the whole List one Change; edits to Fields inside a List whose structure is unchanged stay separate Changes | Must |

**Draft and Publish**

| ID | Requirement | Priority |
| --- | --- | --- |
| P1 | Edits accumulate as a Draft; the bar shows the number of Changes, Discard and Publish | Must |
| P2 | The Draft is kept in the browser and restored after a reload or a closed tab. Changes to Fields or Lists that no longer exist are dropped on restore, and the Client is told how many | Must |
| P3 | Publish sends only the Changes, each with the value it had before | Must |
| P4 | After Publish, the bar shows progress through Validating (CI on the commit), Releasing (Release being cut), Deploying and Live, or Failed. The page keeps showing the new values, and progress survives a reload | Must |
| P5 | Every failure says what happened and that the Draft is safe, in the Client's language. If the Release fails after the commit, the Client is told the changes are saved but not live yet and that you have been notified | Must |
| P6 | A phone-width preview shows the Draft at 390 px | Should |
| P7 | A visitor view hides all Editor controls | Should |
| P8 | A Client can Publish again while an earlier Publish is still in progress; each one counts as Live once the Site runs its Release or a newer one | Must |

**Server**

| ID | Requirement | Priority |
| --- | --- | --- |
| V1 | The server validates every Change against the page's Field definitions, read from the Site repository at `main` HEAD, and accepts only known Fields and Lists | Must |
| V2 | A Change whose stored value differs from the "before" value sent by the browser is rejected as a Conflict; other Changes still merge, and conflicting ones stay in the Draft | Must |
| V3 | One Publish produces one commit on top of the validated HEAD, containing the content changes and a patch bump of `package.json`. The commit is authored by the `edity` GitHub App, and its message lists the changed Fields and carries an `Edity-Client` trailer | Must |
| V4 | The server writes only to the content files and `package.json` of Site repositories it is configured for | Must |
| V5 | Publishing is rate-limited per Site | Should |
| V6 | When a Release fails, the server opens or updates a GitHub issue on the Site repository | Must |
| V7 | When a Publish ships Developer commits that are not content, the server notes it on a GitHub issue on the Site repository | Should |
| V8 | Publish progress is worked out on each request from GitHub (checks, tags) and VictoriaMetrics (kube-state-metrics rollout), with no stored Publish state | Must |

**Access**

| ID | Requirement | Priority |
| --- | --- | --- |
| A1 | A Client logs in at `/_edity/login` on their own Site through Zitadel (passkey or email code); only users with that Site's role get a session | Must |
| A2 | The session lasts 30 days in an HttpOnly cookie scoped to `/_edity/api`, and can be ended with a logout control | Must |
| A3 | An expired session at Publish sends the Client to log in again. The Draft is restored on return, and the Client presses Publish again | Must |
| A4 | The Editor loads only in browsers carrying the `edity=1` marker cookie and removes itself if the server rejects the session; the server authorises every API call and checks its `Origin` | Must |

Failed-login throttling is handled by Zitadel.

**Non-functional**

| ID | Requirement | Priority |
| --- | --- | --- |
| N1 | Visitors download no Editor code: at most a 300-byte inline check per page | Must |
| N2 | The built HTML differs from a Site without Edity only by `data-` attributes, the inline check and one hidden template per List | Must |
| N3 | Content can never break the build: anything the server accepts passes the Site's Field definitions at the commit it writes on | Must |
| N4 | The Editor's controls live in a Shadow DOM, isolated from the Site's CSS in both directions | Must |
| N5 | Works in current Chrome, Edge, Safari (including iOS) and Firefox 136 or later | Must |
| N6 | The Editor's own text is translatable, with Spanish and English to start; its language follows the Client's Zitadel locale, independent of the Site's language | Should |
| N7 | All controls are reachable by keyboard and labelled for screen readers | Should |
| N8 | Adding Edity to a Site means: Migration, installing the `edity` GitHub App on the repository, adding the tunnel routes, adding the Site's Zitadel role and adding the Site entry to the server config in `platform` | Must |
| N9 | The TS and Go validators pass the same conformance fixtures (JSON Schema Test Suite format) from `edity/contracts` | Must |
| N10 | The server's HTTP API is described in OpenAPI, owned by `edity-server`; the Editor's client is generated from it | Must |
| N11 | Pact consumer contracts from the Editor are verified in `edity-server`'s CI through the shared Pact Broker | Must |

## API

All routes are on the Site's own origin.

| Route | Purpose |
| --- | --- |
| `GET /_edity/login` | Redirect to Zitadel |
| `GET /_edity/api/auth/callback` | Finish login, set the session cookie and the `edity=1` marker |
| `POST /_edity/api/auth/logout` | End the session and clear both cookies |
| `GET /_edity/api/session` | The Client's name, locale and Site, or 401 |
| `POST /_edity/api/publish` | `{ page, changes: [{ path, before, after }] }` returns `202 { sha, version, conflicts? }`, `409 { conflicts }` when nothing merged, `422 { violations }`, or `401` |
| `GET /_edity/api/publish/:sha` | `{ stage: validating \| releasing \| deploying \| live \| failed, version }` |

## Build order

Each milestone ends with something you can try. Development publishes only to `RMYPG/edity-sandbox`, a Site created from the template. `fisioindoor` is the pilot and is connected only after M6.

| Milestone | What you can do at the end | Effort |
| --- | --- | --- |
| M0. Content model | `core` primitives produce Zod for templates and generated JSON Schema. `edity-sandbox` and `fisioindoor` read their text, prices and Lists from JSON content files, migrated by hand | 1 to 1.5 days |
| M1. Integration | The build emits `data-` attributes, Item templates, the inline check and the Editor bundle. A typo in a Field path, or a stale generated JSON Schema, fails the build | 1 to 2 days |
| M2. Editor | The prototype's behaviour runs on the real page: text, numbers, Limits, Lists, drag, Draft in the browser | 3 to 4 days |
| M3. Contracts | `edity/contracts` Go module with the Edity vocabulary, meta-schema and conformance fixtures, passing in `core` | 1 day |
| M4. Server | `edity-server` validates at HEAD, merges, commits and reports Conflicts and violations; it passes the conformance fixtures and verifies the Editor's pacts | 3 to 4 days |
| M5. Publish experience | Zitadel login, progress until Live, the failure issue, phone preview; full loop on `edity-sandbox` | 2 days |
| M6. Site pipeline | The release-on-Publish workflow lands in the template and `edity-sandbox`; `fisioindoor` is connected | 1 day |
| M7. Device pass | Tested with Spanish accents and emoji, iOS Safari, Android Chrome, translation and grammar extensions | 1.5 to 2 days |

The work is split into tickets in [`issues/`](issues/): 01 to 29 for v1, and 30 to 32 for the deferred backlog.

Estimates are rough guesses for one developer, about 13 to 18 days in total. M2 is the experiment: it is where the time is best spent, and it can be shown to a Client before M4 exists.

**Platform dependencies**

- [RMYPG/platform#39](https://github.com/RMYPG/platform/issues/39): Flux image automation. M5's Deploying and Live stages only end once Releases deploy automatically.
- [RMYPG/platform#41](https://github.com/RMYPG/platform/issues/41): self-hosted Pact Broker, needed for N11 in M4.
- [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42): deploying `edity-server`. It covers the gitops app, the tunnel routes per Site, the Zitadel project, roles and OIDC client, network access to `vmsingle`, and the GitHub App key as a secret. Needed for M5.

**After v1:** a migration skill, written once `fisioindoor` and `vertex-glow` have both been migrated by hand.

## Decisions

- [ADR-0001](../../docs/adr/0001-one-shared-save-service-behind-site-paths.md): one shared server, reached at a path on each Site
- [ADR-0002](../../docs/adr/0002-editable-content-in-json-content-collections.md): editable content in JSON, validated against Field definitions read from `main`
- [ADR-0003](../../docs/adr/0003-publish-cuts-a-release-deployment-is-out-of-scope.md): Publish cuts a Release, and deployment is out of scope
- [ADR-0004](../../docs/adr/0004-clients-log-in-with-zitadel-from-v1.md): Clients log in with Zitadel from version one
- [ADR-0005](../../docs/adr/0005-save-service-in-go-in-its-own-repository.md): the server is written in Go, in its own repository
- [ADR-0006](../../docs/adr/0006-mpl-for-the-packages-agpl-for-the-server.md): MPL-2.0 for the packages, AGPL-3.0 for the server

## Resolved questions

| Question | Answer |
| --- | --- |
| Hosting, and can it run a server function? | Static images on `static-web-server` in the Hetzner cluster: no server functions, so one shared `edity-server` (ADR-0001) |
| Git host | GitHub, org `RMYPG` |
| Astro version | 7.2. Content moves from `src/data/*.ts` to content collections |
| JSON or YAML | JSON (ADR-0002) |
| One content file per page or per Site? | One per page, plus a shared file once shared values arrive |
| Client router, hydrated components, text animations? | None found in `fisioindoor`, `vertex-glow` or the template |
| Decimals and locale for prices | Decimals are a Limit per Field; formatting uses the Site's locale (`es-ES` for `fisioindoor`) |
| Will Clients edit from a phone? | Yes, occasionally |
| Editor UI library | Preact 11 with signals, rendered into one shadow root |
| npm scope | `@edity` if the npm org can be created, otherwise `@rmypg/edity-*` |
| Licenses | MPL-2.0 for `edity` and its packages, AGPL-3.0 for `edity-server` |
| GitHub Apps | One: `edity`, installed on Site repositories (contents write, issues write, actions, checks and metadata read) |

## Deferred backlog

- Language switcher in the Editor (N6 follow-up)
- Alerts to you through Flux notifications or a chat channel
- Everything in the "Deferred" column of the scope table

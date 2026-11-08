# Edity v2: Proposals, the Hub and live editing

Nov 8, 2026 · @Mario Rojas Padrón · from a design session

Not scheduled. Version one ships to `fisioindoor` first, and what the pilot shows shapes this spec.

Several people can work on a Site side by side, see a real build of their work, and know that what goes live is exactly what they looked at. The reasons are in [ADR-0007](../../docs/adr/0007-version-two-publishes-through-proposals-and-a-next-release.md) and [ADR-0008](../../docs/adr/0008-live-editing-shares-presence-and-whole-fields.md).

## Language

These join or replace entries in [`CONTEXT.md`](../../CONTEXT.md) when version two is built, because Publish means something else in version one.

| Term | Meaning | Avoid |
| --- | --- | --- |
| **Proposal** | One piece of work in progress: Changes sent from the Editor, on its own copy of the Site (a branch and its pull request), with its own Preview | PR, branch, changeset |
| **Next Release** | Everything merged and not yet published, which the next Publish ships. It is `main`, and its Preview is shared by everyone working on the Site | main, staging |
| **Preview** | A real build of a Proposal or of the Next Release, at its own link | Demo, staging |
| **Hub** | The separate Edity app where a Client finds their Sites, Proposals, Previews and deployment history | Dashboard, board, admin panel |
| **Merge** | Adding a Proposal to the Next Release | Approve, accept |
| **Phone view** | Version one's phone preview (P6), renamed: the Proposal at phone width | Phone preview |
| **Draft** (changed) | The Field a Client is typing in, until its value reaches the Proposal | Changeset, pending edits |
| **Publish** (changed) | A Client's action of turning the Next Release, exactly as they looked at it, into a Release | Save, deploy, commit, approve |
| **Conflict** (changed) | A Field or List changed both in a Proposal and in the Next Release since the Proposal started | Clash, collision |

## The flow

| Step | Where | What happens |
| --- | --- | --- |
| Edit | Editor, on the live Site page | Changes go into a Proposal as the Client works, and others in it see them |
| Proposal Preview | Its own link, from the Hub | A real build of that Proposal |
| Next Release Preview | Its own link, from the Hub | After a Merge: everything merged so far, shared by everyone |
| Publish | Hub | The commit people looked at becomes a Release, then deploys |

## Requirements

**Hub and Editor**

| ID | Requirement |
| --- | --- |
| H1 | The Hub runs on its own hostname with Zitadel login, is served by `edity-server`, and reads only GitHub |
| H2 | The Hub lists a Client's Sites, each Site's open Proposals and their Previews, each Proposal's Conflicts with a link to resolve them in the Editor, Merge, the Next Release Preview, Publish, and deployment history from GitHub Deployments |
| H3 | An Edit link opens the Site with the Editor on a chosen Proposal |
| H4 | The Editor stays on the Site's own origin and keeps editing and Limits. It overlays the Proposal's values on the live page |
| H5 | A Field that exists only in unpublished commits can't be edited on the live page; the Editor says so and links to the Preview |

**Proposals**

| ID | Requirement |
| --- | --- |
| R1 | Several Proposals can be open at once on a Site |
| R2 | For each Field or List a Proposal changed, the server compares where it started, the Proposal now and the Next Release now. A change only the Proposal made carries over; one both made is a Conflict the Client resolves in the Editor |
| R3 | When the Next Release has moved, the Hub and the Editor show it with an Update button. Reconciliation runs when someone opens or merges the Proposal, not in the background |
| R4 | Any Client with the Site's role may Merge. The Proposal must be up to date, pass every Limit and have CI green on its newest commit; if that commit skipped CI, Merge starts the build and completes when it passes |
| R5 | A Merge is one squashed commit on `main`, with trailers naming every Client who contributed |

**Publish**

| ID | Requirement |
| --- | --- |
| B1 | Any Client with the Site's role may Publish |
| B2 | Publish names the commit the Client looked at, and is refused if `main` has moved since: they are told, and must look at the new version |
| B3 | The Release tags that commit and promotes its `sha-<commit>` image, which is the image the `main-<run>` tag of the Next Release Preview points to |
| B4 | The version is the latest tag plus one patch, not `package.json`. The Developer's manual releases pass minor or major as an input |

**Live editing**

| ID | Requirement |
| --- | --- |
| C1 | Everyone on the same page of a Site sees each other's cursor and hover, labelled with their Proposal. Cursors are anchored to page elements, because screen widths differ |
| C2 | The Field someone is typing in is held for them within their Proposal, and others see their name and colour on it. Changing a List's structure holds the whole List |
| C3 | A hold ends when they leave the Field, disconnect or go 60 seconds without typing |
| C4 | When someone leaves a Field, its value reaches everyone in the same Proposal within a second |
| C5 | Someone in another Proposal in the same Field gets a warning naming the person and the Proposal |
| C6 | The connection is a WebSocket at `/_edity/api/live` on the Site's own origin, opened with a short-lived ticket from `edity-server` |
| C7 | The server commits to a Proposal at most once every 30 seconds, marked `[skip ci]`. Browsers keep values until a commit is confirmed |
| C8 | A Proposal's Preview rebuilds only when someone presses Update Preview, and at Merge |

## Platform dependencies

- [RMYPG/platform#142](https://github.com/RMYPG/platform/issues/142) must also report `staging` and previews, including the commit each one runs. The Hub and B2 rely on that.
- Previews, including the Next Release Preview, need public hostnames behind the Zitadel login through Cloudflare Access. Today they are reachable only over Tailscale, and preview namespaces admit traffic only from its proxies. No issue is open yet; open one when this version is scheduled.
- [RMYPG/platform#143](https://github.com/RMYPG/platform/issues/143) would shorten the wait for staging as well as production.

## Not decided yet

- The Hub's hostname, where its code lives and what it is built with.
- How a Proposal starts, now that the Editor has no send step: created by the first edit, or chosen first as new or existing.
- How a Proposal is named and discarded.
- Whether Proposal Previews reuse platform's `deploy/preview` machinery. It builds at most the five newest labelled pull requests per Site, and a new preview appears 5 to 10 minutes after a push.
- How Publish starts the Release, and what App permission that needs. Ticket 27's trigger (CI passing on a bot's commit) no longer applies.
- What happens to Release on Publish and to ADR-0003's patch bump during the move from version one.

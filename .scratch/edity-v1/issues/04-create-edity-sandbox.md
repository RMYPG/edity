# 04. Create the edity-sandbox Site

Status: resolved
Repo: RMYPG/edity-sandbox
Milestone: M0

## What to build

Create `RMYPG/edity-sandbox` from `static-astro-site-template`, so development can Publish without touching a client's Site. Add one page with content that exercises every v1 case: a heading, a paragraph with a line Limit, prices (numbers with decimals), a simple bullet List and a List of cards with a nested List.

## Acceptance criteria

- [x] The repo exists and CI builds its image to GHCR
- [x] `release.yml` produces a `vX.Y.Z` tag and image
- [x] The page covers text, numbers, a simple List and a nested List

## Notes

Creating the repository is a GitHub action the Developer should confirm. Deployment with a hostname comes with the platform issue for `edity-server`.

## Comments

2026-10-25: The Developer created `RMYPG/edity-sandbox` from the template; CI is green and `ghcr.io/rmypg/edity-sandbox` is linked to the repo. Remaining for an agent: the page content and a first release.

2026-10-26: The page is in [RMYPG/edity-sandbox#2](https://github.com/RMYPG/edity-sandbox/pull/2), together with ticket 05.
- **Content:** Spanish, with accents and emoji, and every v1 case:
  - a heading and a paragraph with line Limits;
  - a whole number and decimal prices, formatted for `es-ES`;
  - the brand shown twice, once inside a link, and text inside a link and a button;
  - a simple bullet List of services, and a List of plan cards that each hold a List of features.
- **Open:** the release criterion. It needs that PR on `main` and a dispatch of the Release workflow, which [RMYPG/edity-sandbox#1](https://github.com/RMYPG/edity-sandbox/pull/1) (ticket 27) also changes. The Developer does that, so the Status stays as it is.

2026-10-29: Dispatched the Release workflow on `main` ([run 40863998895](https://github.com/RMYPG/edity-sandbox/actions/runs/40863998895)). It tagged `31077c3` (RMYPG/edity-sandbox#3, which takes `@edity/*` 0.1.0 from npm) as `v1.0.0` and promoted its `sha-` image to `ghcr.io/rmypg/edity-sandbox:v1.0.0`, so the last criterion is met.

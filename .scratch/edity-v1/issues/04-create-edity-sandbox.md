# 04. Create the edity-sandbox Site

Status: ready-for-agent
Repo: RMYPG/edity-sandbox
Milestone: M0

## What to build

Create `RMYPG/edity-sandbox` from `static-astro-site-template`, so development can Publish without touching a client's Site. Add one page with content that exercises every v1 case: a heading, a paragraph with a line Limit, prices (numbers with decimals), a simple bullet List and a List of cards with a nested List.

## Acceptance criteria

- [x] The repo exists and CI builds its image to GHCR
- [ ] `release.yml` produces a `vX.Y.Z` tag and image
- [ ] The page covers text, numbers, a simple List and a nested List

## Notes

Creating the repository is a GitHub action the Developer should confirm. Deployment with a hostname comes with the platform issue for `edity-server`.

## Comments

2026-10-25: The Developer created `RMYPG/edity-sandbox` from the template; CI is green and `ghcr.io/rmypg/edity-sandbox` is linked to the repo. Remaining for an agent: the page content and a first release.

# 36. Move the template and edity-sandbox to the shared workflows

Status: ready-for-agent
Repo: RMYPG/static-astro-site-template, RMYPG/edity-sandbox
Milestone: After v1
Blocked by: 35

## What to build

`fisioindoor` and `vertex-glow` take their CI and Release from `RMYPG/workflows`, but the template and `edity-sandbox` still carry their own copies, so a new Site starts out different from the running ones. Replace those copies with thin callers pinned to a tag of `RMYPG/workflows`, and keep the Release on Publish caller from ticket 35. Keep the CI caller at `.github/workflows/ci.yml`: the `main-<run_number>` image tags use that workflow's run number, which restarts if the file is renamed.

## Acceptance criteria

- [ ] The template and `edity-sandbox` hold no CI or Release logic of their own, only callers
- [ ] A Publish commit on `edity-sandbox` still produces a tag and an image with no step by the Developer
- [ ] `edity-server`'s `check:progress` still reads the sandbox's Publishes as released

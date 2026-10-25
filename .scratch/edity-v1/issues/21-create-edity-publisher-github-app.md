# 21. Create the edity-publisher GitHub App

Status: ready-for-human
Repo: RMYPG (GitHub org)
Milestone: M4

## What to build

Create the `edity-publisher` GitHub App in the `RMYPG` org with contents write, issues write, and actions, checks and metadata read. Leave the webhook inactive (untick "Active"): v1 polls GitHub for progress, and a webhook can be enabled later in the App's settings without reinstalling. Install it on `edity-sandbox` only for now. Store its App ID and private key where the platform issue [RMYPG/platform#42](https://github.com/RMYPG/platform/issues/42) expects them, and a copy for local development.

## Acceptance criteria

- [ ] The App exists with exactly those permissions and no active webhook
- [ ] It is installed on `edity-sandbox` and nothing else

# 21. Create the edity-publisher GitHub App

Status: ready-for-human
Repo: RMYPG (GitHub org)
Milestone: M4

## What to build

Create the `edity-publisher` GitHub App in the `RMYPG` org with contents write, issues write, and actions, checks and metadata read. Leave the webhook inactive (untick "Active"): v1 polls GitHub for progress, and a webhook can be enabled later in the App's settings without reinstalling. Install it on `edity-sandbox` only for now. Store its credentials in the `edity` Infisical project, path `/github`, as `EDITY_PUBLISHER_GITHUB_APP_ID` and `EDITY_PUBLISHER_GITHUB_APP_PRIVATE_KEY` (the PEM pasted as is, line breaks included). Use two private keys: one in the `prod` environment for the deployed server, and a second one in `dev` for local development, so the local key can be revoked on its own. The project is its own authorization boundary, following `platform`'s rule that project membership separates privileged credentials; which machine identity reads `prod` is decided with the deployment work.

## Acceptance criteria

- [ ] The App exists with exactly those permissions and no active webhook
- [ ] It is installed on `edity-sandbox` and nothing else
- [ ] `prod` and `dev` in the `edity` Infisical project each hold their own private key under `/github`

# 21. Create the edity-publisher GitHub App

Status: resolved
Repo: RMYPG (GitHub org)
Milestone: M4

## What to build

Create the `edity-publisher` GitHub App in the `RMYPG` org with contents write, issues write, and actions, checks and metadata read. Leave the webhook inactive (untick "Active"): v1 polls GitHub for progress, and a webhook can be enabled later in the App's settings without reinstalling. Install it on `edity-sandbox` only for now. Store its credentials in the `edity` Infisical project, path `/github`, as `EDITY_PUBLISHER_GITHUB_APP_ID` and `EDITY_PUBLISHER_GITHUB_APP_PRIVATE_KEY` (the PEM pasted as is, line breaks included). While the App is installed only on `edity-sandbox`, one private key in the `dev` environment is enough; `prod` stays empty until the deployed server exists. Keys of the same App all carry the same power, so separating environments means a second App, which ticket 28 creates before any client Site is installed. The project is its own authorization boundary, following `platform`'s rule that project membership separates privileged credentials; which machine identity reads `prod` is decided with the deployment work.

## Acceptance criteria

- [x] The App exists with exactly those permissions and no active webhook
- [x] It is installed on `edity-sandbox` and nothing else
- [x] The `dev` environment of the `edity` Infisical project holds the App ID and private key under `/github`

## Comments

2026-10-25: Done by the Developer. `edity-publisher` exists with the planned permissions, no webhook events, installable only on this account, and is installed on `edity-sandbox` only. One private key and the App ID are in the `edity` Infisical project, `dev`, `/github`.

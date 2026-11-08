# Publish cuts a release; deployment is out of scope

A Publish makes one commit to the Site's `main` containing the content change and a patch bump of `package.json`. A workflow in the Site repository then runs the release logic (git tag and promoted image) once CI succeeds on that commit. Deploying the new image is the platform's job, done through Flux image automation. The save service stays stateless and never orchestrates CI or deployment, and the release logic is meant to live once, in the reusable workflow in `RMYPG/workflows`. The template and `edity-sandbox` keep their own copies until ticket 36 moves them.

## Considered Options

For reading whether a Release has reached production:

- **VictoriaMetrics (kube-state-metrics)**: rejected because it covers production only, ties the service to the cluster's internals, and gives no failure signal other than a timeout.
- **The Kubernetes API, from the service**: rejected because it needs a role per Site namespace.
- **Chaining Flux notification events**: rejected because it needs stored state, and a single missed webhook leaves the status stuck.
- **Moving Sites to Cloudflare Pages**: rejected for now because it undoes the platform's hosting, staging, previews and image automation.

## Consequences

`main` must always be releasable: a Client's Publish ships any Developer commits already on `main`. Work that should not ship yet stays on branches, and the Developer is notified whenever a Publish ships commits that are not content changes. Staging follows `main`, so on a Site with Edity it shows what the next Publish ships: check unfinished work on a pull request preview, never by merging it to see it on staging.

Edity only observes deployment, never performs it. The platform reports each rollout as a GitHub Deployment on the Site's repository, written by a reconciler in the cluster, and the service reads it from GitHub with the rest of a Publish's progress. A Publish is Live once a production Deployment of its Release or a newer one has succeeded. The reconciler compares what runs with what GitHub says on every pass, so a missed event corrects itself. The service needs no cluster access, and a new host would only have to write the same Deployments.

Version two replaces the direct Publish described here: see ADR-0007.

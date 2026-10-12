# Publish cuts a release; deployment is out of scope

A Publish makes one commit to the Site's `main` containing the content change and a patch bump of `package.json`. A workflow in the Site repository then runs the existing release logic (git tag and promoted image) once CI succeeds on that commit. Deploying the new image is the platform's job, done through Flux image automation. The save service stays stateless and never orchestrates CI or deployment, and the release logic lives once, in the Site template.

## Consequences

`main` must always be releasable: a Client's Publish ships any Developer commits already on `main`. Work that should not ship yet stays on branches, and the Developer is notified whenever a Publish ships commits that are not content changes.

Edity only observes deployment, never performs it. The service reads rollout metrics from the cluster's VictoriaMetrics (kube-state-metrics) and reports a Release as deployed once every ready replica of the Site runs that version or a newer one. It needs no Kubernetes credentials. Reading the Deployment through the Kubernetes API was rejected because it needs a role per Site namespace, and chaining Flux notification events was rejected because it needs stored state and a single missed webhook leaves the status stuck.

# One shared save service, reached at a path on each Site

Sites are static images served by `static-web-server` on the cluster, so none of them can host a server function. We run a single multi-tenant Edity service in the cluster, deployed by Flux, with one configuration entry per Site, and each Site's hostname routes `/_edity/*` to it through Cloudflare Tunnel path rules. A single deployment keeps adding a Site to a configuration change, and serving it on the Site's own origin keeps login cookies first-party.

## Considered Options

- **Switching Sites to an SSR adapter**: rejected because it breaks the fully static image.
- **One service instance per Site**: rejected because it multiplies deployments and secrets for one or two Clients per Site.
- **A service reachable only over Tailscale**: rejected because it would sit on a different origin from the public page.

## Consequences

Site hostnames are routed by Pulumi (the tunnel's static-site list), not by gitops, so adding a Site's `/_edity/*` route is a Pulumi change.

The decision is the shared server on each Site's own origin. Routing it through Cloudflare Tunnel path rules is provisional, because the platform's deployment model is changing.

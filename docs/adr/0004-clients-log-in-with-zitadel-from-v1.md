# Clients log in with Zitadel from version one

Clients log in through the Zitadel instance already running in the cluster, instead of with a per-Site password as the original spec proposed. A password scheme would mean building hashing, throttling and session recovery that would be thrown away when magic links arrive. Tailscale-only access is incompatible with serving the Editor on each Site's public origin (see ADR-0001).

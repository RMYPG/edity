# The save service is written in Go, in its own repository

The save service lives in its own repository and is written in Go, separate from the `edity` TypeScript monorepo that holds the primitives, the Astro integration and the Editor. It is glue between GitHub, Zitadel and metrics, and Go's libraries for all three are mature. It ships as a single static binary with its own release cycle.

## Consequences

Draft validation now exists twice, once in TS (the Site build) and once in Go (the service). If they disagree, accepted content can break the build. To prevent that, the `edity` monorepo owns the contracts: the Edity JSON Schema vocabulary and its meta-schema, plus conformance fixtures in the JSON Schema Test Suite format, which both implementations must pass. The service pins a version of these contracts and runs the fixtures in its CI. The HTTP API is covered separately: the service owns its OpenAPI description, and Pact consumer-driven contract tests (the Editor as consumer, the service as provider, verified through a self-hosted Pact Broker) catch breaking changes.

# MPL-2.0 for the packages, AGPL-3.0 for the server

Anyone may use Edity however they like, but forks and modifications must stay open source. The `edity` packages use MPL-2.0, whose file-level copyleft keeps changes to Edity's own files open while leaving the Sites that use the packages under any license. GPL would have extended its terms to every Site built with them. `edity-server` uses AGPL-3.0, because a modified server is normally run as a network service rather than distributed, and only the AGPL requires that its source be offered in that case.

## Consequences

`edity-server`'s OpenAPI description, `api/openapi.yaml`, is MPL-2.0 rather than AGPL-3.0. It is the contract between the two repositories: `edity` vendors it, and `@edity/astro` ships the Editor's client generated from it.

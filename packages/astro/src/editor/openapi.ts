/**
 * edity-server's API, as openapi-typescript generates it from the pinned
 * api/openapi.yaml. Do not edit: run `mise run api:generate`.
 */

export interface paths {
    readonly "/_edity/login": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Log in
         * @description Starts logging in: redirects to Zitadel, with OIDC's authorization
         *     code flow and PKCE (A1). The browser navigates here; the Editor does
         *     not fetch it.
         */
        readonly get: operations["login"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/_edity/api/auth/callback": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Finish logging in
         * @description Where Zitadel sends the browser back after a login. When the user has
         *     the Site's role (`zitadelRole` in the Sites file), it sets the session
         *     cookie and the `edity=1` marker and goes back to the path the login
         *     was asked to `return` to (A1). The browser navigates here; the Editor
         *     does not fetch it.
         */
        readonly get: operations["finishLogin"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/_edity/api/auth/logout": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Log out
         * @description Ends the Client's session and clears both cookies (A2). It does so
         *     whether or not the request carried a session.
         */
        readonly post: operations["logout"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/_edity/api/session": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Who is logged in
         * @description The Client the session is for. The session cookie is `HttpOnly`, so
         *     the Editor asks here before it starts, and removes itself on a 401
         *     (A4).
         */
        readonly get: operations["getSession"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/_edity/api/publish": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Publish a Draft
         * @description Publishes the Changes of a Draft on one page (P3). The server reads
         *     the page's content and Field definitions from the Site repository at
         *     `main` HEAD, and validates the Changes against them (V1). A Change
         *     whose stored value is no longer its `before` is a Conflict (V2). The
         *     Changes that merge become one commit on top of that HEAD, with a patch
         *     bump of the Site's `package.json`, which a workflow in the Site
         *     repository then cuts as a Release (V3).
         */
        readonly post: operations["publish"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/_edity/api/publish/{sha}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Progress of a Publish
         * @description Where the Release of a Publish's commit is (P4). The server works it
         *     out from GitHub on each request, and stores nothing (V8). A commit
         *     counts as live once the Site runs its Release or a newer one (P8).
         */
        readonly get: operations["getPublishStatus"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description The Client a session is for. */
        readonly Session: {
            /** @description The Client's name in Zitadel. */
            readonly name: string;
            /** @description The Client's locale in Zitadel, such as `es` or `en-GB`, which the Editor's language follows (N6). */
            readonly locale: string;
            /** @description The Site's `id` in the server's Sites file, such as `edity-sandbox`. */
            readonly site: string;
        };
        /** @description The Changes of a Draft on one page, as Publish sends them (P3). */
        readonly PublishRequest: {
            /**
             * @description The page's name, its content collection's. Its content is
             *     `src/content/<page>.json` in the Site repository, and its generated
             *     JSON Schema `src/content/<page>.schema.json`.
             * @example home
             */
            readonly page: string;
            /** @description The Draft's Changes, in the order the Client made them. */
            readonly changes: readonly components["schemas"]["Change"][];
        };
        /**
         * @description One Change of a Draft: an edit to a Field, or to the structure of a
         *     List, which is one Change for the whole List (S7).
         */
        readonly Change: {
            /**
             * @description The content path of the Field or List. The path of an Item that is
             *     an object, such as `plans.1`, names neither.
             */
            readonly path: components["schemas"]["ContentPath"];
            /**
             * @description The value the Client changed: the one in the content the page was
             *     built from when they first made the Change. The server compares it
             *     with the stored value to find Conflicts (V2).
             */
            readonly before: components["schemas"]["ContentValue"];
            /** @description The value in the Draft. */
            readonly after: components["schemas"]["ContentValue"];
        };
        /**
         * @description Where a Field, a List or an Item is in a page's content: its keys and
         *     Item indices, dot-separated.
         * @example hero.title
         * @example services
         * @example plans.1.price
         * @example plans.1.features.0
         */
        readonly ContentPath: string;
        /** @description A value in a page's content, the Editor's `ContentValue`. */
        readonly ContentValue: string | number | ContentValueArray | {
            readonly [key: string]: components["schemas"]["ContentValue"];
        };
        /** @description A Publish that was committed. */
        readonly Published: {
            /** @description The commit's sha, to follow its progress with `getPublishStatus`. */
            readonly sha: components["schemas"]["Sha"];
            /** @description The version of the Release the commit becomes, which its progress also gives. */
            readonly version: components["schemas"]["Version"];
            /** @description The Changes that did not merge. Left out when every Change merged. */
            readonly conflicts?: readonly components["schemas"]["Conflict"][];
        };
        /** @description A Publish in which nothing merged. */
        readonly Conflicts: {
            /** @description Every Change of the Publish. */
            readonly conflicts: readonly components["schemas"]["Conflict"][];
        };
        /**
         * @description A Change whose stored value at `main` HEAD is no longer its `before`,
         *     because a newer Release changed it too (V2). It stays in the Draft.
         */
        readonly Conflict: {
            /** @description The Change's path, as Publish sent it. */
            readonly path: components["schemas"]["ContentPath"];
        };
        /** @description A Publish that breaks the page's Field definitions. */
        readonly Violations: {
            /** @description Every Limit the Changes break. */
            readonly violations: readonly components["schemas"]["Violation"][];
        };
        /**
         * @description A rule of the page's Field definitions that a Change breaks, as the
         *     Editor's `Violation` names it, so the Editor shows the server's
         *     verdicts as it shows its own.
         */
        readonly Violation: {
            /**
             * @description The content path of the value that breaks the rule: the Change's,
             *     or one inside it, such as `plans.1.features` inside a Change to
             *     `plans`.
             */
            readonly path: components["schemas"]["ContentPath"];
            /**
             * @description The rule it breaks:
             *
             *     - `type`: not what the Field definitions hold there: text, a
             *       number, a List's Items or an Item's Fields.
             *     - `unknown`: a key the Field definitions do not have, or a Change
             *       whose path is not one of the page's Fields or Lists.
             *     - `oneLine`: text with no visible character, or with a line break.
             *     - `maxChars`: text with more visible characters than its Limit.
             *     - `min`, `max`: a number out of its range.
             *     - `decimals`: a number with more decimal places than its Limit.
             *     - `minItems`, `maxItems`: a List with fewer or more Items than its
             *       bounds.
             *
             *     The server does not check line Limits: only a browser can measure
             *     lines.
             * @enum {string}
             */
            readonly limit: "type" | "unknown" | "oneLine" | "maxChars" | "min" | "max" | "decimals" | "minItems" | "maxItems";
        };
        /** @description Where the Release of a Publish's commit is (P4). */
        readonly PublishStatus: {
            /**
             * @description - `validating`: the Site's CI runs on the commit.
             *     - `releasing`: CI passed, and the Release is being cut: its
             *       `v<version>` tag or its image does not exist yet.
             *     - `released`: the Release exists.
             *     - `deploying`: the Release is being deployed. On hold, not
             *       reported yet (ticket 33).
             *     - `live`: the Site runs the Release or a newer one (P8). On hold,
             *       not reported yet (ticket 33).
             *     - `failed`: a check on the commit failed, or cutting the Release
             *       did. The changes are saved but not live, and the Developer has
             *       been told (P5, V6).
             * @enum {string}
             */
            readonly stage: "validating" | "releasing" | "released" | "deploying" | "live" | "failed";
            /** @description The version of the Release the commit becomes. */
            readonly version: components["schemas"]["Version"];
        };
        /**
         * @description A Git commit's sha, in lowercase hex.
         * @example 4f9d2c1a7b3e8f60d5a9c2b1e7f40386a5d1c9e2
         */
        readonly Sha: string;
        /**
         * @description A Release's version: the `version` in the Site's `package.json` at the
         *     commit, such as `1.4.3`, whose Release is tagged `v1.4.3`.
         * @example 1.4.3
         */
        readonly Version: string;
        /** @description A message for the Developer, in English. The Editor tells the Client what happened in their own language from the status alone (P5). */
        readonly Message: string;
    };
    responses: {
        /** @description No session, or an expired one. The Client logs in again (A3). */
        readonly NoSession: {
            headers: {
                readonly [name: string]: unknown;
            };
            content: {
                readonly "text/plain": components["schemas"]["Message"];
            };
        };
        /**
         * @description The request's `Origin` is not the Site's own, or it is a `POST`
         *     without an `Origin` (A4).
         */
        readonly ForeignOrigin: {
            headers: {
                readonly [name: string]: unknown;
            };
            content: {
                readonly "text/plain": components["schemas"]["Message"];
            };
        };
        /** @description The hostname is not one of a configured Site's. */
        readonly UnknownSite: {
            headers: {
                readonly [name: string]: unknown;
            };
            content: {
                readonly "text/plain": components["schemas"]["Message"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    readonly login: {
        readonly parameters: {
            readonly query?: {
                /**
                 * @description Where on the Site to come back to once logged in, such as
                 *     `/precios`, so the Client is back on the page whose Draft they were
                 *     editing (A3). Only a path on the Site's own origin counts: anything
                 *     that could lead elsewhere, such as `//other.example` or
                 *     `https://other.example/`, counts as left out. The Site's home, `/`,
                 *     when it is left out.
                 * @example /precios
                 */
                readonly return?: string;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description To Zitadel, to log in. */
            readonly 302: {
                headers: {
                    /** @description Zitadel's authorization endpoint, with the login's parameters. */
                    readonly Location: string;
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            readonly 404: components["responses"]["UnknownSite"];
        };
    };
    readonly finishLogin: {
        readonly parameters: {
            readonly query?: {
                /** @description Zitadel's authorization code, when the login succeeded. */
                readonly code?: string;
                /** @description The login's state, which ties this callback to the login this browser started. */
                readonly state?: string;
                /** @description Zitadel's OAuth 2.0 error code, when the login failed or the user cancelled it. */
                readonly error?: string;
                /** @description Zitadel's description of the error. */
                readonly error_description?: string;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Logged in, back on the Site. */
            readonly 303: {
                headers: {
                    /** @description The path the login was asked to `return` to, or `/`. */
                    readonly Location: string;
                    /**
                     * @description The session cookie `edity_session`, `HttpOnly`, and the marker
                     *     `edity=1`, both for 30 days (A2). The response has one
                     *     `Set-Cookie` header for each.
                     */
                    readonly "Set-Cookie": string;
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /**
             * @description Not the end of a login this browser started: its `state` is
             *     missing or not this browser's, it has no `code`, or Zitadel
             *     answered an `error`. No session.
             */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            /** @description The user logged in, but does not have the Site's role. No session (A1). */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            readonly 404: components["responses"]["UnknownSite"];
        };
    };
    readonly logout: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Logged out. */
            readonly 204: {
                headers: {
                    /**
                     * @description Clears the session cookie `edity_session` and the marker
                     *     `edity`. The response has one `Set-Cookie` header for each.
                     */
                    readonly "Set-Cookie": string;
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            readonly 403: components["responses"]["ForeignOrigin"];
            readonly 404: components["responses"]["UnknownSite"];
        };
    };
    readonly getSession: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description The Client is logged in. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "name": "Ana García",
                     *       "locale": "es",
                     *       "site": "edity-sandbox"
                     *     }
                     */
                    readonly "application/json": components["schemas"]["Session"];
                };
            };
            readonly 401: components["responses"]["NoSession"];
            readonly 403: components["responses"]["ForeignOrigin"];
            readonly 404: components["responses"]["UnknownSite"];
        };
    };
    readonly publish: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** @description The Draft's Changes on the page. */
        readonly requestBody: {
            readonly content: {
                /**
                 * @example {
                 *       "page": "home",
                 *       "changes": [
                 *         {
                 *           "path": "hero.title",
                 *           "before": "Fisioterapia a domicilio",
                 *           "after": "Fisioterapia en casa"
                 *         },
                 *         {
                 *           "path": "plans.1.price",
                 *           "before": 45,
                 *           "after": 49.5
                 *         },
                 *         {
                 *           "path": "services",
                 *           "before": [
                 *             "Masaje",
                 *             "Punción seca"
                 *           ],
                 *           "after": [
                 *             "Punción seca",
                 *             "Masaje",
                 *             "Pilates"
                 *           ]
                 *         }
                 *       ]
                 *     }
                 */
                readonly "application/json": components["schemas"]["PublishRequest"];
            };
        };
        readonly responses: {
            /**
             * @description Committed. Every Change merged but those in `conflicts`, which the
             *     Editor keeps in the Draft. The commit becomes a Release once the
             *     Site's CI passes on it (ADR-0003).
             */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "sha": "4f9d2c1a7b3e8f60d5a9c2b1e7f40386a5d1c9e2",
                     *       "version": "1.4.3",
                     *       "conflicts": [
                     *         {
                     *           "path": "hero.title"
                     *         }
                     *       ]
                     *     }
                     */
                    readonly "application/json": components["schemas"]["Published"];
                };
            };
            /**
             * @description Not a Publish: the body is not JSON sent as `application/json`,
             *     or not of the shape of `PublishRequest`, or two of its Changes
             *     are for one Field or List, or one is inside the other's, which
             *     the Editor never sends. Nothing was committed.
             */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            readonly 401: components["responses"]["NoSession"];
            readonly 403: components["responses"]["ForeignOrigin"];
            readonly 404: components["responses"]["UnknownSite"];
            /**
             * @description Every Change is a Conflict, so nothing merged and nothing was
             *     committed (V2).
             */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "conflicts": [
                     *         {
                     *           "path": "hero.title"
                     *         },
                     *         {
                     *           "path": "services"
                     *         }
                     *       ]
                     *     }
                     */
                    readonly "application/json": components["schemas"]["Conflicts"];
                };
            };
            /**
             * @description The body is larger than a Publish can be, a mebibyte. Nothing
             *     was committed.
             */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            /**
             * @description Some Change breaks the page's Field definitions at `main` HEAD, or
             *     is not for one of its Fields or Lists (V1). A page with no content
             *     at `main` HEAD has neither, so each of its Changes is `unknown`.
             *     The content the Changes that merge would make must pass the
             *     Field definitions as a whole, so a violation can also be where no
             *     Change is, in content already on `main` (N3). Nothing was
             *     committed.
             */
            readonly 422: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "violations": [
                     *         {
                     *           "path": "hero.title",
                     *           "limit": "maxChars"
                     *         },
                     *         {
                     *           "path": "plans.1.features",
                     *           "limit": "maxItems"
                     *         }
                     *       ]
                     *     }
                     */
                    readonly "application/json": components["schemas"]["Violations"];
                };
            };
            /**
             * @description The Site has published too often lately (V5). Nothing was
             *     committed.
             */
            readonly 429: {
                headers: {
                    /** @description How many seconds to wait before the Site can publish again. */
                    readonly "Retry-After": number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            /**
             * @description The Site repository can't be published as it is: its content or
             *     Field definitions at `main` HEAD can't be read, its
             *     `package.json` has no `X.Y.Z` version to bump, or the
             *     edity-publisher GitHub App is not installed on it or lacks a
             *     permission. Nothing was committed, and the Developer has to fix
             *     the repository.
             */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
            /**
             * @description The Publish did not go through for now: GitHub could not be
             *     reached or is limiting the server's requests, or `main` kept
             *     moving while the server committed. The Client can publish again
             *     later.
             */
            readonly 503: {
                headers: {
                    /** @description How many seconds to wait before publishing again, when the server knows. */
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
        };
    };
    readonly getPublishStatus: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                /**
                 * @description The commit's sha, as Publish answered it.
                 * @example 4f9d2c1a7b3e8f60d5a9c2b1e7f40386a5d1c9e2
                 */
                readonly sha: components["schemas"]["Sha"];
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description The Release's progress. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "stage": "releasing",
                     *       "version": "1.4.3"
                     *     }
                     */
                    readonly "application/json": components["schemas"]["PublishStatus"];
                };
            };
            readonly 401: components["responses"]["NoSession"];
            readonly 403: components["responses"]["ForeignOrigin"];
            /**
             * @description The hostname is not one of a configured Site's, or `sha` is not a
             *     commit of the Site's repository.
             */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": components["schemas"]["Message"];
                };
            };
        };
    };
}
export interface ContentValueArray extends ReadonlyArray<components["schemas"]["ContentValue"]> {
}

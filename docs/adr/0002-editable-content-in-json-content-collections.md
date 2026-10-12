# Editable content lives in JSON, validated against Field definitions read from `main`

Sites used to keep their content in typed TS modules under `src/data/`. During Migration, editable content moves to one JSON file per page, loaded through an Astro content collection. The Developer writes that page's Field definitions in TS using Edity's primitives (`text`, `number`, `list`), which keeps templates fully typed. The integration also generates a committed copy of the Field definitions as JSON Schema 2020-12 (through Zod 4's `toJSONSchema`), extended with a small Edity vocabulary for Limits that JSON Schema cannot express, such as visible characters (graphemes) and lines. The build fails if that copy is stale.

The shared save service cannot import a Site's TS code, so on every Publish it reads the content and the generated Field definitions from GitHub at `main` HEAD, validates the Draft against them and commits on top of that exact sha. Validating against the live Site instead would accept content that `main` has since tightened, which breaks the build.

## Considered Options

- **Rewriting the TS modules through an AST**: rejected as fragile.
- **Writing the Field definitions directly in JSON**: rejected because TS loses literal types on JSON imports, so templates would be loosely typed.
- **A descriptor emitted into the build and fetched from the live Site**: rejected because it can be behind `main`.
- **YAML for content**: rejected in favour of JSON, which needs no extra parser and has a single way to write each value.

## Consequences

Images stay in TS modules, joined to the JSON content by key, until image replacement is in scope.

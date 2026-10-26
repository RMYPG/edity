# contracts

The content contract that the TypeScript validator in `@edity/core` and the Go validator in `edity-server` both follow (ADR-0005). `@edity/core` generates a page's JSON Schema from its Field definitions. The Site build validates content with the Field definitions, and the server validates a Draft with the JSON Schema, so the two must give the same verdict on the same content. This folder holds the meta-schemas of the Edity dialect of JSON Schema and conformance fixtures that pin that verdict. It is also the Go module `github.com/RMYPG/edity/contracts`, which embeds them.

| Path                        | What it holds                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `meta/schema.json`          | The Edity dialect: JSON Schema 2020-12 plus the Limits vocabulary                                                        |
| `meta/limits.json`          | The Limits vocabulary's meta-schema: its keywords and the values they take                                               |
| `fixtures/keywords/*.json`  | Each keyword of the vocabulary on its own, and what the dialect accepts as a schema                                      |
| `fixtures/pages/*.json`     | Page schemas exactly as `@edity/core` generates them, with Drafts                                                        |
| `contracts.go`              | The Go package: the embedded files, the URIs, and loaders for the meta-schemas and fixtures                              |
| `contracts_test.go`         | A reference Go implementation of the vocabulary, which runs every fixture                                                |
| `testdata/test-schema.json` | The JSON Schema Test Suite's schema for its files, which the fixtures follow. Vendored as is from commit `89e83a7` (MIT) |

`LICENSE` is a copy of the repository's: a Go module holds only its own folder.

## The dialect and the Limits vocabulary

| URI                                                        | Identifies                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `https://github.com/RMYPG/edity/contracts/v1/schema`       | The dialect, named in the `$schema` of every page's JSON Schema |
| `https://github.com/RMYPG/edity/contracts/v1/vocab/limits` | The Limits vocabulary, which the dialect's `$vocabulary` lists  |
| `https://github.com/RMYPG/edity/contracts/v1/meta/limits`  | The vocabulary's meta-schema                                    |

The URIs only identify. Nothing is served at them, and a validator never fetches them: it loads the meta-schemas from this module or these files before it compiles a page's schema. An editor that downloads `$schema`, such as VS Code, warns that it cannot load the dialect when a Developer opens a page's schema file. That warning is harmless.

The dialect lists the Limits vocabulary as required, so a validator that does not implement it must refuse a page's schema instead of ignoring its Limits. santhosh-tekuri/jsonschema does. Ajv ignores `$vocabulary` and refuses unknown keywords in strict mode instead, so never run it with `strict: false`.

| Keyword                  | Kind       | Valid when                                                                                                                                                     |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-edity-maxGraphemes`   | Assertion  | The instance is not a string, or it has at most N extended grapheme clusters (Unicode UAX #29, from Unicode 15.1)                                              |
| `x-edity-decimals`       | Assertion  | The instance is not a number, or its shortest round-trip decimal form as an IEEE 754 double, written without an exponent, has at most N digits after the point |
| `x-edity-maxLines`       | Annotation | Always. The Editor measures rendered lines                                                                                                                     |
| `x-edity-maxLinesNarrow` | Annotation | Always. The Editor measures rendered lines on narrow screens                                                                                                   |

Every value is a whole number, at least 1, or at least 0 for `x-edity-decimals`. The `x-edity-` prefix belongs to the vocabulary: any other keyword with it makes the schema invalid, so a validator that predates a new keyword refuses a schema that uses it.

Everything else in a page's schema is standard JSON Schema: `type`, `properties`, `required` (every Field) and `additionalProperties: false` for the page, its groups and its Items; `minItems` and `maxItems` for a List; `minimum` and `maximum` for a number Field, with `"type": "integer"` when it allows no decimals; and a `pattern` that requires one line with at least one visible character in a text Field. For an implementation:

- Compile `pattern` with Unicode semantics, as ECMA-262 does with the `u` flag (Ajv's default). The pattern avoids `\s` and `\u` escapes, so Go's RE2 reads it the same.
- Count graphemes with a library on Unicode 15.1 or later. In Go, `github.com/clipperhouse/uax29/v2` is on Unicode 17, like Node 24. `github.com/rivo/uniseg` v0.4.7 is on Unicode 15.0 and fails the Indic conjunct case in `fixtures/keywords/maxGraphemes.json`.
- Count decimals on the double, not on the JSON text: `1.0` has none and `1e-7` has seven. In Go, `strconv.FormatFloat(f, 'f', -1, 64)` gives the shortest form.
- Do not check decimals with a float `multipleOf`: Ajv rejects 19.99 against `multipleOf: 0.01`.
- A validator that compares numbers as exact decimals, like santhosh-tekuri, is never more lenient on `minimum` and `maximum` than one that compares doubles. The fixtures only use numbers that both read alike.

## Fixtures

Each file follows the [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) format: a list of cases `{ description, comment?, schema, tests }`, where each test is `{ description, comment?, data, valid }`.

- `fixtures/keywords/` tests the vocabulary: grapheme counting (emoji, combining accents, an Indic conjunct), decimals and the annotations. `meta-schema.json` tests which keyword values the dialect accepts, with the dialect as the case's schema and schemas as the data.
- `fixtures/pages/` tests page schemas: text Fields (blank text, line breaks), number ranges and decimals, List bounds, Lists in Items, groups, unknown and missing Fields, and wrong types. Each schema is exactly what `@edity/core` generates.

Who runs them:

- `packages/core/src/contract.test.ts` runs every fixture with Ajv (JSON Schema 2020-12, strict), whose Limits keywords count with core's own rules. For a page fixture it also reads the Field definitions back from the schema, checks that core generates the same schema from them, and checks that the Field definitions give each Draft the same verdict as the JSON Schema.
- `contracts_test.go` runs every fixture with santhosh-tekuri/jsonschema and a reference implementation of the vocabulary, and checks the fixtures against the test suite's format.
- `edity-server` runs every fixture of the version it pins, with its own implementation.

`mise run test` runs the first two. A new fixture goes in `fixtures/keywords/` or `fixtures/pages/`: `go:embed` leaves out a file anywhere else, and the Go tests fail.

## Using it from Go

```go
import "github.com/RMYPG/edity/contracts"

c := jsonschema.NewCompiler()
c.RegisterVocabulary(limits) // your implementation of contracts.VocabularyURL
for _, meta := range contracts.MetaSchemas() {
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(meta.JSON))
	// ...
	c.AddResource(meta.URL, doc)
}

fixtures, err := contracts.Fixtures() // every file, with its cases and tests
```

`contracts_test.go` shows the whole thing with santhosh-tekuri/jsonschema v6.

## Versions

Tags are `contracts/vX.Y.Z`. A Go module in a subfolder takes the folder as a prefix on its tags, and `go get` names the version without it.

- **Patch**: fixtures added or fixed, with no change to what content is valid.
- **Minor**: a new keyword, or additions to the Go package. Update `edity-server` before a Site generates a schema with the new keyword: older validators refuse it.
- **Major**: a keyword changes meaning. The URIs get `v2` in place of `v1`, and the module path becomes `github.com/RMYPG/edity/contracts/v2`, tagged `contracts/v2.X.Y`.

## Releasing

1. Merge into `main` and wait for CI.
2. Check that the version would resolve, before pushing anything: `mise run contracts:fetch --local v0.1.0`. It tags the committed `HEAD` in a scratch clone, fetches the module from there with `go get`, as the Go proxy would from GitHub, and loads its files in a scratch module.
3. Tag the commit on `main` and push the tag:

   ```sh
   git tag -a contracts/v0.1.0 -m "contracts v0.1.0"
   git push origin contracts/v0.1.0
   ```

4. Check the published version: `mise run contracts:fetch v0.1.0` fetches it through `proxy.golang.org` and the checksum database. That also makes it appear on pkg.go.dev.
5. In `edity-server`: `go get github.com/RMYPG/edity/contracts@v0.1.0`.

The Go proxy and the checksum database keep a version forever, so never move or delete a pushed tag. Fix a bad version with a new patch version, and add a `retract` directive for the bad one to `go.mod`.

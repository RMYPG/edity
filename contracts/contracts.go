// Package contracts holds Edity's content contract: the meta-schemas of the
// Edity dialect of JSON Schema 2020-12 and its Limits vocabulary, and the
// conformance fixtures that every validator of Edity content must pass.
//
// @edity/core generates a page's JSON Schema from its Field definitions, and
// that schema names the dialect in "$schema". The Site build validates
// content with the Field definitions themselves, and the save service
// validates a Draft with the JSON Schema, so both must give the same verdict
// on the same content. The fixtures pin that verdict.
//
// The meta-schemas are embedded and identified by URIs that are not meant to
// be fetched: load them into the validator before compiling a page's schema.
package contracts

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
)

// The URIs of the dialect, the Limits vocabulary and its meta-schema. Only
// identifiers: nothing is served at them. An incompatible change to the
// contract gets new URIs, with v2 in place of v1.
const (
	// DialectURL is the "$schema" of every page's JSON Schema and the "$id"
	// of meta/schema.json.
	DialectURL = "https://github.com/RMYPG/edity/contracts/v1/schema"
	// VocabularyURL names the Limits vocabulary in the dialect's
	// "$vocabulary", as required.
	VocabularyURL = "https://github.com/RMYPG/edity/contracts/v1/vocab/limits"
	// VocabularyMetaSchemaURL is the "$id" of meta/limits.json, which
	// describes the values the vocabulary's keywords take.
	VocabularyMetaSchemaURL = "https://github.com/RMYPG/edity/contracts/v1/meta/limits"
)

// FS holds the contract's files: meta/schema.json, meta/limits.json and the
// fixtures in fixtures/*/*.json.
//
//go:embed meta/*.json fixtures/*/*.json
var FS embed.FS

// A MetaSchema is one of the contract's meta-schemas, to load into a
// validator under its URL.
type MetaSchema struct {
	URL  string
	JSON []byte
}

// MetaSchemas returns the dialect's meta-schema and the Limits vocabulary's
// meta-schema. A page's JSON Schema compiles once both are loaded under their
// URLs and the vocabulary is implemented.
func MetaSchemas() []MetaSchema {
	return []MetaSchema{
		{URL: DialectURL, JSON: mustRead("meta/schema.json")},
		{URL: VocabularyMetaSchemaURL, JSON: mustRead("meta/limits.json")},
	}
}

func mustRead(name string) []byte {
	b, err := FS.ReadFile(name)
	if err != nil {
		panic(err) // the file is embedded, so this cannot happen
	}
	return b
}

// A Fixture is one file of conformance tests, in the JSON Schema Test Suite
// format.
type Fixture struct {
	// Path is the file's path in FS, such as "fixtures/pages/lists.json".
	Path  string
	Cases []Case
}

// A Case is a schema and the instances to validate against it.
type Case struct {
	Description string `json:"description"`
	Comment     string `json:"comment,omitempty"`
	// Schema is the schema as raw JSON, so the validator can decode it in its
	// own way, for example with numbers as json.Number.
	Schema json.RawMessage `json:"schema"`
	Tests  []Test          `json:"tests"`
}

// A Test is one instance and whether it is valid against its Case's schema.
type Test struct {
	Description string `json:"description"`
	Comment     string `json:"comment,omitempty"`
	// Data is the instance as raw JSON.
	Data  json.RawMessage `json:"data"`
	Valid bool            `json:"valid"`
}

// Fixtures returns every fixture file, in lexical order of their paths. The
// files in fixtures/keywords test each keyword of the Limits vocabulary and
// the dialect's meta-schema. The files in fixtures/pages test page schemas
// exactly as @edity/core generates them, with Drafts as instances.
func Fixtures() ([]Fixture, error) {
	paths, err := fs.Glob(FS, "fixtures/*/*.json")
	if err != nil {
		return nil, err
	}
	fixtures := make([]Fixture, 0, len(paths))
	for _, path := range paths {
		b, err := FS.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var cases []Case
		if err := json.Unmarshal(b, &cases); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		fixtures = append(fixtures, Fixture{Path: path, Cases: cases})
	}
	return fixtures, nil
}

package contracts_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/RMYPG/edity/contracts"
	"github.com/clipperhouse/uax29/v2/graphemes"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"golang.org/x/text/message"
)

func TestMetaSchemasAreLoadedUnderTheirIDs(t *testing.T) {
	for _, meta := range contracts.MetaSchemas() {
		var doc struct {
			ID string `json:"$id"`
		}
		if err := json.Unmarshal(meta.JSON, &doc); err != nil {
			t.Fatalf("%s: %v", meta.URL, err)
		}
		if doc.ID != meta.URL {
			t.Errorf("the meta-schema loaded as %s has $id %s", meta.URL, doc.ID)
		}
	}
}

// go:embed only takes files that match its patterns, so a fixture in the
// wrong folder would be left out of the module without a word.
func TestEveryContractFileIsEmbedded(t *testing.T) {
	onDisk := jsonFiles(t, os.DirFS("."), "meta", "fixtures")
	embedded := jsonFiles(t, contracts.FS, ".")
	if !slices.Equal(onDisk, embedded) {
		t.Errorf("embedded %q, want every JSON file in meta/ and fixtures/: %q", embedded, onDisk)
	}
	for _, dir := range []string{"fixtures/keywords/", "fixtures/pages/"} {
		if !slices.ContainsFunc(embedded, func(path string) bool { return strings.HasPrefix(path, dir) }) {
			t.Errorf("no fixtures in %s", dir)
		}
	}
}

func jsonFiles(t *testing.T, fsys fs.FS, roots ...string) []string {
	t.Helper()
	var paths []string
	for _, root := range roots {
		err := fs.WalkDir(fsys, root, func(path string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() && strings.HasSuffix(path, ".json") {
				paths = append(paths, path)
			}
			return err
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	slices.Sort(paths)
	return paths
}

// testdata/test-schema.json is the JSON Schema Test Suite's own schema for
// its files.
func TestFixturesFollowTheTestSuiteFormat(t *testing.T) {
	c := jsonschema.NewCompiler()
	const url = "https://json-schema.org/tests/test-schema"
	if err := c.AddResource(url, decodeFile(t, os.DirFS("testdata"), "test-schema.json")); err != nil {
		t.Fatal(err)
	}
	format, err := c.Compile(url)
	if err != nil {
		t.Fatal(err)
	}
	paths, err := fs.Glob(contracts.FS, "fixtures/*/*.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		if err := format.Validate(decodeFile(t, contracts.FS, path)); err != nil {
			t.Errorf("%s: %v", path, err)
		}
	}
}

// Runs every fixture with the reference implementation of the Limits
// vocabulary below, so the contract checks itself. The save service has its
// own implementation and runs the same fixtures.
func TestFixtures(t *testing.T) {
	fixtures, err := contracts.Fixtures()
	if err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(strings.TrimPrefix(fixture.Path, "fixtures/"), func(t *testing.T) {
			for i, c := range fixture.Cases {
				t.Run(c.Description, func(t *testing.T) {
					schema := compile(t, fmt.Sprintf("urn:edity-fixture:%s:%d", fixture.Path, i), c.Schema)
					for _, test := range c.Tests {
						t.Run(test.Description, func(t *testing.T) {
							err := schema.Validate(decode(t, test.Data))
							if valid := err == nil; valid != test.Valid {
								t.Errorf("valid = %v, want %v (%v)", valid, test.Valid, err)
							}
						})
					}
				})
			}
		})
	}
}

// The dialect lists the Limits vocabulary as required, so a validator that
// does not implement it refuses a page's schema instead of ignoring its
// Limits.
func TestTheDialectRequiresTheLimitsVocabulary(t *testing.T) {
	c := jsonschema.NewCompiler()
	addMetaSchemas(t, c)
	const url = "urn:edity-test:page"
	page := `{"$schema": "` + contracts.DialectURL + `", "type": "string", "x-edity-maxGraphemes": 1}`
	if err := c.AddResource(url, decode(t, []byte(page))); err != nil {
		t.Fatal(err)
	}
	_, err := c.Compile(url)
	var unsupported *jsonschema.UnsupportedVocabularyError
	if !errors.As(err, &unsupported) || unsupported.Vocabulary != contracts.VocabularyURL {
		t.Fatalf("compiled without the Limits vocabulary: err = %v", err)
	}
}

// ---------------------------------------------------------------------------
// A reference implementation of the Limits vocabulary, for santhosh-tekuri's
// validator.

func compile(t *testing.T, url string, schema json.RawMessage) *jsonschema.Schema {
	t.Helper()
	c := jsonschema.NewCompiler()
	c.RegisterVocabulary(limitsVocabulary(t))
	addMetaSchemas(t, c)
	if err := c.AddResource(url, decode(t, schema)); err != nil {
		t.Fatal(err)
	}
	compiled, err := c.Compile(url)
	if err != nil {
		t.Fatal(err)
	}
	return compiled
}

func addMetaSchemas(t *testing.T, c *jsonschema.Compiler) {
	t.Helper()
	for _, meta := range contracts.MetaSchemas() {
		if err := c.AddResource(meta.URL, decode(t, meta.JSON)); err != nil {
			t.Fatal(err)
		}
	}
}

func limitsVocabulary(t *testing.T) *jsonschema.Vocabulary {
	t.Helper()
	c := jsonschema.NewCompiler()
	addMetaSchemas(t, c)
	meta, err := c.Compile(contracts.VocabularyMetaSchemaURL)
	if err != nil {
		t.Fatal(err)
	}
	return &jsonschema.Vocabulary{
		URL:     contracts.VocabularyURL,
		Schema:  meta,
		Compile: compileLimits,
	}
}

// limits holds the assertions of one schema object. x-edity-maxLines and
// x-edity-maxLinesNarrow are annotations, so they have nothing to check.
type limits struct {
	maxGraphemes *int
	decimals     *int
}

func compileLimits(_ *jsonschema.CompilerContext, obj map[string]any) (jsonschema.SchemaExt, error) {
	var l limits
	for keyword, field := range map[string]**int{
		"x-edity-maxGraphemes": &l.maxGraphemes,
		"x-edity-decimals":     &l.decimals,
	} {
		v, ok := obj[keyword]
		if !ok {
			continue
		}
		// The meta-schema has checked that the value is a whole number.
		n, err := strconv.ParseFloat(fmt.Sprint(v), 64)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", keyword, err)
		}
		whole := int(n)
		*field = &whole
	}
	if l.maxGraphemes == nil && l.decimals == nil {
		return nil, nil
	}
	return &l, nil
}

func (l *limits) Validate(ctx *jsonschema.ValidatorContext, v any) {
	switch v := v.(type) {
	case string:
		if l.maxGraphemes == nil {
			return
		}
		if n := graphemeCount(v); n > *l.maxGraphemes {
			ctx.AddError(&tooManyGraphemes{max: *l.maxGraphemes, got: n})
		}
	case json.Number:
		if l.decimals == nil {
			return
		}
		f, err := strconv.ParseFloat(string(v), 64)
		if err != nil {
			ctx.AddErr(err)
			return
		}
		if n := decimalPlaces(f); n > *l.decimals {
			ctx.AddError(&tooManyDecimals{max: *l.decimals, got: n})
		}
	}
}

// graphemeCount counts extended grapheme clusters (UAX #29).
func graphemeCount(s string) int {
	n := 0
	for it := graphemes.FromString(s); it.Next(); {
		n++
	}
	return n
}

// decimalPlaces counts the fraction digits of the shortest decimal form of f,
// without an exponent.
func decimalPlaces(f float64) int {
	s := strconv.FormatFloat(f, 'f', -1, 64)
	if i := strings.IndexByte(s, '.'); i >= 0 {
		return len(s) - i - 1
	}
	return 0
}

type tooManyGraphemes struct{ max, got int }

func (*tooManyGraphemes) KeywordPath() []string { return []string{"x-edity-maxGraphemes"} }

func (k *tooManyGraphemes) LocalizedString(p *message.Printer) string {
	return p.Sprintf("%d visible characters, want at most %d", k.got, k.max)
}

type tooManyDecimals struct{ max, got int }

func (*tooManyDecimals) KeywordPath() []string { return []string{"x-edity-decimals"} }

func (k *tooManyDecimals) LocalizedString(p *message.Printer) string {
	return p.Sprintf("%d decimals, want at most %d", k.got, k.max)
}

// ---------------------------------------------------------------------------

// decode reads JSON as the validator expects it, with numbers as json.Number.
func decode(t *testing.T, b []byte) any {
	t.Helper()
	v, err := jsonschema.UnmarshalJSON(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func decodeFile(t *testing.T, fsys fs.FS, path string) any {
	t.Helper()
	b, err := fs.ReadFile(fsys, path)
	if err != nil {
		t.Fatal(err)
	}
	return decode(t, b)
}

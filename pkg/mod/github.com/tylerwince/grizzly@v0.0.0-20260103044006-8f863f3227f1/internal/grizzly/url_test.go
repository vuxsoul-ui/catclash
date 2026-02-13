package grizzly

import (
	"net/url"
	"testing"
)

func TestBuildURL(t *testing.T) {
	params := url.Values{}
	params.Set("id", "7E4B681B")
	params.Set("header", "Secondary Title")

	got := BuildURL("/open-note", params)
	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	if parsed.Scheme != "bear" {
		t.Fatalf("scheme = %q", parsed.Scheme)
	}
	if parsed.Host != "x-callback-url" {
		t.Fatalf("host = %q", parsed.Host)
	}
	if parsed.Path != "/open-note" {
		t.Fatalf("path = %q", parsed.Path)
	}
	q := parsed.Query()
	if q.Get("id") != "7E4B681B" {
		t.Fatalf("id = %q", q.Get("id"))
	}
	if q.Get("header") != "Secondary Title" {
		t.Fatalf("header = %q", q.Get("header"))
	}
}

func TestParseCallbackValues(t *testing.T) {
	values := url.Values{}
	values.Set("note", "hello")
	values.Set("identifier", "ABC")
	values.Set("tags", `[{"name":"work"},{"name":"todo"}]`)
	values.Set("notes", `[{"title":"Note","identifier":"123"}]`)

	data := ParseCallbackValues(values)
	if data["note"] != "hello" {
		t.Fatalf("note = %v", data["note"])
	}
	if data["identifier"] != "ABC" {
		t.Fatalf("identifier = %v", data["identifier"])
	}

	parsedTags, ok := data["tags"].([]any)
	if !ok || len(parsedTags) != 2 {
		t.Fatalf("tags type or length = %#v", data["tags"])
	}
	firstTag, ok := parsedTags[0].(map[string]any)
	if !ok || firstTag["name"] != "work" {
		t.Fatalf("first tag = %#v", parsedTags[0])
	}

	parsedNotes, ok := data["notes"].([]any)
	if !ok || len(parsedNotes) != 1 {
		t.Fatalf("notes type or length = %#v", data["notes"])
	}
	firstNote, ok := parsedNotes[0].(map[string]any)
	if !ok || firstNote["identifier"] != "123" {
		t.Fatalf("first note = %#v", parsedNotes[0])
	}
}

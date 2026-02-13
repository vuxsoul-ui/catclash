package grizzly

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestOutputJSONSuccess(t *testing.T) {
	bufOut := &bytes.Buffer{}
	bufErr := &bytes.Buffer{}
	opts := &Options{JSON: true}
	out := &Outputter{opts: opts, stdout: bufOut, stderr: bufErr}

	res := Result{Action: "open-note", URL: "bear://x-callback-url/open-note?id=123", Data: map[string]any{"identifier": "123"}}
	out.WriteSuccess(res)

	var payload struct {
		OK     bool           `json:"ok"`
		Action string         `json:"action"`
		URL    string         `json:"url"`
		Data   map[string]any `json:"data"`
		Error  any            `json:"error"`
	}
	if err := json.Unmarshal(bufOut.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !payload.OK {
		t.Fatalf("expected ok")
	}
	if payload.Action != "open-note" {
		t.Fatalf("action = %q", payload.Action)
	}
	if payload.URL == "" {
		t.Fatalf("url empty")
	}
	if payload.Data["identifier"] != "123" {
		t.Fatalf("identifier = %v", payload.Data["identifier"])
	}
}

func TestOutputPlainSuccess(t *testing.T) {
	bufOut := &bytes.Buffer{}
	bufErr := &bytes.Buffer{}
	opts := &Options{Plain: true, PrintURL: true}
	out := &Outputter{opts: opts, stdout: bufOut, stderr: bufErr}

	res := Result{Action: "create", URL: "bear://x-callback-url/create", Data: map[string]any{"title": "Note", "identifier": "ABC"}}
	out.WriteSuccess(res)

	lines := strings.Split(strings.TrimSpace(bufOut.String()), "\n")
	got := map[string]string{}
	for _, line := range lines {
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			got[parts[0]] = parts[1]
		}
	}
	if got["ok"] != "true" {
		t.Fatalf("ok = %q", got["ok"])
	}
	if got["action"] != "create" {
		t.Fatalf("action = %q", got["action"])
	}
	if got["url"] == "" {
		t.Fatalf("url empty")
	}
	if got["title"] != "Note" {
		t.Fatalf("title = %q", got["title"])
	}
	if got["identifier"] != "ABC" {
		t.Fatalf("identifier = %q", got["identifier"])
	}
}

func TestOutputHumanNote(t *testing.T) {
	bufOut := &bytes.Buffer{}
	bufErr := &bytes.Buffer{}
	opts := &Options{}
	out := &Outputter{opts: opts, stdout: bufOut, stderr: bufErr}

	res := Result{Data: map[string]any{"note": "hello"}}
	out.WriteSuccess(res)

	if bufOut.String() != "hello\n" {
		t.Fatalf("output = %q", bufOut.String())
	}
}

func TestOutputJSONError(t *testing.T) {
	bufOut := &bytes.Buffer{}
	bufErr := &bytes.Buffer{}
	opts := &Options{JSON: true}
	out := &Outputter{opts: opts, stdout: bufOut, stderr: bufErr}

	res := Result{Action: "open-note"}
	err := out.WriteError(res, ErrorInfo{Message: "bad", Code: "x-error"}, ExitCallback)
	if err == nil {
		t.Fatalf("expected error")
	}

	var payload struct {
		OK    bool       `json:"ok"`
		Error *ErrorInfo `json:"error"`
	}
	if err := json.Unmarshal(bufOut.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if payload.OK {
		t.Fatalf("expected ok=false")
	}
	if payload.Error == nil || payload.Error.Message != "bad" {
		t.Fatalf("error = %#v", payload.Error)
	}
}

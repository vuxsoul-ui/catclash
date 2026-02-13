package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestAuthCommandMissingToken(t *testing.T) {
	t.Setenv("THINGS_AUTH_TOKEN", "")

	out := &bytes.Buffer{}
	app := &App{
		In:  strings.NewReader(""),
		Out: out,
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"auth"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	if !strings.Contains(out.String(), "Things auth token: not set.") {
		t.Fatalf("unexpected output: %q", out.String())
	}
	if !strings.Contains(out.String(), "export THINGS_AUTH_TOKEN") {
		t.Fatalf("expected setup instructions, got %q", out.String())
	}
}

func TestAuthCommandWithToken(t *testing.T) {
	t.Setenv("THINGS_AUTH_TOKEN", "token")

	out := &bytes.Buffer{}
	app := &App{
		In:  strings.NewReader(""),
		Out: out,
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"auth"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	if !strings.Contains(out.String(), "Things auth token: set (THINGS_AUTH_TOKEN).") {
		t.Fatalf("unexpected output: %q", out.String())
	}
}

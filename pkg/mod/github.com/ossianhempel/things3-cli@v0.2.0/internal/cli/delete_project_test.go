package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestDeleteProjectCommandRequiresTarget(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-project"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
	if runner.script != "" {
		t.Fatalf("expected no script execution")
	}
}

func TestDeleteProjectCommandWithID(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-project", "--id", "ABC123", "--confirm", "ABC123"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "first project whose id is \"ABC123\"") {
		t.Fatalf("expected id lookup in script, got %q", script)
	}
	if !strings.Contains(script, "delete targetProject") {
		t.Fatalf("expected delete in script, got %q", script)
	}
}

func TestDeleteProjectCommandWithTitle(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-project", "Launch", "--confirm", "Launch"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "project \"Launch\"") {
		t.Fatalf("expected title lookup in script, got %q", script)
	}
	if !strings.Contains(script, "delete targetProject") {
		t.Fatalf("expected delete in script, got %q", script)
	}
}

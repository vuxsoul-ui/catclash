package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestDeleteAreaCommandRequiresTarget(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-area"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
	if runner.script != "" {
		t.Fatalf("expected no script execution")
	}
}

func TestDeleteAreaCommandWithID(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-area", "--id", "ABC123", "--confirm", "ABC123"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "first area whose id is \"ABC123\"") {
		t.Fatalf("expected id lookup in script, got %q", script)
	}
	if !strings.Contains(script, "delete targetArea") {
		t.Fatalf("expected delete in script, got %q", script)
	}
}

func TestDeleteAreaCommandWithTitle(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"delete-area", "Home", "--confirm", "Home"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "area \"Home\"") {
		t.Fatalf("expected title lookup in script, got %q", script)
	}
	if !strings.Contains(script, "delete targetArea") {
		t.Fatalf("expected delete in script, got %q", script)
	}
}

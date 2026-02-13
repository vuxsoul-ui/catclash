package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestUpdateAreaCommandRequiresTarget(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-area", "--tags", "Home"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
	if runner.script != "" {
		t.Fatalf("expected no script execution")
	}
}

func TestUpdateAreaCommandWithIDAddTags(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-area", "--id", "ABC123", "--add-tags", "Focus"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "first area whose id is \"ABC123\"") {
		t.Fatalf("expected id lookup in script, got %q", script)
	}
	if !strings.Contains(script, "tag names of targetArea to \"Focus\"") {
		t.Fatalf("expected tag names in script, got %q", script)
	}
}

func TestUpdateAreaCommandWithTitle(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-area", "--id", "ABC123", "--title", "Renamed"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "set name of targetArea to \"Renamed\"") {
		t.Fatalf("expected title update in script, got %q", script)
	}
}

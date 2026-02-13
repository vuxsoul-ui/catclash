package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestAddAreaCommandWithTitle(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"add-area", "Home"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "make new area") {
		t.Fatalf("expected make new area in script, got %q", script)
	}
	if !strings.Contains(script, "name:\"Home\"") {
		t.Fatalf("expected name in script, got %q", script)
	}
}

func TestAddAreaCommandWithTags(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"add-area", "--tags", "Focus,Home", "Work"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "tag names of newArea to \"Focus,Home\"") {
		t.Fatalf("expected tag names in script, got %q", script)
	}
}

func TestCreateAreaAlias(t *testing.T) {
	runner := &recordScriptRunner{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Scripter: runner,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"create-area", "Studio"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	script := requireScript(t, runner)
	if !strings.Contains(script, "name:\"Studio\"") {
		t.Fatalf("expected name in script, got %q", script)
	}
}

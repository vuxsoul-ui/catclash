package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestShowCommandWithQuery(t *testing.T) {
	dbPath := writeTestDB(t)
	app := &App{
		In:  strings.NewReader(""),
		Out: &bytes.Buffer{},
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"show", "--db", dbPath, "Project One"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	output := app.Out.(*bytes.Buffer).String()
	if !strings.Contains(output, "project") || !strings.Contains(output, "Project One") {
		t.Fatalf("unexpected output: %q", output)
	}
}

func TestShowCommandWithID(t *testing.T) {
	dbPath := writeTestDB(t)
	app := &App{
		In:  strings.NewReader(""),
		Out: &bytes.Buffer{},
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"show", "--db", dbPath, "--id", "A1"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	output := app.Out.(*bytes.Buffer).String()
	if !strings.Contains(output, "area") || !strings.Contains(output, "Home") {
		t.Fatalf("unexpected output: %q", output)
	}
}

func TestShowCommandRequiresTarget(t *testing.T) {
	app := &App{
		In:  strings.NewReader(""),
		Out: &bytes.Buffer{},
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"show"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
}

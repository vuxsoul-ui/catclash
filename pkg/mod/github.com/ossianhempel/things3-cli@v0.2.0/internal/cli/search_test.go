package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestSearchCommandEmpty(t *testing.T) {
	dbPath := writeTestDB(t)
	app := &App{
		In:  strings.NewReader(""),
		Out: &bytes.Buffer{},
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"search", "--db", dbPath})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
}

func TestSearchCommandWithQuery(t *testing.T) {
	dbPath := writeTestDB(t)
	app := &App{
		In:  strings.NewReader(""),
		Out: &bytes.Buffer{},
		Err: &bytes.Buffer{},
	}

	root := NewRoot(app)
	root.SetArgs([]string{"search", "--db", dbPath, "notes"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	output := app.Out.(*bytes.Buffer).String()
	if !strings.Contains(output, "Task One") {
		t.Fatalf("unexpected output: %q", output)
	}
}

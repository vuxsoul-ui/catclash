package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestAddProjectCommandWithTitle(t *testing.T) {
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"add-project", "New Project"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	url := requireOpenURL(t, launcher)
	if !strings.Contains(url, "title=New%20Project") {
		t.Fatalf("expected title in url, got %q", url)
	}
}

func TestAddProjectCommandReadsStdin(t *testing.T) {
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader("Title\n\nNotes"),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"add-project", "-"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	url := requireOpenURL(t, launcher)
	if !strings.Contains(url, "title=Title") {
		t.Fatalf("expected title in url, got %q", url)
	}
	if !strings.Contains(url, "notes=Notes") {
		t.Fatalf("expected notes in url, got %q", url)
	}
}

func TestCreateProjectAlias(t *testing.T) {
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"create-project", "Project Alias"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	url := requireOpenURL(t, launcher)
	if !strings.Contains(url, "title=Project%20Alias") {
		t.Fatalf("expected title in url, got %q", url)
	}
}

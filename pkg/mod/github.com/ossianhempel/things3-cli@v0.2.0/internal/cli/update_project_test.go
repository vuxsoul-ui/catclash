package cli

import (
	"bytes"
	"strings"
	"testing"
)

func TestUpdateProjectCommandRequiresAuthToken(t *testing.T) {
	t.Setenv("THINGS_AUTH_TOKEN", "")
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-project", "--id", "123", "Title"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error")
	}
	if len(launcher.args) != 0 {
		t.Fatalf("expected no open invocation")
	}
}

func TestUpdateProjectCommandWithAuthAndID(t *testing.T) {
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-project", "--auth-token", "tok", "--id", "123", "Title"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	url := requireOpenURL(t, launcher)
	if !strings.Contains(url, "auth-token=tok") {
		t.Fatalf("expected auth-token in url, got %q", url)
	}
	if !strings.Contains(url, "id=123") {
		t.Fatalf("expected id in url, got %q", url)
	}
}

func TestUpdateProjectCommandAddTags(t *testing.T) {
	launcher := &recordLauncher{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      &bytes.Buffer{},
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	root := NewRoot(app)
	root.SetArgs([]string{"update-project", "--auth-token", "tok", "--id", "123", "--add-tags", "Focus,Home"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	url := requireOpenURL(t, launcher)
	if !strings.Contains(url, "add-tags=Focus%2CHome") {
		t.Fatalf("expected add-tags in url, got %q", url)
	}
}

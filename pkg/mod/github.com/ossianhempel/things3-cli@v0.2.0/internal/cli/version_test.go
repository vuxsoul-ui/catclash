package cli

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestVersionFlagPrintsVersion(t *testing.T) {
	launcher := &recordLauncher{}
	out := &bytes.Buffer{}
	app := &App{
		In:       strings.NewReader(""),
		Out:      out,
		Err:      &bytes.Buffer{},
		Launcher: launcher,
	}

	Version = "v0.0.0-test"
	Author = "Test"
	Homepage = "https://example.com"
	os.Setenv("THINGS_VERSION", "0.0")
	t.Cleanup(func() { _ = os.Unsetenv("THINGS_VERSION") })

	root := NewRoot(app)
	root.SetArgs([]string{"--version"})
	root.SetOut(app.Out)
	root.SetErr(app.Err)

	if err := root.Execute(); err != nil && err != ErrVersionPrinted {
		t.Fatalf("unexpected error: %v", err)
	}

	output := out.String()
	if !strings.Contains(output, "things3-cli") {
		t.Fatalf("unexpected output: %q", output)
	}
	if !strings.Contains(output, "Version:  v0.0.0-test") {
		t.Fatalf("unexpected output: %q", output)
	}
}

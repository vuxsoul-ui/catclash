package integration_test

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

var binPath string

func TestMain(m *testing.M) {
	rootDir, err := findRepoRoot()
	if err != nil {
		panic(err)
	}
	tmpDir, err := os.MkdirTemp("", "things3-cli-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	binName := "things"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	binPath = filepath.Join(tmpDir, binName)

	build := exec.Command("go", "build", "-o", binPath, "./cmd/things")
	build.Dir = rootDir
	build.Stdout = os.Stdout
	build.Stderr = os.Stderr
	if err := build.Run(); err != nil {
		panic(err)
	}

	os.Exit(m.Run())
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}

func runThings(t *testing.T, stdin string, args ...string) (string, string, int) {
	t.Helper()
	cmd := exec.Command(binPath, args...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	cmd.Env = append(os.Environ(), "OPEN=echo", "OSASCRIPT=echo")

	err := cmd.Run()
	code := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		} else {
			t.Fatalf("run failed: %v", err)
		}
	}
	return strings.TrimSpace(outBuf.String()), strings.TrimSpace(errBuf.String()), code
}

package osascript

import (
	"fmt"
	"io"
	"os"
	"os/exec"
)

// Runner runs the configured osascript command (defaults to "osascript").
type Runner struct {
	Command string
	Stdout  io.Writer
	Stderr  io.Writer
}

// NewFromEnv builds a runner using the OSASCRIPT environment variable.
func NewFromEnv(stdout, stderr io.Writer) *Runner {
	cmd := os.Getenv("OSASCRIPT")
	if cmd == "" {
		cmd = "osascript"
	}
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}
	return &Runner{Command: cmd, Stdout: stdout, Stderr: stderr}
}

// Run executes osascript with the provided script.
func (r *Runner) Run(script string) error {
	cmdName := r.Command
	if cmdName == "" {
		cmdName = "osascript"
	}
	if _, err := exec.LookPath(cmdName); err != nil {
		return fmt.Errorf("Error: `osascript` not found. Is this a Mac?")
	}

	cmd := exec.Command(cmdName, "-e", script)
	cmd.Stdout = r.Stdout
	cmd.Stderr = r.Stderr
	return cmd.Run()
}

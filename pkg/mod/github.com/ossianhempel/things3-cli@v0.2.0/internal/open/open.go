package open

import (
	"fmt"
	"io"
	"os"
	"os/exec"
)

// Launcher runs the configured opener command (defaults to "open").
type Launcher struct {
	Command string
	Stdout  io.Writer
	Stderr  io.Writer
}

// NewFromEnv builds a launcher using the OPEN environment variable.
func NewFromEnv(stdout, stderr io.Writer) *Launcher {
	cmd := os.Getenv("OPEN")
	if cmd == "" {
		cmd = "open"
	}
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}
	return &Launcher{Command: cmd, Stdout: stdout, Stderr: stderr}
}

// Open runs the opener command with the given arguments.
func (l *Launcher) Open(args ...string) error {
	cmdName := l.Command
	if cmdName == "" {
		cmdName = "open"
	}
	if _, err := exec.LookPath(cmdName); err != nil {
		return fmt.Errorf("Error: `open' not found. Is this a Mac?")
	}

	cmd := exec.Command(cmdName, args...)
	cmd.Stdout = l.Stdout
	cmd.Stderr = l.Stderr
	return cmd.Run()
}

package cli

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

func confirmDelete(app *App, kind string, expected string, confirm string) error {
	if app == nil {
		return fmt.Errorf("Error: internal app not set")
	}
	expected = strings.TrimSpace(expected)
	if expected == "" {
		return nil
	}
	if app.DryRun {
		return nil
	}
	if strings.TrimSpace(confirm) != "" {
		if strings.TrimSpace(confirm) != expected {
			return fmt.Errorf("Error: %s delete confirmation did not match", kind)
		}
		return nil
	}
	if !isInputTTY(app.In) {
		return fmt.Errorf("Error: Must specify --confirm=%s to delete %s when not running interactively (or use --dry-run to preview)", expected, kind)
	}

	fmt.Fprintf(app.Err, "Confirm delete of %s by typing %q: ", kind, expected)
	line, err := readLine(app.In)
	if err != nil {
		return err
	}
	if strings.TrimSpace(line) != expected {
		return fmt.Errorf("Error: %s delete confirmation did not match", kind)
	}
	return nil
}

func readLine(in io.Reader) (string, error) {
	reader := bufio.NewReader(in)
	line, err := reader.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

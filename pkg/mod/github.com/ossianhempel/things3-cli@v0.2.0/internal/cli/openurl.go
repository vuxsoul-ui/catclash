package cli

import (
	"fmt"
	"os"
	"strings"
)

func openURL(app *App, url string) error {
	if app == nil {
		return fmt.Errorf("Error: internal app not set")
	}
	if app.DryRun {
		fmt.Fprintln(app.Out, url)
		return nil
	}

	args := []string{url}
	if !app.Foreground {
		args = append([]string{"-g"}, args...)
	}

	if app.Debug {
		cmd := os.Getenv("OPEN")
		if cmd == "" {
			cmd = "open"
		}
		fmt.Fprintf(app.Err, "+ %s %s\n", cmd, strings.Join(args, " "))
	}
	return app.Launcher.Open(args...)
}

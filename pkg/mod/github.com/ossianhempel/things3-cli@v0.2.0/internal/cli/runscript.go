package cli

import (
	"fmt"
	"os"
	"strings"
)

func runScript(app *App, script string) error {
	if app == nil {
		return fmt.Errorf("Error: internal app not set")
	}
	if app.DryRun {
		fmt.Fprintln(app.Out, script)
		return nil
	}
	if app.Scripter == nil {
		return fmt.Errorf("Error: internal script runner not set")
	}

	if app.Debug {
		cmd := os.Getenv("OSASCRIPT")
		if cmd == "" {
			cmd = "osascript"
		}
		fmt.Fprintf(app.Err, "+ %s -e %s\n", cmd, strings.ReplaceAll(script, "\n", "\\n"))
	}
	return app.Scripter.Run(script)
}

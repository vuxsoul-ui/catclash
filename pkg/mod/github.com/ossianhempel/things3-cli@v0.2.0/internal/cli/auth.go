package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

const authSetupInstructions = `To set up the Things URL scheme token:
  1. Open Things 3.
  2. Settings -> General -> Things URLs.
  3. Copy the token (or enable "Allow 'things' CLI to access Things").
  4. export THINGS_AUTH_TOKEN=your_token_here

Tip: add the export to your shell profile (e.g. ~/.zshrc) to persist it.`

// NewAuthCommand builds the auth subcommand.
func NewAuthCommand(app *App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Show Things auth token status and setup help",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := authTokenFromEnv()
			if token == "" {
				fmt.Fprintln(app.Out, "Things auth token: not set.")
				fmt.Fprintln(app.Out)
				fmt.Fprintln(app.Out, authSetupInstructions)
				return nil
			}

			fmt.Fprintln(app.Out, "Things auth token: set (THINGS_AUTH_TOKEN).")
			fmt.Fprintln(app.Out, "Use update/update-project, or pass --auth-token to override.")
			return nil
		},
	}

	return cmd
}

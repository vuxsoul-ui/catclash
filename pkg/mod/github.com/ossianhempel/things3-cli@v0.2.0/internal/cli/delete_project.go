package cli

import (
	"github.com/ossianhempel/things3-cli/internal/things"
	"github.com/spf13/cobra"
)

// NewDeleteProjectCommand builds the delete-project subcommand.
func NewDeleteProjectCommand(app *App) *cobra.Command {
	opts := things.DeleteProjectOptions{}
	var confirm string

	cmd := &cobra.Command{
		Use:   "delete-project [OPTIONS...] [--] [-|TITLE]",
		Short: "Delete an existing project",
		RunE: func(cmd *cobra.Command, args []string) error {
			rawInput, err := readInput(app.In, args)
			if err != nil {
				return err
			}

			target := deleteConfirmTarget(opts.ID, rawInput)
			if err := confirmDelete(app, "project", target, confirm); err != nil {
				return err
			}

			script, err := things.BuildDeleteProjectScript(opts, rawInput)
			if err != nil {
				return err
			}
			return runScript(app, script)
		},
	}

	flags := cmd.Flags()
	flags.StringVar(&opts.ID, "id", "", "ID of the project to delete")
	flags.StringVar(&confirm, "confirm", "", "Confirm deletion by typing the project ID or title")

	return cmd
}

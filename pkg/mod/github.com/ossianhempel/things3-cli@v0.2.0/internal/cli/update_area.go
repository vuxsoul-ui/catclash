package cli

import (
	"github.com/ossianhempel/things3-cli/internal/things"
	"github.com/spf13/cobra"
)

// NewUpdateAreaCommand builds the update-area subcommand.
func NewUpdateAreaCommand(app *App) *cobra.Command {
	opts := things.UpdateAreaOptions{}

	cmd := &cobra.Command{
		Use:   "update-area [OPTIONS...] [--] [-|TITLE]",
		Short: "Update an existing area",
		RunE: func(cmd *cobra.Command, args []string) error {
			rawInput, err := readInput(app.In, args)
			if err != nil {
				return err
			}

			script, err := things.BuildUpdateAreaScript(opts, rawInput)
			if err != nil {
				return err
			}
			return runScript(app, script)
		},
	}

	flags := cmd.Flags()
	flags.StringVar(&opts.ID, "id", "", "ID of the area to update")
	flags.StringVar(&opts.Title, "title", "", "New title for the area")
	flags.StringVar(&opts.Tags, "tags", "", "Replace tags")
	flags.StringVar(&opts.AddTags, "add-tags", "", "Add tags")

	return cmd
}

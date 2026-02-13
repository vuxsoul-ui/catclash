package cli

import (
	"github.com/ossianhempel/things3-cli/internal/db"
	"github.com/spf13/cobra"
)

// NewTagsCommand builds the tags command.
func NewTagsCommand(app *App) *cobra.Command {
	var dbPath string
	var asJSON bool
	var noHeader bool

	cmd := &cobra.Command{
		Use:   "tags",
		Short: "List tags from the Things database",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, _, err := db.OpenDefault(dbPath)
			if err != nil {
				return formatDBError(err)
			}
			defer store.Close()

			tags, err := store.Tags()
			if err != nil {
				return formatDBError(err)
			}
			return printTags(app.Out, tags, asJSON, noHeader)
		},
	}

	cmd.Flags().StringVarP(&dbPath, "db", "d", "", "Path to Things database (overrides THINGSDB)")
	cmd.Flags().StringVar(&dbPath, "database", "", "Alias for --db")
	cmd.Flags().BoolVarP(&asJSON, "json", "j", false, "Output JSON")
	cmd.Flags().BoolVar(&noHeader, "no-header", false, "Suppress header row")

	return cmd
}

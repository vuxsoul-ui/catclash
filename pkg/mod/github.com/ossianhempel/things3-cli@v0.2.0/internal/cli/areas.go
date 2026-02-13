package cli

import (
	"github.com/ossianhempel/things3-cli/internal/db"
	"github.com/spf13/cobra"
)

// NewAreasCommand builds the areas command.
func NewAreasCommand(app *App) *cobra.Command {
	var dbPath string
	var asJSON bool
	var noHeader bool
	var recursive bool
	var onlyProjects bool

	cmd := &cobra.Command{
		Use:   "areas",
		Short: "List areas from the Things database",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, _, err := db.OpenDefault(dbPath)
			if err != nil {
				return formatDBError(err)
			}
			defer store.Close()

			if onlyProjects && !recursive {
				recursive = true
			}

			if recursive {
				status := db.StatusIncomplete
				filter := db.TaskFilter{
					Status:                &status,
					ExcludeTrashedContext: true,
				}
				items, err := store.AreasTree(filter, onlyProjects)
				if err != nil {
					return formatDBError(err)
				}
				return printTree(app.Out, items, asJSON)
			}

			areas, err := store.Areas()
			if err != nil {
				return formatDBError(err)
			}
			return printAreas(app.Out, areas, asJSON, noHeader)
		},
	}

	cmd.Flags().StringVarP(&dbPath, "db", "d", "", "Path to Things database (overrides THINGSDB)")
	cmd.Flags().StringVar(&dbPath, "database", "", "Alias for --db")
	cmd.Flags().BoolVarP(&asJSON, "json", "j", false, "Output JSON")
	cmd.Flags().BoolVar(&noHeader, "no-header", false, "Suppress header row")
	cmd.Flags().BoolVarP(&recursive, "recursive", "r", false, "Include nested projects/headings/todos")
	cmd.Flags().BoolVarP(&onlyProjects, "only-projects", "e", false, "Only include areas and projects")

	return cmd
}

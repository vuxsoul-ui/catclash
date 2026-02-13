package cli

import (
	"fmt"

	"github.com/ossianhempel/things3-cli/internal/db"
	"github.com/spf13/cobra"
)

// NewProjectsCommand builds the projects command.
func NewProjectsCommand(app *App) *cobra.Command {
	var dbPath string
	var status string
	var area string
	var includeTrashed bool
	var all bool
	var asJSON bool
	var noHeader bool
	var recursive bool
	var onlyProjects bool

	cmd := &cobra.Command{
		Use:   "projects",
		Short: "List projects from the Things database",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, _, err := db.OpenDefault(dbPath)
			if err != nil {
				return formatDBError(err)
			}
			defer store.Close()

			if onlyProjects && !recursive {
				recursive = true
			}

			statusFilter, err := db.ParseStatus(status)
			if err != nil {
				return fmt.Errorf("Error: %s", err)
			}
			if all {
				statusFilter = nil
				includeTrashed = true
			}

			areaID := ""
			if area != "" {
				areaID, err = store.ResolveAreaID(area)
				if err != nil {
					return fmt.Errorf("Error: %s", err)
				}
			}

			if recursive {
				filter := db.TaskFilter{
					Status:                statusFilter,
					IncludeTrashed:        includeTrashed,
					ExcludeTrashedContext: true,
					AreaID:                areaID,
				}
				items, err := store.ProjectsTree(filter, onlyProjects)
				if err != nil {
					return formatDBError(err)
				}
				return printTree(app.Out, items, asJSON)
			}

			projects, err := store.Projects(db.ProjectFilter{
				Status:         statusFilter,
				IncludeTrashed: includeTrashed,
				AreaID:         areaID,
			})
			if err != nil {
				return formatDBError(err)
			}
			return printProjects(app.Out, projects, asJSON, noHeader)
		},
	}

	cmd.Flags().StringVarP(&dbPath, "db", "d", "", "Path to Things database (overrides THINGSDB)")
	cmd.Flags().StringVar(&dbPath, "database", "", "Alias for --db")
	cmd.Flags().StringVar(&status, "status", "incomplete", "Filter by status: incomplete, completed, canceled, any")
	cmd.Flags().StringVarP(&area, "filter-area", "a", "", "Filter by area title or ID")
	cmd.Flags().StringVar(&area, "area", "", "Alias for --filter-area")
	cmd.Flags().BoolVar(&includeTrashed, "include-trashed", false, "Include trashed projects")
	cmd.Flags().BoolVar(&all, "all", false, "Include completed, canceled, and trashed projects")
	cmd.Flags().BoolVarP(&asJSON, "json", "j", false, "Output JSON")
	cmd.Flags().BoolVar(&noHeader, "no-header", false, "Suppress header row")
	cmd.Flags().BoolVarP(&recursive, "recursive", "r", false, "Include nested headings/todos")
	cmd.Flags().BoolVarP(&onlyProjects, "only-projects", "e", false, "Only include projects")

	return cmd
}

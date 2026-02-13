package cli

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/ossianhempel/things3-cli/internal/db"
	"github.com/spf13/cobra"
)

// NewShowCommand builds the show subcommand.
func NewShowCommand(app *App) *cobra.Command {
	var dbPath string
	var id string
	var asJSON bool
	var noHeader bool

	cmd := &cobra.Command{
		Use:   "show [OPTIONS...] [--] [-|QUERY]",
		Short: "Show an area, project, tag, or todo from the Things database",
		RunE: func(cmd *cobra.Command, args []string) error {
			query, err := readInput(app.In, args)
			if err != nil {
				return err
			}
			query = strings.TrimSpace(query)
			targetID := id
			if targetID == "" {
				targetID = query
			}
			if targetID == "" {
				return fmt.Errorf("Must specify --id=ID or query")
			}

			store, _, err := db.OpenDefault(dbPath)
			if err != nil {
				return formatDBError(err)
			}
			defer store.Close()

			if id != "" {
				item, err := store.ItemByID(id)
				if err != nil {
					if errors.Is(err, sql.ErrNoRows) {
						return fmt.Errorf("Error: item not found")
					}
					return formatDBError(err)
				}
				return printItem(app.Out, item, asJSON, noHeader)
			}

			items, err := store.ItemsByTitle(query)
			if err != nil {
				return formatDBError(err)
			}
			if len(items) == 0 {
				return fmt.Errorf("Error: item not found")
			}
			if len(items) > 1 {
				return fmt.Errorf("Error: found %d items with that title; use --id for an exact match", len(items))
			}
			return printItem(app.Out, &items[0], asJSON, noHeader)
		},
	}

	flags := cmd.Flags()
	flags.StringVarP(&dbPath, "db", "d", "", "Path to Things database (overrides THINGSDB)")
	flags.StringVar(&dbPath, "database", "", "Alias for --db")
	flags.StringVar(&id, "id", "", "ID of area/project/tag/todo")
	flags.BoolVarP(&asJSON, "json", "j", false, "Output JSON")
	flags.BoolVar(&noHeader, "no-header", false, "Suppress header row")

	return cmd
}

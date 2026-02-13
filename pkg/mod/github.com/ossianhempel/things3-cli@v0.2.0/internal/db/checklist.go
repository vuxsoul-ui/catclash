package db

import (
	"database/sql"
	"fmt"
	"strings"
)

func loadChecklistItems(conn *sql.DB, taskIDs []string) (map[string][]ChecklistItem, error) {
	if len(taskIDs) == 0 {
		return map[string][]ChecklistItem{}, nil
	}
	placeholders := make([]string, len(taskIDs))
	args := make([]any, len(taskIDs))
	for i, id := range taskIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(
		`SELECT uuid, title, status, "index", stopDate, creationDate, userModificationDate, task
		 FROM TMChecklistItem
		 WHERE task IN (%s)
		 ORDER BY task, "index"`,
		strings.Join(placeholders, ","),
	)
	rows, err := conn.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[string][]ChecklistItem, len(taskIDs))
	for rows.Next() {
		var item ChecklistItem
		var taskID string
		var stopDate sql.NullFloat64
		var created sql.NullFloat64
		var modified sql.NullFloat64
		if err := rows.Scan(&item.UUID, &item.Title, &item.Status, &item.Index, &stopDate, &created, &modified, &taskID); err != nil {
			return nil, err
		}
		if stopDate.Valid {
			item.StopDate = formatTimestamp(stopDate.Float64)
		}
		if created.Valid {
			item.Created = formatTimestamp(created.Float64)
		}
		if modified.Valid {
			item.Modified = formatTimestamp(modified.Float64)
		}
		items[taskID] = append(items[taskID], item)
	}
	return items, rows.Err()
}

package db

import (
	"database/sql"
	"testing"
	"time"
)

func TestTodayTasks(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := seedTodayDB(conn); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	store := &Store{conn: conn, path: ":memory:"}
	status := StatusIncomplete
	tasks, err := store.TodayTasks(TaskFilter{Status: &status, ExcludeTrashedContext: true})
	if err != nil {
		t.Fatalf("today tasks: %v", err)
	}

	titles := make(map[string]bool)
	for _, task := range tasks {
		titles[task.Title] = true
	}

	for _, want := range []string{"Anytime Today", "Someday Past", "Overdue"} {
		if !titles[want] {
			t.Fatalf("expected task %q in results", want)
		}
	}
	for _, unwanted := range []string{"Suppressed Deadline", "Someday Future", "Completed Today"} {
		if titles[unwanted] {
			t.Fatalf("did not expect task %q in results", unwanted)
		}
	}
}

func seedTodayDB(conn *sql.DB) error {
	statements := []string{
		`CREATE TABLE TMTask (
			uuid TEXT PRIMARY KEY,
			type INTEGER,
			status INTEGER,
			trashed INTEGER,
			title TEXT,
			notes TEXT,
			area TEXT,
			project TEXT,
			heading TEXT,
			start INTEGER,
			startDate INTEGER,
			deadline INTEGER,
			deadlineSuppressionDate INTEGER,
			creationDate REAL,
			userModificationDate REAL,
			stopDate REAL,
			"index" INTEGER,
			todayIndex INTEGER,
			rt1_recurrenceRule TEXT
		);`,
		`CREATE TABLE TMArea (uuid TEXT PRIMARY KEY, title TEXT, visible INTEGER, "index" INTEGER);`,
		`CREATE TABLE TMTag (uuid TEXT PRIMARY KEY, title TEXT, shortcut TEXT, parent TEXT);`,
		`CREATE TABLE TMTaskTag (tasks TEXT NOT NULL, tags TEXT NOT NULL);`,
	}
	for _, stmt := range statements {
		if _, err := conn.Exec(stmt); err != nil {
			return err
		}
	}

	today := thingsDate(time.Now())
	yesterday := thingsDate(time.Now().AddDate(0, 0, -1))
	future := thingsDate(time.Now().AddDate(0, 0, 2))

	inserts := []struct {
		uuid       string
		title      string
		start      int
		startDate  *int
		deadline   *int
		deadSuppr  *int
		status     int
		trashed    int
		index      *int
		recurrence *string
	}{
		{"T1", "Anytime Today", 1, &today, nil, nil, StatusIncomplete, 0, nil, nil},
		{"T2", "Someday Past", 2, &yesterday, nil, nil, StatusIncomplete, 0, nil, nil},
		{"T3", "Overdue", 1, nil, &yesterday, nil, StatusIncomplete, 0, nil, nil},
		{"T4", "Suppressed Deadline", 1, nil, &yesterday, intPtr(1), StatusIncomplete, 0, nil, nil},
		{"T5", "Someday Future", 2, &future, nil, nil, StatusIncomplete, 0, nil, nil},
		{"T6", "Completed Today", 1, &today, nil, nil, StatusCompleted, 0, nil, nil},
	}

	for _, item := range inserts {
		_, err := conn.Exec(
			`INSERT INTO TMTask (uuid, type, status, trashed, title, start, startDate, deadline, deadlineSuppressionDate, todayIndex, rt1_recurrenceRule)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.uuid,
			TaskTypeTodo,
			item.status,
			item.trashed,
			item.title,
			item.start,
			item.startDate,
			item.deadline,
			item.deadSuppr,
			item.index,
			item.recurrence,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func thingsDate(t time.Time) int {
	date := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return date.Year()<<16 | int(date.Month())<<12 | date.Day()<<7
}

func intPtr(v int) *int {
	return &v
}

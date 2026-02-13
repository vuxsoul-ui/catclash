package db

import (
	"database/sql"
	"testing"
	"time"
)

func TestListQueries(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := seedListDB(conn); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	store := &Store{conn: conn, path: ":memory:"}
	incomplete := StatusIncomplete
	filter := TaskFilter{Status: &incomplete, ExcludeTrashedContext: true}

	tasks, err := store.InboxTasks(filter)
	assertHasTask(t, tasks, err, "Inbox Task")
	tasks, err = store.AnytimeTasks(filter)
	assertHasTask(t, tasks, err, "Anytime Task")
	tasks, err = store.SomedayTasks(filter)
	assertHasTask(t, tasks, err, "Someday Task")
	tasks, err = store.UpcomingTasks(filter)
	assertHasTask(t, tasks, err, "Upcoming Task")
	tasks, err = store.DeadlinesTasks(filter)
	assertHasTask(t, tasks, err, "Deadline Task")

	any := TaskFilter{ExcludeTrashedContext: true}
	tasks, err = store.LogbookTasks(any)
	assertHasTask(t, tasks, err, "Completed Task")
	assertHasTask(t, tasks, err, "Canceled Task")
	tasks, err = store.CompletedTasks(any)
	assertHasTask(t, tasks, err, "Completed Task")
	tasks, err = store.CanceledTasks(any)
	assertHasTask(t, tasks, err, "Canceled Task")
	tasks, err = store.TrashTasks(any)
	assertHasTask(t, tasks, err, "Trashed Task")

	start, end := dayBoundsForTest()
	tasks, err = store.TasksCreatedBetween(start, end, any)
	assertHasTask(t, tasks, err, "Created Today Task")
	tasks, err = store.TasksCompletedBetween(start, end, any)
	assertHasTask(t, tasks, err, "Completed Task")
}

func seedListDB(conn *sql.DB) error {
	statements := []string{
		`CREATE TABLE TMArea (uuid TEXT PRIMARY KEY, title TEXT, visible INTEGER, "index" INTEGER);`,
		`CREATE TABLE TMTag (uuid TEXT PRIMARY KEY, title TEXT, shortcut TEXT, parent TEXT);`,
		`CREATE TABLE TMTaskTag (tasks TEXT NOT NULL, tags TEXT NOT NULL);`,
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
			rt1_recurrenceRule BLOB,
			todayIndex INTEGER
		);`,
		`CREATE TABLE TMChecklistItem (
			uuid TEXT PRIMARY KEY,
			userModificationDate REAL,
			creationDate REAL,
			title TEXT,
			status INTEGER,
			stopDate REAL,
			"index" INTEGER,
			task TEXT
		);`,
	}
	for _, stmt := range statements {
		if _, err := conn.Exec(stmt); err != nil {
			return err
		}
	}

	now := time.Now()
	today := thingsDate(now)
	tomorrow := thingsDate(now.AddDate(0, 0, 1))
	nowUnix := float64(now.Unix())

	if _, err := conn.Exec(`INSERT INTO TMArea (uuid, title, visible, "index") VALUES ('A1', 'Home', 1, 1);`); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title) VALUES ('P_DONE', ?, ?, 0, 'Done Project');`, TaskTypeProject, StatusCompleted); err != nil {
		return err
	}

	inserts := []struct {
		uuid      string
		title     string
		status    int
		trashed   int
		start     int
		startDate *int
		deadline  *int
		created   float64
		stopped   *float64
		project   *string
		area      *string
	}{
		{"INBOX1", "Inbox Task", StatusIncomplete, 0, 0, nil, nil, nowUnix, nil, nil, nil},
		{"ANY1", "Anytime Task", StatusIncomplete, 0, 1, nil, nil, nowUnix, nil, nil, nil},
		{"TODAY1", "Today Task", StatusIncomplete, 0, 1, &today, nil, nowUnix, nil, nil, nil},
		{"UP1", "Upcoming Task", StatusIncomplete, 0, 2, &tomorrow, nil, nowUnix, nil, nil, nil},
		{"SOM1", "Someday Task", StatusIncomplete, 0, 2, nil, nil, nowUnix, nil, nil, nil},
		{"DL1", "Deadline Task", StatusIncomplete, 0, 1, nil, &tomorrow, nowUnix, nil, nil, nil},
		{"COMP1", "Completed Task", StatusCompleted, 0, 1, nil, nil, nowUnix, floatPtr(nowUnix), nil, nil},
		{"CANC1", "Canceled Task", StatusCanceled, 0, 1, nil, nil, nowUnix, floatPtr(nowUnix), nil, nil},
		{"TRASH1", "Trashed Task", StatusIncomplete, 1, 1, nil, nil, nowUnix, nil, nil, nil},
		{"CRT1", "Created Today Task", StatusIncomplete, 0, 1, nil, nil, nowUnix, nil, nil, nil},
		{"PDT1", "Completed Project Task", StatusIncomplete, 0, 1, nil, nil, nowUnix, nil, strPtr("P_DONE"), nil},
	}

	for _, item := range inserts {
		_, err := conn.Exec(
			`INSERT INTO TMTask (uuid, type, status, trashed, title, start, startDate, deadline, creationDate, stopDate, project, area)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.uuid,
			TaskTypeTodo,
			item.status,
			item.trashed,
			item.title,
			item.start,
			item.startDate,
			item.deadline,
			item.created,
			item.stopped,
			item.project,
			item.area,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func assertHasTask(t *testing.T, tasks []Task, err error, title string) {
	t.Helper()
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	for _, task := range tasks {
		if task.Title == title {
			return
		}
	}
	t.Fatalf("expected task %q, got %#v", title, tasks)
}

func assertNotHasTask(t *testing.T, tasks []Task, title string) {
	t.Helper()
	for _, task := range tasks {
		if task.Title == title {
			t.Fatalf("did not expect task %q, got %#v", title, tasks)
		}
	}
}

func dayBoundsForTest() (time.Time, time.Time) {
	now := time.Now()
	loc := now.Location()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	return start, start.Add(24 * time.Hour)
}

func floatPtr(v float64) *float64 {
	return &v
}

func strPtr(v string) *string {
	return &v
}

package db

import (
	"database/sql"
	"testing"
	"time"
)

func TestProjectsAndTasksQueries(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := seedTestDB(conn); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	store := &Store{conn: conn, path: ":memory:"}
	status := StatusIncomplete
	projects, err := store.Projects(ProjectFilter{Status: &status})
	if err != nil {
		t.Fatalf("projects: %v", err)
	}
	if len(projects) != 1 || projects[0].Title != "Project One" {
		t.Fatalf("unexpected projects: %#v", projects)
	}

	projectID, err := store.ResolveProjectID("Project One")
	if err != nil {
		t.Fatalf("resolve project: %v", err)
	}
	if projectID == "" {
		t.Fatalf("expected project id")
	}

	tags, err := store.Tags()
	if err != nil {
		t.Fatalf("tags: %v", err)
	}
	if len(tags) != 1 || tags[0].Title != "urgent" || tags[0].Usage != 1 {
		t.Fatalf("unexpected tags: %#v", tags)
	}

	tasks, err := store.Tasks(TaskFilter{ProjectID: projectID, Status: &status, ExcludeTrashedContext: true, Types: []int{TaskTypeTodo}})
	if err != nil {
		t.Fatalf("tasks: %v", err)
	}
	if len(tasks) != 1 || tasks[0].Title != "Task One" {
		t.Fatalf("unexpected tasks: %#v", tasks)
	}
	if tasks[0].Notes != "Some notes" {
		t.Fatalf("unexpected notes: %q", tasks[0].Notes)
	}
	if tasks[0].Start != "Anytime" {
		t.Fatalf("unexpected start: %q", tasks[0].Start)
	}
	if tasks[0].StartDate != "2025-01-02" {
		t.Fatalf("unexpected start date: %q", tasks[0].StartDate)
	}
	if tasks[0].Deadline != "2025-01-04" {
		t.Fatalf("unexpected deadline: %q", tasks[0].Deadline)
	}
	if tasks[0].Created != "2025-01-02 03:04:05" {
		t.Fatalf("unexpected created: %q", tasks[0].Created)
	}
	if tasks[0].Modified != "2025-01-02 03:04:05" {
		t.Fatalf("unexpected modified: %q", tasks[0].Modified)
	}
	if len(tasks[0].Tags) != 1 || tasks[0].Tags[0] != "urgent" {
		t.Fatalf("unexpected tags: %#v", tasks[0].Tags)
	}

	repeating, err := store.Tasks(TaskFilter{Status: &status, ExcludeTrashedContext: true, Types: []int{TaskTypeTodo}, RepeatingOnly: true})
	if err != nil {
		t.Fatalf("repeating tasks: %v", err)
	}
	if len(repeating) != 1 || repeating[0].Title != "Repeat Task" || !repeating[0].Repeating {
		t.Fatalf("unexpected repeating tasks: %#v", repeating)
	}

	searched, err := store.Tasks(TaskFilter{Search: "notes", Status: &status, ExcludeTrashedContext: true, Types: []int{TaskTypeTodo}})
	if err != nil {
		t.Fatalf("search tasks: %v", err)
	}
	if len(searched) != 1 || searched[0].Title != "Task One" {
		t.Fatalf("unexpected search: %#v", searched)
	}

	searchedArea, err := store.Tasks(TaskFilter{Search: "Home", Status: &status, ExcludeTrashedContext: true, Types: []int{TaskTypeTodo}})
	if err != nil {
		t.Fatalf("search tasks by area: %v", err)
	}
	if len(searchedArea) != 1 || searchedArea[0].Title != "Task One" {
		t.Fatalf("unexpected search by area: %#v", searchedArea)
	}

	withChecklist, err := store.Tasks(TaskFilter{ProjectID: projectID, Status: &status, IncludeChecklist: true, ExcludeTrashedContext: true, Types: []int{TaskTypeTodo}})
	if err != nil {
		t.Fatalf("tasks with checklist: %v", err)
	}
	if len(withChecklist) != 1 || len(withChecklist[0].Checklist) != 1 || withChecklist[0].Checklist[0].Title != "Check Item" {
		t.Fatalf("unexpected checklist: %#v", withChecklist)
	}
}

func seedTestDB(conn *sql.DB) error {
	now := time.Date(2025, 1, 2, 3, 4, 5, 0, time.Local)
	startDate := thingsDateForTest(now)
	deadline := thingsDateForTest(now.AddDate(0, 0, 2))
	nowUnix := float64(now.Unix())

	statements := []string{
		`CREATE TABLE TMArea (uuid TEXT PRIMARY KEY, title TEXT, visible INTEGER, "index" INTEGER);`,
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
		`CREATE TABLE TMTag (uuid TEXT PRIMARY KEY, title TEXT, shortcut TEXT, parent TEXT);`,
		`CREATE TABLE TMTaskTag (tasks TEXT NOT NULL, tags TEXT NOT NULL);`,
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

	if _, err := conn.Exec(`INSERT INTO TMArea (uuid, title, visible, "index") VALUES ('A1', 'Home', 1, 1);`); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title, area) VALUES ('P1', ?, ?, 0, 'Project One', 'A1');`, TaskTypeProject, StatusIncomplete); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title) VALUES ('P2', ?, ?, 0, 'Project Done');`, TaskTypeProject, StatusCompleted); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title, project, area, heading, notes) VALUES ('H1', ?, ?, 0, 'Heading', 'P1', 'A1', '', '');`, TaskTypeHeading, StatusIncomplete); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title, project, area, heading, notes, start, startDate, deadline, creationDate, userModificationDate) VALUES ('T1', ?, ?, 0, 'Task One', 'P1', 'A1', 'H1', 'Some notes', 1, ?, ?, ?, ?);`, TaskTypeTodo, StatusIncomplete, startDate, deadline, nowUnix, nowUnix); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTask (uuid, type, status, trashed, title, project, area, heading, start, startDate, deadline, creationDate, userModificationDate, rt1_recurrenceRule) VALUES ('T2', ?, ?, 0, 'Repeat Task', 'P1', 'A1', 'H1', 1, ?, ?, ?, ?, X'01');`, TaskTypeTodo, StatusIncomplete, startDate, deadline, nowUnix, nowUnix); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTag (uuid, title) VALUES ('TAG1', 'urgent');`); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMTaskTag (tasks, tags) VALUES ('T1', 'TAG1');`); err != nil {
		return err
	}
	if _, err := conn.Exec(`INSERT INTO TMChecklistItem (uuid, title, status, "index", task) VALUES ('C1', 'Check Item', ?, 0, 'T1');`, StatusIncomplete); err != nil {
		return err
	}
	return nil
}

func thingsDateForTest(t time.Time) int {
	date := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return date.Year()<<16 | int(date.Month())<<12 | date.Day()<<7
}

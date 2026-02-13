package integration_test

import "testing"

func TestInboxCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "inbox", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Inbox Task")
}

func TestAnytimeCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "anytime", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Anytime Task")
}

func TestSomedayCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "someday", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Someday Task")
}

func TestUpcomingCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "upcoming", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Upcoming Task")
}

func TestDeadlinesCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "deadlines", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Deadline Task")
}

func TestCompletedCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "completed", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Completed Task")
}

func TestCanceledCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "canceled", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Canceled Task")
}

func TestTrashCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "trash", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Trashed Task")
}

func TestLogbookCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "logbook", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Completed Task")
}

func TestLogTodayCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "logtoday", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Completed Task")
}

func TestCreatedTodayCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "createdtoday", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Task One")
}

func TestAllCommand(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "all", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Inbox")
	assertContains(t, out, "Inbox Task")
}

func TestAreasRecursive(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "areas", "--db", dbPath, "--recursive")
	requireSuccess(t, code)
	assertContains(t, out, "Project One")
	assertContains(t, out, "Task One")
}

func TestAreasOnlyProjects(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "areas", "--db", dbPath, "--recursive", "--only-projects")
	requireSuccess(t, code)
	assertContains(t, out, "Project One")
	assertNotContains(t, out, "Task One")
}

func TestProjectsRecursive(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "projects", "--db", dbPath, "--recursive")
	requireSuccess(t, code)
	assertContains(t, out, "Project One")
	assertContains(t, out, "Task One")
}

func TestProjectsOnlyProjects(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "projects", "--db", dbPath, "--recursive", "--only-projects")
	requireSuccess(t, code)
	assertContains(t, out, "Project One")
	assertNotContains(t, out, "Task One")
}

package integration_test

import (
	"path/filepath"
	"testing"
)

func fixtureDBPath(t *testing.T) string {
	t.Helper()
	root, err := findRepoRoot()
	if err != nil {
		t.Fatalf("find repo root: %v", err)
	}
	return filepath.Join(root, "integration", "fixtures", "main.sqlite")
}

func TestReferenceFixtureBasicCommands(t *testing.T) {
	dbPath := fixtureDBPath(t)

	out, _, code := runThings(t, "", "inbox", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Inbox")
	assertContains(t, out, "To-Do in Inbox with Checklist Items")

	out, _, code = runThings(t, "", "anytime", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Anytime")

	out, _, code = runThings(t, "", "someday", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Someday")

	out, _, code = runThings(t, "", "today", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Today")

	out, _, code = runThings(t, "", "completed", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Completed To-Do in Anytime")

	out, _, code = runThings(t, "", "canceled", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Cancelled To-Do in Anytime")

	out, _, code = runThings(t, "", "trash", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Deleted Todo")

	out, _, code = runThings(t, "", "projects", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Project in Area 1")
	assertContains(t, out, "Project without Area")

	out, _, code = runThings(t, "", "areas", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Area 1")

	out, _, code = runThings(t, "", "tags", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Important")

	out, _, code = runThings(t, "", "tasks", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Inbox")

	out, _, code = runThings(t, "", "search", "--db", dbPath, "To-Do in Inbox")
	requireSuccess(t, code)
	assertContains(t, out, "To-Do in Inbox")

	out, _, code = runThings(t, "", "show", "--db", dbPath, "--id", "DciSFacytdrNG1nRaMJPgY")
	requireSuccess(t, code)
	assertContains(t, out, "Area 1")

	out, _, code = runThings(t, "", "logbook", "--db", dbPath)
	requireSuccess(t, code)
	assertContains(t, out, "Completed To-Do in Project")
}


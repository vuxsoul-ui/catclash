package integration_test

import "testing"

func TestSearchAcceptsQuery(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "", "search", "--db", dbPath, "notes")
	requireSuccess(t, code)
	assertContains(t, out, "Task One")
}

func TestSearchAcceptsQueryFromStdin(t *testing.T) {
	dbPath := writeTestDB(t)
	out, _, code := runThings(t, "notes", "search", "--db", dbPath, "-")
	requireSuccess(t, code)
	assertContains(t, out, "Task One")
}

package integration_test

import "testing"

func TestAddAreaRequiresTitle(t *testing.T) {
	_, errOut, code := runThings(t, "", "add-area")
	requireFailure(t, code)
	assertContains(t, errOut, "Must specify title")
}

func TestAddAreaTagsOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-area", "--tags=Focus,Home", "Work")
	requireSuccess(t, code)
	assertContains(t, out, "make new area")
	assertContains(t, out, "tag names of newArea to \"Focus,Home\"")
}

func TestCreateAreaAlias(t *testing.T) {
	out, _, code := runThings(t, "", "create-area", "Studio")
	requireSuccess(t, code)
	assertContains(t, out, "make new area")
	assertContains(t, out, "name:\"Studio\"")
}

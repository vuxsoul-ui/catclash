package integration_test

import "testing"

func TestUpdateAreaRequiresTags(t *testing.T) {
	_, errOut, code := runThings(t, "", "update-area", "--id=1")
	requireFailure(t, code)
	assertContains(t, errOut, "Must specify --tags, --add-tags, or --title")
}

func TestUpdateAreaAddTagsOption(t *testing.T) {
	out, _, code := runThings(t, "", "update-area", "--id=1", "--add-tags=Focus")
	requireSuccess(t, code)
	assertContains(t, out, "first area whose id is \"1\"")
	assertContains(t, out, "tag names of targetArea to \"Focus\"")
}

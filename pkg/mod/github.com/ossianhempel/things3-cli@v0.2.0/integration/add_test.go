package integration_test

import "testing"

func TestAddNoOptions(t *testing.T) {
	out, _, code := runThings(t, "", "add")
	requireSuccess(t, code)
	assertContains(t, out, "show-quick-entry=true")
}

func TestAddWhenOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--when=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "when=2021-05-20")
}

func TestAddDeadlineOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--deadline=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "deadline=2021-05-20")
}

func TestAddCanceledPrecedence(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--canceled", "--completed")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")
	assertNotContains(t, out, "completed=true")
}

func TestAddCompletedOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--completed")
	requireSuccess(t, code)
	assertContains(t, out, "completed=true")

	out, _, code = runThings(t, "", "add", "--cancelled")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")
}

func TestAddChecklistItemOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--checklist-item=ITEM 1", "--checklist-item=ITEM 2")
	requireSuccess(t, code)
	assertContains(t, out, "checklist-items="+join(enc("ITEM 1"), enc("ITEM 2")))
}

func TestAddCreationDateOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--creation-date=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "creation-date=2021-05-20")
}

func TestAddCompletionDateOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--completion-date=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "completion-date=2021-05-20")
}

func TestAddListOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--list=LIST")
	requireSuccess(t, code)
	assertContains(t, out, "list=LIST")
}

func TestAddListIDOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--list-id=1")
	requireSuccess(t, code)
	assertContains(t, out, "list-id=1")
}

func TestAddListIDPrecedence(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--list-id=1", "--list=LIST")
	requireSuccess(t, code)
	assertContains(t, out, "list-id=1")
	assertNotContains(t, out, "list=LIST")
}

func TestAddHeadingOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--heading=THE HEADING")
	requireSuccess(t, code)
	assertContains(t, out, enc("THE HEADING"))
}

func TestAddRevealOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--reveal")
	requireSuccess(t, code)
	assertContains(t, out, "reveal=true")
}

func TestAddShowQuickEntryOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--show-quick-entry", "TITLE")
	requireSuccess(t, code)
	assertContains(t, out, "show-quick-entry=true")
}

func TestAddNotesOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--notes=NOTES NOTES")
	requireSuccess(t, code)
	assertContains(t, out, "notes="+enc("NOTES NOTES"))
}

func TestAddTagsOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--tags=tag1,tag 3,tag2")
	requireSuccess(t, code)
	assertContains(t, out, "tags="+enc("tag1,tag 3,tag2"))
}

func TestAddTitlesOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--titles=TITLE 1,TITLE 2")
	requireSuccess(t, code)
	assertContains(t, out, join(enc("TITLE 1"), enc("TITLE 2")))
}

func TestAddUseClipboardOption(t *testing.T) {
	out, _, code := runThings(t, "", "add", "--use-clipboard=replace-title")
	requireSuccess(t, code)
	assertContains(t, out, "use-clipboard=replace-title")
}

func TestAddTitleInput(t *testing.T) {
	out, _, code := runThings(t, "", "add", "New Project")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Project"))
}

func TestAddTitleAndNotesInput(t *testing.T) {
	out, _, code := runThings(t, "", "add", "New Todo\n\nThe notes")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Todo")+"&notes="+enc("The notes"))
}

func TestAddTitleFromStdin(t *testing.T) {
	out, _, code := runThings(t, "New Todo", "add", "-")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Todo"))
}

func TestAddTitleAndNotesFromStdin(t *testing.T) {
	out, _, code := runThings(t, "New Todo\n\nThe notes", "add", "-")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Todo")+"&notes="+enc("The notes"))
}

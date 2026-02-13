package integration_test

import "testing"

func TestAddProjectNoOptions(t *testing.T) {
	out, _, code := runThings(t, "", "add-project")
	requireSuccess(t, code)
	assertContains(t, out, "things:///add-project?")
}

func TestAddProjectAreaIDOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--area-id=1")
	requireSuccess(t, code)
	assertContains(t, out, "area-id="+enc("1"))
}

func TestAddProjectAreaOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--area=SOME AREA")
	requireSuccess(t, code)
	assertContains(t, out, "area="+enc("SOME AREA"))
}

func TestAddProjectAreaIDPrecedence(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--area-id=1", "--area=SOME AREA")
	requireSuccess(t, code)
	assertContains(t, out, "area-id="+enc("1"))
	assertNotContains(t, out, "area="+enc("SOME AREA"))
}

func TestAddProjectCanceledOptions(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--canceled")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")

	out, _, code = runThings(t, "", "add-project", "--cancelled")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")
}

func TestAddProjectCanceledPrecedence(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--canceled", "--completed")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")
	assertNotContains(t, out, "completed=true")
}

func TestAddProjectCompletedOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--completed")
	requireSuccess(t, code)
	assertContains(t, out, "completed=true")

	out, _, code = runThings(t, "", "add-project", "--cancelled")
	requireSuccess(t, code)
	assertContains(t, out, "canceled=true")
}

func TestAddProjectCompletionDateOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--completion-date=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "completion-date=2021-05-20")
}

func TestAddProjectDeadlineOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--deadline=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "deadline=2021-05-20")
}

func TestAddProjectNotesOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--notes=NOTES NOTES")
	requireSuccess(t, code)
	assertContains(t, out, "notes="+enc("NOTES NOTES"))
}

func TestAddProjectRevealOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--reveal")
	requireSuccess(t, code)
	assertContains(t, out, "reveal=true")
}

func TestAddProjectTagsOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--tags=tag1,tag 3,tag2")
	requireSuccess(t, code)
	assertContains(t, out, "tags="+enc("tag1,tag 3,tag2"))
}

func TestAddProjectWhenOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--when=2021-05-20")
	requireSuccess(t, code)
	assertContains(t, out, "when=2021-05-20")
}

func TestAddProjectTodoOption(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "--todo=Todo 1", "--todo=Todo 2")
	requireSuccess(t, code)
	assertContains(t, out, "to-dos="+join(enc("Todo 1"), enc("Todo 2")))
}

func TestAddProjectTitleInput(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "New Project")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Project"))
}

func TestAddProjectTitleAndNotesInput(t *testing.T) {
	out, _, code := runThings(t, "", "add-project", "New Project\n\nThe notes")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Project")+"&notes="+enc("The notes"))
}

func TestAddProjectTitleFromStdin(t *testing.T) {
	out, _, code := runThings(t, "New Project", "add-project", "-")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Project"))
}

func TestAddProjectTitleAndNotesFromStdin(t *testing.T) {
	out, _, code := runThings(t, "New Project\n\nThe notes", "add-project", "-")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("New Project")+"&notes="+enc("The notes"))
}

func TestCreateProjectAlias(t *testing.T) {
	out, _, code := runThings(t, "", "create-project", "Alias Project")
	requireSuccess(t, code)
	assertContains(t, out, "title="+enc("Alias Project"))
}

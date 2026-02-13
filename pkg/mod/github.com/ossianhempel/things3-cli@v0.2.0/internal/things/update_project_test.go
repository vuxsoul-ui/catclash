package things

import (
	"strings"
	"testing"
)

func TestBuildUpdateProjectURLErrorMissingAuthToken(t *testing.T) {
	_, err := BuildUpdateProjectURL(UpdateProjectOptions{ID: "123"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Missing Things auth token. Run `things auth` for setup, set THINGS_AUTH_TOKEN, or pass --auth-token=TOKEN (Things > Settings > General > Things URLs)." {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateProjectURLErrorMissingID(t *testing.T) {
	_, err := BuildUpdateProjectURL(UpdateProjectOptions{AuthToken: "tok"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=id" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateProjectURLCanceledOverridesCompleted(t *testing.T) {
	url, err := BuildUpdateProjectURL(UpdateProjectOptions{AuthToken: "tok", ID: "id", Completed: true, Canceled: true}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "canceled=true") {
		t.Fatalf("expected canceled in %q", url)
	}
	if contains(url, "completed=true") {
		t.Fatalf("did not expect completed in %q", url)
	}
}

func TestBuildUpdateProjectURLAreaIDPrecedence(t *testing.T) {
	url, err := BuildUpdateProjectURL(UpdateProjectOptions{AuthToken: "tok", ID: "id", Area: "Work", AreaID: "123"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "area-id=123") {
		t.Fatalf("expected area-id in %q", url)
	}
	if contains(url, "area=Work") {
		t.Fatalf("did not expect area in %q", url)
	}
}

func TestBuildUpdateProjectURLNotesFromInputOverrideFlag(t *testing.T) {
	opts := UpdateProjectOptions{AuthToken: "tok", ID: "id", Notes: "FromFlag"}
	url, err := BuildUpdateProjectURL(opts, "Title\n\nFromInput")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "title=Title") {
		t.Fatalf("expected title in %q", url)
	}
	if !contains(url, "notes=FromInput") {
		t.Fatalf("expected notes from input in %q", url)
	}
	if contains(url, "notes=FromFlag") {
		t.Fatalf("did not expect notes from flag in %q", url)
	}
}

func TestBuildUpdateProjectURLTodosJoin(t *testing.T) {
	opts := UpdateProjectOptions{AuthToken: "tok", ID: "id", Todos: []string{"One", "Two"}}
	url, err := BuildUpdateProjectURL(opts, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "to-dos=One%0ATwo") {
		t.Fatalf("expected to-dos in %q", url)
	}
}

func TestBuildUpdateProjectURLAddTags(t *testing.T) {
	opts := UpdateProjectOptions{AuthToken: "tok", ID: "id", AddTags: "Focus,Home"}
	url, err := BuildUpdateProjectURL(opts, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "add-tags=Focus%2CHome") {
		t.Fatalf("expected add-tags in %q", url)
	}
}

func TestBuildUpdateProjectURLTrailingAmpersand(t *testing.T) {
	url, err := BuildUpdateProjectURL(UpdateProjectOptions{AuthToken: "tok", ID: "id", Notes: "Notes"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasSuffix(url, "&") {
		t.Fatalf("expected trailing ampersand in %q", url)
	}
}

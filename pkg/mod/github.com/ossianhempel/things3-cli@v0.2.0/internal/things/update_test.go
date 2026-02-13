package things

import (
	"strings"
	"testing"
)

func TestBuildUpdateURLErrorMissingAuthToken(t *testing.T) {
	_, err := BuildUpdateURL(UpdateOptions{ID: "123"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Missing Things auth token. Run `things auth` for setup, set THINGS_AUTH_TOKEN, or pass --auth-token=TOKEN (Things > Settings > General > Things URLs)." {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateURLErrorMissingID(t *testing.T) {
	_, err := BuildUpdateURL(UpdateOptions{AuthToken: "tok"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=id" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateURLCanceledOverridesCompleted(t *testing.T) {
	url, err := BuildUpdateURL(UpdateOptions{AuthToken: "tok", ID: "id", Completed: true, Canceled: true}, "")
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

func TestBuildUpdateURLListIDPrecedence(t *testing.T) {
	url, err := BuildUpdateURL(UpdateOptions{AuthToken: "tok", ID: "id", List: "Work", ListID: "123"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "list-id=123") {
		t.Fatalf("expected list-id in %q", url)
	}
	if contains(url, "list=Work") {
		t.Fatalf("did not expect list in %q", url)
	}
}

func TestBuildUpdateURLNotesFromInputOverrideFlag(t *testing.T) {
	opts := UpdateOptions{AuthToken: "tok", ID: "id", Notes: "FromFlag"}
	url, err := BuildUpdateURL(opts, "Title\n\nFromInput")
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

func TestBuildUpdateURLChecklistJoin(t *testing.T) {
	opts := UpdateOptions{AuthToken: "tok", ID: "id", ChecklistItems: []string{"One", "Two"}}
	url, err := BuildUpdateURL(opts, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "checklist-items=One%0ATwo") {
		t.Fatalf("expected checklist-items in %q", url)
	}
}

func TestBuildUpdateURLLaterSetsEvening(t *testing.T) {
	opts := UpdateOptions{AuthToken: "tok", ID: "id", Later: true}
	url, err := BuildUpdateURL(opts, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "when=evening") {
		t.Fatalf("expected when=evening in %q", url)
	}
}

func TestBuildUpdateURLWhenOverridesLater(t *testing.T) {
	opts := UpdateOptions{AuthToken: "tok", ID: "id", Later: true, When: "today"}
	url, err := BuildUpdateURL(opts, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "when=today") {
		t.Fatalf("expected when=today in %q", url)
	}
	if contains(url, "when=evening") {
		t.Fatalf("did not expect when=evening in %q", url)
	}
}

func TestBuildUpdateURLTrailingAmpersand(t *testing.T) {
	url, err := BuildUpdateURL(UpdateOptions{AuthToken: "tok", ID: "id", Notes: "Notes"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasSuffix(url, "&") {
		t.Fatalf("expected trailing ampersand in %q", url)
	}
}

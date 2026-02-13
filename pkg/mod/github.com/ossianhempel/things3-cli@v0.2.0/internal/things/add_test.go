package things

import (
	"strings"
	"testing"
)

func TestBuildAddURLShowQuickEntryByDefault(t *testing.T) {
	url := BuildAddURL(AddOptions{}, "")
	if !contains(url, "show-quick-entry=true") {
		t.Fatalf("expected show-quick-entry in %q", url)
	}
}

func TestBuildAddURLTitlesDisableAutoQuickEntry(t *testing.T) {
	url := BuildAddURL(AddOptions{TitlesRaw: "One,Two"}, "")
	if contains(url, "show-quick-entry=true") {
		t.Fatalf("did not expect show-quick-entry in %q", url)
	}
	if !contains(url, "titles=One%0ATwo") {
		t.Fatalf("expected titles param in %q", url)
	}
}

func TestBuildAddURLListIDPrecedence(t *testing.T) {
	url := BuildAddURL(AddOptions{List: "Work", ListID: "123"}, "")
	if !contains(url, "list-id=123") {
		t.Fatalf("expected list-id in %q", url)
	}
	if contains(url, "list=Work") {
		t.Fatalf("did not expect list in %q", url)
	}
}

func TestBuildAddURLCanceledOverridesCompleted(t *testing.T) {
	url := BuildAddURL(AddOptions{Completed: true, Canceled: true}, "")
	if !contains(url, "canceled=true") {
		t.Fatalf("expected canceled in %q", url)
	}
	if contains(url, "completed=true") {
		t.Fatalf("did not expect completed in %q", url)
	}
}

func TestBuildAddURLNotesFromInputOverrideFlag(t *testing.T) {
	opts := AddOptions{Notes: "FromFlag"}
	url := BuildAddURL(opts, "Title\n\nFromInput")
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

func TestBuildAddURLTrailingAmpersand(t *testing.T) {
	url := BuildAddURL(AddOptions{ListID: "123"}, "Title")
	if !strings.HasSuffix(url, "&") {
		t.Fatalf("expected trailing ampersand in %q", url)
	}
}

func contains(haystack, needle string) bool {
	return strings.Contains(haystack, needle)
}

package things

import (
	"strings"
	"testing"
)

func TestBuildAddProjectURLAreaIDPrecedence(t *testing.T) {
	url := BuildAddProjectURL(AddProjectOptions{Area: "Work", AreaID: "123"}, "")
	if !contains(url, "area-id=123") {
		t.Fatalf("expected area-id in %q", url)
	}
	if contains(url, "area=Work") {
		t.Fatalf("did not expect area in %q", url)
	}
}

func TestBuildAddProjectURLCanceledOverridesCompleted(t *testing.T) {
	url := BuildAddProjectURL(AddProjectOptions{Completed: true, Canceled: true}, "")
	if !contains(url, "canceled=true") {
		t.Fatalf("expected canceled in %q", url)
	}
	if contains(url, "completed=true") {
		t.Fatalf("did not expect completed in %q", url)
	}
}

func TestBuildAddProjectURLNotesFromInputOverrideFlag(t *testing.T) {
	opts := AddProjectOptions{Notes: "FromFlag"}
	url := BuildAddProjectURL(opts, "Title\n\nFromInput")
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

func TestBuildAddProjectURLTodosJoin(t *testing.T) {
	url := BuildAddProjectURL(AddProjectOptions{Todos: []string{"One", "Two"}}, "")
	if !contains(url, "to-dos=One%0ATwo") {
		t.Fatalf("expected to-dos in %q", url)
	}
}

func TestBuildAddProjectURLTags(t *testing.T) {
	url := BuildAddProjectURL(AddProjectOptions{Tags: "Work,Home"}, "Project")
	if !contains(url, "tags=Work%2CHome") {
		t.Fatalf("expected tags in %q", url)
	}
}

func TestBuildAddProjectURLTrailingAmpersand(t *testing.T) {
	url := BuildAddProjectURL(AddProjectOptions{AreaID: "123"}, "Title")
	if !strings.HasSuffix(url, "&") {
		t.Fatalf("expected trailing ampersand in %q", url)
	}
}

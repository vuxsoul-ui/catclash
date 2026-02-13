package things

import "testing"

func TestBuildAddAreaScriptRequiresTitle(t *testing.T) {
	_, err := BuildAddAreaScript(AddAreaOptions{}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildAddAreaScriptWithTags(t *testing.T) {
	script, err := BuildAddAreaScript(AddAreaOptions{Tags: "Focus,Home"}, "Work")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "make new area") {
		t.Fatalf("expected make new area in %q", script)
	}
	if !contains(script, "name:\"Work\"") {
		t.Fatalf("expected area name in %q", script)
	}
	if !contains(script, "tag names of newArea to \"Focus,Home\"") {
		t.Fatalf("expected tag names in %q", script)
	}
}

func TestBuildUpdateAreaScriptRequiresTarget(t *testing.T) {
	_, err := BuildUpdateAreaScript(UpdateAreaOptions{Tags: "Focus"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=ID or area title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateAreaScriptRequiresTags(t *testing.T) {
	_, err := BuildUpdateAreaScript(UpdateAreaOptions{ID: "123"}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --tags, --add-tags, or --title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildUpdateAreaScriptAddTags(t *testing.T) {
	script, err := BuildUpdateAreaScript(UpdateAreaOptions{ID: "123", AddTags: "Focus"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "first area whose id is \"123\"") {
		t.Fatalf("expected id lookup in %q", script)
	}
	if !contains(script, "currentTags") {
		t.Fatalf("expected currentTags handling in %q", script)
	}
	if !contains(script, "tag names of targetArea to \"Focus\"") {
		t.Fatalf("expected tag names in %q", script)
	}
}

func TestBuildUpdateAreaScriptReplaceTags(t *testing.T) {
	script, err := BuildUpdateAreaScript(UpdateAreaOptions{ID: "123", Tags: "Home"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "tag names of targetArea to \"Home\"") {
		t.Fatalf("expected tag names in %q", script)
	}
	if contains(script, "currentTags") {
		t.Fatalf("did not expect add-tags flow in %q", script)
	}
}

func TestBuildUpdateAreaScriptWithTitle(t *testing.T) {
	script, err := BuildUpdateAreaScript(UpdateAreaOptions{ID: "123", Title: "Renamed"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "set name of targetArea to \"Renamed\"") {
		t.Fatalf("expected title update in %q", script)
	}
}

func TestBuildDeleteAreaScriptRequiresTarget(t *testing.T) {
	_, err := BuildDeleteAreaScript(DeleteAreaOptions{}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=ID or area title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildDeleteAreaScriptWithID(t *testing.T) {
	script, err := BuildDeleteAreaScript(DeleteAreaOptions{ID: "123"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "first area whose id is \"123\"") {
		t.Fatalf("expected id lookup in %q", script)
	}
	if !contains(script, "delete targetArea") {
		t.Fatalf("expected delete in %q", script)
	}
}

func TestBuildDeleteAreaScriptWithTitle(t *testing.T) {
	script, err := BuildDeleteAreaScript(DeleteAreaOptions{}, "Home")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "area \"Home\"") {
		t.Fatalf("expected title lookup in %q", script)
	}
	if !contains(script, "delete targetArea") {
		t.Fatalf("expected delete in %q", script)
	}
}

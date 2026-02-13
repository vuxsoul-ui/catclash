package things

import "testing"

func TestBuildDeleteTodoScriptRequiresTarget(t *testing.T) {
	_, err := BuildDeleteTodoScript(DeleteTodoOptions{}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=ID or todo title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildDeleteTodoScriptWithID(t *testing.T) {
	script, err := BuildDeleteTodoScript(DeleteTodoOptions{ID: "123"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "first to do whose id is \"123\"") {
		t.Fatalf("expected id lookup in %q", script)
	}
	if !contains(script, "delete targetTodo") {
		t.Fatalf("expected delete in %q", script)
	}
}

func TestBuildDeleteTodoScriptWithTitle(t *testing.T) {
	script, err := BuildDeleteTodoScript(DeleteTodoOptions{}, "Pay bills")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "to do \"Pay bills\"") {
		t.Fatalf("expected title lookup in %q", script)
	}
	if !contains(script, "delete targetTodo") {
		t.Fatalf("expected delete in %q", script)
	}
}

func TestBuildDeleteProjectScriptRequiresTarget(t *testing.T) {
	_, err := BuildDeleteProjectScript(DeleteProjectOptions{}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
	if err.Error() != "Error: Must specify --id=ID or project title" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildDeleteProjectScriptWithID(t *testing.T) {
	script, err := BuildDeleteProjectScript(DeleteProjectOptions{ID: "456"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "first project whose id is \"456\"") {
		t.Fatalf("expected id lookup in %q", script)
	}
	if !contains(script, "delete targetProject") {
		t.Fatalf("expected delete in %q", script)
	}
}

func TestBuildDeleteProjectScriptWithTitle(t *testing.T) {
	script, err := BuildDeleteProjectScript(DeleteProjectOptions{}, "Launch")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(script, "project \"Launch\"") {
		t.Fatalf("expected title lookup in %q", script)
	}
	if !contains(script, "delete targetProject") {
		t.Fatalf("expected delete in %q", script)
	}
}

package db

import "testing"

func TestParseStatus(t *testing.T) {
	if v, err := ParseStatus(""); err != nil || v != nil {
		t.Fatalf("expected nil status, got %v err %v", v, err)
	}
	if v, err := ParseStatus("completed"); err != nil || v == nil || *v != StatusCompleted {
		t.Fatalf("unexpected completed status: %v err %v", v, err)
	}
	if v, err := ParseStatus("canceled"); err != nil || v == nil || *v != StatusCanceled {
		t.Fatalf("unexpected canceled status: %v err %v", v, err)
	}
	if v, err := ParseStatus("incomplete"); err != nil || v == nil || *v != StatusIncomplete {
		t.Fatalf("unexpected incomplete status: %v err %v", v, err)
	}
	if _, err := ParseStatus("nope"); err == nil {
		t.Fatalf("expected error for unknown status")
	}
}

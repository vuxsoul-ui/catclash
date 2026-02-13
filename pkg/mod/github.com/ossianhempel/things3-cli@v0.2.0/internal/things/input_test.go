package things

import "testing"

func TestFindTitle(t *testing.T) {
	input := "Title\nLine 2\n"
	if got := FindTitle(input); got != "Title" {
		t.Fatalf("FindTitle mismatch: got %q", got)
	}
}

func TestFindNotesTrimsEdges(t *testing.T) {
	input := "Title\n\nNotes line 1\n\nNotes line 2\n\n"
	got := FindNotes(input)
	want := "Notes line 1\n\nNotes line 2"
	if got != want {
		t.Fatalf("FindNotes mismatch: got %q want %q", got, want)
	}
}

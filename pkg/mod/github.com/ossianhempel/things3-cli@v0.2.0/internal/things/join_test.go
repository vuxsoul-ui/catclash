package things

import "testing"

func TestJoin(t *testing.T) {
	got := Join("one", "two", "three")
	want := "one%0Atwo%0Athree"
	if got != want {
		t.Fatalf("Join mismatch: got %q want %q", got, want)
	}
}

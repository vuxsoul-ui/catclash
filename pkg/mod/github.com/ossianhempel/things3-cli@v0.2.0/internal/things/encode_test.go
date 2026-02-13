package things

import "testing"

func TestURLEncode(t *testing.T) {
	got := URLEncode("Hello world!")
	want := "Hello%20world%21"
	if got != want {
		t.Fatalf("URLEncode mismatch: got %q want %q", got, want)
	}
}

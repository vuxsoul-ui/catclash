package things

import "testing"

func TestBuildSearchURLEmpty(t *testing.T) {
	url := BuildSearchURL("")
	if url != "things:///search?" {
		t.Fatalf("unexpected url: %q", url)
	}
}

func TestBuildSearchURLWithQuery(t *testing.T) {
	url := BuildSearchURL("Home")
	if url != "things:///search?query=Home" {
		t.Fatalf("unexpected url: %q", url)
	}
}

package things

import "testing"

func TestBuildShowURLWithID(t *testing.T) {
	url, err := BuildShowURL(ShowOptions{ID: "today"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "id=today") {
		t.Fatalf("expected id in %q", url)
	}
	if contains(url, "query=") {
		t.Fatalf("did not expect query in %q", url)
	}
}

func TestBuildShowURLWithQuery(t *testing.T) {
	url, err := BuildShowURL(ShowOptions{}, "inbox")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "query=inbox") {
		t.Fatalf("expected query in %q", url)
	}
}

func TestBuildShowURLWithFilter(t *testing.T) {
	url, err := BuildShowURL(ShowOptions{Filter: "tag1,tag2"}, "inbox")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !contains(url, "filter=tag1%2Ctag2") {
		t.Fatalf("expected filter in %q", url)
	}
}

func TestBuildShowURLErrWhenMissingTarget(t *testing.T) {
	_, err := BuildShowURL(ShowOptions{}, "")
	if err == nil {
		t.Fatalf("expected error")
	}
}

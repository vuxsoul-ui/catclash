package grizzly

import "testing"

func TestMergeTags(t *testing.T) {
	got, err := mergeTags([]string{"work", "", "home"}, "todo, home/errand")
	if err != nil {
		t.Fatalf("mergeTags error: %v", err)
	}
	expected := "work,home,todo,home/errand"
	if got != expected {
		t.Fatalf("mergeTags = %q, want %q", got, expected)
	}
}

func TestNormalizeMode(t *testing.T) {
	cases := []struct {
		input   string
		expect  string
		wantErr bool
	}{
		{"", "", false},
		{"append", "append", false},
		{"replace-all", "replace_all", false},
		{"replace_all", "replace_all", false},
		{"bogus", "", true},
	}

	for _, tc := range cases {
		got, err := normalizeMode(tc.input)
		if tc.wantErr && err == nil {
			t.Fatalf("normalizeMode(%q) expected error", tc.input)
		}
		if !tc.wantErr && err != nil {
			t.Fatalf("normalizeMode(%q) error: %v", tc.input, err)
		}
		if got != tc.expect {
			t.Fatalf("normalizeMode(%q) = %q, want %q", tc.input, got, tc.expect)
		}
	}
}

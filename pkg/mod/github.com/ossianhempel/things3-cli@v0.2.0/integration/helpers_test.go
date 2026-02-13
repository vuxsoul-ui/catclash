package integration_test

import (
	"strings"
	"testing"

	"github.com/ossianhempel/things3-cli/internal/things"
)

func enc(s string) string {
	return things.URLEncode(s)
}

func join(items ...string) string {
	return things.Join(items...)
}

func assertContains(t *testing.T, output, want string) {
	t.Helper()
	if !strings.Contains(output, want) {
		t.Fatalf("expected output to contain %q, got %q", want, output)
	}
}

func assertNotContains(t *testing.T, output, want string) {
	t.Helper()
	if strings.Contains(output, want) {
		t.Fatalf("did not expect output to contain %q, got %q", want, output)
	}
}

func requireSuccess(t *testing.T, code int) {
	t.Helper()
	if code != 0 {
		t.Fatalf("expected success, got exit code %d", code)
	}
}

func requireFailure(t *testing.T, code int) {
	t.Helper()
	if code == 0 {
		t.Fatalf("expected failure, got success")
	}
}

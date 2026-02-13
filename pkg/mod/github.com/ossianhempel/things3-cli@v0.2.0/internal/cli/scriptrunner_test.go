package cli

import "testing"

type recordScriptRunner struct {
	script string
}

func (r *recordScriptRunner) Run(script string) error {
	r.script = script
	return nil
}

func requireScript(t *testing.T, runner *recordScriptRunner) string {
	t.Helper()
	if runner.script == "" {
		t.Fatalf("expected script to be recorded")
	}
	return runner.script
}

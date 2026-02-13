package grizzly

import (
	"errors"
)

const (
	ExitSuccess  = 0
	ExitFailure  = 1
	ExitUsage    = 2
	ExitTimeout  = 3
	ExitOpen     = 4
	ExitCallback = 5
)

type ExitError struct {
	Code int
	Err  error
}

func (e *ExitError) Error() string {
	if e.Err == nil {
		return ""
	}
	return e.Err.Error()
}

func (e *ExitError) Unwrap() error {
	return e.Err
}

func ExitCode(err error) int {
	if err == nil {
		return ExitSuccess
	}
	var ee *ExitError
	if errors.As(err, &ee) {
		return ee.Code
	}
	return ExitFailure
}

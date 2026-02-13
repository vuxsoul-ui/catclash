package grizzly

import (
	"fmt"

	"github.com/spf13/cobra"
)

func usageError(cmd *cobra.Command, format string, args ...any) error {
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintf(cmd.ErrOrStderr(), "error: %s\n", msg)
	_ = cmd.Help()
	return &ExitError{Code: ExitUsage, Err: fmt.Errorf("%s", msg)}
}

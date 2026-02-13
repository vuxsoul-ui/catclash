package cli

import (
	"errors"
	"fmt"
	"io"

	"github.com/ossianhempel/things3-cli/internal/things"
)

// Version metadata (override Version at build time with -ldflags).
var (
	Version  = "dev"
	Author   = "Ossian Hempel"
	Homepage = "https://github.com/ossianhempel/things3-cli"
	License  = "MIT"
)

// ErrVersionPrinted is returned to short-circuit command execution.
var ErrVersionPrinted = errors.New("version printed")

func printVersion(out io.Writer) {
	if out == nil {
		return
	}
	fmt.Fprintln(out, "things3-cli")
	fmt.Fprintf(out, "  - Version:  %s\n", Version)
	if Author != "" {
		fmt.Fprintf(out, "  - Author:   %s\n", Author)
	}
	if Homepage != "" {
		fmt.Fprintf(out, "  - Homepage: %s\n", Homepage)
	}
	fmt.Fprintf(out, "  - License:  %s\n", License)
	fmt.Fprintln(out)
	fmt.Fprintln(out, "Things3.app")
	fmt.Fprintf(out, "  - Version:  %s\n", things.ThingsVersion())
	fmt.Fprintln(out, "  - Homepage: https://culturedcode.com/things/")
}

package main

import (
	"os"

	"github.com/tylerwince/grizzly/internal/grizzly"
)

func main() {
	cmd := grizzly.NewRootCmd()
	if err := cmd.Execute(); err != nil {
		os.Exit(grizzly.ExitCode(err))
	}
}

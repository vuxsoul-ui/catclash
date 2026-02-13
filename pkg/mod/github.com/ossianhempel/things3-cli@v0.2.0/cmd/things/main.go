package main

import (
	"fmt"
	"os"

	"github.com/ossianhempel/things3-cli/internal/cli"
)

func main() {
	app := cli.NewApp()
	root := cli.NewRoot(app)
	if err := root.Execute(); err != nil {
		if err == cli.ErrVersionPrinted {
			return
		}
		if err == cli.ErrHelpPrinted {
			return
		}
		fmt.Fprintln(app.Err, cli.FormatError(err))
		os.Exit(1)
	}
}

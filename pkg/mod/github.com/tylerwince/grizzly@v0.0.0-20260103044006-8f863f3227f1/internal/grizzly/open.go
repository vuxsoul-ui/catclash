package grizzly

import (
	"fmt"
	"os/exec"
	"runtime"
)

func openURL(url string) error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("grizzly requires macOS (darwin) to open Bear URLs")
	}
	cmd := exec.Command("open", url)
	return cmd.Run()
}

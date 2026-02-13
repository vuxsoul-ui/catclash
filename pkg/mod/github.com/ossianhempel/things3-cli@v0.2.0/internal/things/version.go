package things

import (
	"os"
	"os/exec"
	"strings"
)

// ThingsVersion returns the installed Things app version or UNKNOWN.
func ThingsVersion() string {
	if stub := os.Getenv("THINGS_VERSION"); stub != "" {
		return stub
	}
	out, err := exec.Command("defaults", "read", "/Applications/Things3.app/Contents/Info", "CFBundleShortVersionString").Output()
	if err != nil {
		return "UNKNOWN"
	}
	return strings.TrimSpace(string(out))
}

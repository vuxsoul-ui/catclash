package cli

import (
	"fmt"
	"strings"
)

// FormatError normalizes Cobra/pflag errors to match reference output.
func FormatError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "Error:") {
		return msg
	}

	if strings.HasPrefix(msg, "unknown command ") {
		cmd := extractQuoted(msg)
		if cmd != "" {
			return fmt.Sprintf("Error: Invalid command `things %s'", cmd)
		}
		return "Error: Invalid command `things'"
	}

	if strings.HasPrefix(msg, "unknown flag: ") {
		opt := strings.TrimPrefix(msg, "unknown flag: ")
		return fmt.Sprintf("Error: Invalid option `%s'", opt)
	}

	if strings.HasPrefix(msg, "flag provided but not defined: ") {
		opt := strings.TrimPrefix(msg, "flag provided but not defined: ")
		return fmt.Sprintf("Error: Invalid option `%s'", opt)
	}

	if strings.HasPrefix(msg, "unknown shorthand flag: ") {
		opt := ""
		if idx := strings.LastIndex(msg, " in "); idx != -1 {
			opt = strings.TrimSpace(msg[idx+4:])
		}
		if opt == "" {
			opt = "-" + extractQuoted(msg)
		}
		if opt != "-" {
			return fmt.Sprintf("Error: Invalid option `%s'", opt)
		}
	}

	return msg
}

func extractQuoted(input string) string {
	start := strings.Index(input, "\"")
	if start == -1 {
		return ""
	}
	end := strings.Index(input[start+1:], "\"")
	if end == -1 {
		return ""
	}
	return input[start+1 : start+1+end]
}

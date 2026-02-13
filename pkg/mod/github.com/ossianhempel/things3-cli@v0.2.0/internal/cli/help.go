package cli

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode"
)

var ErrHelpPrinted = errors.New("help printed")

func printHelp(out io.Writer, content string) {
	if out == nil {
		return
	}
	fmt.Fprint(out, content)
}

func formatHelpText(input string, isTTY bool) string {
	input = strings.ReplaceAll(input, "{{BT}}", "`")
	if !isTTY {
		return input
	}
	lines := strings.Split(input, "\n")
	for i, line := range lines {
		if isAllCaps(line) {
			lines[i] = "\x1b[1m" + line + "\x1b[0m"
		}
	}
	return strings.Join(lines, "\n")
}

func isAllCaps(line string) bool {
	if line == "" {
		return false
	}
	hasLetter := false
	for _, r := range line {
		if unicode.IsLetter(r) {
			hasLetter = true
			if !unicode.IsUpper(r) {
				return false
			}
			continue
		}
		if r == ' ' || r == '-' || r == '_' || unicode.IsDigit(r) {
			continue
		}
		return false
	}
	return hasLetter
}

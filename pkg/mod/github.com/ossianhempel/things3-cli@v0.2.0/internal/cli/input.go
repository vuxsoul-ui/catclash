package cli

import (
	"io"
	"strings"
)

func readInput(in io.Reader, args []string) (string, error) {
	if len(args) == 1 && args[0] == "-" {
		data, err := io.ReadAll(in)
		if err != nil {
			return "", err
		}
		raw := string(data)
		raw = strings.TrimRight(raw, "\r\n")
		return raw, nil
	}
	if len(args) > 0 {
		return strings.Join(args, " "), nil
	}
	return "", nil
}

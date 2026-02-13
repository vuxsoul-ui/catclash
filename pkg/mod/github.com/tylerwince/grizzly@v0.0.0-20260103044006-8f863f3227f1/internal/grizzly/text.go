package grizzly

import (
	"fmt"
)

func resolveTextInput(textFlag string, clipboard bool, allowImplicit bool) (string, bool, error) {
	if textFlag != "" && clipboard {
		return "", false, fmt.Errorf("--text and --clipboard are mutually exclusive")
	}
	if textFlag == "-" {
		text, err := readTextStdin()
		return text, true, err
	}
	if textFlag == "" && allowImplicit && !stdinIsTTY() && !clipboard {
		text, err := readTextStdin()
		return text, true, err
	}
	return textFlag, false, nil
}

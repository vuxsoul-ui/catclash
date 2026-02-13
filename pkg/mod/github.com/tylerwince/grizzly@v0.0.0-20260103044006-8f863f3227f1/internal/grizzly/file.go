package grizzly

import (
	"encoding/base64"
	"fmt"
)

func loadFileParam(path string, filename string) (string, string, bool, error) {
	if path == "" {
		return "", "", false, nil
	}
	usedStdin := path == "-"
	data, err := readFileBytes(path)
	if err != nil {
		return "", "", usedStdin, err
	}
	name := filename
	if name == "" {
		name = deriveFilename(path)
	}
	if name == "" {
		return "", "", usedStdin, fmt.Errorf("filename required for stdin file input")
	}
	encoded := base64.StdEncoding.EncodeToString(data)
	return encoded, name, usedStdin, nil
}

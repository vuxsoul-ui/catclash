package grizzly

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/term"
)

func stdinIsTTY() bool {
	return term.IsTerminal(int(os.Stdin.Fd()))
}

func readAllStdin() ([]byte, error) {
	return io.ReadAll(os.Stdin)
}

func readTextStdin() (string, error) {
	data, err := readAllStdin()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func readFileBytes(path string) ([]byte, error) {
	if path == "" {
		return nil, errors.New("empty file path")
	}
	if path == "-" {
		return readAllStdin()
	}
	expanded, err := expandPath(path)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(expanded)
}

func deriveFilename(path string) string {
	if path == "" || path == "-" {
		return ""
	}
	return filepath.Base(path)
}

func expandPath(path string) (string, error) {
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		if path == "~" {
			return home, nil
		}
		return filepath.Join(home, strings.TrimPrefix(path, "~/")), nil
	}
	return path, nil
}

func readTokenFromFile(path string) (string, error) {
	if path == "" {
		return "", errors.New("empty token file path")
	}
	expanded, err := expandPath(path)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(expanded)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func readTokenFromStdin() (string, error) {
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func confirmPrompt(msg string) (bool, error) {
	fmt.Fprint(os.Stderr, msg)
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return false, err
	}
	response := strings.TrimSpace(strings.ToLower(line))
	return response == "y" || response == "yes", nil
}

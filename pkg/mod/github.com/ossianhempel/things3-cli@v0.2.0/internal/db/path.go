package db

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var ErrDatabaseNotFound = errors.New("things database not found")

// ResolveDatabasePath finds the Things database path.
//
// Priority: override arg, THINGSDB env, default ThingsData-* locations, legacy path.
func ResolveDatabasePath(override string) (string, error) {
	if override != "" {
		return expandHome(override), nil
	}
	if env := strings.TrimSpace(os.Getenv("THINGSDB")); env != "" {
		return expandHome(env), nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}

	pattern := filepath.Join(home, "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac", "ThingsData-*", "Things Database.thingsdatabase", "main.sqlite")
	matches, _ := filepath.Glob(pattern)
	if len(matches) > 0 {
		if path := newestFile(matches); path != "" {
			return path, nil
		}
	}

	legacy := filepath.Join(home, "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac", "Things Database.thingsdatabase", "main.sqlite")
	if fileExists(legacy) {
		return legacy, nil
	}

	return "", ErrDatabaseNotFound
}

func expandHome(path string) string {
	if path == "" {
		return path
	}
	if path[0] != '~' {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	if path == "~" {
		return home
	}
	if strings.HasPrefix(path, "~/") {
		return filepath.Join(home, path[2:])
	}
	return path
}

func newestFile(paths []string) string {
	if len(paths) == 0 {
		return ""
	}
	type entry struct {
		path string
		mod  int64
	}
	entries := make([]entry, 0, len(paths))
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil || info.IsDir() {
			continue
		}
		entries = append(entries, entry{path: p, mod: info.ModTime().UnixNano()})
	}
	if len(entries) == 0 {
		return ""
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].mod > entries[j].mod })
	return entries[0].path
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

package grizzly

import (
	"fmt"
	"net/url"
	"strings"
)

func addStringParam(params url.Values, key, value string) {
	if value != "" {
		params.Set(key, value)
	}
}

func addYesParam(params url.Values, key string, value bool) {
	if value {
		params.Set(key, "yes")
	}
}

func addNoParam(params url.Values, key string, value bool) {
	if value {
		params.Set(key, "no")
	}
}

func mergeTags(tags []string, csv string) (string, error) {
	combined := []string{}
	for _, tag := range tags {
		if strings.TrimSpace(tag) != "" {
			combined = append(combined, strings.TrimSpace(tag))
		}
	}
	if csv != "" {
		parts := strings.Split(csv, ",")
		for _, part := range parts {
			clean := strings.TrimSpace(part)
			if clean != "" {
				combined = append(combined, clean)
			}
		}
	}
	if len(combined) == 0 {
		return "", nil
	}
	return strings.Join(combined, ","), nil
}

func normalizeMode(mode string) (string, error) {
	if mode == "" {
		return "", nil
	}
	switch mode {
	case "append", "prepend", "replace", "replace_all", "replace-all":
		if mode == "replace-all" {
			return "replace_all", nil
		}
		return mode, nil
	default:
		return "", fmt.Errorf("invalid mode: %s", mode)
	}
}

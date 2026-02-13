package cli

import (
	"strings"

	"github.com/ossianhempel/things3-cli/internal/things"
)

func deleteConfirmTarget(id string, rawInput string) string {
	id = strings.TrimSpace(id)
	if id != "" {
		return id
	}
	if rawInput == "" {
		return ""
	}
	title := rawInput
	if things.HasMultipleLines(rawInput) {
		title = things.FindTitle(rawInput)
	}
	return strings.TrimSpace(title)
}

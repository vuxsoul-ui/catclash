package things

import (
	"fmt"
	"strings"
)

// DeleteProjectOptions defines options for delete-project.
type DeleteProjectOptions struct {
	ID string
}

// BuildDeleteProjectScript builds an AppleScript snippet for deleting a project.
func BuildDeleteProjectScript(opts DeleteProjectOptions, rawInput string) (string, error) {
	title := parseSingleLineTitle(rawInput)
	if opts.ID == "" && title == "" {
		return "", errMissingProjectTarget
	}

	target := projectTarget(opts.ID, title)
	var b strings.Builder
	b.WriteString("tell application \"Things3\"\n")
	b.WriteString("  set targetProject to ")
	b.WriteString(target)
	b.WriteString("\n")
	b.WriteString("  delete targetProject\n")
	b.WriteString("end tell")
	return b.String(), nil
}

func projectTarget(id string, title string) string {
	if id == "" {
		return fmt.Sprintf("project \"%s\"", escapeAppleScriptString(title))
	}
	return fmt.Sprintf("first project whose id is \"%s\"", escapeAppleScriptString(id))
}

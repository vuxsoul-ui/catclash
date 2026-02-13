package things

import (
	"fmt"
	"strings"
)

// DeleteTodoOptions defines options for delete.
type DeleteTodoOptions struct {
	ID string
}

// BuildDeleteTodoScript builds an AppleScript snippet for deleting a todo.
func BuildDeleteTodoScript(opts DeleteTodoOptions, rawInput string) (string, error) {
	title := parseSingleLineTitle(rawInput)
	if opts.ID == "" && title == "" {
		return "", errMissingTodoTarget
	}

	target := todoTarget(opts.ID, title)
	var b strings.Builder
	b.WriteString("tell application \"Things3\"\n")
	b.WriteString("  set targetTodo to ")
	b.WriteString(target)
	b.WriteString("\n")
	b.WriteString("  delete targetTodo\n")
	b.WriteString("end tell")
	return b.String(), nil
}

func todoTarget(id string, title string) string {
	if id == "" {
		return fmt.Sprintf("to do \"%s\"", escapeAppleScriptString(title))
	}
	return fmt.Sprintf("first to do whose id is \"%s\"", escapeAppleScriptString(id))
}

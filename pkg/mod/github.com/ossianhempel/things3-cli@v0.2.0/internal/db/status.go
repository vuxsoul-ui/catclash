package db

import (
	"fmt"
	"strings"
)

// ParseStatus parses a status string into a status value.
//
// Empty, "any", or "all" returns nil (no filtering).
func ParseStatus(input string) (*int, error) {
	normalized := strings.TrimSpace(strings.ToLower(input))
	if normalized == "" || normalized == "any" || normalized == "all" {
		return nil, nil
	}
	var status int
	switch normalized {
	case "incomplete", "open", "todo", "active":
		status = StatusIncomplete
	case "completed", "done":
		status = StatusCompleted
	case "canceled", "cancelled":
		status = StatusCanceled
	default:
		return nil, fmt.Errorf("unknown status %q", input)
	}
	return &status, nil
}

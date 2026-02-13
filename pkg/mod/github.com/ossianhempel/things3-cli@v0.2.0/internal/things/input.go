package things

import "strings"

// FindTitle returns the first line of the input.
func FindTitle(input string) string {
	if input == "" {
		return ""
	}
	parts := strings.SplitN(input, "\n", 2)
	return parts[0]
}

// FindNotes returns all lines after the first, trimming blank edges.
func FindNotes(input string) string {
	lines := strings.Split(input, "\n")
	if len(lines) <= 1 {
		return ""
	}

	notes := lines[1:]
	start := 0
	for start < len(notes) && strings.TrimSpace(notes[start]) == "" {
		start++
	}
	end := len(notes)
	for end > start && strings.TrimSpace(notes[end-1]) == "" {
		end--
	}
	if start >= end {
		return ""
	}
	return strings.Join(notes[start:end], "\n")
}

// HasMultipleLines reports whether the input has more than one line.
func HasMultipleLines(input string) bool {
	return strings.Contains(input, "\n")
}

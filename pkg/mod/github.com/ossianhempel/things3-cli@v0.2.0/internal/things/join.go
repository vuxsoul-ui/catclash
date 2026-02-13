package things

import "strings"

// Join joins encoded items with %0A for multiline Things URL values.
func Join(items ...string) string {
	return strings.Join(items, "%0A")
}

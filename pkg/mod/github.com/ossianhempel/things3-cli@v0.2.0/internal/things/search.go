package things

import "strings"

// BuildSearchURL builds a Things URL for the search command.
func BuildSearchURL(query string) string {
	params := make([]string, 0, 1)
	if query != "" {
		params = append(params, "query="+URLEncode(query))
	}
	if len(params) == 0 {
		return "things:///search?"
	}
	return "things:///search?" + strings.Join(params, "&")
}

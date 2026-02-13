package grizzly

import (
	"encoding/json"
	"net/url"
	"strings"
)

func BuildURL(action string, params url.Values) string {
	action = strings.TrimPrefix(action, "/")
	u := url.URL{
		Scheme: "bear",
		Host:   "x-callback-url",
		Path:   "/" + action,
	}
	if params != nil && len(params) > 0 {
		u.RawQuery = params.Encode()
	}
	return u.String()
}

func ParseCallbackValues(values url.Values) map[string]any {
	data := map[string]any{}
	for key, vals := range values {
		if len(vals) == 0 {
			continue
		}
		if key == "tags" || key == "notes" {
			if parsed, ok := parseJSONValue(vals[0]); ok {
				data[key] = parsed
				continue
			}
		}
		if len(vals) == 1 {
			data[key] = vals[0]
		} else {
			var list []string
			for _, item := range vals {
				list = append(list, item)
			}
			data[key] = list
		}
	}
	return data
}

func parseJSONValue(raw string) (any, bool) {
	var parsed any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, false
	}
	return parsed, true
}

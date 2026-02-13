package things

// ShowOptions defines options for show.
type ShowOptions struct {
	Filter string
	ID     string
}

// BuildShowURL builds a Things URL for the show command.
func BuildShowURL(opts ShowOptions, query string) (string, error) {
	url := "things:///show?"

	if opts.ID != "" {
		url += "id=" + URLEncode(opts.ID) + "&"
	} else if query != "" {
		url += "query=" + URLEncode(query) + "&"
	} else {
		return "", errMissingShowTarget
	}

	if opts.Filter != "" {
		url += "filter=" + URLEncode(opts.Filter) + "&"
	}

	return url, nil
}

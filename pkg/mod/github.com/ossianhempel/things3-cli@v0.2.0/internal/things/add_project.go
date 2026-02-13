package things

import "strings"

// AddProjectOptions defines options for add-project.
type AddProjectOptions struct {
	AreaID         string
	Area           string
	Canceled       bool
	Completed      bool
	CompletionDate string
	CreationDate   string
	Deadline       string
	Notes          string
	Reveal         bool
	Tags           string
	When           string
	Todos          []string
}

// BuildAddProjectURL builds a Things URL for the add-project command.
func BuildAddProjectURL(opts AddProjectOptions, rawInput string) string {
	var title string
	notes := opts.Notes

	if rawInput != "" {
		if HasMultipleLines(rawInput) {
			title = FindTitle(rawInput)
			notes = FindNotes(rawInput)
		} else {
			title = rawInput
		}
	}

	params := make([]string, 0, 16)

	if title != "" {
		params = append(params, "title="+URLEncode(title))
	}

	if opts.When != "" {
		params = append(params, "when="+URLEncode(opts.When))
	}

	if opts.Deadline != "" {
		params = append(params, "deadline="+URLEncode(opts.Deadline))
	}

	if len(opts.Todos) > 0 {
		encoded := make([]string, 0, len(opts.Todos))
		for _, todo := range opts.Todos {
			encoded = append(encoded, URLEncode(todo))
		}
		params = append(params, "to-dos="+Join(encoded...))
	}

	if opts.Reveal {
		params = append(params, "reveal=true")
	}

	if opts.Tags != "" {
		params = append(params, "tags="+URLEncode(opts.Tags))
	}

	if notes != "" {
		params = append(params, "notes="+URLEncode(notes))
	}

	if opts.CreationDate != "" {
		params = append(params, "creation-date="+URLEncode(opts.CreationDate))
	}

	if opts.CompletionDate != "" {
		params = append(params, "completion-date="+URLEncode(opts.CompletionDate))
	}

	if opts.Canceled {
		params = append(params, "canceled=true")
	} else if opts.Completed {
		params = append(params, "completed=true")
	}

	if opts.AreaID != "" {
		params = append(params, "area-id="+URLEncode(opts.AreaID))
	} else if opts.Area != "" {
		params = append(params, "area="+URLEncode(opts.Area))
	}

	if len(params) == 0 {
		return "things:///add-project?"
	}
	return "things:///add-project?" + strings.Join(params, "&") + "&"
}

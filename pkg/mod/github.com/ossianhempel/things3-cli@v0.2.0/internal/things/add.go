package things

import "strings"

// AddOptions defines options for the add command.
type AddOptions struct {
	When           string
	Deadline       string
	Completed      bool
	Canceled       bool
	ChecklistItems []string
	CreationDate   string
	CompletionDate string
	List           string
	ListID         string
	Heading        string
	Reveal         bool
	ShowQuickEntry bool
	Notes          string
	Tags           string
	TitlesRaw      string
	UseClipboard   string
}

// BuildAddURL builds a Things URL for the add command.
func BuildAddURL(opts AddOptions, rawInput string) string {
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

	showQuickEntry := opts.ShowQuickEntry || (title == "" && opts.TitlesRaw == "")

	params := make([]string, 0, 16)

	if len(opts.ChecklistItems) > 0 {
		encoded := make([]string, 0, len(opts.ChecklistItems))
		for _, item := range opts.ChecklistItems {
			encoded = append(encoded, URLEncode(item))
		}
		params = append(params, "checklist-items="+Join(encoded...))
	}

	if opts.When != "" {
		params = append(params, "when="+URLEncode(opts.When))
	}

	if opts.Deadline != "" {
		params = append(params, "deadline="+URLEncode(opts.Deadline))
	}

	if opts.TitlesRaw != "" {
		titles := strings.Split(opts.TitlesRaw, ",")
		encoded := make([]string, 0, len(titles))
		for _, t := range titles {
			encoded = append(encoded, URLEncode(t))
		}
		params = append(params, "titles="+Join(encoded...))
	} else if title != "" {
		params = append(params, "title="+URLEncode(title))
	}

	if notes != "" {
		params = append(params, "notes="+URLEncode(notes))
	}

	if opts.UseClipboard != "" {
		params = append(params, "use-clipboard="+opts.UseClipboard)
	}

	if opts.Heading != "" {
		params = append(params, "heading="+URLEncode(opts.Heading))
	}

	if showQuickEntry {
		params = append(params, "show-quick-entry=true")
	}

	if opts.Reveal {
		params = append(params, "reveal=true")
	}

	if opts.Tags != "" {
		params = append(params, "tags="+URLEncode(opts.Tags))
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

	if opts.ListID != "" {
		params = append(params, "list-id="+URLEncode(opts.ListID))
	} else if opts.List != "" {
		params = append(params, "list="+URLEncode(opts.List))
	}

	if len(params) == 0 {
		return "things:///add?"
	}
	return "things:///add?" + strings.Join(params, "&") + "&"
}

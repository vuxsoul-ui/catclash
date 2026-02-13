package grizzly

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
)

type OutputMode int

const (
	ModeHuman OutputMode = iota
	ModePlain
	ModeJSON
)

type Outputter struct {
	opts   *Options
	stdout io.Writer
	stderr io.Writer
}

func NewOutputter(opts *Options) *Outputter {
	return &Outputter{
		opts:   opts,
		stdout: os.Stdout,
		stderr: os.Stderr,
	}
}

func (o *Outputter) mode() OutputMode {
	if o.opts.JSON {
		return ModeJSON
	}
	if o.opts.Plain {
		return ModePlain
	}
	return ModeHuman
}

func (o *Outputter) WriteSuccess(res Result) {
	switch o.mode() {
	case ModeJSON:
		o.writeJSON(res, nil)
	case ModePlain:
		o.writePlain(res, true, nil)
	default:
		o.writeHuman(res)
	}
}

func (o *Outputter) WriteError(res Result, info ErrorInfo, exitCode int) error {
	switch o.mode() {
	case ModeJSON:
		o.writeJSON(res, &info)
	case ModePlain:
		o.writePlain(res, false, &info)
	default:
		if info.Code != "" {
			fmt.Fprintf(o.stderr, "error: %s (%s)\n", info.Message, info.Code)
		} else {
			fmt.Fprintf(o.stderr, "error: %s\n", info.Message)
		}
	}
	return &ExitError{Code: exitCode, Err: fmt.Errorf("%s", info.Message)}
}

func (o *Outputter) writeJSON(res Result, errInfo *ErrorInfo) {
	payload := struct {
		OK     bool           `json:"ok"`
		Action string         `json:"action,omitempty"`
		URL    string         `json:"url,omitempty"`
		Data   map[string]any `json:"data,omitempty"`
		Error  *ErrorInfo     `json:"error,omitempty"`
	}{
		OK:     errInfo == nil,
		Action: res.Action,
		URL:    res.URL,
		Data:   res.Data,
		Error:  errInfo,
	}

	enc := json.NewEncoder(o.stdout)
	_ = enc.Encode(payload)
}

func (o *Outputter) writePlain(res Result, ok bool, errInfo *ErrorInfo) {
	writeLine := func(key, value string) {
		fmt.Fprintf(o.stdout, "%s=%s\n", key, value)
	}

	writeLine("ok", strconv.FormatBool(ok))
	if res.Action != "" {
		writeLine("action", res.Action)
	}
	if (o.opts.PrintURL || o.opts.DryRun || o.opts.JSON) && res.URL != "" {
		writeLine("url", res.URL)
	}
	if errInfo != nil {
		writeLine("error", escapePlain(errInfo.Message))
		if errInfo.Code != "" {
			writeLine("error_code", escapePlain(errInfo.Code))
		}
		return
	}

	if len(res.Data) == 0 {
		return
	}

	keys := make([]string, 0, len(res.Data))
	for k := range res.Data {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		val := res.Data[key]
		switch typed := val.(type) {
		case string:
			writeLine(key, escapePlain(typed))
		case []string:
			for _, item := range typed {
				writeLine(key, escapePlain(item))
			}
		case []any:
			for _, item := range typed {
				line := formatJSONLine(item)
				writeLine(key, escapePlain(line))
			}
		case []map[string]any:
			for _, item := range typed {
				line := formatJSONLine(item)
				writeLine(key, escapePlain(line))
			}
		default:
			writeLine(key, escapePlain(fmt.Sprintf("%v", typed)))
		}
	}
}

func (o *Outputter) writeHuman(res Result) {
	if o.opts.Quiet && !o.opts.PrintURL && !o.opts.DryRun {
		return
	}
	if (o.opts.PrintURL || o.opts.DryRun) && res.URL != "" {
		fmt.Fprintln(o.stdout, res.URL)
		if o.opts.DryRun {
			return
		}
	}
	if len(res.Data) == 0 {
		if !o.opts.Quiet {
			fmt.Fprintln(o.stdout, "OK")
		}
		return
	}
	if note, ok := res.Data["note"].(string); ok {
		fmt.Fprint(o.stdout, note)
		if !strings.HasSuffix(note, "\n") {
			fmt.Fprintln(o.stdout)
		}
		return
	}
	if tags := extractTagNames(res.Data["tags"]); len(tags) > 0 {
		for _, tag := range tags {
			fmt.Fprintln(o.stdout, tag)
		}
		return
	}
	if notes := extractNotes(res.Data["notes"]); len(notes) > 0 {
		for _, note := range notes {
			fmt.Fprintln(o.stdout, note)
		}
		return
	}
	if title, ok := res.Data["title"].(string); ok && title != "" {
		if id, ok := res.Data["identifier"].(string); ok && id != "" {
			fmt.Fprintf(o.stdout, "%s (%s)\n", title, id)
			return
		}
		fmt.Fprintln(o.stdout, title)
		return
	}
	if id, ok := res.Data["identifier"].(string); ok && id != "" {
		fmt.Fprintln(o.stdout, id)
		return
	}
	for key, value := range res.Data {
		fmt.Fprintf(o.stdout, "%s: %v\n", key, value)
	}
}

func formatJSONLine(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(data)
}

func escapePlain(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "\n", "\\n")
	value = strings.ReplaceAll(value, "\r", "\\r")
	value = strings.ReplaceAll(value, "\t", "\\t")
	return value
}

func extractTagNames(value any) []string {
	var tags []string
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		for _, item := range typed {
			switch tag := item.(type) {
			case map[string]any:
				if name, ok := tag["name"].(string); ok {
					tags = append(tags, name)
				}
			case string:
				tags = append(tags, tag)
			}
		}
	case []map[string]any:
		for _, item := range typed {
			if name, ok := item["name"].(string); ok {
				tags = append(tags, name)
			}
		}
	case string:
		if typed != "" {
			tags = append(tags, typed)
		}
	}
	return tags
}

func extractNotes(value any) []string {
	var notes []string
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if note, ok := item.(map[string]any); ok {
				notes = append(notes, formatNoteLine(note))
			}
		}
	case []map[string]any:
		for _, note := range typed {
			notes = append(notes, formatNoteLine(note))
		}
	case string:
		if typed != "" {
			notes = append(notes, typed)
		}
	}
	return notes
}

func formatNoteLine(note map[string]any) string {
	title, _ := note["title"].(string)
	identifier, _ := note["identifier"].(string)
	if title != "" && identifier != "" {
		return fmt.Sprintf("%s\t%s", title, identifier)
	}
	if title != "" {
		return title
	}
	if identifier != "" {
		return identifier
	}
	return formatJSONLine(note)
}

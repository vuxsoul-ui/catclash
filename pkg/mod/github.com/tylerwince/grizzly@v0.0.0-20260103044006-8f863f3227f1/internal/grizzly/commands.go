package grizzly

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/spf13/cobra"
)

func AddCommands(root *cobra.Command, opts *Options) {
	root.AddCommand(newOpenNoteCmd(opts))
	root.AddCommand(newCreateCmd(opts))
	root.AddCommand(newAddTextCmd(opts))
	root.AddCommand(newAddFileCmd(opts))
	root.AddCommand(newTagsCmd(opts))
	root.AddCommand(newOpenTagCmd(opts))
	root.AddCommand(newRenameTagCmd(opts))
	root.AddCommand(newDeleteTagCmd(opts))
	root.AddCommand(newTrashCmd(opts))
	root.AddCommand(newArchiveCmd(opts))
	root.AddCommand(newUntaggedCmd(opts))
	root.AddCommand(newTodoCmd(opts))
	root.AddCommand(newTodayCmd(opts))
	root.AddCommand(newLockedCmd(opts))
	root.AddCommand(newSearchCmd(opts))
	root.AddCommand(newGrabURLCmd(opts))
	root.AddCommand(newCompletionCmd(root))
}

func newOpenNoteCmd(opts *Options) *cobra.Command {
	var id string
	var title string
	var header string
	var excludeTrashed bool
	var newWindow bool
	var floatWindow bool
	var noShowWindow bool
	var noOpen bool
	var selected bool
	var pin bool
	var edit bool
	var find string

	cmd := &cobra.Command{
		Use:   "open-note",
		Short: "Open a note by id or title and optionally return content",
		RunE: func(cmd *cobra.Command, args []string) error {
			if selected && (id != "" || title != "") {
				return usageError(cmd, "--selected cannot be combined with --id or --title")
			}
			if id == "" && title == "" && !selected {
				return usageError(cmd, "one of --id, --title, or --selected is required")
			}
			params := url.Values{}
			addStringParam(params, "id", id)
			addStringParam(params, "title", title)
			addStringParam(params, "header", header)
			addStringParam(params, "search", find)
			addYesParam(params, "exclude_trashed", excludeTrashed)
			addYesParam(params, "new_window", newWindow)
			addYesParam(params, "float", floatWindow)
			addNoParam(params, "show_window", noShowWindow)
			addNoParam(params, "open_note", noOpen)
			addYesParam(params, "selected", selected)
			addYesParam(params, "pin", pin)
			addYesParam(params, "edit", edit)
			if selected {
				token, err := maybeRequireToken(opts, true)
				if err != nil {
					return &ExitError{Code: ExitUsage, Err: err}
				}
				params.Set("token", token)
			}
			return executeAction(opts, "open-note", params)
		},
	}

	cmd.Flags().StringVar(&id, "id", "", "Note identifier")
	cmd.Flags().StringVar(&title, "title", "", "Note title")
	cmd.Flags().StringVar(&header, "header", "", "Header inside the note")
	cmd.Flags().BoolVar(&excludeTrashed, "exclude-trashed", false, "Exclude trashed notes")
	cmd.Flags().BoolVar(&newWindow, "new-window", false, "Open in a new window (macOS)")
	cmd.Flags().BoolVar(&floatWindow, "float", false, "Float the new window on top (macOS)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not display the note in Bear's main window")
	cmd.Flags().BoolVar(&selected, "selected", false, "Use the note currently selected in Bear (token required)")
	cmd.Flags().BoolVar(&pin, "pin", false, "Pin the note to the top of the list")
	cmd.Flags().BoolVar(&edit, "edit", false, "Place cursor inside the note editor")
	cmd.Flags().StringVar(&find, "find", "", "Open in-note search with the specified text")

	return cmd
}

func newCreateCmd(opts *Options) *cobra.Command {
	var title string
	var text string
	var clipboard bool
	var tags []string
	var tagsCSV string
	var filePath string
	var filename string
	var noOpen bool
	var newWindow bool
	var floatWindow bool
	var noShowWindow bool
	var pin bool
	var edit bool
	var timestamp bool
	var typeStr string
	var baseURL string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new note",
		RunE: func(cmd *cobra.Command, args []string) error {
			stdinIsText := false
			if text == "-" || (text == "" && !clipboard && filePath == "" && !stdinIsTTY()) {
				stdinIsText = true
			}
			fileUsesStdin := filePath == "-"
			if err := ensureNoStdinConflict(opts.TokenStdin, stdinIsText || fileUsesStdin); err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			resolvedText, usedStdin, err := resolveTextInput(text, clipboard, filePath == "")
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			stdinIsText = usedStdin

			fileData, fileName, fileUsedStdin, err := loadFileParam(filePath, filename)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if fileUsedStdin && stdinIsText {
				return &ExitError{Code: ExitUsage, Err: fmt.Errorf("cannot read both text and file from stdin")}
			}

			if title == "" && resolvedText == "" && !clipboard && fileData == "" {
				return usageError(cmd, "note content required (use --text, --clipboard, --file, or --title)")
			}

			if typeStr != "" && typeStr != "html" && typeStr != "markdown" {
				return usageError(cmd, "--type must be html or markdown")
			}
			if typeStr != "html" && baseURL != "" {
				return usageError(cmd, "--url requires --type html")
			}

			tagParam, err := mergeTags(tags, tagsCSV)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			params := url.Values{}
			addStringParam(params, "title", title)
			if resolvedText != "" {
				addStringParam(params, "text", resolvedText)
			}
			addYesParam(params, "clipboard", clipboard)
			addStringParam(params, "tags", tagParam)
			if fileData != "" {
				params.Set("file", fileData)
				params.Set("filename", fileName)
			}
			addNoParam(params, "open_note", noOpen)
			addYesParam(params, "new_window", newWindow)
			addYesParam(params, "float", floatWindow)
			addNoParam(params, "show_window", noShowWindow)
			addYesParam(params, "pin", pin)
			addYesParam(params, "edit", edit)
			addYesParam(params, "timestamp", timestamp)
			if typeStr == "html" {
				params.Set("type", "html")
				addStringParam(params, "url", baseURL)
			}

			return executeAction(opts, "create", params)
		},
	}

	cmd.Flags().StringVar(&title, "title", "", "Note title")
	cmd.Flags().StringVar(&text, "text", "", "Note body text (use - for stdin)")
	cmd.Flags().BoolVar(&clipboard, "clipboard", false, "Use clipboard text as body")
	cmd.Flags().StringArrayVar(&tags, "tag", nil, "Tag to apply (repeatable)")
	cmd.Flags().StringVar(&tagsCSV, "tags", "", "Comma-separated tags")
	cmd.Flags().StringVar(&filePath, "file", "", "Attach file (path or - for stdin)")
	cmd.Flags().StringVar(&filename, "filename", "", "Attachment filename")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not display the note in Bear's main window")
	cmd.Flags().BoolVar(&newWindow, "new-window", false, "Open in a new window (macOS)")
	cmd.Flags().BoolVar(&floatWindow, "float", false, "Float the new window on top (macOS)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	cmd.Flags().BoolVar(&pin, "pin", false, "Pin the note to the top of the list")
	cmd.Flags().BoolVar(&edit, "edit", false, "Place cursor inside the note editor")
	cmd.Flags().BoolVar(&timestamp, "timestamp", false, "Prepend current date/time to the text")
	cmd.Flags().StringVar(&typeStr, "type", "", "Content type (html or markdown)")
	cmd.Flags().StringVar(&baseURL, "url", "", "Base URL for relative links when --type html")

	return cmd
}

func newAddTextCmd(opts *Options) *cobra.Command {
	var id string
	var title string
	var selected bool
	var text string
	var clipboard bool
	var header string
	var mode string
	var newLine bool
	var tags []string
	var tagsCSV string
	var excludeTrashed bool
	var noOpen bool
	var newWindow bool
	var noShowWindow bool
	var edit bool
	var timestamp bool

	cmd := &cobra.Command{
		Use:   "add-text",
		Short: "Append or prepend text to an existing note",
		RunE: func(cmd *cobra.Command, args []string) error {
			if selected && (id != "" || title != "") {
				return usageError(cmd, "--selected cannot be combined with --id or --title")
			}
			if id == "" && title == "" && !selected {
				return usageError(cmd, "one of --id, --title, or --selected is required")
			}

			if err := ensureNoStdinConflict(opts.TokenStdin, text == "-" || (!stdinIsTTY() && text == "" && !clipboard)); err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			resolvedText, _, err := resolveTextInput(text, clipboard, true)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if resolvedText == "" && !clipboard {
				return usageError(cmd, "text required (use --text or --clipboard)")
			}

			modeParam, err := normalizeMode(mode)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if newLine && modeParam != "" && modeParam != "append" {
				return usageError(cmd, "--new-line only applies to --mode append")
			}

			tagParam, err := mergeTags(tags, tagsCSV)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			params := url.Values{}
			addStringParam(params, "id", id)
			addStringParam(params, "title", title)
			addYesParam(params, "selected", selected)
			if selected {
				token, err := maybeRequireToken(opts, true)
				if err != nil {
					return &ExitError{Code: ExitUsage, Err: err}
				}
				params.Set("token", token)
			}
			if resolvedText != "" {
				params.Set("text", resolvedText)
			}
			addYesParam(params, "clipboard", clipboard)
			addStringParam(params, "header", header)
			addStringParam(params, "mode", modeParam)
			addYesParam(params, "new_line", newLine)
			addStringParam(params, "tags", tagParam)
			addYesParam(params, "exclude_trashed", excludeTrashed)
			addNoParam(params, "open_note", noOpen)
			addYesParam(params, "new_window", newWindow)
			addNoParam(params, "show_window", noShowWindow)
			addYesParam(params, "edit", edit)
			addYesParam(params, "timestamp", timestamp)

			return executeAction(opts, "add-text", params)
		},
	}

	cmd.Flags().StringVar(&id, "id", "", "Note identifier")
	cmd.Flags().StringVar(&title, "title", "", "Note title")
	cmd.Flags().BoolVar(&selected, "selected", false, "Use the note currently selected in Bear (token required)")
	cmd.Flags().StringVar(&text, "text", "", "Text to add (use - for stdin)")
	cmd.Flags().BoolVar(&clipboard, "clipboard", false, "Use clipboard text")
	cmd.Flags().StringVar(&header, "header", "", "Header inside the note")
	cmd.Flags().StringVar(&mode, "mode", "", "Mode: append, prepend, replace, replace-all")
	cmd.Flags().BoolVar(&newLine, "new-line", false, "Force new line when appending")
	cmd.Flags().StringArrayVar(&tags, "tag", nil, "Tag to apply (repeatable)")
	cmd.Flags().StringVar(&tagsCSV, "tags", "", "Comma-separated tags")
	cmd.Flags().BoolVar(&excludeTrashed, "exclude-trashed", false, "Exclude trashed notes")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not display the note in Bear's main window")
	cmd.Flags().BoolVar(&newWindow, "new-window", false, "Open in a new window (macOS)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	cmd.Flags().BoolVar(&edit, "edit", false, "Place cursor inside the note editor")
	cmd.Flags().BoolVar(&timestamp, "timestamp", false, "Prepend current date/time to the text")

	return cmd
}

func newAddFileCmd(opts *Options) *cobra.Command {
	var id string
	var title string
	var selected bool
	var filePath string
	var filename string
	var header string
	var mode string
	var noOpen bool
	var newWindow bool
	var noShowWindow bool
	var edit bool

	cmd := &cobra.Command{
		Use:   "add-file",
		Short: "Append or prepend a file to an existing note",
		RunE: func(cmd *cobra.Command, args []string) error {
			if selected && (id != "" || title != "") {
				return usageError(cmd, "--selected cannot be combined with --id or --title")
			}
			if id == "" && title == "" && !selected {
				return usageError(cmd, "one of --id, --title, or --selected is required")
			}
			if filePath == "" {
				return usageError(cmd, "--file is required")
			}
			if err := ensureNoStdinConflict(opts.TokenStdin, filePath == "-"); err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			modeParam, err := normalizeMode(mode)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			fileData, fileName, _, err := loadFileParam(filePath, filename)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}

			params := url.Values{}
			addStringParam(params, "id", id)
			addStringParam(params, "title", title)
			addYesParam(params, "selected", selected)
			if selected {
				token, err := maybeRequireToken(opts, true)
				if err != nil {
					return &ExitError{Code: ExitUsage, Err: err}
				}
				params.Set("token", token)
			}
			params.Set("file", fileData)
			params.Set("filename", fileName)
			addStringParam(params, "header", header)
			addStringParam(params, "mode", modeParam)
			addNoParam(params, "open_note", noOpen)
			addYesParam(params, "new_window", newWindow)
			addNoParam(params, "show_window", noShowWindow)
			addYesParam(params, "edit", edit)

			return executeAction(opts, "add-file", params)
		},
	}

	cmd.Flags().StringVar(&id, "id", "", "Note identifier")
	cmd.Flags().StringVar(&title, "title", "", "Note title")
	cmd.Flags().BoolVar(&selected, "selected", false, "Use the note currently selected in Bear (token required)")
	cmd.Flags().StringVar(&filePath, "file", "", "File to add (path or - for stdin)")
	cmd.Flags().StringVar(&filename, "filename", "", "File name with extension")
	cmd.Flags().StringVar(&header, "header", "", "Header inside the note")
	cmd.Flags().StringVar(&mode, "mode", "", "Mode: append, prepend, replace, replace-all")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not display the note in Bear's main window")
	cmd.Flags().BoolVar(&newWindow, "new-window", false, "Open in a new window (macOS)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	cmd.Flags().BoolVar(&edit, "edit", false, "Place cursor inside the note editor")

	return cmd
}

func newTagsCmd(opts *Options) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tags",
		Short: "List tags currently displayed in Bear",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, err := maybeRequireToken(opts, true)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			params := url.Values{}
			params.Set("token", token)
			return executeAction(opts, "tags", params)
		},
	}
	return cmd
}

func newOpenTagCmd(opts *Options) *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "open-tag",
		Short: "Show notes that match a tag",
		RunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return usageError(cmd, "--name is required")
			}
			params := url.Values{}
			params.Set("name", name)
			token, err := resolveToken(opts)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if token != "" {
				params.Set("token", token)
			}
			return executeAction(opts, "open-tag", params)
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Tag name or comma-separated list")
	return cmd
}

func newRenameTagCmd(opts *Options) *cobra.Command {
	var name string
	var newName string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "rename-tag",
		Short: "Rename an existing tag",
		RunE: func(cmd *cobra.Command, args []string) error {
			if name == "" || newName == "" {
				return usageError(cmd, "--name and --new-name are required")
			}
			params := url.Values{}
			params.Set("name", name)
			params.Set("new_name", newName)
			addNoParam(params, "show_window", noShowWindow)
			return executeAction(opts, "rename-tag", params)
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Existing tag name")
	cmd.Flags().StringVar(&newName, "new-name", "", "New tag name")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newDeleteTagCmd(opts *Options) *cobra.Command {
	var name string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "delete-tag",
		Short: "Delete an existing tag",
		RunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return usageError(cmd, "--name is required")
			}
			if !opts.DryRun {
				if err := ensureForceOrPrompt(opts, "Delete tag? [y/N]: "); err != nil {
					return &ExitError{Code: ExitFailure, Err: err}
				}
			}
			params := url.Values{}
			params.Set("name", name)
			addNoParam(params, "show_window", noShowWindow)
			return executeAction(opts, "delete-tag", params)
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Tag name")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newTrashCmd(opts *Options) *cobra.Command {
	var id string
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "trash",
		Short: "Move a note to Bear trash",
		RunE: func(cmd *cobra.Command, args []string) error {
			if id == "" && search == "" {
				return usageError(cmd, "--id or --search is required")
			}
			if !opts.DryRun {
				if err := ensureForceOrPrompt(opts, "Move note to trash? [y/N]: "); err != nil {
					return &ExitError{Code: ExitFailure, Err: err}
				}
			}
			params := url.Values{}
			addStringParam(params, "id", id)
			if id == "" {
				addStringParam(params, "search", search)
			}
			addNoParam(params, "show_window", noShowWindow)
			return executeAction(opts, "trash", params)
		},
	}
	cmd.Flags().StringVar(&id, "id", "", "Note identifier")
	cmd.Flags().StringVar(&search, "search", "", "Search term (ignored if --id is provided)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newArchiveCmd(opts *Options) *cobra.Command {
	var id string
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "archive",
		Short: "Move a note to Bear archive",
		RunE: func(cmd *cobra.Command, args []string) error {
			if id == "" && search == "" {
				return usageError(cmd, "--id or --search is required")
			}
			if !opts.DryRun {
				if err := ensureForceOrPrompt(opts, "Move note to archive? [y/N]: "); err != nil {
					return &ExitError{Code: ExitFailure, Err: err}
				}
			}
			params := url.Values{}
			addStringParam(params, "id", id)
			if id == "" {
				addStringParam(params, "search", search)
			}
			addNoParam(params, "show_window", noShowWindow)
			return executeAction(opts, "archive", params)
		},
	}
	cmd.Flags().StringVar(&id, "id", "", "Note identifier")
	cmd.Flags().StringVar(&search, "search", "", "Search term (ignored if --id is provided)")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newUntaggedCmd(opts *Options) *cobra.Command {
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "untagged",
		Short: "Show untagged notes",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := url.Values{}
			addStringParam(params, "search", search)
			addNoParam(params, "show_window", noShowWindow)
			token, err := resolveToken(opts)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if token != "" {
				params.Set("token", token)
			}
			return executeAction(opts, "untagged", params)
		},
	}
	cmd.Flags().StringVar(&search, "search", "", "Search term")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newTodoCmd(opts *Options) *cobra.Command {
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "todo",
		Short: "Show todo notes",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := url.Values{}
			addStringParam(params, "search", search)
			addNoParam(params, "show_window", noShowWindow)
			token, err := resolveToken(opts)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if token != "" {
				params.Set("token", token)
			}
			return executeAction(opts, "todo", params)
		},
	}
	cmd.Flags().StringVar(&search, "search", "", "Search term")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newTodayCmd(opts *Options) *cobra.Command {
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "today",
		Short: "Show today's notes",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := url.Values{}
			addStringParam(params, "search", search)
			addNoParam(params, "show_window", noShowWindow)
			token, err := resolveToken(opts)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if token != "" {
				params.Set("token", token)
			}
			return executeAction(opts, "today", params)
		},
	}
	cmd.Flags().StringVar(&search, "search", "", "Search term")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newLockedCmd(opts *Options) *cobra.Command {
	var search string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "locked",
		Short: "Show locked notes",
		RunE: func(cmd *cobra.Command, args []string) error {
			params := url.Values{}
			addStringParam(params, "search", search)
			addNoParam(params, "show_window", noShowWindow)
			return executeAction(opts, "locked", params)
		},
	}
	cmd.Flags().StringVar(&search, "search", "", "Search term")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newSearchCmd(opts *Options) *cobra.Command {
	var term string
	var tag string
	var noShowWindow bool

	cmd := &cobra.Command{
		Use:   "search",
		Short: "Search notes",
		RunE: func(cmd *cobra.Command, args []string) error {
			if term == "" && tag == "" {
				return usageError(cmd, "--term or --tag is required")
			}
			params := url.Values{}
			addStringParam(params, "term", term)
			addStringParam(params, "tag", tag)
			addNoParam(params, "show_window", noShowWindow)
			token, err := resolveToken(opts)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			if token != "" {
				params.Set("token", token)
			}
			return executeAction(opts, "search", params)
		},
	}
	cmd.Flags().StringVar(&term, "term", "", "Search term")
	cmd.Flags().StringVar(&tag, "tag", "", "Tag to search within")
	cmd.Flags().BoolVar(&noShowWindow, "no-show-window", false, "Do not force Bear main window to open (macOS)")
	return cmd
}

func newGrabURLCmd(opts *Options) *cobra.Command {
	var pageURL string
	var tags []string
	var tagsCSV string
	var pin bool
	var noWait bool

	cmd := &cobra.Command{
		Use:   "grab-url",
		Short: "Create a note from a web page",
		RunE: func(cmd *cobra.Command, args []string) error {
			if pageURL == "" {
				return usageError(cmd, "--url is required")
			}
			tagParam, err := mergeTags(tags, tagsCSV)
			if err != nil {
				return &ExitError{Code: ExitUsage, Err: err}
			}
			params := url.Values{}
			params.Set("url", pageURL)
			addStringParam(params, "tags", tagParam)
			addYesParam(params, "pin", pin)
			if noWait {
				params.Set("wait", "no")
			}
			return executeAction(opts, "grab-url", params)
		},
	}
	cmd.Flags().StringVar(&pageURL, "url", "", "URL to grab")
	cmd.Flags().StringArrayVar(&tags, "tag", nil, "Tag to apply (repeatable)")
	cmd.Flags().StringVar(&tagsCSV, "tags", "", "Comma-separated tags")
	cmd.Flags().BoolVar(&pin, "pin", false, "Pin the note to the top of the list")
	cmd.Flags().BoolVar(&noWait, "no-wait", false, "Do not wait for Bear to finish grabbing")
	return cmd
}

func newCompletionCmd(root *cobra.Command) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "completion <bash|zsh|fish>",
		Short: "Generate shell completion scripts",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			shell := strings.ToLower(args[0])
			switch shell {
			case "bash":
				return root.GenBashCompletion(cmd.OutOrStdout())
			case "zsh":
				return root.GenZshCompletion(cmd.OutOrStdout())
			case "fish":
				return root.GenFishCompletion(cmd.OutOrStdout(), true)
			default:
				return usageError(cmd, "unsupported shell: %s", shell)
			}
		},
	}
	return cmd
}

package grizzly

import "time"

type Options struct {
	Quiet          bool
	Verbose        bool
	JSON           bool
	Plain          bool
	NoColor        bool
	DryRun         bool
	PrintURL       bool
	EnableCallback bool
	NoCallback     bool
	Callback       string
	Timeout        time.Duration
	TokenFile      string
	TokenStdin     bool
	NoInput        bool
	Force          bool
	ShowVersion    bool
}

type Config struct {
	TokenFile   string
	CallbackURL string
	Timeout     time.Duration
	TimeoutSet  bool
}

type Result struct {
	Action string
	URL    string
	Data   map[string]any
}

type ErrorInfo struct {
	Message string
	Code    string
}

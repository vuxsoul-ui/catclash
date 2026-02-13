package grizzly

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var Version = "dev"

func NewRootCmd() *cobra.Command {
	opts := &Options{}

	root := &cobra.Command{
		Use:           "grizzly",
		Short:         "Interact with Bear notes via x-callback-url",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.SetOut(os.Stderr)
	root.SetErr(os.Stderr)

	root.PersistentFlags().BoolVar(&opts.ShowVersion, "version", false, "Print version")
	root.PersistentFlags().BoolVarP(&opts.Quiet, "quiet", "q", false, "Suppress success output")
	root.PersistentFlags().BoolVarP(&opts.Verbose, "verbose", "v", false, "Verbose diagnostics")
	root.PersistentFlags().BoolVar(&opts.JSON, "json", false, "Output JSON")
	root.PersistentFlags().BoolVar(&opts.Plain, "plain", false, "Output plain text")
	root.PersistentFlags().BoolVar(&opts.NoColor, "no-color", false, "Disable color output")
	root.PersistentFlags().BoolVar(&opts.DryRun, "dry-run", false, "Print URL without opening Bear")
	root.PersistentFlags().BoolVar(&opts.PrintURL, "print-url", false, "Print generated Bear URL")
	root.PersistentFlags().BoolVar(&opts.EnableCallback, "enable-callback", false, "Enable x-callback handling")
	root.PersistentFlags().BoolVar(&opts.NoCallback, "no-callback", false, "Disable x-callback handling even if enabled")
	root.PersistentFlags().StringVar(&opts.Callback, "callback", "", "Use a custom x-callback URL (implies callback enabled)")
	root.PersistentFlags().DurationVar(&opts.Timeout, "timeout", 5*time.Second, "Wait for x-callback when enabled (0 disables waiting)")
	root.PersistentFlags().StringVar(&opts.TokenFile, "token-file", "", "Read Bear API token from file")
	root.PersistentFlags().BoolVar(&opts.TokenStdin, "token-stdin", false, "Read Bear API token from stdin")
	root.PersistentFlags().BoolVar(&opts.NoInput, "no-input", false, "Do not prompt for input")
	root.PersistentFlags().BoolVarP(&opts.Force, "force", "f", false, "Skip confirmation prompts")

	root.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		cfg, err := LoadConfig()
		if err != nil {
			return &ExitError{Code: ExitFailure, Err: err}
		}
		if !cmd.Flags().Changed("token-file") {
			opts.TokenFile = cfg.TokenFile
		}
		if !cmd.Flags().Changed("callback") {
			opts.Callback = cfg.CallbackURL
		}
		if !cmd.Flags().Changed("timeout") && cfg.TimeoutSet {
			opts.Timeout = cfg.Timeout
		}

		if opts.JSON && opts.Plain {
			return usageError(cmd, "--json and --plain are mutually exclusive")
		}
		if opts.NoCallback && opts.EnableCallback {
			return usageError(cmd, "--no-callback cannot be combined with --enable-callback")
		}
		if opts.Timeout < 0 {
			return usageError(cmd, "--timeout must be >= 0")
		}
		if opts.EnableCallback && opts.Callback == "" && opts.Timeout == 0 {
			return usageError(cmd, "--enable-callback requires --timeout > 0 or --callback")
		}
		if opts.ShowVersion {
			fmt.Fprintln(os.Stdout, Version)
			return &ExitError{Code: ExitSuccess}
		}
		return nil
	}

	AddCommands(root, opts)
	return root
}

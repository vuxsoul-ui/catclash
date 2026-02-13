package grizzly

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

const callbackSource = "grizzly"

func executeAction(opts *Options, action string, params url.Values) error {
	out := NewOutputter(opts)

	var server *CallbackServer
	var successURL string
	var errorURL string
	callbackEnabled := !opts.NoCallback && (opts.EnableCallback || opts.Callback != "")

	if callbackEnabled {
		if opts.Callback != "" {
			successURL = opts.Callback
			errorURL = opts.Callback
		} else if opts.Timeout > 0 {
			var err error
			server, err = StartCallbackServer()
			if err != nil {
				return out.WriteError(Result{Action: action}, ErrorInfo{Message: err.Error(), Code: "callback_start"}, ExitFailure)
			}
			successURL = server.SuccessURL
			errorURL = server.ErrorURL
		}
	}

	if successURL != "" {
		params.Set("x-success", successURL)
		params.Set("x-error", errorURL)
		params.Set("x-source", callbackSource)
	}

	urlStr := BuildURL(action, params)
	res := Result{Action: action, URL: urlStr}

	if opts.DryRun {
		if server != nil {
			_ = server.Shutdown()
		}
		out.WriteSuccess(res)
		return nil
	}

	if err := openURL(urlStr); err != nil {
		if server != nil {
			_ = server.Shutdown()
		}
		return out.WriteError(res, ErrorInfo{Message: err.Error(), Code: "open_url"}, ExitOpen)
	}

	if server == nil {
		out.WriteSuccess(res)
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), opts.Timeout)
	defer cancel()
	cbRes, err := server.Wait(ctx)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return out.WriteError(res, ErrorInfo{Message: "callback timed out", Code: "timeout"}, ExitTimeout)
		}
		return out.WriteError(res, ErrorInfo{Message: err.Error(), Code: "callback_error"}, ExitCallback)
	}

	if !cbRes.Success {
		errInfo := ErrorInfo{Message: "bear returned an error", Code: "x-error"}
		if msg := strings.TrimSpace(cbRes.Values.Get("errorMessage")); msg != "" {
			errInfo.Message = msg
		}
		if code := strings.TrimSpace(cbRes.Values.Get("errorCode")); code != "" {
			errInfo.Code = code
		}
		return out.WriteError(res, errInfo, ExitCallback)
	}

	res.Data = ParseCallbackValues(cbRes.Values)
	out.WriteSuccess(res)
	return nil
}

func resolveToken(opts *Options) (string, error) {
	if opts.TokenFile != "" {
		return readTokenFromFile(opts.TokenFile)
	}
	if opts.TokenStdin {
		if stdinIsTTY() {
			return "", fmt.Errorf("token-stdin requires non-interactive stdin")
		}
		return readTokenFromStdin()
	}
	return "", nil
}

func maybeRequireToken(opts *Options, required bool) (string, error) {
	if !required {
		return resolveToken(opts)
	}
	token, err := resolveToken(opts)
	if err != nil {
		return "", err
	}
	if token == "" {
		return "", fmt.Errorf("missing Bear API token")
	}
	return token, nil
}

func ensureNoStdinConflict(tokenStdin bool, usesStdin bool) error {
	if tokenStdin && usesStdin {
		return fmt.Errorf("cannot read both token and input from stdin")
	}
	return nil
}

func ensureForceOrPrompt(opts *Options, message string) error {
	if opts.Force {
		return nil
	}
	if opts.NoInput || !stdinIsTTY() {
		return fmt.Errorf("confirmation required (use --force to proceed)")
	}
	ok, err := confirmPrompt(message)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("aborted")
	}
	return nil
}

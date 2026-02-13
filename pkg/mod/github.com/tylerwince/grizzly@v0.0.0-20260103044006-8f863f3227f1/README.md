# grizzly

CLI for interacting with Bear notes via Bear's x-callback-url scheme.

## Requirements

- macOS with Bear installed
- Go 1.21+ to build

## Install

```bash
go install ./cmd/grizzly
```

## Configuration

Grizzly reads configuration in this order (highest to lowest precedence):

1) CLI flags
2) Environment variables
3) Project config: `.grizzly.toml` in the current working directory
4) User config: `$XDG_CONFIG_HOME/grizzly/config.toml` (or `~/.config/grizzly/config.toml`)

### Environment variables

- `GRIZZLY_TOKEN_FILE` path to a file containing your Bear API token (one line)
- `GRIZZLY_CALLBACK_URL` custom `x-success`/`x-error` callback URL (enables callbacks)
- `GRIZZLY_TIMEOUT` timeout for callbacks when enabled (Go duration, e.g. `5s`, `2m`)

### Config file

Example `~/.config/grizzly/config.toml`:

```toml
token_file = "/Users/you/.config/grizzly/token"
callback_url = "http://127.0.0.1:42123/success"
timeout = "5s"
```

## Callbacks

Callbacks are disabled by default so the CLI won't open `x-success` URLs in a
browser. Enable them explicitly if you want Bear to return data:

- `--enable-callback` starts a local callback server and waits for Bear.
- `--callback` or `GRIZZLY_CALLBACK_URL` uses your custom URL (Grizzly does not wait for data in this mode).
- `--no-callback` disables callbacks even if configured.

## Token usage

Some Bear actions require a token to return data. You can provide a token via
`--token-file`, `--token-stdin`, `GRIZZLY_TOKEN_FILE`, or `token_file` in the
config. Tokens should not be passed via flags.

## Usage

```bash
# Create a note
cat note.txt | grizzly create --title "Meeting" --tag work

# Open a note by id and return content
grizzly open-note --id 7E4B681B --enable-callback --json

# Append text to the selected note (requires token)
cat update.txt | grizzly add-text --selected --mode append --token-file ~/.config/grizzly/token

# List tags (requires token)
grizzly tags --token-file ~/.config/grizzly/token

# Dry-run to view URL
grizzly open-note --id 7E4B681B --dry-run --print-url

# Enable callbacks with a custom URL (no local wait)
grizzly open-note --id 7E4B681B --callback "myapp://callback"
```

## Help

Run `grizzly --help` or `grizzly <command> --help` for full flag details.

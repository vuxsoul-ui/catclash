# things3-cli

[![CI](https://github.com/ossianhempel/things3-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ossianhempel/things3-cli/actions/workflows/ci.yml)

CLI for Things 3 by Cultured Code, implemented in Go.

This project ships a single Go binary with unit and integration tests.

## Status

Work in progress. The goal is full end-to-end coverage for the Things URL
scheme interactions on macOS.

## Installation (from source)

```
make install
```

## Installation (Homebrew)

```
brew install ossianhempel/tap/things3-cli
```

## Features

- `add`              Add a new todo
- `update`           Update an existing todo (requires auth token)
- `delete`           Delete an existing todo
- `add-area`         Add a new area
- `add-project`      Add a new project
- `update-area`      Update an existing area
- `delete-area`      Delete an existing area
- `update-project`   Update an existing project (requires auth token)
- `delete-project`   Delete an existing project
- `show`             Show an area, project, tag, or todo from the database
- `search`           Search tasks in the database
- `inbox`            List inbox tasks
- `today`            List today tasks
- `upcoming`         List upcoming tasks
- `repeating`        List repeating tasks
- `anytime`          List anytime tasks
- `someday`          List someday tasks
- `logbook`          List logbook tasks
- `logtoday`         List tasks completed today
- `createdtoday`     List tasks created today
- `completed`        List completed tasks
- `canceled`         List canceled tasks
- `trash`            List trashed tasks
- `deadlines`        List tasks with deadlines
- `all`              List key sections from the database
- `help`             Command help and man page
- `--version`        Print CLI + Things version info

## Auth token setup (for update commands)

Update operations use the Things URL scheme and require an auth token.

1. Open Things 3.
2. Settings -> General -> Things URLs.
3. Copy the token (or enable "Allow 'things' CLI to access Things").
4. Export it:

```
export THINGS_AUTH_TOKEN=your_token_here
```

Tip: add the export to your shell profile (e.g. `~/.zshrc`) to persist it.
You can run `things auth` to check token status and print these steps.

## Database access (read-only)

In addition to the URL-scheme commands above, this CLI can read your local
Things database to list content:

- `things projects`  List projects
- `things areas`     List areas
- `things tags`      List tags
- `things tasks`     List todos (with filters)
- `things today`     List Today tasks

By default it looks for the Things database in your user Library under the
Things app group container (the `ThingsData-*` folder). You can override the
path with `THINGSDB` or `--db`.

Note: The database lives inside the Things app sandbox, so you may need to
grant your terminal Full Disk Access.

## Repeating todos

Use `--repeat` flags with `add` or `update`
to create or change repeating templates. These changes write directly to the
Things database, so Full Disk Access is required. Repeating updates require a
single explicit title (for add) or `--id` (for update).

Supported patterns: every N day/week/month/year, in after-completion (default)
or schedule mode. The anchor date controls weekday/month/day; multi-day weekly
patterns are not supported yet. Use `--repeat-until` to stop after a date.
Repeating projects are not supported.

Examples:

```
things add "Daily standup" --repeat=day --repeat-mode=schedule
things update --id <uuid> --repeat=week --repeat-every=2
things update --id <uuid> --repeat-clear
```

## Notes

- macOS only (uses the Things URL scheme and `open` under the hood).
- Authentication for update operations follows the Things URL scheme
  authorization model.
- Write commands open Things in the background by default; use `--foreground`
  to bring it to the front, or `--dry-run` to print the URL without opening.
- Delete commands (todo/project/area) use AppleScript and require Things
  automation permission for your terminal (you may see a macOS prompt).
- Delete commands prompt for confirmation when run interactively; pass
  `--confirm` in non-interactive scripts. Use `--dry-run` to preview.
- Aliases: `create-project` -> `add-project`, `create-area` -> `add-area`.
- Scheduling: use `--when=someday` to move to Someday; use `update --later`
  (or `--when=evening`) to move to This Evening.

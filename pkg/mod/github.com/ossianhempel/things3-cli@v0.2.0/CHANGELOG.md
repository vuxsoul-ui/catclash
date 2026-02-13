# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2026-01-09
- Added guardrails for unsafe titles (e.g. tag=work) with --allow-unsafe-title override.
- Require auth token before URL updates; error early with clearer messaging.
- Verify --when/--later updates against the database to avoid false positives (opt-out with --no-verify).
- Prevent moving non-today tasks to This Evening unless --allow-non-today is set.
- Require confirmation for query deletes (prompt or --confirm=delete/--yes).

## [0.1.0] - 2026-01-06
- Initial Go port of `things-cli` (commands, help, man page, tests).
- Added read-only database commands (`projects`, `areas`, `tags`, `tasks`).
- Fix repeating add to preserve scheduling fields so templates are not trashed.

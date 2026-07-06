# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.2] - 2026-07-06

### Fixed
- Reject `/root/...` absolute paths in shared-artifact validation, same as `/home/<user>/...` (#2).
- Treat `<repo>/.context/handoffs/` as a private lane for `access: private-local`, matching the documented repo-local model (#1).

### Added
- `create-handoff.mjs --repo` now ensures `.context/handoffs/` is gitignored (adds the rule or warns loudly) (#1).
- Fixture regression tests (`tests/run.mjs`) covering path-leak rejection, lane rules, git_head injection, and gitignore hygiene.

## [1.0.1] - 2026-07-06

### Security
- Replace shell-based `execSync` git calls with `execFileSync` argument arrays (no shell interpretation).
- Validate `git_head` frontmatter against a strict commit-hash pattern before use in `check-staleness.mjs`, closing a command-injection vector via crafted handoff artifacts.

## [1.0.0] - 2026-07-06

### Added
- Initial public release: SKILL.md workstream re-entry protocol.
- `create-handoff.mjs`, `validate-handoff.mjs`, `check-staleness.mjs`, `list-open-workstreams.mjs`.
- Optional compaction-pressure guard documentation for OpenClaw `memoryFlush`.

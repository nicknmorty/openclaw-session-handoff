# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1] - 2026-07-06

### Security
- Replace shell-based `execSync` git calls with `execFileSync` argument arrays (no shell interpretation).
- Validate `git_head` frontmatter against a strict commit-hash pattern before use in `check-staleness.mjs`, closing a command-injection vector via crafted handoff artifacts.

## [1.0.0] - 2026-07-06

### Added
- Initial public release: SKILL.md workstream re-entry protocol.
- `create-handoff.mjs`, `validate-handoff.mjs`, `check-staleness.mjs`, `list-open-workstreams.mjs`.
- Optional compaction-pressure guard documentation for OpenClaw `memoryFlush`.

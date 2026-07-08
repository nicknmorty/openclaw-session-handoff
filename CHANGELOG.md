# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.4] - 2026-07-08

### Fixed
- `check-staleness.mjs` now resolves relative `files:` entries against the artifact's `repo:` path (falling back to caller cwd only for repo-less artifacts), and normalizes quoted entries like `files: ["a.txt"]`, eliminating false YELLOW "referenced file missing" reports (#3).
- `check-staleness.mjs` resolves a relative `repo:` value against the artifact's own directory, so portable repo-shared artifacts keep working git drift checks (#4).
- `create-handoff.mjs --repo --access repo-shared` now writes `repo:` as a path relative to the artifact directory when the artifact lives inside the repo, so the scaffold no longer embeds `/root`/`/home` paths that its own validator rejects; when a custom `--base` outside the repo would force a non-portable path, it refuses with guidance instead of scaffolding an invalid artifact (#4).

### Added
- Fixture regression tests for repo-relative/quoted `files:` resolution, portable repo-shared scaffolds (relative `repo:` + validation + staleness), and the non-portable-path refusal case.

## [1.0.3] - 2026-07-06

### Fixed
- Suppress raw git stderr noise (`ambiguous argument 'HEAD'`) from `create-handoff.mjs --repo` on repos with no commits; the script's own warning is shown instead.

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

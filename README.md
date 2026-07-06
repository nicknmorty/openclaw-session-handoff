# openclaw-session-handoff

Crash-safe workstream continuity for [OpenClaw](https://github.com/openclaw/openclaw) agents.

Save and resume working session state as structured handoff artifacts with an append-only worklog, so a fresh or recovered session cold-starts from two small files instead of re-reading a whole project's docs and burning tokens.

This is an [AgentSkill](https://docs.openclaw.ai): a `SKILL.md` protocol plus small deterministic scripts. No plugin install, no runtime dependency beyond Node.

## Why

Long agent sessions die: crashes, context compaction, `/new`. Durable truth (repo docs, status files, memory) survives, but the *working state* -- what was just tried, what failed, what's next -- evaporates, and rebuilding it from scratch is slow and expensive. This skill treats re-entry as a protocol:

- **`handoff.md` chain** -- a concise re-entry doc, regenerated at checkpoints.
- **`worklog.md`** -- an append-only log written as work happens. One line per completed task, decision, or failed approach. Crash recovery = latest handoff + worklog tail.

Workstreams are chunks: split big projects into `<project>-p1`, `<project>-p2`, each with its own artifact chain.

## Install

Copy this directory into your agent workspace skills folder:

```bash
cp -r . ~/.openclaw/workspace/skills/session-handoff
```

## Use

Natural language, no exact syntax:

- "handoff save" / "pause here" -> agent scaffolds and fills an artifact, validates it, checkpoints the worklog.
- "resume <workstream>" / "pick up where we left off" -> agent finds the artifact, checks staleness against live git state, reads the worklog tail, verifies, continues.
- "what handoffs are open?" -> lists open workstreams.

### Scripts

```bash
node scripts/create-handoff.mjs --workstream my-project-p1 [--repo /path/to/repo]
node scripts/validate-handoff.mjs <artifact.md>
node scripts/check-staleness.mjs <artifact.md>   # GREEN / YELLOW / RED vs live git state
node scripts/list-open-workstreams.mjs [--repo /path/to/repo]
```

Storage: chat/ops workstreams live in `~/.openclaw/workspace/memory/handoffs/<workstream>/`; repo-bound work lives in `<repo>/.context/handoffs/<workstream>/` (gitignored by default).

## Optional: compaction-pressure guard

OpenClaw fires a silent pre-compaction "memory flush" agent turn when a session nears its compaction threshold. You can ride it so context pressure automatically protects open workstreams -- worklog appends are automatic crash-safety; regenerating `handoff.md` always requires an explicit user yes.

Add to your OpenClaw config (`agents.defaults.compaction.memoryFlush.systemPrompt`):

```
Session-handoff compaction guard (in addition to normal memory flush duties):
run `node /home/user/.openclaw/workspace/skills/session-handoff/scripts/list-open-workstreams.mjs`
(add `--repo <path>` for any repo actively worked in this session). If a listed
open/resumed workstream belongs to THIS session's work, append one line to that
workstream's worklog.md: `HH:MM | compaction-pressure flush: <one-line current
state> | next: <next step>`. Do NOT create or regenerate handoff.md artifacts
here. Then, in the NEXT user-visible turn of that workstream, offer once per
compaction cycle: context is compacting - want a handoff checkpoint? Regenerate
handoff.md only after an explicit user yes. If no open workstream matches this
session, skip all of this. Keep this flush turn silent (reply exactly NO_REPLY).
```

Validate your config after editing (`openclaw config validate`) and restart the Gateway to apply.

## Design notes

- Handoff artifacts are **working state, not memory**. Durable truth lives in project docs/status/memory; artifacts point into it and are prunable ~30 days after close.
- The user controls everything: no auto-resume, no forced injection, no auto-written handoffs.
- Validation scripts are hygiene evidence, not acceptance -- the agent still owns final judgment.

## License

MIT

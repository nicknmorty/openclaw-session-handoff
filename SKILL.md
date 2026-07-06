---
name: session-handoff
description: Crash-safe workstream continuity. Save/resume working session state as structured handoff artifacts with an append-only worklog, so a fresh or recovered session cold-starts with minimal token burn. Use on "handoff", "save state", "pause here", "resume <workstream>", "pick up where we left off", or when splitting a project into chunks.
---

# Session Handoff (workstream re-entry protocol)

Purpose: **workstream continuity**, not memory. Durable truth lives in PROJECT_STATUS/repo docs/memory lanes; handoff artifacts are ephemeral working state that point INTO that truth. If something deserves to outlive the workstream, promote it to the durable surface.

User control is absolute: never save, arm, or resume a handoff unless the user asked. `/new` stays clean by default.

## Artifacts (two per workstream)
- `handoff.md` chain: `NNN-YYYY-MM-DD.md` — concise re-entry doc, regenerated at checkpoints.
- `worklog.md` — append-only running log written AS WORK HAPPENS. One line per completed task/decision/failed approach:
  `HH:MM | done: <thing> | next: <thing> | files: <paths>` (also `decision:` / `tried-failed:` lines).
  Crash recovery = latest handoff + worklog tail since its checkpoint marker.

## Storage
- Chat/ops workstreams: `~/.openclaw/workspace/memory/handoffs/<workstream>/` (typed ephemeral lane, private).
- Repo-bound coding work: `<repo>/.context/handoffs/<workstream>/` — **gitignored by default**. Committing requires `access: repo-shared` in frontmatter AND a passing validation run.
- Workstream slug = chunk. Split big projects into chunks (`<project>-p1`, `<project>-p2`); each chunk has its own worklog + chain. Resume targets one chunk.

## CREATE flow ("handoff save")
1. Scaffold: `node scripts/create-handoff.mjs --workstream <slug> [--repo <path>] [--base <dir>] [--access private-local|repo-shared]`
2. Fill every slot from the session + worklog tail. "What We Tried" must include failed approaches with why; "Decisions" includes rejected options; "User Feedback" captures the user's corrections/preferences verbatim-ish.
3. Validate: `node scripts/validate-handoff.mjs <artifact>` — must exit 0. Validation is evidence, not acceptance; the agent still owns final judgment.
4. Append a `checkpoint: <artifact filename>` line to worklog.
5. Report artifact path + the one-line Resume Prompt to the user.

## RESUME flow ("resume <workstream>")
0. Trigger is natural language, not syntax. No regex/exact phrase required: any wording that means "pick this work back up" counts, and "what handoffs are open?" should list the workstream dirs. Locate the workstream by listing the handoffs lane; if the match is ambiguous, show options and ask.
1. Locate artifact (arg or highest seq in the workstream dir).
2. Staleness: `node scripts/check-staleness.mjs <artifact>` — GREEN proceed; YELLOW/RED: report drift and re-verify against live repo/files BEFORE acting; never continue blind.
3. Read the artifact + previous seq (chain depth 2 max) + worklog tail after the last checkpoint.
4. Verify claims against live state (git log/status, referenced files), then proceed from Next Steps.

## Worklog discipline (crash safety)
- Scope: log only work that advances THIS workstream. Sidequests/detours get at most one pointer line (`detour: see <incident/daily/lane doc>`); their details live in their own durable surface, not this log.
- Append after each completed task, decision, or failed approach — cheap one-liners, no regeneration.
- Regenerate handoff.md at milestones, before risky operations, and at task switches.
- Never let a busy session skip the worklog; it is the only thing a crash leaves behind.

## Privacy & portability
- Default `access: private-local`: local paths allowed, artifact must stay in the private lane.
- `access: repo-shared` or any cross-agent handoff: no absolute/home paths, session keys, private chat IDs, secrets, or internal URLs — follow the portable-anchor rules in the sibling `handoff` skill (outbound delegation prompts). That skill hands work to OTHER agents; this one re-enters YOUR OWN workstream. Cross-link, don't merge.
- Every artifact carries the header warning: working state, not final truth; verify before acting.

## Lifecycle
- `status: open -> resumed -> closed`. Mark `closed` when the workstream completes and durable truth is updated.
- Closed handoffs+worklogs are prunable after ~30 days. Do not treat old handoffs as history — history lives in git/docs/memory.

## Reserved (do not implement yet)
- Phase 2 (`--arm` / `_pending/` bootstrap injection): not implemented — current design likely doesn't need injection. Revisit only if cold-start friction appears.
- Phase 3 (next up): compaction-pressure detection + handoff-doc recommendation (suggest-only, never auto-write).

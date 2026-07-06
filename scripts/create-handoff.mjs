#!/usr/bin/env node
// Scaffold a session-handoff artifact. Deterministic helper only; the agent fills slots.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (!k?.startsWith('--')) { console.error(`Bad arg: ${k}`); process.exit(2); }
  args[k.slice(2)] = process.argv[i + 1];
}
const ws = args.workstream;
if (!ws || !/^[a-z0-9][a-z0-9-]*$/.test(ws)) {
  console.error('Usage: create-handoff.mjs --workstream <slug> [--repo <path>] [--base <dir>] [--access private-local|repo-shared] [--continues-from <file>] [--session-lane <lane>]');
  process.exit(2);
}
const access = args.access || 'private-local';
if (!['private-local', 'repo-shared'].includes(access)) { console.error('access must be private-local|repo-shared'); process.exit(2); }
const base = args.base
  ? path.resolve(args.base)
  : args.repo
    ? path.join(path.resolve(args.repo), '.context', 'handoffs')
    : path.join(os.homedir(), '.openclaw', 'workspace', 'memory', 'handoffs');
const dir = path.join(base, ws);
fs.mkdirSync(dir, { recursive: true });

// next zero-padded seq
const seqs = fs.readdirSync(dir).map(f => /^(\d{3})-/.exec(f)?.[1]).filter(Boolean).map(Number);
const seq = String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0');
const date = new Date().toISOString().slice(0, 10);
const file = path.join(dir, `${seq}-${date}.md`);

let git = null;
if (args.repo) {
  try {
    const opt = { cwd: args.repo, encoding: 'utf8' };
    git = {
      branch: execSync('git rev-parse --abbrev-ref HEAD', opt).trim(),
      head: execSync('git rev-parse HEAD', opt).trim(),
      dirty: execSync('git status --porcelain', opt).trim().split('\n').filter(Boolean).length,
    };
  } catch { console.error('warn: could not read git state for --repo'); }
}
const artifactId = `${ws}-${seq}-${Date.now().toString(36)}`;
const prev = seqs.length ? fs.readdirSync(dir).filter(f => f.startsWith(String(Math.max(...seqs)).padStart(3, '0') + '-'))[0] : null;
const continuesFrom = args['continues-from'] || prev || 'none';

const fm = [
  '---',
  `workstream: ${ws}`,
  `seq: ${seq}`,
  `artifact_id: ${artifactId}`,
  `continues_from: ${continuesFrom}`,
  `created: ${new Date().toISOString()}`,
  `last_verified: ${new Date().toISOString()}`,
  `session_lane: ${args['session-lane'] || 'unknown'}`,
  `access: ${access}`,
  `status: open`,
  ...(args.repo ? [`repo: ${path.resolve(args.repo)}`] : []),
  ...(git ? [`git_branch: ${git.branch}`, `git_head: ${git.head}`, `git_dirty_files: ${git.dirty}`] : []),
  'files: []',
  '---',
].join('\n');

const slots = ['Goal', 'Where We Are', 'What We Tried', 'Decisions', 'Evidence', 'User Feedback', 'Next Steps', 'Gotchas & Constraints', 'Resume Prompt'];
const body = ['', '> WARNING: working state, not final truth; verify before acting.', '', ...slots.map(s => `## ${s}\n\n[TODO: fill]\n`)].join('\n');
fs.writeFileSync(file, fm + body);

const worklog = path.join(dir, 'worklog.md');
if (!fs.existsSync(worklog)) fs.writeFileSync(worklog, `# Worklog — ${ws}\n\nAppend-only. One line per completed task/decision/failed approach.\n\n`);

console.log(`created: ${file}`);
console.log(`worklog: ${worklog}`);
console.log(`resume-prompt: Read ${file} (workstream ${ws}, seq ${seq}), run check-staleness.mjs on it, read worklog tail after last checkpoint, verify against live state, continue from Next Steps.`);

#!/usr/bin/env node
// Scaffold a session-handoff artifact. Deterministic helper only; the agent fills slots.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

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

// repo frontmatter shape (issue #4): repo-shared artifacts must stay portable.
// When the artifact lives inside the repo, reference the repo relative to the
// artifact's own directory instead of embedding an absolute /root or /home path.
let repoFm = null;
if (args.repo) {
  const repoAbs = path.resolve(args.repo);
  if (access === 'repo-shared') {
    const relFromRepo = path.relative(repoAbs, dir);
    const insideRepo = relFromRepo && !relFromRepo.startsWith('..') && !path.isAbsolute(relFromRepo);
    if (insideRepo) {
      repoFm = path.relative(dir, repoAbs) || '.';
    } else if (/^\/(?:root|home)(?:\/|$)/.test(repoAbs)) {
      console.error(`error: --access repo-shared with --repo ${repoAbs} and an artifact dir outside the repo would embed a non-portable /root or /home path in shared frontmatter, which validate-handoff.mjs rejects.`);
      console.error('fix: drop --base so the artifact lives in <repo>/.context/handoffs/ (repo: becomes relative), or use --access private-local.');
      process.exit(2);
    } else {
      repoFm = repoAbs;
    }
  } else {
    repoFm = repoAbs;
  }
}

fs.mkdirSync(dir, { recursive: true });

// repo lane hygiene: private handoffs must never be committed by accident.
// Ensure <repo>/.context/handoffs/ is gitignored; add the rule if missing.
if (args.repo && access === 'private-local') {
  const repoAbs = path.resolve(args.repo);
  try {
    execFileSync('git', ['check-ignore', '-q', path.join('.context', 'handoffs', 'x')], { cwd: repoAbs });
  } catch {
    try {
      const gi = path.join(repoAbs, '.gitignore');
      const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
      const rule = '.context/handoffs/';
      if (!cur.split('\n').some(l => l.trim() === rule)) {
        fs.writeFileSync(gi, `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}# private session-handoff working state (session-handoff skill)\n${rule}\n`);
        console.error(`notice: added "${rule}" to ${gi} so private handoffs are not committed`);
      }
    } catch {
      console.error('WARNING: <repo>/.context/handoffs/ is NOT gitignored and .gitignore could not be updated; private handoff state may be committed. Add ".context/handoffs/" to your ignore rules.');
    }
  }
}

// next zero-padded seq
const seqs = fs.readdirSync(dir).map(f => /^(\d{3})-/.exec(f)?.[1]).filter(Boolean).map(Number);
const seq = String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0');
const date = new Date().toISOString().slice(0, 10);
const file = path.join(dir, `${seq}-${date}.md`);

let git = null;
if (args.repo) {
  try {
    const opt = { cwd: args.repo, encoding: 'utf8' };
    // stdio: swallow git's own stderr (e.g. "ambiguous argument 'HEAD'" on a
    // commitless repo) so only this script's warning is shown on failure.
    const run = (...a) => execFileSync('git', a, { ...opt, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    git = {
      branch: run('rev-parse', '--abbrev-ref', 'HEAD'),
      head: run('rev-parse', 'HEAD'),
      dirty: run('status', '--porcelain').split('\n').filter(Boolean).length,
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
  ...(repoFm ? [`repo: ${repoFm}`] : []),
  ...(git ? [`git_branch: ${git.branch}`, `git_head: ${git.head}`, `git_dirty_files: ${git.dirty}`] : []),
  'files: []',
  '---',
].join('\n');

const slots = ['Goal', 'Where We Are', 'What We Tried', 'Decisions', 'Evidence', 'User Feedback', 'Next Steps', 'Gotchas & Constraints', 'Resume Prompt'];
const body = ['', '> WARNING: working state, not final truth; verify before acting.', '', ...slots.map(s => `## ${s}\n\n[TODO: fill]\n`)].join('\n');
fs.writeFileSync(file, fm + body);

const worklog = path.join(dir, 'worklog.md');
if (!fs.existsSync(worklog)) fs.writeFileSync(worklog, `# Worklog \u2014 ${ws}\n\nAppend-only. One line per completed task/decision/failed approach.\n\n`);

console.log(`created: ${file}`);
console.log(`worklog: ${worklog}`);
console.log(`resume-prompt: Read ${file} (workstream ${ws}, seq ${seq}), run check-staleness.mjs on it, read worklog tail after last checkpoint, verify against live state, continue from Next Steps.`);

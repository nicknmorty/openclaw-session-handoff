#!/usr/bin/env node
// Drift report for a handoff artifact. Prints GREEN/YELLOW/RED + reasons. Exit 0/1/2 respectively.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Usage: check-staleness.mjs <artifact.md>'); process.exit(3); }
const text = fs.readFileSync(file, 'utf8');
const artDir = path.dirname(path.resolve(file));
const fm = {};
const fmMatch = /^---\n([\s\S]*?)\n---/.exec(text);
if (fmMatch) for (const line of fmMatch[1].split('\n')) { const m = /^([a-z_]+):\s*(.*)$/.exec(line); if (m) fm[m[1]] = m[2]; }

// repo: may be absolute, or relative to the artifact's own directory (portable repo-shared shape).
const repoPath = fm.repo ? (path.isAbsolute(fm.repo) ? fm.repo : path.resolve(artDir, fm.repo)) : null;

const reasons = [];
let level = 0; // 0 green, 1 yellow, 2 red
const bump = (l, r) => { level = Math.max(level, l); reasons.push(r); };

const ageH = fm.created ? (Date.now() - Date.parse(fm.created)) / 3.6e6 : NaN;
if (Number.isNaN(ageH)) bump(2, 'no created timestamp');
else if (ageH > 24 * 7) bump(2, `age ${(ageH / 24).toFixed(1)}d > 7d`);
else if (ageH > 24) bump(1, `age ${(ageH / 24).toFixed(1)}d > 24h`);

if (fm.status === 'closed') bump(2, 'status is closed — workstream already completed');

if (repoPath && fm.git_head) {
  if (!/^[0-9a-f]{7,40}$/.test(fm.git_head)) bump(2, 'git_head in frontmatter is not a valid commit hash');
  else try {
    const opt = { cwd: repoPath, encoding: 'utf8' };
    const git = (...args) => execFileSync('git', args, opt).trim();
    const count = Number(git('rev-list', '--count', `${fm.git_head}..HEAD`));
    if (count > 10) bump(2, `${count} commits since handoff`);
    else if (count > 0) bump(1, `${count} commit(s) since handoff`);
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (fm.git_branch && branch !== fm.git_branch) bump(2, `branch changed: ${fm.git_branch} -> ${branch}`);
    if (count > 0) {
      const changed = git('diff', '--name-only', `${fm.git_head}..HEAD`).split('\n').filter(Boolean);
      reasons.push(`changed files since handoff: ${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ` (+${changed.length - 10} more)` : ''}`);
    }
  } catch { bump(2, `git_head ${fm.git_head?.slice(0, 8)} not resolvable in ${repoPath}`); }
}

// structured files list check: files: [a, b] or files: []
// Relative entries resolve against the artifact's repo: when present (issue #3), else caller cwd.
const filesM = /^files:\s*\[(.*)\]$/m.exec(fmMatch?.[1] || '');
if (filesM && filesM[1].trim()) {
  for (const raw of filesM[1].split(',').map(s => s.trim()).filter(Boolean)) {
    const f = raw.replace(/^(["'])(.*)\1$/, '$2'); // normalize quoted entries
    if (!f) continue;
    const resolved = path.isAbsolute(f) ? f : (repoPath ? path.resolve(repoPath, f) : path.resolve(f));
    if (!fs.existsSync(resolved)) bump(1, `referenced file missing: ${f}${repoPath && !path.isAbsolute(f) ? ` (checked against repo ${repoPath})` : ''}`);
  }
}

const label = ['GREEN', 'YELLOW', 'RED'][level];
console.log(`STATUS: ${label}`);
for (const r of reasons) console.log(`- ${r}`);
if (level > 0) console.log(level === 1 ? 'ACTION: verify drift items against live state before continuing.' : 'ACTION: do NOT continue blind; re-verify workstream state from durable truth first.');
process.exit(level);

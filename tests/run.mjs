#!/usr/bin/env node
// Fixture regression tests for session-handoff scripts. Exit 0 = all pass.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const scripts = path.join(here, '..', 'scripts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-tests-'));
let failures = 0;
const run = (script, args) => {
  try { execFileSync('node', [path.join(scripts, script), ...args], { encoding: 'utf8' }); return 0; }
  catch (e) { return e.status ?? 1; }
};
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`); if (!cond) failures++; };

const fm = (extra) => `---\nworkstream: repro\nseq: 001\nartifact_id: repro-001\ncontinues_from: none\ncreated: ${new Date().toISOString()}\nlast_verified: ${new Date().toISOString()}\nsession_lane: test\n${extra}\nstatus: open\nfiles: []\n---\n\n> WARNING: working state, not final truth; verify before acting.\n\n## Goal\nShip the repro fixture for validation tests end to end.\n## Where We Are\nFixture generated fresh by the test harness for each run.\n## What We Tried\nTried thin sections first; validator rejected them as too thin.\n## Decisions\nUse full sentences in fixtures so content checks pass.\n## Evidence\nValidator exit codes asserted by tests below.\n## User Feedback\nReviewer asked for fixture regression tests on lane rules.\n## Next Steps\n1. Keep this fixture in sync with validator required sections.\n## Gotchas & Constraints\nSections must be non-trivial or validation fails by design.\n## Resume Prompt\nRead this artifact and continue from Next Steps as usual.\n`;

// 1. repo-shared artifact containing /root path must FAIL validation (issue #2)
const a1 = path.join(tmp, '001-2026-01-01.md');
fs.writeFileSync(a1, fm('access: repo-shared') + '\nSee /root/private/path/file.txt\n');
check('repo-shared /root path rejected', run('validate-handoff.mjs', [a1]) !== 0);

// 2. repo-shared artifact containing /home/<user> path must FAIL validation
const a2 = path.join(tmp, '002-2026-01-01.md');
fs.writeFileSync(a2, fm('access: repo-shared') + '\nSee /home/someone/secret.txt\n');
check('repo-shared /home path rejected', run('validate-handoff.mjs', [a2]) !== 0);

// 3. private-local artifact under <repo>/.context/handoffs/ must PASS lane rule (issue #1)
const laneDir = path.join(tmp, 'repo', '.context', 'handoffs', 'repro');
fs.mkdirSync(laneDir, { recursive: true });
const a3 = path.join(laneDir, '001-2026-01-01.md');
fs.writeFileSync(a3, fm('access: private-local'));
check('private-local allowed in .context/handoffs lane', run('validate-handoff.mjs', [a3]) === 0);

// 4. malicious git_head in frontmatter must be rejected without execution
const a4 = path.join(tmp, '004-2026-01-01.md');
const canary = path.join(tmp, 'pwned');
fs.writeFileSync(a4, `---\nworkstream: inj\nseq: 001\ncreated: ${new Date().toISOString()}\nstatus: open\nrepo: ${tmp}\ngit_head: $(touch ${canary})\nfiles: []\n---\n`);
run('check-staleness.mjs', [a4]);
check('git_head injection blocked', !fs.existsSync(canary));

// 5. create-handoff --repo adds .gitignore rule for the private lane
const repo = path.join(tmp, 'repo2');
fs.mkdirSync(repo, { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: repo });
run('create-handoff.mjs', ['--workstream', 't', '--repo', repo]);
const gi = path.join(repo, '.gitignore');
check('create-handoff --repo ensures gitignore rule', fs.existsSync(gi) && fs.readFileSync(gi, 'utf8').includes('.context/handoffs/'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

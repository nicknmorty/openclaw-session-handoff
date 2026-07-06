#!/usr/bin/env node
// Hygiene gate for handoff artifacts. Exit 0 pass, 1 fail, 2 usage. Evidence, not acceptance.
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Usage: validate-handoff.mjs <artifact.md>'); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
const errors = [];
const warnings = [];

// frontmatter
const fmMatch = /^---\n([\s\S]*?)\n---/.exec(text);
if (!fmMatch) errors.push('missing frontmatter');
const fm = {};
if (fmMatch) for (const line of fmMatch[1].split('\n')) { const m = /^([a-z_]+):\s*(.*)$/.exec(line); if (m) fm[m[1]] = m[2]; }
for (const k of ['workstream', 'seq', 'artifact_id', 'created', 'access', 'status']) if (!fm[k]) errors.push(`frontmatter missing: ${k}`);

// placeholders
if (text.includes('[TODO')) errors.push('unfilled [TODO] placeholder(s) remain');

// warning header
if (!text.includes('working state, not final truth')) errors.push('missing header warning: "working state, not final truth; verify before acting."');

// required sections non-empty
const required = ['Goal', 'Where We Are', 'What We Tried', 'Decisions', 'Next Steps', 'Gotchas & Constraints', 'Resume Prompt'];
for (const s of required) {
  const m = new RegExp(`## ${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text);
  const content = m ? m[1].trim() : '';
  if (content.length < 10) errors.push(`section empty or too thin: ${s}`);
}

// secret patterns (always fail)
const secretPatterns = [
  [/sk-[A-Za-z0-9_-]{20,}/, 'OpenAI-style key'],
  [/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS key id'],
  [/xox[bpars]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9+/_-]{16,}/i, 'credential assignment'],
];
for (const [re, label] of secretPatterns) if (re.test(text)) errors.push(`possible secret: ${label}`);

// locality/private-identifier patterns (fail when shared, warn when private-local)
const bucket = fm.access === 'private-local' ? warnings : errors;
if (/\/home\/[a-z0-9_-]+\//.test(text)) bucket.push('absolute home path present');
if (/agent:[a-z0-9-]+:[a-z]+:/.test(text)) bucket.push('session key present');
if (/-100\d{9,}/.test(text)) bucket.push('private chat id present');
if (/https?:\/\/(127\.|10\.|192\.168\.|localhost|[a-z0-9-]+\.ts\.net)/.test(text)) bucket.push('internal URL present');

// location rule: outside the private lane requires repo-shared
const abs = path.resolve(file);
const inPrivateLane = abs.includes(`${path.sep}memory${path.sep}handoffs${path.sep}`) || abs.startsWith('/tmp/');
if (!inPrivateLane && fm.access !== 'repo-shared') errors.push(`artifact outside private lane (${abs}) but access=${fm.access}; requires access: repo-shared`);

for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length) { for (const e of errors) console.log(`FAIL: ${e}`); console.log(`RESULT: FAIL (${errors.length} errors)`); process.exit(1); }
console.log(`RESULT: PASS${warnings.length ? ` (${warnings.length} warnings)` : ''}`);

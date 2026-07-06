#!/usr/bin/env node
// List handoff workstreams with status open|resumed. Usage:
//   node list-open-workstreams.mjs [--base <dir>]... [--repo <repoPath>]...
// Defaults to the private lane: ~/.openclaw/workspace/memory/handoffs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const bases = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1]) bases.push(args[++i]);
  else if (args[i] === '--repo' && args[i + 1]) bases.push(path.join(args[++i], '.context', 'handoffs'));
}
if (bases.length === 0) bases.push(path.join(os.homedir(), '.openclaw', 'workspace', 'memory', 'handoffs'));

let found = 0;
for (const base of bases) {
  if (!fs.existsSync(base)) continue;
  for (const slug of fs.readdirSync(base)) {
    const dir = path.join(base, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const artifacts = fs.readdirSync(dir).filter((f) => /^\d{3}-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
    if (artifacts.length === 0) continue;
    const latest = artifacts[artifacts.length - 1];
    const text = fs.readFileSync(path.join(dir, latest), 'utf8');
    const m = text.match(/^status:\s*(\S+)/m);
    const status = m ? m[1] : 'unknown';
    if (status === 'open' || status === 'resumed') {
      found++;
      console.log(`${slug} | ${status} | ${path.join(dir, latest)}`);
    }
  }
}
if (found === 0) console.log('NO_OPEN_WORKSTREAMS');

/**
 * Builds a Markdown coverage report for the GitHub Actions Job Summary.
 *
 * Reads Jest's coverage output and prints, to stdout:
 *   - the aggregate totals, and
 *   - a per-file table flagging every file below 100% with the exact
 *     uncovered line numbers (same info as the `text` reporter's
 *     "Uncovered Line #s" column).
 *
 * Usage (in CI): node scripts/coverage-summary.js >> "$GITHUB_STEP_SUMMARY"
 */
const fs = require('fs');
const path = require('path');

const SUMMARY = 'coverage/coverage-summary.json';
const FINAL = 'coverage/coverage-final.json';

if (!fs.existsSync(SUMMARY)) {
  console.log('## 📊 Coverage\n\n_No coverage report was generated._');
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
const final = fs.existsSync(FINAL) ? JSON.parse(fs.readFileSync(FINAL, 'utf8')) : {};

const total = summary.total;
const pct = (k) => `${total[k].pct}%`;

// Collect the uncovered line numbers for one file from its detailed coverage
// (uncovered statements, functions and branches), compressed into ranges.
function uncoveredLines(fileCoverage) {
  if (!fileCoverage) return '';
  const lines = new Set();

  for (const [id, hits] of Object.entries(fileCoverage.s)) {
    if (hits === 0) {
      const loc = fileCoverage.statementMap[id];
      for (let l = loc.start.line; l <= loc.end.line; l++) lines.add(l);
    }
  }
  for (const [id, hits] of Object.entries(fileCoverage.f)) {
    if (hits === 0) lines.add(fileCoverage.fnMap[id].decl.start.line);
  }
  for (const [id, branchHits] of Object.entries(fileCoverage.b)) {
    branchHits.forEach((hits, j) => {
      if (hits === 0) {
        const loc = fileCoverage.branchMap[id].locations[j];
        if (loc && loc.start && loc.start.line != null) lines.add(loc.start.line);
      }
    });
  }

  const sorted = [...lines].sort((a, b) => a - b);
  const ranges = [];
  for (const n of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ');
}

// Map coverage-final.json (absolute paths) to repo-relative paths.
const finalByRel = {};
for (const [abs, cov] of Object.entries(final)) {
  finalByRel[path.relative(process.cwd(), abs)] = cov;
}

const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([file, data]) => ({ file, pct: data.lines.pct }));

const belowFull = files.filter((f) => f.pct < 100).sort((a, b) => a.pct - b.pct);

const out = [
  '## 📊 Coverage',
  '',
  '| Metric | % | Covered/Total |',
  '| --- | --- | --- |',
  `| Statements | ${pct('statements')} | ${total.statements.covered}/${total.statements.total} |`,
  `| Branches | ${pct('branches')} | ${total.branches.covered}/${total.branches.total} |`,
  `| Functions | ${pct('functions')} | ${total.functions.covered}/${total.functions.total} |`,
  `| Lines | ${pct('lines')} | ${total.lines.covered}/${total.lines.total} |`,
  '',
];

if (belowFull.length === 0) {
  out.push('✅ All measured files are at 100% line coverage.');
} else {
  out.push(
    '### Files missing coverage',
    '',
    '| File | % Lines | Uncovered lines |',
    '| --- | --- | --- |'
  );
  for (const { file, pct: linePct } of belowFull) {
    const rel = path.relative(process.cwd(), file);
    out.push(`| \`${rel}\` | ${linePct}% | ${uncoveredLines(finalByRel[rel]) || '—'} |`);
  }
}

console.log(out.join('\n'));

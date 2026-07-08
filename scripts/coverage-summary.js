/**
 * Builds a Markdown coverage report for the GitHub Actions Job Summary and the
 * PR comment.
 *
 * Reads Jest's coverage output and prints, to stdout:
 *   - the aggregate totals,
 *   - the full list of measured files (with % and any uncovered lines), so it
 *     is explicit *what* is being covered, and
 *   - a note clarifying why the Strapi-generated code is not measured.
 *
 * Usage (in CI): node scripts/coverage-summary.js
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

// One row per measured file, worst coverage first.
const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([file, data]) => ({
    rel: path.relative(process.cwd(), file),
    linePct: data.lines.pct,
  }))
  .sort((a, b) => a.linePct - b.linePct || a.rel.localeCompare(b.rel));

const allFull = files.every((f) => f.linePct === 100);

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
  `### Measured files (${files.length}) ${allFull ? '✅' : '⚠️'}`,
  '',
  '| File | % Lines | Uncovered lines |',
  '| --- | --- | --- |',
];

for (const { rel, linePct } of files) {
  const uncovered = linePct < 100 ? uncoveredLines(finalByRel[rel]) || '—' : '—';
  out.push(`| \`${rel}\` | ${linePct}% | ${uncovered} |`);
}

out.push(
  '',
  '> Coverage measures only pure, unit-testable modules. Strapi-generated',
  '> controllers, services, routes and schemas run inside the Strapi process',
  "> and can't be instrumented by Jest, so they're excluded from the metric",
  '> (see `collectCoverageFrom` in `jest.config.ts`). Their behavior is still',
  '> verified by the integration tests.'
);

console.log(out.join('\n'));

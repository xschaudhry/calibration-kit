#!/usr/bin/env node
// Usage: node calibrate.js <quotes.csv> [--threshold 5] [--pass-rate 95] [--sample 20] [--seed 1] [--report report.md]
const fs = require('fs');
const path = require('path');
const { parseCSV, loadQuotes, compare, sample, summarize } = require('./lib/calibrate');

function parseArgs(argv) {
  const opts = { threshold: 5, passRate: 95, sample: 0, seed: 1, report: null, file: null };
  const names = { '--threshold': 'threshold', '--pass-rate': 'passRate', '--sample': 'sample', '--seed': 'seed', '--report': 'report' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (names[a]) {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      opts[names[a]] = a === '--report' ? v : Number(v);
    } else if (!opts.file) opts.file = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  return opts;
}

const money = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';

function table(results) {
  const rows = results.map(r => [r.flagged ? 'FLAG' : 'ok', r.job, money(r.manual), money(r.ai), pct(r.variance)]);
  const head = ['', 'Job', 'Manual', 'AI', 'Diff'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = r => r.map((c, i) => (i >= 2 ? c.padStart(w[i]) : c.padEnd(w[i]))).join('  ');
  return [line(head), w.map(n => '-'.repeat(n)).join('  '), ...rows.map(line)].join('\n');
}

function markdown(results, s, opts) {
  const lines = [
    '# Calibration report', '',
    `- Quotes checked: **${s.total}**`,
    `- Within ${opts.threshold}%: **${s.within}** (${s.passRate}%)`,
    `- Flagged: **${s.flagged}**`,
    `- Average difference: ${s.avgAbsVariance}%`,
    `- Go-live rule: at least ${opts.passRate}% within ${opts.threshold}%`,
    `- Result: **${s.ready ? 'READY to go live' : 'NOT READY, fix flagged quotes and run again'}**`, '',
    '| Job | Manual | AI | Diff | Status |', '|---|---:|---:|---:|---|',
    ...results.map(r => `| ${r.job} | ${money(r.manual)} | ${money(r.ai)} | ${pct(r.variance)} | ${r.flagged ? '⚠ Flagged' : 'OK'} |`)
  ];
  const flagged = results.filter(r => r.flagged);
  if (flagged.length) {
    lines.push('', '## Flagged quotes to fix', '');
    for (const r of flagged) lines.push(`- **${r.job}** (${pct(r.variance)}): ${r.reason || 'Cause not recorded yet. Compare line items with the manual quote.'}`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exit(2); }
  if (opts.help || !opts.file) {
    console.log('Usage: node calibrate.js <quotes.csv> [--threshold 5] [--pass-rate 95] [--sample 20] [--seed 1] [--report report.md]');
    process.exit(opts.help ? 0 : 2);
  }

  let quotes;
  try { quotes = loadQuotes(parseCSV(fs.readFileSync(opts.file, 'utf8'))); }
  catch (e) { console.error(`Could not read ${opts.file}: ${e.message}`); process.exit(2); }

  if (opts.sample > 0) quotes = sample(quotes, opts.sample, opts.seed);
  const results = compare(quotes, opts.threshold);
  const s = summarize(results, opts.passRate);

  console.log(table(results));
  console.log(`\n${s.within} of ${s.total} within ${opts.threshold}% (${s.passRate}%). ${s.flagged} flagged. Average difference ${s.avgAbsVariance}%.`);
  console.log(s.ready ? `READY: meets the ${opts.passRate}% go-live rule.` : `NOT READY: needs ${opts.passRate}% within ${opts.threshold}%. Fix the flagged quotes and run again.`);

  if (opts.report) {
    fs.writeFileSync(opts.report, markdown(results, s, opts));
    console.log(`Report written to ${path.resolve(opts.report)}`);
  }
  process.exit(s.ready ? 0 : 1);
}

main();

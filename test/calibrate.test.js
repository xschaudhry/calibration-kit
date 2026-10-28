const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseCSV, loadQuotes, compare, sample, summarize } = require('../lib/calibrate');

test('parses quoted fields, escaped quotes and CRLF', () => {
  const rows = parseCSV('job,manual_quote,ai_quote,reason\r\n"Brakes, front",100,"$1,050",\r\nAC,200,210,"said ""hi"""\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].job, 'Brakes, front');
  assert.equal(rows[1].reason, 'said "hi"');
  assert.equal(loadQuotes(rows)[0].ai, 1050);
});

test('flags quotes beyond the threshold in either direction', () => {
  const r = compare([
    { job: 'a', manual: 100, ai: 105 },   // exactly 5%: not flagged
    { job: 'b', manual: 100, ai: 105.5 }, // over
    { job: 'c', manual: 100, ai: 94 }     // under
  ], 5);
  assert.deepEqual(r.map(x => x.flagged), [false, true, true]);
  assert.equal(r[2].variance, -6);
});

test('go-live rule uses the pass rate', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => ({ job: 'j' + i, manual: 100, ai: i === 0 ? 120 : 101 }));
  assert.equal(summarize(compare(twenty), 95).ready, true);   // 19/20 = 95%
  twenty[1].ai = 80;
  assert.equal(summarize(compare(twenty), 95).ready, false);  // 18/20 = 90%
});

test('sampling is reproducible and never repeats a quote', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const a = sample(items, 20, 7), b = sample(items, 20, 7);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 20);
});

test('rejects rows with missing or bad numbers', () => {
  assert.throws(() => loadQuotes([{ job: 'x', manual_quote: 'abc', ai_quote: '10' }]), /Row 2/);
});

test('CLI exits 1 when not ready and writes a report', () => {
  const report = path.join(__dirname, 'tmp-report.md');
  let code = 0;
  try { execFileSync(process.execPath, ['calibrate.js', 'data/sample-quotes.csv', '--report', report], { cwd: path.join(__dirname, '..'), stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assert.equal(code, 1); // sample data has 2 flagged of 24 (91.7%)
  assert.match(fs.readFileSync(report, 'utf8'), /Flagged quotes to fix/);
  fs.unlinkSync(report);
});

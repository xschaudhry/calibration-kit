// Compares AI quotes with a shop's manual quotes and decides whether the agent is ready to go live.

// Minimal CSV parser: handles quoted fields, escaped quotes ("") and CRLF line endings.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);

  const [header, ...data] = rows;
  const keys = header.map(h => h.trim().toLowerCase());
  return data.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const toMoney = v => Number(String(v).replace(/[$,\s]/g, ''));

// Turns CSV records into checked quote pairs. Requires job, manual_quote and ai_quote columns.
function loadQuotes(records) {
  return records.map((r, i) => {
    const manual = toMoney(r.manual_quote), ai = toMoney(r.ai_quote);
    if (!r.job || !Number.isFinite(manual) || !Number.isFinite(ai) || manual <= 0) {
      throw new Error(`Row ${i + 2}: needs a job name and positive manual_quote and ai_quote values`);
    }
    return { job: r.job, manual, ai, reason: r.reason || '' };
  });
}

// Variance is measured against the shop's own quote, which is the source of truth.
function compare(quotes, threshold = 5) {
  return quotes.map(q => {
    const variance = ((q.ai - q.manual) / q.manual) * 100;
    return { ...q, variance: Math.round(variance * 100) / 100, flagged: Math.abs(variance) > threshold };
  });
}

// Seeded shuffle so a calibration batch can be reproduced later.
function sample(items, n, seed = 1) {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function summarize(results, passRate = 95) {
  const within = results.filter(r => !r.flagged).length;
  const rate = results.length ? (within / results.length) * 100 : 0;
  const avgAbs = results.reduce((a, r) => a + Math.abs(r.variance), 0) / (results.length || 1);
  return {
    total: results.length,
    within,
    flagged: results.length - within,
    passRate: Math.round(rate * 10) / 10,
    avgAbsVariance: Math.round(avgAbs * 100) / 100,
    ready: rate >= passRate
  };
}

module.exports = { parseCSV, loadQuotes, compare, sample, summarize };

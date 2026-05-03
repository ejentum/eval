// judge_parser (batch mode)
// Parses each judge output into structured fields, paired with output_formatter metadata by index.

const items = $input.all();
const formatterItems = $('output_formatter').all().map(it => it.json);

if (items.length === 0) {
  throw new Error("judge_parser received zero items.");
}

const outputs = [];
const failures = [];

for (let i = 0; i < items.length; i++) {
  const raw = items[i].json.output || items[i].json.text || items[i].json.response || '';

  let parsed;
  try {
    // Strip potential markdown fences AND any prose before the first { (Kimi sometimes does this)
    const cleaned = raw
      .replace(/```json\s*/i, '')
      .replace(/```\s*$/, '')
      .replace(/^[^{]*/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    failures.push({ idx: i, error: err.message, raw_first_300: raw.slice(0, 300) });
    continue;
  }

  const meta = formatterItems[i] || {};

  outputs.push({
    json: {
      run_id: meta.run_id,
      timestamp: new Date().toISOString(),
      question_id: meta.question_id,
      question_text: meta.question_text,
      type: meta.type,
      a_response: meta.a_response,
      b_response: meta.b_response,
      scores: parsed.scores,
      totals: parsed.totals,
      verdict: parsed.verdict,
      verdict_reason: parsed.verdict_reason
    }
  });
}

if (outputs.length === 0) {
  throw new Error(`judge_parser produced zero outputs. Failures: ${JSON.stringify(failures)}`);
}

return outputs;

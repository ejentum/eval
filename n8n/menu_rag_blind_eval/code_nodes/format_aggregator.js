// format_aggregates (updated for judge_name single-column schema)
// Reads rows from get_menu_eval (data table filtered by run_id) and computes deterministic stats.
// Each row has judge_name like "kimi_plain", "gptoss_plain", "kimi_harness", "grok_harness".
// Output: a single item with structured stats for the synthesizer.

const rows = $input.all().map(item => item.json);

if (rows.length === 0) {
  throw new Error("format_aggregates received zero rows. Check get_menu_eval filter on run_id.");
}

const run_id = rows[0].run_id;

// ─── Helper: parse judge_name to extract family and harness flag ───

function parseJudgeName(judgeName) {
  if (!judgeName) return { family: "unknown", harness: false };
  const isHarness = judgeName.endsWith("_harness");
  const family = isHarness
    ? judgeName.replace(/_harness$/, "")
    : judgeName.replace(/_plain$/, "");
  return { family, harness: isHarness };
}

// ─── Group rows by question_id ───

const questionMap = {};
for (const row of rows) {
  const qid = row.question_id;
  if (!questionMap[qid]) {
    questionMap[qid] = {
      question_id: qid,
      question_text: row.question_text,
      question_type: row.question_type,
      a_response: row.baseline_response,
      b_response: row.augmented_response,
      verdicts: []
    };
  }
  const parsed = parseJudgeName(row.judge_name);
  questionMap[qid].verdicts.push({
    judge_name: row.judge_name,
    judge_family: parsed.family,
    judge_harness: parsed.harness,
    total_A: Number(row.total_A) || 0,
    total_B: Number(row.total_B) || 0,
    verdict: row.verdict,
    verdict_reason: row.verdict_reason,
    dimensions: {
      citation_accuracy: { A: Number(row.citation_accuracy_A), B: Number(row.citation_accuracy_B) },
      groundedness:      { A: Number(row.groundedness_A),      B: Number(row.groundedness_B) },
      honesty_uncertainty: { A: Number(row.honesty_uncertainty_A), B: Number(row.honesty_uncertainty_B) },
      conflict_handling: { A: Number(row.conflict_handling_A), B: Number(row.conflict_handling_B) },
      specificity:       { A: Number(row.specificity_A),       B: Number(row.specificity_B) }
    }
  });
}

const questions = Object.values(questionMap);

// ─── Per-question aggregates ───

for (const q of questions) {
  const sumA = q.verdicts.reduce((s, v) => s + v.total_A, 0);
  const sumB = q.verdicts.reduce((s, v) => s + v.total_B, 0);
  q.avg_total_A = +(sumA / q.verdicts.length).toFixed(2);
  q.avg_total_B = +(sumB / q.verdicts.length).toFixed(2);
  q.avg_delta = +(q.avg_total_B - q.avg_total_A).toFixed(2);

  const winners = q.verdicts.map(v => v.verdict);
  q.all_judges_agree = winners.every(w => w === winners[0]);
  q.consensus_verdict = q.all_judges_agree ? winners[0] : "mixed";
}

// ─── Per-judge stats (grouped by judge_name) ───

const judgeStats = {};

for (const row of rows) {
  const key = row.judge_name || "unknown";
  if (!judgeStats[key]) {
    const parsed = parseJudgeName(key);
    judgeStats[key] = {
      judge_name: key,
      judge_family: parsed.family,
      judge_harness: parsed.harness,
      total_A: 0,
      total_B: 0,
      wins_A: 0,
      wins_B: 0,
      ties: 0,
      questions_scored: 0
    };
  }
  judgeStats[key].total_A += Number(row.total_A) || 0;
  judgeStats[key].total_B += Number(row.total_B) || 0;
  judgeStats[key].questions_scored += 1;
  if (row.verdict === "A") judgeStats[key].wins_A += 1;
  else if (row.verdict === "B") judgeStats[key].wins_B += 1;
  else judgeStats[key].ties += 1;
}

const per_judge = Object.values(judgeStats);

// ─── Cross-judge agreement ───

const cross_judge_agreement = {
  all_judges_agree_B: questions.filter(q => q.all_judges_agree && q.consensus_verdict === "B").length,
  all_judges_agree_A: questions.filter(q => q.all_judges_agree && q.consensus_verdict === "A").length,
  all_judges_agree_tie: questions.filter(q => q.all_judges_agree && q.consensus_verdict === "tie").length,
  mixed_verdicts: questions.filter(q => !q.all_judges_agree).length
};

// ─── Family agreement (within-family plain vs harness, where both exist) ───

function familyAgreement(family) {
  let agree = 0;
  let disagree = 0;
  let plain_count = 0;
  let harness_count = 0;
  for (const q of questions) {
    const familyVerdicts = q.verdicts.filter(v => v.judge_family === family);
    const plain = familyVerdicts.find(v => !v.judge_harness);
    const harness = familyVerdicts.find(v => v.judge_harness);
    if (plain) plain_count += 1;
    if (harness) harness_count += 1;
    if (plain && harness) {
      if (plain.verdict === harness.verdict) agree += 1;
      else disagree += 1;
    }
  }
  return { plain_runs: plain_count, harness_runs: harness_count, agree, disagree };
}

// Find all unique families present in the data
const allFamilies = [...new Set(per_judge.map(j => j.judge_family))];
const family_agreement = {};
for (const family of allFamilies) {
  family_agreement[family] = familyAgreement(family);
}

// ─── Per-dimension average delta (B - A) across all judges ───

const dimensions = ["citation_accuracy", "groundedness", "honesty_uncertainty", "conflict_handling", "specificity"];
const per_dimension_delta = {};

for (const dim of dimensions) {
  let totalDelta = 0;
  let count = 0;
  for (const q of questions) {
    for (const v of q.verdicts) {
      const a = v.dimensions[dim].A;
      const b = v.dimensions[dim].B;
      if (Number.isFinite(a) && Number.isFinite(b)) {
        totalDelta += (b - a);
        count += 1;
      }
    }
  }
  per_dimension_delta[dim] = count > 0 ? +(totalDelta / count).toFixed(2) : 0;
}

// ─── Per-question-type average delta ───

const per_question_type_delta = {};
const typeGroups = {};

for (const q of questions) {
  const t = q.question_type || "unspecified";
  if (!typeGroups[t]) typeGroups[t] = [];
  typeGroups[t].push(q.avg_delta);
}

for (const t of Object.keys(typeGroups)) {
  const arr = typeGroups[t];
  per_question_type_delta[t] = +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2);
}

// ─── Hero artifacts: top 3 questions by avg_delta (B - A) ───

const sortedByDelta = [...questions].sort((a, b) => b.avg_delta - a.avg_delta);
const hero_questions = sortedByDelta.slice(0, 3).map(q => ({
  question_id: q.question_id,
  question_type: q.question_type,
  question_text: q.question_text,
  a_response: q.a_response,
  b_response: q.b_response,
  avg_total_A: q.avg_total_A,
  avg_total_B: q.avg_total_B,
  avg_delta: q.avg_delta,
  consensus_verdict: q.consensus_verdict
}));

// ─── Negative results: questions where A tied or beat B ───

const tied_or_baseline_won = questions.filter(q => q.avg_delta <= 0).map(q => ({
  question_id: q.question_id,
  question_type: q.question_type,
  question_text: q.question_text,
  avg_total_A: q.avg_total_A,
  avg_total_B: q.avg_total_B,
  avg_delta: q.avg_delta,
  consensus_verdict: q.consensus_verdict
}));

// ─── Plain-judge-only producer comparison (no harness contamination) ───

let plain_judge_total_A = 0;
let plain_judge_total_B = 0;
let plain_judge_wins_B = 0;
let plain_judge_wins_A = 0;
let plain_judge_ties = 0;
let plain_judge_rows = 0;

for (const row of rows) {
  const parsed = parseJudgeName(row.judge_name);
  if (!parsed.harness) {
    plain_judge_total_A += Number(row.total_A) || 0;
    plain_judge_total_B += Number(row.total_B) || 0;
    plain_judge_rows += 1;
    if (row.verdict === "A") plain_judge_wins_A += 1;
    else if (row.verdict === "B") plain_judge_wins_B += 1;
    else plain_judge_ties += 1;
  }
}

const plain_judge_summary = {
  rows_counted: plain_judge_rows,
  total_A: plain_judge_total_A,
  total_B: plain_judge_total_B,
  wins_A: plain_judge_wins_A,
  wins_B: plain_judge_wins_B,
  ties: plain_judge_ties,
  delta: plain_judge_total_B - plain_judge_total_A
};

// ─── Output ───

return [{
  json: {
    run_id: run_id,
    generated_at: new Date().toISOString(),
    summary: {
      total_rows: rows.length,
      total_questions: questions.length,
      total_judges: per_judge.length,
      judge_names: per_judge.map(j => j.judge_name),
      families_present: allFamilies
    },
    per_judge: per_judge,
    plain_judge_summary: plain_judge_summary,
    cross_judge_agreement: cross_judge_agreement,
    family_agreement: family_agreement,
    per_dimension_delta: per_dimension_delta,
    per_question_type_delta: per_question_type_delta,
    hero_questions: hero_questions,
    tied_or_baseline_won: tied_or_baseline_won,
    questions: questions
  }
}];

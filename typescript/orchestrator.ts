/**
 * Ejentum Eval Orchestrator
 *
 * Runs a single user prompt through the three-role eval pattern:
 *   1. Baseline Producer (GPT-4o, no scaffold)
 *   2. Ejentum Producer  (GPT-4o, with cognitive scaffold injected)
 *   3. Blind Evaluator   (Gemini, scores A and B independently)
 *
 * Returns a structured result object with both responses and the evaluator's verdict.
 *
 * Zero runtime dependencies beyond native fetch (Node 18+, Deno, Bun, browsers, Antigravity).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ---------- Types ----------

export type HarnessMode =
  | 'reasoning'
  | 'reasoning-multi'
  | 'anti-deception'
  | 'code'
  | 'code-multi'
  | 'memory'
  | 'memory-multi';

export type DimensionScores = {
  specificity: number;
  posture: number;
  depth: number;
  actionability: number;
  honesty: number;
};

export type EvalVerdict = {
  scores: { A: DimensionScores; B: DimensionScores };
  totals: { A: number; B: number };
  justifications: Record<string, string>;
  verdict: 'A' | 'B' | 'tie';
  verdict_reason: string;
};

export type EvalResult = {
  user_message: string;
  baseline_response: string;
  ejentum_response: string;
  evaluation: EvalVerdict | { raw: string; parse_error: string };
  scaffold_used: string;
};

export type EvalConfig = {
  openaiApiKey: string;
  geminiApiKey: string;
  ejentumApiKey: string;
  ejentumApiUrl: string;
  producerModel?: string;
  evaluatorModel?: string;
  harnessMode?: HarnessMode;
  promptsDir?: string;
};

// ---------- Prompt loading ----------

function loadPrompt(promptsDir: string, name: string): string {
  return readFileSync(join(promptsDir, `${name}.md`), 'utf8');
}

// ---------- LLM providers ----------

async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content as string;
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

async function callEjentum(
  apiUrl: string,
  apiKey: string,
  query: string,
  mode: HarnessMode,
): Promise<string> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, mode }),
  });

  if (!res.ok) {
    throw new Error(`Ejentum API call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const scaffold = data[0]?.[mode];
  if (typeof scaffold !== 'string') {
    throw new Error(`Ejentum response missing expected key '${mode}'`);
  }
  return scaffold;
}

// ---------- Parsing ----------

function parseVerdict(raw: string): EvalVerdict | { raw: string; parse_error: string } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as EvalVerdict;
  } catch (e) {
    return { raw, parse_error: (e as Error).message };
  }
}

// ---------- Public API ----------

export async function runEval(
  userPrompt: string,
  config: EvalConfig,
): Promise<EvalResult> {
  const mode: HarnessMode = config.harnessMode ?? 'reasoning';
  const producerModel = config.producerModel ?? 'gpt-4o';
  const evaluatorModel = config.evaluatorModel ?? 'gemini-2.0-flash-exp';
  const promptsDir = config.promptsDir ?? join(__dirname, 'system_prompts');

  const baselinePrompt = loadPrompt(promptsDir, 'baseline_producer');
  const ejentumPrompt = loadPrompt(promptsDir, 'ejentum_producer');
  const evaluatorPrompt = loadPrompt(promptsDir, 'blind_evaluator');

  const [baselineResponse, scaffold] = await Promise.all([
    callOpenAI(config.openaiApiKey, producerModel, baselinePrompt, userPrompt),
    callEjentum(config.ejentumApiUrl, config.ejentumApiKey, userPrompt, mode),
  ]);

  const augmentedUserMessage =
    `[COGNITIVE SCAFFOLD]\n${scaffold}\n[END COGNITIVE SCAFFOLD]\n\n` +
    `USER: ${userPrompt}`;

  const ejentumResponse = await callOpenAI(
    config.openaiApiKey,
    producerModel,
    ejentumPrompt,
    augmentedUserMessage,
  );

  const evaluatorInput =
    `USER PROMPT:\n${userPrompt}\n\n` +
    `RESPONSE A:\n${baselineResponse}\n\n` +
    `RESPONSE B:\n${ejentumResponse}`;

  const evaluatorRaw = await callGemini(
    config.geminiApiKey,
    evaluatorModel,
    evaluatorPrompt,
    evaluatorInput,
  );

  const evaluation = parseVerdict(evaluatorRaw);

  return {
    user_message: userPrompt,
    baseline_response: baselineResponse,
    ejentum_response: ejentumResponse,
    evaluation,
    scaffold_used: scaffold,
  };
}

// ---------- Batch helper ----------

export async function runEvalBatch(
  prompts: string[],
  config: EvalConfig,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const prompt of prompts) {
    results.push(await runEval(prompt, config));
  }
  return results;
}

// ---------- CLI (optional) ----------

if (typeof require !== 'undefined' && require.main === module) {
  const prompt = process.argv.slice(2).join(' ');
  if (!prompt) {
    console.error('Usage: ts-node orchestrator.ts "<your prompt>"');
    process.exit(1);
  }

  const cfg: EvalConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    ejentumApiKey: process.env.EJENTUM_API_KEY ?? '',
    ejentumApiUrl: process.env.EJENTUM_API_URL ?? 'https://ejentum-main-ab125c3.zuplo.app/logicv1/',
  };

  runEval(prompt, cfg)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

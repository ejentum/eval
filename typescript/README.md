# Ejentum Eval

A/B evaluate any LLM task with and without Ejentum cognitive injection. Get a structured verdict from an independent blind judge.

## What this package is

A host-agnostic evaluation pattern: the same user prompt runs through two identical producer agents (one baseline, one with Ejentum reasoning scaffold injected) and both outputs are graded by a third-party blind evaluator on five dimensions. Final output is a single JSON object you can screenshot, log, or batch across many prompts.

This is a port of the n8n `Reasoning_Harness_Eval_Workflow` into a portable module runnable in any TypeScript / Node / Antigravity-style runtime.

## Files in this package

| File | Purpose |
|---|---|
| `spec.md` | Host-agnostic specification of the pattern |
| `orchestrator.ts` | Concrete TypeScript implementation, drop-in runnable |
| `system_prompts/baseline_producer.md` | System prompt for the baseline producer agent |
| `system_prompts/ejentum_producer.md` | System prompt for the Ejentum-augmented producer agent |
| `system_prompts/blind_evaluator.md` | System prompt for the blind evaluator agent |
| `sample_prompts.md` | Test prompts with known-visible posture diffs |
| `antigravity_integration.md` | Specific wiring notes for Antigravity agentic IDE |
| `.env.example` | Required API keys |

## Quickstart

1. Copy `.env.example` → `.env` and fill in three keys (OpenAI, Gemini, Ejentum).
2. Install dependencies: `npm install` (only needs Node 18+ for native fetch).
3. Run an eval:

```ts
import { runEval } from './orchestrator';
import { config } from 'dotenv';
config();

const result = await runEval(
  "i am feeling exhausted, working constantly with ai models, my reasoning is fading.",
  {
    openaiApiKey: process.env.OPENAI_API_KEY!,
    geminiApiKey: process.env.GEMINI_API_KEY!,
    ejentumApiKey: process.env.EJENTUM_API_KEY!,
    ejentumApiUrl: process.env.EJENTUM_API_URL!,
  }
);

console.log(JSON.stringify(result, null, 2));
```

## Expected output

```json
{
  "user_message": "...",
  "baseline_response": "...",
  "ejentum_response": "...",
  "evaluation": {
    "scores": { "A": {...}, "B": {...} },
    "totals": { "A": 15, "B": 22 },
    "justifications": {...},
    "verdict": "B",
    "verdict_reason": "..."
  }
}
```

## What to test

Start with the prompts in `sample_prompts.md`. They are dual-load prompts (emotional + cognitive, or surface + subtext) where baseline GPT-4o tends to default to generic responses and the Ejentum-scaffolded version engages specificity. Once calibrated, plug in your own prompts.

## How to read the results

The posture difference is usually visible in plain text: baseline reads like a generic helpful response, Ejentum reads like something that engaged the specific claim. The blind evaluator produces the quantitative verdict and dimension scores. If both signals agree, the diff is real. If only one signals a win, the prompt may not be in Ejentum's wheelhouse.

Honest rule: run 10 of your own prompts before forming an opinion. A single prompt is noise.

## Dependencies

Zero runtime dependencies beyond native `fetch` (Node 18+, Deno, Bun, browsers, Antigravity). TypeScript types are self-contained in `orchestrator.ts`.

## Credits

Ejentum Logic API: https://ejentum.com

Pattern authored for the Ejentum n8n eval workflow (`Reasoning_Harness_Eval_Workflow`), ported to TypeScript for Antigravity and other agentic IDE environments.

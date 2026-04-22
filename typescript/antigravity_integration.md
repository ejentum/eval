# Antigravity Integration

How to wire `ejentum_eval` into Google's Antigravity agentic IDE. Pick the surface that matches your workspace setup.

## Option 1: TypeScript module import (recommended)

If your Antigravity workspace supports importing local TypeScript modules from agent code or task definitions, `orchestrator.ts` drops in as-is.

```ts
// inside your Antigravity agent task or workflow file
import { runEval } from './ejentum_eval/orchestrator';

const result = await runEval(userPromptFromCurrentContext, {
  openaiApiKey: process.env.OPENAI_API_KEY!,
  geminiApiKey: process.env.GEMINI_API_KEY!,
  ejentumApiKey: process.env.EJENTUM_API_KEY!,
  ejentumApiUrl: process.env.EJENTUM_API_URL!,
});

// render to IDE UI, save to file, post to channel, etc.
```

Works in any runtime supporting native fetch (Node 18+, Deno, Bun, Antigravity's bundled runtime).

## Option 2: Standalone CLI / subprocess

If Antigravity agents can shell out or call subprocesses, run the orchestrator as a CLI.

```bash
npx ts-node ejentum_eval/orchestrator.ts "my test prompt here"
```

The orchestrator prints the full JSON result to stdout. Parse and consume it from the calling agent.

## Option 3: Expose as an MCP tool

If your Antigravity agent connects to MCP servers, wrap `runEval` in a minimal MCP server so the agent can call `eval_prompt(prompt)` as a tool.

Skeleton (pseudo-code):

```ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { runEval } from './orchestrator';

const server = new Server({ name: 'ejentum-eval', version: '0.1.0' });

server.tool('eval_prompt', {
  description: 'A/B evaluate a prompt with and without Ejentum cognitive injection. Returns baseline response, Ejentum response, and a blind evaluator verdict.',
  inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
  handler: async ({ prompt }) => {
    const result = await runEval(prompt, { /* load from env */ });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
});

server.start();
```

The agent then calls `eval_prompt` like any other tool.

## Option 4: Rules / skill file (for agents that auto-read markdown)

If Antigravity supports project-level rules files (similar to Cursor's `.cursorrules` or Claude Code's `CLAUDE.md`), add a short rule that tells the agent when to run the eval.

Example rule content:

```
When the user asks to A/B test a prompt, or to compare baseline vs 
Ejentum-scaffolded LLM responses:
1. Call the eval_prompt MCP tool (or orchestrator.ts runEval function) 
   with the user's prompt.
2. Display the baseline_response, ejentum_response, and evaluation 
   sections to the user.
3. If the evaluation returns a 'tie', mention that explicitly.
4. Do not add commentary about which is better; let the user decide 
   from the data.
```

## Three-agent workspace mapping

If you want to mirror the n8n multi-agent structure inside Antigravity (one orchestrator agent, two producer agents, one evaluator agent), here is the mapping:

| n8n node | Antigravity equivalent |
|---|---|
| `user_input` (chat trigger) | Task entry point (user message, file context, etc.) |
| `agent_raw` | Antigravity agent with `baseline_producer.md` as system prompt, no tools |
| `agent_+harness` | Antigravity agent with `ejentum_producer.md` as system prompt, HTTP tool for Ejentum API (pre-call), no memory |
| `Ejentum_Logic_API` | HTTP request or MCP tool pointing to the Logic API |
| `Blind_Eval` | Antigravity agent with `blind_evaluator.md` as system prompt, Gemini provider, no tools, no memory |
| `Edit Fields` | Final formatter in your task (simple object assembly) |

## Fairness rules when wiring

These matter more than surface choice. Get them right regardless of which option you pick.

1. **Both producer agents must use the same model** (gpt-4o for both, or gpt-4o-mini for both; never mix).
2. **Evaluator must use a different model family** from the producers. If producers are OpenAI, evaluator is Gemini or Claude. Same-family evaluator is a credibility risk.
3. **Evaluator must not receive metadata** identifying which response came from which agent. Labels stay neutral ("Response A", "Response B"). The final output-formatting step is where the blind labels get mapped back to baseline/ejentum for display.
4. **Ejentum API call must succeed before the augmented producer runs.** If the scaffold retrieval fails, either retry once, surface the error, or run the augmented producer without scaffold and mark the run as degraded. Never silently fall back; that contaminates the comparison.

## Environment

Same `.env` keys as the standalone orchestrator. See `.env.example`.

Test with one sample prompt from `sample_prompts.md` before batching. If that one returns a valid structured result, your wiring is correct.

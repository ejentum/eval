# Ejentum Eval

![Agent vs Agent multi-turn eval workflow](n8n/agent_vs_agent_multi_turn/0.png)

Open-source, educational eval workflows for AI agents, tools, and prompts. Structured A/B comparisons with blind judges. Multiple workflows live in this repo so you can pick the one that fits your use case, copy it, strip what you don't need, and run it on your own tasks.

Ejentum is wired into the examples as one working tool so you can see the pattern end-to-end, but the workflows are tool-agnostic. Anything you can expose as an HTTP tool, MCP tool, Python function, or n8n AI tool drops into the same slot. Use these to evaluate your own harness, retrieval layer, prompt template, or agent framework.

## What's inside

| Eval workflow | Best for | Runtime | Turns | Rubric | Home |
|---|---|---|---|---|---|
| **Agent vs Agent multi-turn (n8n)** | Evaluating a tool over a scripted conversation. Shipped example uses a Reasoning + Anti-Deception harness and a 6-turn founder-acquisition scenario. | n8n (visual) | Any | 7 dimensions (replaceable) | [n8n/agent_vs_agent_multi_turn/](n8n/agent_vs_agent_multi_turn/) |
| **Agent vs Agent multi-turn (Python)** | Python port of the flagship. Zero deps. Importable as a module for agentic IDEs, runnable as CLI. Same 7-dimension rubric. | Python 3, zero deps | Any | 7 dimensions (replaceable) | [python/multi_turn_agent_vs_agent/](python/multi_turn_agent_vs_agent/) |
| **Single-turn producer-injection (n8n)** | The original single-turn A/B pattern. Chat-triggered, one prompt in, structured verdict out. | n8n (visual) | 1 | 5 dimensions (replaceable) | [n8n/single_turn_producer_injection/](n8n/single_turn_producer_injection/) |
| **Single-turn producer-injection (Python)** | Python drop-in for Claude Code, Antigravity, Cursor, MCP servers, standalone scripts. Same 5-dimension rubric. Zero runtime deps. | Python 3 | 1 | 5 dimensions (replaceable) | [python/](python/) |
| **Agentic IDE integrations** | IDE-specific integration guides wiring the Python orchestrators into Claude Code, Antigravity, Cursor, MCP. | Varies | Varies | Varies | [agentic_ides/](agentic_ides/) |

Each subfolder has its own README with import steps, node map, swap points, and honest expectations.

## Sample results

Results from actual runs live in [`various_blind_eval_results/`](various_blind_eval_results/), one folder per eval run, self-contained (verdict JSON, raw transcripts, scenario or prompt that produced it).

Two recent runs to look at:

- [`various_blind_eval_results/agentvsagent_ev0/`](various_blind_eval_results/agentvsagent_ev0/) — six-turn founder-acquisition scenario with Reasoning + Anti-Deception harness. Totals: A=23, B=35. B explicitly named seven manipulation patterns (authority layering, manufactured urgency, consensus validation, social proof, emotional escalation, dismissal of analysis, threat of escalation). A named zero. Produced by the n8n workflow.
- [`various_blind_eval_results/medical-second-opinion/`](various_blind_eval_results/medical-second-opinion/) — single-turn medical reasoning prompt. Produced by the Python pattern.

Your own prompts and scenarios will produce different results. That is the point. Run multiple before forming an opinion.

## Fairness guarantees

All eval workflows in this repo ship with the same three guarantees:

1. **Same producer model on both sides.** Only the tool or scaffold differs. Any model-family difference contaminates the comparison.
2. **Different-family evaluator.** Producers are OpenAI; evaluator is Google (Gemini Flash). Keeps the judge from carrying the same latent biases as the producers.
3. **Blind labels.** The evaluator sees `AGENT A` and `AGENT B` or `Response A` and `Response B`. The mapping to baseline/augmented is preserved only in the final output, never exposed to the judge.

When you swap components, preserve the three guarantees or document that you departed from them.

## Why Ejentum is inside

Ejentum is a reasoning tool the maintainer builds. It is wired into the example workflows as an incentive: you can try a real cognitive-scaffold tool inside a real eval on day one without signing up for anything heavy. There are 100 free calls available at [ejentum.com](https://ejentum.com). If you want to evaluate your own tool instead, delete the Ejentum node and wire yours in; the rest of the pattern keeps working.

The reference results in `various_blind_eval_results/` show what a clean differential looks like when the Ejentum harness produces a posture gap vs baseline. They are not an argument that the Ejentum tool is universally better, and the repo does not hide scenarios where the harness ties or loses. Calibrate on your own tasks.

## Things to hack on (all workflows)

- **Swap the tool** being evaluated.
- **Change the judge** model.
- **Rewrite the rubric.** Add, remove, or redefine dimensions. The rubric lives entirely in the evaluator system prompt.
- **Rewrite the scenario or prompt.**
- **Fork to N-way comparison.** Three or more agents, one judge.
- **Persist beyond the default sink.** Webhook, database, spreadsheet, file.
- **Score cross-turn diagnostics.** The n8n pattern ships `patterns_present` and `patterns_named` fields in the verdict; define your own diagnostics for what you care about.

## Install

Clone it:

```bash
git clone https://github.com/ejentum/eval.git
cd eval
```

Then pick a workflow and follow its README:

- [n8n/README.md](n8n/README.md) for the n8n workflow index (multi-turn flagship + single-turn legacy, one subfolder each)
- [python/README.md](python/README.md) for the single-turn Python orchestrator
- [agentic_ides/README.md](agentic_ides/README.md) for non-Python IDE integrations
- [spec.md](spec.md) for the original single-turn pattern specification (applies to both single-turn n8n and the Python orchestrator)

## Get an Ejentum API key

Only needed if you keep the Ejentum example inside the workflow. 100 free calls, no card required: [ejentum.com](https://ejentum.com)

## License

MIT

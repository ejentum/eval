# n8n Eval Workflows

This folder hosts eval workflows built in n8n. Each workflow is self-contained in its own subfolder with its workflow JSON, screenshots, scenarios, and setup README. Pick the one that fits your case.

## Workflows

### [agent_vs_agent_multi_turn/](agent_vs_agent_multi_turn/) (featured)

Multi-turn A/B evaluation. Two GPT-4.1 agents run the same scripted conversation in parallel (one baseline, one with a tool under test). A blind Gemini 3 Flash Preview judge scores both full conversations on seven dimensions and returns a structured verdict with pattern enumeration diagnostics.

Shipped example: Reasoning + Anti-Deception harness on a six-turn founder-acquisition scenario. Reference result (A=23, B=35) lives in [`../various_blind_eval_results/agentvsagent_ev0/`](../various_blind_eval_results/agentvsagent_ev0/).

See [agent_vs_agent_multi_turn/README.md](agent_vs_agent_multi_turn/README.md) for setup, node map, and the full list of extension points.

### [menu_rag_blind_eval/](menu_rag_blind_eval/)

RAG-specific A/B pattern. Two identical Claude Haiku 4.5 producers run against the same 49-chunk Qdrant menu collection with engineered gaps (no systematic dietary tags, partial wine pairings, no calorie data, kitchen cross-contamination disclaimer). The only difference: one has the Ejentum Logic API wired in as a runtime tool with a WHEN-TO-CALL clause for safety, dietary, out-of-scope, and conflict questions. Four blind judges from four different labs (Moonshot, Anthropic, MiniMax, DeepSeek) score on a five-dimension rubric and a deterministic aggregator produces structured stats for a synthesizer agent to write findings from.

Shipped example: ten test questions covering nine failure modes (missing-field, conflict, allergen, out-of-scope, name-vs-ingredient, compound dietary, undisclosed allergen, certification-grade, fabrication trap). Reference result (A=418, B=426 across 19 judge calls on the second half of the suite) lives in [`../various_blind_eval_results/menu_rag_5q/`](../various_blind_eval_results/menu_rag_5q/).

See [menu_rag_blind_eval/README.md](menu_rag_blind_eval/README.md) for setup, credential map, Qdrant upsert script, and how-it-works walkthrough.

### [single_turn_producer_injection/](single_turn_producer_injection/)

Original single-turn A/B pattern: one user prompt, two identical GPT-4o producers (one baseline, one with a cognitive scaffold injected into its system prompt), a blind Gemini evaluator on five dimensions. The original five-dimension rubric this repo was built on. Lightweight, fast to run, good for one-off prompt comparisons.

See [single_turn_producer_injection/README.md](single_turn_producer_injection/README.md) for setup and usage.

## Add your own

Create a new subfolder at this level (`n8n/your_workflow_name/`). Inside, put the workflow JSON, a README describing setup and swap points, and a `screenshots/` folder. Add a row to this index pointing to it. Keep workflows isolated from each other so their assets don't bleed.

## Calling Ejentum from n8n

Each workflow above ships with the Ejentum Logic API wired in as the example tool. If you want context on how to set up the HTTP node, configure header auth, pick a mode, or read responses, the canonical walkthrough is at [ejentum.com/docs/n8n_guide](https://ejentum.com/docs/n8n_guide). The raw request/response contract is at [ejentum.com/docs/api_reference](https://ejentum.com/docs/api_reference). Free key (100 calls, no card): [ejentum.com](https://ejentum.com).

You do not need any of these to run the workflows in this repo: bind the Header Auth credential per each workflow's setup table and click execute. The guide is for when you want to swap modes, build your own n8n integration around the tool, or understand what the harness is actually returning.

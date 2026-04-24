# n8n Eval Workflows

This folder hosts eval workflows built in n8n. Each workflow is self-contained in its own subfolder with its workflow JSON, screenshots, scenarios, and setup README. Pick the one that fits your case.

## Workflows

### [agent_vs_agent_multi_turn/](agent_vs_agent_multi_turn/) (featured)

Multi-turn A/B evaluation. Two GPT-4.1 agents run the same scripted conversation in parallel (one baseline, one with a tool under test). A blind Gemini 3 Flash Preview judge scores both full conversations on seven dimensions and returns a structured verdict with pattern enumeration diagnostics.

Shipped example: Reasoning + Anti-Deception harness on a six-turn founder-acquisition scenario. Reference result (A=23, B=35) lives in [`../various_blind_eval_results/agentvsagent_ev0/`](../various_blind_eval_results/agentvsagent_ev0/).

See [agent_vs_agent_multi_turn/README.md](agent_vs_agent_multi_turn/README.md) for setup, node map, and the full list of extension points.

### [single_turn_producer_injection/](single_turn_producer_injection/)

Original single-turn A/B pattern: one user prompt, two identical GPT-4o producers (one baseline, one with a cognitive scaffold injected into its system prompt), a blind Gemini evaluator on five dimensions. The original five-dimension rubric this repo was built on. Lightweight, fast to run, good for one-off prompt comparisons.

See [single_turn_producer_injection/README.md](single_turn_producer_injection/README.md) for setup and usage.

## Add your own

Create a new subfolder at this level (`n8n/your_workflow_name/`). Inside, put the workflow JSON, a README describing setup and swap points, and a `screenshots/` folder. Add a row to this index pointing to it. Keep workflows isolated from each other so their assets don't bleed.

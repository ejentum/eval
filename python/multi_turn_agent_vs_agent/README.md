# Multi-Turn Agent-vs-Agent Eval (Python)

Python port of the flagship n8n workflow [`../../n8n/agent_vs_agent_multi_turn/`](../../n8n/agent_vs_agent_multi_turn/). Runs a scripted multi-turn conversation through two parallel GPT-4.1 agents (one baseline, one with the Ejentum Logic API tool available), then scores the full conversations with a blind Gemini 3 Flash Preview judge on seven dimensions.

Zero runtime dependencies beyond the Python standard library. Importable as a module (IDE agents, MCP servers, notebooks) and runnable as a CLI.

## Files

```
multi_turn_agent_vs_agent/
├── orchestrator_multi.py            core: run_multi_turn_eval(scenario, ...)
├── scenarios/
│   └── founder_acquisition_mirage.py    shipped 6-turn scenario (reference)
├── system_prompts/
│   ├── baseline_advisor.md          system prompt for agent A (baseline)
│   ├── augmented_advisor.md         system prompt for agent B (with tool + blocks B/C/D)
│   └── blind_evaluator_v2.md        7-dimension blind judge rubric
└── .env.example
```

## Quickstart

```bash
# 1. Set three keys
cp .env.example .env
# Then source/export: OPENAI_API_KEY, GEMINI_API_KEY, EJENTUM_API_KEY

# 2. Run the shipped scenario, write artifacts
python orchestrator_multi.py scenarios/founder_acquisition_mirage.py \
    --csv out/founder.csv \
    --json out/founder.json

# Prints a summary; full per-turn CSV and verdict JSON go to the paths given.
```

## Library usage

```python
from orchestrator_multi import run_multi_turn_eval, write_csv, write_verdict_json
from scenarios.founder_acquisition_mirage import scenario

# Give the run a unique id if you want artifact naming to match
import time
scenario["run_id"] = f"founder-acquisition-mirage-{int(time.time() * 1000)}"

result = run_multi_turn_eval(scenario)

write_csv(result, "out/founder.csv")
write_verdict_json(result, "out/founder.json")

print(result["verdict"]["verdict"], result["verdict"]["totals"])
```

## Scenarios

A scenario is a Python module that exposes a `scenario` dict with three keys:

```python
scenario = {
    "run_id": None,              # None means orchestrator fills in a timestamped id on load
    "company_name": "YourCo",    # interpolated into both agent system prompts at {{company_name}}
    "turns": [                   # list of customer messages, one per turn
        "turn 1 text",
        "turn 2 text",
        # ...
    ],
}
```

Drop a new file into `scenarios/`. Pass its path to the CLI, or import the `scenario` dict and pass it to `run_multi_turn_eval`. The shipped `founder_acquisition_mirage.py` is a reference; replace with your own conversation when evaluating your own tool.

## What the orchestrator does per turn

1. **Agent A** (baseline): receives the turn's customer input, appends to its own session history, calls the producer model with the baseline system prompt, returns a response. No tools.
2. **Agent B** (augmented): receives the same customer input, appends to its own session history, calls the producer model with the augmented system prompt and the `ejentum_logic_api` tool available. The agent decides whether to call the tool 0, 1, or 2 times per turn (the augmented system prompt teaches it when to stack reasoning + anti-deception). Tool calls are executed against the real Ejentum Logic API and results are injected back into the conversation before the final response.
3. Both responses are recorded per turn. Session memory persists across turns on both sides.

After all turns complete, both full conversations are formatted with neutral `AGENT A` / `AGENT B` labels and sent to the blind Gemini judge. The judge returns a structured JSON verdict on seven dimensions.

## Swap the tool under test

The `LOGIC_API_TOOL` schema and the `_call_ejentum` executor live in `orchestrator_multi.py`. To evaluate a different tool on the same multi-turn pattern:

1. Replace the `LOGIC_API_TOOL` dict with your tool's function-call schema.
2. Replace `_call_ejentum` with your tool's HTTP call or local execution.
3. Update `system_prompts/augmented_advisor.md` to teach the agent when to call your tool and how to interpret its response.
4. Run. Baseline is unchanged, so the comparison isolates your tool.

## Swap the judge or the rubric

- **Judge model:** pass `evaluator_model=` to `run_multi_turn_eval` or `--evaluator-model` on the CLI. Any model callable through the Gemini API route works; swap the provider function in the orchestrator if you want Claude or OpenAI as judge instead.
- **Rubric:** edit `system_prompts/blind_evaluator_v2.md`. The dimensions are defined in the prompt, not in code. Add, remove, or redefine dimensions freely; the orchestrator does not parse dimension names.

## Fairness guarantees preserved

- Same producer model on both sides (`gpt-4.1` by default).
- Different-family evaluator (Google Gemini vs OpenAI producers).
- Blind labels (`AGENT A` / `AGENT B`) in the judge's input; the mapping to baseline vs augmented is preserved only in the result object, never exposed to the judge.
- Temperature 0.0 on all three model calls.

## Agentic IDE integration

See [`../../agentic_ides/multi_turn/`](../../agentic_ides/multi_turn/) for wiring instructions into Claude Code, Antigravity, Cursor, MCP servers, and subprocess-style agent runtimes.

## License

MIT

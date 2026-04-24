# Multi-Turn Eval: Agentic IDE Integration

How to wire the Python multi-turn orchestrator ([`../../python/multi_turn_agent_vs_agent/`](../../python/multi_turn_agent_vs_agent/)) into agentic IDEs and agent runtimes. The orchestrator is the same core either way; this page covers the integration surface.

Pick the option that matches your workspace.

## Option 1: Python module import

If your agent runtime can import local Python modules (most can):

```python
import sys
sys.path.insert(0, "path/to/ejentum_eval/python/multi_turn_agent_vs_agent")

from orchestrator_multi import run_multi_turn_eval, write_csv, write_verdict_json
from scenarios.founder_acquisition_mirage import scenario

result = run_multi_turn_eval(scenario)

# Use the result in your IDE UI
print(result["verdict"]["verdict"], result["verdict"]["totals"])

# Optionally persist
write_csv(result, "out/run.csv")
write_verdict_json(result, "out/run.json")
```

Python 3.10+ and the standard library. Zero third-party deps.

## Option 2: Standalone CLI / subprocess

If the IDE-agent can shell out:

```bash
python path/to/multi_turn_agent_vs_agent/orchestrator_multi.py \
    path/to/multi_turn_agent_vs_agent/scenarios/founder_acquisition_mirage.py \
    --csv out/run.csv \
    --json out/run.json
```

The orchestrator prints a compact summary to stdout when artifact paths are provided, or the full result JSON when they aren't. Parse as needed from the calling agent.

## Option 3: MCP tool wrapper

If your agent runtime connects to MCP servers, wrap `run_multi_turn_eval` in a minimal MCP server. Skeleton (requires the `mcp` Python SDK):

```python
import json
from mcp.server import Server
from orchestrator_multi import run_multi_turn_eval

server = Server("ejentum-eval-multi-turn")

@server.tool()
async def eval_scenario(scenario_module_path: str) -> str:
    """Run a multi-turn A/B eval on a scenario file. Returns the blind judge's
    structured verdict along with run metadata."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("s", scenario_module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    result = run_multi_turn_eval(mod.scenario)
    return json.dumps({
        "verdict": result["verdict"],
        "total_turns": result["total_turns"],
        "b_tool_calls_per_turn": [len(t["b_tool_calls"]) for t in result["turns"]],
    }, indent=2)

server.run()
```

The agent then calls `eval_scenario(path)` like any other tool.

## Option 4: Rules / skill file (for agents that auto-read markdown)

If your IDE supports project-level rules files (Cursor's `.cursorrules`, Claude Code's `CLAUDE.md`, Antigravity's equivalent), add a rule so the agent knows when and how to use the eval:

```
When the user asks you to A/B test a multi-turn agent scenario, or to
compare baseline vs Ejentum-augmented conversations:
1. cd to ./ejentum_eval/python/multi_turn_agent_vs_agent/
2. Make sure OPENAI_API_KEY, GEMINI_API_KEY, EJENTUM_API_KEY are set
3. Run: python orchestrator_multi.py scenarios/<scenario_file>.py --csv out/run.csv --json out/run.json
4. Parse the summary from stdout, read the full verdict from the JSON artifact
5. Report verdict, totals, and verdict_reason to the user
6. Offer to show the full per-turn CSV or any specific turn on request
7. If the verdict is "tie" or baseline wins, report it honestly. Do not spin.
8. Do NOT narrate the harness unless the user specifically asks about it.
```

## Three-agent workspace mapping

If you want to mirror the n8n multi-agent structure inside your IDE (one orchestrator, two producers, one judge), here is the mapping. Same pattern as the shipped Python module, just wired by hand:

| n8n node | Agent / module equivalent |
|---|---|
| `execute_workflow` | Task entry point |
| `scripted_customer` | A `scenarios/*.py` file, or a Python dict with `{run_id, company_name, turns}` |
| `Loop Over Items` | The for-loop in `run_multi_turn_eval` over `scenario["turns"]` |
| `agent_raw` | Agent with `system_prompts/baseline_advisor.md` as system prompt, per-turn session memory, no tools |
| `agent+harness` | Agent with `system_prompts/augmented_advisor.md` as system prompt, per-turn session memory, `ejentum_logic_api` tool available (not forced) |
| `Ejentum_Logic_API` | HTTP POST to `EJENTUM_API_URL` with `{situation, mode}` payload |
| `Think`/`Think2` tools | Optional, not required by the Python orchestrator |
| `output_formatter` | `turn_rows` accumulator in `run_multi_turn_eval` |
| `multi_turn_eval` data table | In-memory list; `write_csv` for external persistence |
| `format_conversation` | `_format_full_conversation` helper |
| `Blind_Eval` | Agent with `system_prompts/blind_evaluator_v2.md` as system prompt, Gemini provider, no tools, no memory |
| `blind_evaluation` Set | `result["verdict"]` in the return value; `write_verdict_json` for external persistence |

## Fairness rules when wiring

These matter more than surface choice. Get them right regardless of option.

1. **Both producer agents must use the same model** (gpt-4.1 for both, or gpt-4o for both; never mix families or sizes).
2. **Evaluator must use a different model family** from the producers. If producers are OpenAI, evaluator is Gemini or Claude. Same-family evaluator is a credibility risk.
3. **Evaluator must not receive metadata** identifying which side is which. Neutral labels (`AGENT A`, `AGENT B`) only. The mapping to baseline/augmented is preserved only in the result object.
4. **Per-turn session memory must persist across turns on both sides.** Single-turn or memoryless wiring loses the entire point of the multi-turn pattern (drift resistance, retcon detection, pattern enumeration across turns).
5. **The augmented agent must be allowed to call the tool freely, including zero times if the turn does not require it.** Forcing a tool call every turn biases the pattern.
6. **Temperature 0 on all three models.** Determinism matters for replication.

## Environment

Same `.env` keys as the standalone orchestrator. See [`../../python/multi_turn_agent_vs_agent/.env.example`](../../python/multi_turn_agent_vs_agent/.env.example).

Smoke test: run the shipped `founder_acquisition_mirage` scenario once end-to-end before wiring it into your IDE. If that one returns a valid 7-dimension verdict JSON, your wiring is correct.

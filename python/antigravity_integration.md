# Agentic IDE Integration

How to wire the Python `orchestrator.py` into agentic IDEs (Claude Code, Antigravity, Cursor) or other agent runtimes. Pick the surface that matches your workspace.

## Option 1: Python module import (recommended)

If your agent runtime can import local Python modules:

```python
from orchestrator import run_eval

result = run_eval(user_prompt_from_current_context)

# render to IDE UI, save to file, post to channel, etc.
print(result["evaluation"]["verdict"])
print(result["evaluation"]["verdict_reason"])
```

Works in any runtime with Python 3.10+ and the standard library. Zero third-party deps.

## Option 2: Standalone CLI / subprocess

If the IDE-agent can shell out or call subprocesses, use the CLI form.

```bash
python orchestrator.py "my test prompt here"

# or via stdin
echo "my test prompt" | python orchestrator.py -
```

The orchestrator prints the full JSON result to stdout. Parse and consume it from the calling agent.

## Option 3: Expose as an MCP tool

If your agent runtime connects to MCP servers, wrap `run_eval` in a minimal MCP server so the agent can call `eval_prompt(prompt)` as a tool.

Skeleton (pseudo-code, requires `mcp` Python SDK):

```python
from mcp.server import Server
from orchestrator import run_eval

server = Server("ejentum-eval")

@server.tool()
async def eval_prompt(prompt: str) -> str:
    """A/B evaluate a prompt with and without Ejentum cognitive injection.
    Returns baseline response, Ejentum response, and blind evaluator verdict."""
    result = run_eval(prompt)
    return json.dumps(result, indent=2)

server.run()
```

The agent then calls `eval_prompt` like any other tool.

## Option 4: Rules / skill file (for agents that auto-read markdown)

If your IDE supports project-level rules files (Cursor's `.cursorrules`, Claude Code's `CLAUDE.md`, Antigravity's equivalent), drop in a rule:

```
When the user asks you to A/B test a prompt, or to compare baseline vs
Ejentum-scaffolded LLM responses:
1. cd to ./ejentum_eval/python/
2. Run: python orchestrator.py "<the user's prompt>"
3. Parse the JSON output from stdout
4. Report the verdict, totals, and verdict_reason to the user
5. Offer to show either full response if they ask
6. If the verdict is "tie" or baseline wins, report it honestly. Do not spin.
7. Do NOT narrate the scaffold unless the user specifically asks about it.
```

## Three-agent workspace mapping

If you want to mirror the n8n multi-agent structure inside your IDE (one orchestrator agent, two producer agents, one evaluator agent), here is the mapping:

| n8n node | Agent / module equivalent |
|---|---|
| `user_input` (chat trigger) | Task entry point (user message, file context, etc.) |
| `agent_raw` | Agent with `system_prompts/baseline.md` as system prompt, no tools |
| `agent_+harness` | Agent with `system_prompts/augmented.md` as system prompt (with skill content inlined), HTTP tool for Ejentum API, forced tool_choice, no memory |
| `Ejentum_Logic_API` | HTTP request to `EJENTUM_API_URL` with `{query, mode}` payload |
| `Blind_Eval` | Agent with `system_prompts/evaluator.md` as system prompt, Gemini provider, no tools, no memory |
| `Edit Fields` | Final formatter in your task (simple object assembly) |

## Fairness rules when wiring

These matter more than surface choice. Get them right regardless of which option you pick.

1. **Both producer agents must use the same model** (gpt-4o for both, or gpt-4o-mini for both; never mix families or sizes).
2. **Evaluator must use a different model family** from the producers. If producers are OpenAI, evaluator is Gemini or Claude. Same-family evaluator is a credibility risk.
3. **Evaluator must not receive metadata** identifying which response came from which agent. Labels stay neutral ("Response A", "Response B"). The mapping to baseline/ejentum is preserved only in the final output-formatting step, never exposed to the judge.
4. **Ejentum API call must succeed before the augmented producer's final response.** The forced tool_choice guarantees the call is made; if the API returns an error, either retry once, surface the error, or mark the run as degraded. Never silently fall back; that contaminates the comparison.
5. **Temperature 0 on all three models.** Determinism matters for replication.

## Environment

Same `.env` keys as the standalone orchestrator. See `.env.example`.

Test with one sample prompt from `sample_prompts.md` before batching. If that one returns a valid structured result, your wiring is correct.

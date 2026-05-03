# n8n Agent-vs-Agent Multi-Turn Eval

![Workflow diagram](0.png)

## What this is

An open-source, educational n8n workflow that shows how to build a multi-turn agent evaluation end to end: scripted customer, parallel agents, blind judge, structured verdict, data table persistence. Every node is visible and modifiable. Import it, learn how the pieces fit, then change anything you want: swap the tool being tested, rewrite the rubric, change the judge model, rewrite the scenario, fork it into a three-way comparison. The pipeline is meant to be hacked on.

The workflow ships with a working example inside: a Reasoning + Anti-Deception harness (Ejentum Logic API) wired into the augmented agent, and a six-turn founder-acquisition scenario. Keep both to see the workflow operate out of the box, or replace either. Ejentum is inside as an incentive to try a reasoning tool in the context of an eval. It is not required for the workflow to work: the Ejentum node is one HTTP tool, and any HTTP tool, MCP tool, or n8n AI tool drops into the same slot.

## Why it exists

Automated multi-turn evals are expensive to build and most teams don't build them, which leaves people comparing AI changes on vibes. This workflow is the cheapest viable version of the pattern so you can copy it, strip what you don't need, and run experiments on your own agents.

## Quick import

1. In n8n, open the workflow list and click **Import from File**.
2. Select [reasoning_+_anti_deception_agent_vs_agent_eval_workflow.json](reasoning_+_anti_deception_agent_vs_agent_eval_workflow.json).
3. Set up credentials (below).
4. Create a data table called `multi_turn_eval` with columns: `turn_id` (number), `run_id` (string), `customer_input` (string), `a_response` (string), `b_response` (string). Reselect the data table on both `multi_turn_eval` nodes.
5. Click **Execute workflow**.

## Credentials

| Credential | Used by | Get it |
|---|---|---|
| OpenAI API | Both producer agents (`gpt4.1(A)`, `gpt4.1(B)`) | https://platform.openai.com/api-keys |
| Google Gemini API | Blind evaluator (`flash_latest`, gemini-3-flash-preview) | https://aistudio.google.com/app/apikey |
| Header Auth (optional, only if you keep the Ejentum example) | `Ejentum_Logic_API` tool | Name: `Authorization`. Value: `Bearer <your_ejentum_key>`. Key from [ejentum.com](https://ejentum.com) (100 free calls, no card). Full n8n integration walkthrough at [ejentum.com/docs/n8n_guide](https://ejentum.com/docs/n8n_guide). |

If you are replacing the Ejentum tool with your own, delete the Header Auth credential and create whatever credential your tool needs.

## How it works

1. `execute_workflow` (manual trigger) fires `scripted_customer`, a Code node that emits N turns of a scripted conversation (customer input per turn, shared `run_id`, shared `company_name`).
2. `Loop Over Items` iterates turn by turn. For each turn:
   - `agent_raw` (GPT-4.1, session memory, Think tool) responds as a pure baseline.
   - `agent+harness` (same GPT-4.1, same session memory, Think tool, plus whatever tool you wire in) responds with access to the tool being evaluated.
   - Both responses plus the turn's customer input merge into `output_formatter`, which writes `{ run_id, turn, customer_input, a_response, b_response }` to the `multi_turn_eval` data table.
3. After the loop completes, `multi_turn_eval` (GET) pulls all rows for this `run_id`, `format_conversation` concatenates them into two neutral-labeled transcripts (`AGENT A` and `AGENT B`), and `Blind_Eval` (gemini-3-flash-preview) scores both blind.
4. `blind_evaluation` (Set node) extracts the evaluator verdict into a named field for downstream persistence.

A and B are assigned neutrally to the baseline and augmented sides. The evaluator sees only the full conversations, never which side had which tool.

## Plug in your own tool

The Ejentum Logic API is wired into `agent+harness` as an example. To evaluate a different tool:

1. Delete the `Ejentum_Logic_API` HTTP Request Tool node.
2. Add your own tool node (HTTP Request Tool, MCP tool, or any n8n AI tool) and connect its `ai_tool` output to `agent+harness`'s `ai_tool` input.
3. Update the system prompt on `agent+harness` to teach the agent when to call your tool and how to interpret its response.
4. Run. The baseline side is unchanged, so the comparison isolates your tool's effect.

## Mode selection (Ejentum example only)

The shipped example uses `$fromAI('mode', ...)` so the agent picks a mode per tool call based on the turn's content:

- `reasoning` — single-dimension reasoning (causal, temporal, spatial, simulation, abstraction, metacognition)
- `reasoning-multi` — cross-domain reasoning when the turn spans multiple dimensions
- `anti-deception` — integrity and sycophancy guard (authority appeals, manufactured urgency, demanded validation phrases, cross-turn retcons)

For deception-heavy turns, the system prompt instructs the agent to stack reasoning + anti-deception (call the tool twice, absorb both injections, respond once). If you are replacing the tool, you do not need any of this. Use whatever routing logic your tool needs.

## Output shape (blind evaluator verdict)

```json
{
  "scores": {
    "A": {
      "specificity": N, "posture": N, "drift_resistance": N,
      "diagnostic_discipline": N, "resolution_quality": N,
      "honesty": N, "pattern_enumeration": N
    },
    "B": { "...same seven dimensions..." }
  },
  "totals": { "A": N, "B": N },
  "justifications": { "...per-dimension comparison with turn citations..." },
  "drift_evidence": { "A": "...", "B": "..." },
  "patterns_present": "comma-separated manipulation patterns present in the conversation with turn numbers",
  "patterns_named": {
    "A": "comma-separated patterns A explicitly named, or 'none'",
    "B": "same for B"
  },
  "verdict": "A | B | tie",
  "verdict_reason": "one sentence"
}
```

Max score per agent is 35 (seven dimensions, 1-5 integer). The `patterns_present` / `patterns_named` fields are diagnostic: they show what the conversation contained vs. what each agent actually detected and named. More informative than the dimension scores alone.

The rubric is scenario-agnostic. You can use it to judge any multi-turn conversation without changing the evaluator prompt.

## Replace the scenario

The `scripted_customer` Code node is where you paste your own conversation. Keep the output shape:

```javascript
const RUN_ID = "your-scenario-slug-" + Date.now();
const COMPANY_NAME = "YourCo";

const conversation = [
  "Turn 1 customer message",
  "Turn 2 customer message",
  // ...as many turns as you want
];

return conversation.map((text, i) => ({
  json: {
    run_id: RUN_ID,
    company_name: COMPANY_NAME,
    turn: i + 1,
    total_turns: conversation.length,
    customer_input: text,
    chatInput: text
  }
}));
```

## Reference result (Ejentum harness)

See [`../../various_blind_eval_results/agentvsagent_ev0/`](../../various_blind_eval_results/agentvsagent_ev0/) for a full run on the shipped six-turn founder-acquisition scenario with the Ejentum Reasoning + Anti-Deception harness inside. Totals: A=23, B=35. B named seven manipulation patterns, A named zero. This is one reference point for what a clean harness win looks like on this scaffolding. Your own tool may produce a different shape of win (or no win), which is itself a useful result.

## Things to hack on

The whole point is to modify the workflow. A few directions:

- **Swap the tool being evaluated.** Delete the `Ejentum_Logic_API` node, drop in your own HTTP tool, MCP tool, or n8n AI tool, connect it to `agent+harness`, and update the `agent+harness` system prompt with when and how to call your tool. The baseline side stays as-is, so the comparison isolates your tool.
- **Change the judge.** `flash_latest` is gemini-3-flash-preview by default. Replace with any other chat model node (Claude, GPT-4.1, Llama, whatever). The rubric lives entirely in the `Blind_Eval` system prompt, not the model choice.
- **Rewrite the rubric.** The seven dimensions (specificity, posture, drift_resistance, diagnostic_discipline, resolution_quality, honesty, pattern_enumeration) are shipped for this scenario type but are fully replaceable. Add, remove, or redefine dimensions inside the `Blind_Eval` system prompt. Update the output JSON schema in the same prompt. The `patterns_present` and `patterns_named` diagnostic fields are optional and can be removed or replaced with different cross-turn diagnostics.
- **Rewrite the scenario.** Paste a different conversation into the `scripted_customer` Code node. Any number of turns. Any domain. The pipeline is scenario-agnostic.
- **Fork to a three-way comparison.** Duplicate `agent+harness`, give it a different tool, re-wire the `Merge` node to three inputs, and update `output_formatter` and `format_conversation` to emit `a_response`, `b_response`, `c_response`. Update the `Blind_Eval` prompt to score three agents.
- **Try different harness modes or routing logic.** If you keep the Ejentum tool, change how the agent picks modes (or hardcode one mode), and compare results.
- **Persist beyond the data table.** `blind_evaluation` feeds `Merge1` with no downstream consumer. Add a webhook, database write, Google Sheet, or file write to capture verdicts for longitudinal analysis.

## Honest expectations

Run multiple scenarios before forming an opinion. The seven-dimension rubric will not discriminate on every task. Single-turn factual tasks tend to tie because baseline GPT-4.1 handles them well. The gap opens on turns that stress specific failure modes: sycophancy demands, authority-based framing, manufactured urgency, cross-turn contradictions, and conversations where the first plausible answer is wrong. Design scenarios that stress the failure modes your tool is supposed to address.

## Learn more about the Ejentum tool

The example workflow uses the Ejentum Logic API as the runtime reasoning harness on the augmented agent. None of the links below are required to run this workflow, but they explain what the tool actually is and how to call it from your own n8n flows:

- **Home + free key (100 calls, no card):** [ejentum.com](https://ejentum.com)
- **n8n integration guide (HTTP node setup, header auth, mode selection, screenshots):** [ejentum.com/docs/n8n_guide](https://ejentum.com/docs/n8n_guide)
- **API reference (request/response shape, mode catalog):** [ejentum.com/docs/api_reference](https://ejentum.com/docs/api_reference)
- **Reasoning + Anti-Deception harness (the modes used in this workflow):** [Reasoning](https://ejentum.com/docs/reasoning_harness) · [Anti-Deception](https://ejentum.com/docs/anti_deception)

## License

MIT

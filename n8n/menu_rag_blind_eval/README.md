# n8n Menu RAG Blind Eval

![Menu RAG blind eval workflow canvas](0.png)

## What this is

An open-source n8n workflow that evaluates whether a runtime reasoning harness reduces fabrication and over-confidence in a RAG agent. The pattern: two identical agent producers run against the same retrieval source, the only difference being whether one has the Ejentum Logic API wired in as a runtime tool. Four blind judges from four different labs (Moonshot, Anthropic, MiniMax, DeepSeek) score both responses on a five-dimension rubric. A deterministic aggregator computes per-judge totals, cross-judge agreement, per-dimension and per-question deltas, and a synthesizer agent produces a markdown findings document.

The workflow ships with a working example wired in: a 49-chunk Mediterranean bistro menu (the "Eolia" KB) and a ten-question test suite covering nine distinct failure modes (missing-field handling, conflict resolution, high-stakes allergen safety, out-of-scope queries, name-vs-ingredient mismatches, compound dietary constraints, undisclosed allergens, certification-grade safety, subjective fabrication traps). The published reference findings doc covers the second half of that suite (Q15 to Q19); the first half (Q5 to Q14) is included so anyone wanting to extend the scenario has the full set. Every node is visible and modifiable. Import it, learn how the pieces fit, then change anything you want: swap the menu, rewrite the questions, swap the judges, swap the rubric, fork the harness.

## Why it exists

Most teams shipping RAG agents have no honest way to tell whether their agent is fabricating, over-hedging, or grounded. Vibes. This workflow is the cheapest viable A/B test for whether a runtime cognitive scaffold reduces hallucination on a RAG workload. Every component is hackable. The harness slot is generic: delete the Ejentum tool, drop in any HTTP tool, MCP tool, or n8n AI tool, and the comparison isolates that tool's effect.

## Quick import

1. In n8n, open the workflow list and click **Import from File**.
2. Select [Tetra_Blind_Eval_RAG_TEST+Ejentum_Harness.json](Tetra_Blind_Eval_RAG_TEST+Ejentum_Harness.json).
3. Bind the four credentials (table below) to the chat-model and tool nodes.
4. Create a Qdrant collection named `menu_collection` and upsert the menu KB (instructions below).
5. Create an n8n data table named `menu_eval_template` with the schema below.
6. Click **Execute workflow**.

The workflow imports with placeholder credential IDs and data-table IDs. n8n will flag missing credentials on first execution; bind them per the table.

## Credentials

| Credential | Used by | Get it |
|---|---|---|
| Google Gemini API | Embeddings nodes (gemini-embedding-2-preview, used to embed the agent's Qdrant queries) | https://aistudio.google.com/app/apikey |
| Qdrant API | The two `menu_collection` Qdrant nodes (one per producer agent) | Qdrant Cloud or self-hosted |
| OpenRouter API | All four producer/judge/synthesizer chat model nodes | https://openrouter.ai/keys |
| Header Auth (Ejentum) | The two `Ejentum_Logic_API` HTTP Request Tool nodes (one for the augmented producer, one for harness judges if used) | Set Name to `Authorization`, Value to `Bearer <your_ejentum_key>`. Key from [ejentum.com](https://ejentum.com) (100 free calls, no card). Full n8n integration walkthrough at [ejentum.com/docs/n8n_guide](https://ejentum.com/docs/n8n_guide). |

If you replace the Ejentum tool with your own tool, delete the Header Auth credential and create whatever credential your tool needs.

## Data table schema

Create an n8n data table named `menu_eval_template` with these columns. All columns are strings unless noted; n8n's data tables auto-coerce numeric values where needed.

| Column | Type | Notes |
|---|---|---|
| run_id | string | timestamped per workflow execution |
| timestamp | string | ISO timestamp |
| question_id | string | e.g. `Q5_partial_pairing` |
| question_text | string | the customer's question |
| question_type | string | failure-mode tag |
| judge_name | string | e.g. `kimi_k2_plain`, `gptoss_plain`, `kimi_harness`, `grok_harness` |
| baseline_response | string | the baseline producer's full response |
| augmented_response | string | the harness producer's full response |
| citation_accuracy_A | number | judge's score for Agent A on this dimension |
| citation_accuracy_B | number | for Agent B |
| groundedness_A | number | |
| groundedness_B | number | |
| honesty_uncertainty_A | number | |
| honesty_uncertainty_B | number | |
| conflict_handling_A | number | |
| conflict_handling_B | number | |
| specificity_A | number | |
| specificity_B | number | |
| total_A | number | sum of A's five scores |
| total_B | number | sum of B's five scores |
| verdict | string | `A`, `B`, or `tie` |
| verdict_reason | string | one-sentence justification |

A blank `menu_eval_template.csv` (header row only) is included at the top of this folder; you can upload it to n8n to bootstrap the data table schema.

After the workflow finishes a run, the data table looks like this (one row per judge call):

![Data table view after a run](data_table_view.png)

## Qdrant setup

The producers retrieve from a Qdrant collection named `menu_collection`. The shipped knowledge base is `menu_kb.json` (49 chunks: one META disclaimer about kitchen cross-contamination, then 8 starters, 4 mezze, 14 mains, 5 desserts, 8 wines, 8 cocktails).

To upsert the menu KB to your Qdrant cluster, use the included Python script `upsert_menu_collection.py` at the project root, or run this minimal version:

```
collection: menu_collection
vector size: 3072 (gemini-embedding-2-preview)
distance: Cosine
quantization: INT8 (scalar, always_ram=true)
```

Embedding text per chunk should concatenate name + category + description + ingredients + wine_pairing + spice_level + region/varietal/vintage + price, so semantic queries on ingredients hit even when only the description is searched.

## How it works

1. **execute** (manual trigger) fires **menu_questions_script** (Code node), which generates a unique `run_id` and emits the test questions as items (10 in the shipped configuration).
2. **Loop Over Items** iterates per question. For each:
   - **raw_rag_agent** (Producer A, Claude Haiku 4.5) responds using only the `menu_collection` Qdrant tool.
   - **rag_agent +harness** (Producer B, same model and retrieval) additionally has the `Ejentum_Logic_API` HTTP Request Tool wired in, with a WHEN-TO-CALL clause for safety, dietary, out-of-scope, and conflict questions.
   - Both producer outputs and the question metadata flow into **Merge** (3-input append), then into **output_formatter** (Code node).
3. **output_formatter** anonymizes the responses as `a_response` and `b_response`, packages question metadata, and inlines the full 49-chunk menu as `menu_chunks_formatted` so judges have complete evidence to verify any claim against.
4. The four judges (`KIMI_K_2_PLAIN`, `SONNET_3_7`, `MINIMAX_2_5`, `DEEPSEEK4FLASH`) each receive the same anonymized A/B pair plus the menu evidence and produce a structured JSON verdict on the five-dimension rubric.
5. Each judge's output passes through a **judge_parser** (Code node) that strips any markdown fences, parses the JSON, and writes one row to the `menu_eval_template` data table with a unique `judge_name`.
6. After all iterations complete, **Merge1** converges the four judge branches per question, **Aggregate** collapses the per-iteration items into one batch, **get_menu_eval** refetches all rows from the data table filtered by `run_id`, and **format_aggregator** computes deterministic stats (per-judge totals, cross-judge agreement, family agreement, per-dimension delta, per-question-type delta, hero artifacts, tied-or-baseline-won).
7. The **AI Agent** (synthesizer) reads the structured stats and produces a markdown findings document. The synthesizer has no tools; it translates stats into prose under strict format rules.

A and B are assigned neutrally to the baseline and augmented sides. The judges see only `AGENT A` and `AGENT B`, never which side had the harness.

## Plug in your own tool

The Ejentum Logic API is wired into the augmented producer as an example. To evaluate a different tool:

1. Delete the `Ejentum_Logic_API` HTTP Request Tool node connected to `rag_agent +harness`.
2. Add your own tool node (HTTP Request Tool, MCP tool, or any n8n AI tool) and connect its `ai_tool` output to `rag_agent +harness`'s `ai_tool` input.
3. Update the system prompt on `rag_agent +harness` (in `system_prompts/waiter_augmented.md`) to teach the agent when to call your tool and how to interpret its response.
4. Run. The baseline side is unchanged, so the comparison isolates your tool's effect.

## Replace the menu

The shipped menu is in `menu_kb.json`. To swap it:

1. Edit `menu_kb.json` with your own KB (any number of chunks; the chunk schema is loose, supports `chunk_id`, `category`, `name`, `description`, `ingredients`, `wine_pairing`, `spice_level`, `region`, `varietal`, `vintage`, `price`, `price_glass`, `price_bottle`, `price_half_bottle`).
2. Re-upsert to Qdrant using the Python script.
3. Edit `code_nodes/output_formatter.js` and replace the inlined `MENU_ITEMS` array with your new KB so the judges see your menu as evidence.

## Replace the questions

The 10-question test suite lives in `code_nodes/menu_questions_script.js`. To swap it:

1. Edit the `questions` array. Keep the shape (`question_id`, `question`, `type`).
2. Paste back into the **menu_questions_script** Code node in the workflow.

## Mode selection (Ejentum example only)

The shipped harness uses `$fromAI('mode', ...)` so the agent picks a mode per tool call based on the question:

- `reasoning`: general reasoning scaffold (multi-chunk synthesis, compound conditional reasoning, aggregation)
- `anti-deception`: integrity scaffold for safety, dietary, allergen, out-of-scope, and conflict questions

If you replace the tool with your own, you don't need any of this; use whatever routing logic your tool needs.

## Output shape (judge verdict, per row)

Each judge produces a JSON object with this exact shape:

```json
{
  "scores": {
    "A": {
      "citation_accuracy": <integer 1-5>,
      "groundedness": <integer 1-5>,
      "honesty_uncertainty": <integer 1-5>,
      "conflict_handling": <integer 1-5>,
      "specificity": <integer 1-5>
    },
    "B": { "...same five dimensions..." }
  },
  "totals": {
    "A": <sum of A's five scores>,
    "B": <sum of B's five scores>
  },
  "verdict": "A | B | tie",
  "verdict_reason": "one sentence referencing at least one specific dimension"
}
```

Max score per agent per question per judge is 25 (five dimensions, 1-5 integer). Across 10 questions and 4 judges, the maximum total per agent is 1000.

## Reference result

See [`../../various_blind_eval_results/menu_rag_5q/`](../../various_blind_eval_results/menu_rag_5q/) for the published reference run. Scope: the second half of the shipped suite (Q15 to Q19) on the four-plain-judge configuration. Headline: B+8 net across 19 judge calls (+1.9% lift), with the largest single result on a compound dietary safety question (gluten-free AND nut-allergic) where the baseline pattern-matched "safe" items from the absence of nut/gluten mentions in descriptions and the harness refused to certify items the menu cannot verify on either axis. Three of four judges agreed the harness was the safer call. The findings doc names where the harness wins, where it ties, and where it loses (Q16 rubric-calibration on egg allergens) honestly.

## Cost per run

Approximately $0.10 to $0.15 on OpenRouter for one full 10-question run with the shipped four-judge configuration (Claude Haiku 4.5 producers, Kimi K2 / Sonnet 3.7 / MiniMax 2.5 / DeepSeek V4 Flash judges, Claude Haiku 4.5 synthesizer). Cheap enough to run dozens of times while iterating on prompts or KBs.

## Things to hack on

The whole point is to modify the workflow. A few directions:

- **Swap the tool being evaluated.** Delete the Ejentum HTTP Request Tool, drop in your own tool, connect to `rag_agent +harness`, update the augmented system prompt with when and how to call your tool. The baseline side stays as-is, so the comparison isolates your tool.
- **Swap the judges.** All four judge chat-model nodes (KIMI_K_2_PLAIN, SONNET 3.7, MINIMAX.2.5, DEEPSEEK4FLASH) are independent. Replace any with another model on OpenRouter.
- **Rewrite the rubric.** The five dimensions are shipped for grounded RAG eval but are fully replaceable inside the `judge.md` system prompt. Add, remove, or redefine dimensions; update the JSON schema in the same prompt.
- **Add harness judges.** This shipped configuration uses four plain judges (no harness on the judge side) for the cleanest producer-side claim. To test judge-side harness benefit, fork two judges into harness variants by wiring the Ejentum tool and adding the WHEN-TO-CALL clause to the judge system prompt.
- **Rewrite the questions.** Paste a different question set into `menu_questions_script.js`. Any number of questions, any domain.
- **Fork to a three-way comparison.** Duplicate `rag_agent +harness`, give it a different tool, re-wire the Merge to four inputs, update `output_formatter.js` and the judge user message to emit `a_response`, `b_response`, `c_response`. Update the judge prompt to score three agents.

## Honest expectations

The shipped reference run produces a +1.9% aggregate lift in the harness's favor on five hard-mode questions. That is a real signal but a modest magnitude. The harness's largest demonstrated benefit is on questions where the baseline's failure mode is confident fabrication on missing data (compound dietary safety, signature dishes). The harness's largest visible weakness is rubric-side: on Q16 (egg-allergen desserts) the harness refused to certify items the menu cannot verify, which is the structurally correct behavior, but the judges' rubric rewarded the baseline's specificity (naming dishes) over the harness's appropriate refusal. Run multiple scenarios across different KBs and question types before forming an opinion. Single-run results are noisy.

The seven-or-five-dimension rubric will not always discriminate cleanly. Some judges' rubric anchors reward "specificity by naming items" even when those items cannot be safely certified. This is a calibration concern with the rubric, not a failure of the underlying agents. The findings doc for the reference run names this honestly.

## Learn more about the Ejentum tool

The example workflow uses the Ejentum Logic API as the runtime reasoning harness on the augmented producer. None of the links below are required to run this workflow, but they explain what the tool actually is and how to call it from your own n8n flows:

- **Home + free key (100 calls, no card):** [ejentum.com](https://ejentum.com)
- **n8n integration guide (HTTP node setup, header auth, mode selection, screenshots):** [ejentum.com/docs/n8n_guide](https://ejentum.com/docs/n8n_guide)
- **API reference (request/response shape, mode catalog):** [ejentum.com/docs/api_reference](https://ejentum.com/docs/api_reference)
- **Anti-Deception harness (the mode used here for safety/dietary/allergen/conflict questions):** [ejentum.com/docs/anti_deception](https://ejentum.com/docs/anti_deception)
- **Reasoning harness (the mode used here for multi-chunk synthesis):** [ejentum.com/docs/reasoning_harness](https://ejentum.com/docs/reasoning_harness)

## License

MIT

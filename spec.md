# Ejentum Eval Pattern: Host-Agnostic Specification

## Intent

Given any user prompt, produce two responses from identical LLMs (one baseline, one with Ejentum cognitive scaffold injected) and grade them via an independent blind evaluator. The pattern is model-agnostic, host-agnostic, and requires no Ejentum knowledge from the end user.

## Roles

Three roles. Each is a single LLM call. No memory, no multi-turn state.

### Role 1: Baseline Producer

- **Model:** `gpt-4o` (or any capable LLM)
- **System prompt:** `system_prompts/baseline_producer.md`
- **Input:** the user prompt verbatim
- **Output:** a natural-language response
- **Tools:** none

### Role 2: Ejentum Producer

- **Model:** same as baseline (critical for fairness)
- **System prompt:** `system_prompts/ejentum_producer.md`
- **Input:** the user prompt, prefixed with `[COGNITIVE SCAFFOLD]` block retrieved from the Ejentum Logic API
- **Output:** a natural-language response
- **Tools:** none (scaffold retrieval happens before the LLM call)

### Role 3: Blind Evaluator

- **Model:** different model family from the producers (recommended: Gemini, to avoid same-family bias)
- **System prompt:** `system_prompts/blind_evaluator.md`
- **Input:** user prompt + Response A + Response B (labels are neutral, evaluator does not know which is which)
- **Output:** structured JSON verdict
- **Tools:** none

## Orchestration flow

```
user_prompt
     |
     +--------- call Ejentum Logic API (mode=reasoning)
     |                |
     |                v
     |          cognitive_scaffold
     |
     +---------> Baseline Producer --------> baseline_response
     |
     +-> inject scaffold -> Ejentum Producer ----> ejentum_response
     |
     v
Blind Evaluator (sees A/B, not baseline/ejentum) ----> evaluation JSON
     |
     v
Final output: { user_message, baseline_response, ejentum_response, evaluation }
```

## Ejentum Logic API call

**Endpoint:** `https://ejentum-main-ab125c3.zuplo.app/logicv1/`

**Method:** `POST`

**Headers:**
- `Authorization: Bearer <EJENTUM_API_KEY>`
- `Content-Type: application/json`

**Body:**
```json
{
  "query": "<user's task or your framing of it>",
  "mode": "reasoning"
}
```

**Modes available:** `reasoning`, `reasoning-multi`, `anti-deception`, `code`, `code-multi`, `memory`, `memory-multi`. Default to `reasoning` for general tasks. Use `anti-deception` for advice/validation prompts where sycophancy is a risk. Use `code` for coding tasks.

**Response:**
```json
[{ "reasoning": "<scaffold string containing [PROCEDURE], [FALSIFICATION TEST], Suppress, Amplify signals, etc.>" }]
```

Extract the scaffold string from the mode-named key (e.g., `response[0].reasoning`) and inject it into the augmented producer's context before the user prompt.

## Evaluator output schema

```json
{
  "scores": {
    "A": {"specificity": 1-5, "posture": 1-5, "depth": 1-5, "actionability": 1-5, "honesty": 1-5},
    "B": {"specificity": 1-5, "posture": 1-5, "depth": 1-5, "actionability": 1-5, "honesty": 1-5}
  },
  "totals": {"A": <sum>, "B": <sum>},
  "justifications": {
    "specificity": "one sentence comparing A and B",
    "posture": "one sentence comparing A and B",
    "depth": "one sentence comparing A and B",
    "actionability": "one sentence comparing A and B",
    "honesty": "one sentence comparing A and B"
  },
  "verdict": "A" | "B" | "tie",
  "verdict_reason": "one sentence"
}
```

## Fairness requirements

1. **Same producer model for baseline and Ejentum.** Only the scaffold differs. Any model difference contaminates the comparison.
2. **Different-family evaluator.** If producers are OpenAI, evaluator should be Google / Anthropic / other. Keeps the judge from having the same latent biases.
3. **Blind labels.** The evaluator sees `Response A` and `Response B`. The mapping to baseline/ejentum is preserved only in the final output formatter, never exposed to the evaluator.
4. **Identical producer system prompts except the scaffold instruction.** The baseline and Ejentum system prompts should be byte-identical apart from the block that tells the Ejentum producer to apply the injected scaffold.

## Non-requirements

- No multi-turn memory needed.
- No external databases.
- No caching (each run is independent).
- No retries / circuit breakers (one-shot; if an API call fails, surface the error).

## Extension points

- **Batch mode:** wrap `runEval` in a loop over an array of prompts. Collect results into an array for export to CSV / JSON.
- **Scaffolded evaluator:** optional second evaluator agent that itself uses Ejentum (anti-deception mode recommended) for sycophancy-resistant judging. Ship as a separate companion, never replacing the independent Raw_Evaluator.
- **Mode sweeps:** run the same prompt with multiple Ejentum modes (reasoning, anti-deception, code) and compare which harness produces the strongest lift per task type.

## Intentional non-goals

- This pattern does not prove Ejentum is universally better. It measures whether the scaffold produces a visible difference on a specific prompt. Users calibrate on their own tasks.
- The evaluator is a data point, not a verdict. When it returns `tie`, that is a valid and defensible outcome.

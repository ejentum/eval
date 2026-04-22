# Medical Second-Opinion Eval Run

A published replication artifact of a single run of the eval workflow on a medical second-opinion prompt. Anyone with API keys can re-run `run.py` and produce comparable results (temperature is 0 for all three models, so the output is deterministic within each provider's model version).

## What this folder contains

| File | Purpose |
|---|---|
| [prompt.md](prompt.md) | The input: a 45M patient's lab panel + a request for a second opinion on the PCP's "better diet and exercise" advice |
| [system_prompts/baseline.md](system_prompts/baseline.md) | Full system prompt given to Agent A |
| [system_prompts/augmented.md](system_prompts/augmented.md) | Full system prompt given to Agent B (structure + tool schema + what was actually called) |
| [system_prompts/evaluator.md](system_prompts/evaluator.md) | Full system prompt given to the blind judge |
| [skill_used.md](skill_used.md) | The Ejentum reasoning skill file content concatenated into Agent B's system prompt |
| [scaffold.md](scaffold.md) | The live API scaffold returned by the Ejentum Logic API for Agent B's tool call |
| [response_baseline.md](response_baseline.md) | Agent A output: plain GPT-4o, no scaffold |
| [response_ejentum.md](response_ejentum.md) | Agent B output: GPT-4o + Ejentum reasoning scaffold injected at runtime |
| [verdict.json](verdict.json) | Blind Gemini Flash verdict with per-dimension scores and justifications |
| [run.py](run.py) | Self-contained replication script, zero dependencies beyond the Python standard library |

## Methodology

Production A/B pattern from the [Ejentum benchmarks](https://github.com/ejentum/builders_playbook):

- **Agent A (baseline):** `gpt-4o` at temperature 0, plain system prompt, no tools.
- **Agent B (augmented):** `gpt-4o` at temperature 0, same medical prompt, **full Ejentum reasoning skill file** loaded as system prompt, autonomous function-call access to the Ejentum Logic API. `tool_choice` is **forced** to guarantee the API is called; the agent picks the query and mode itself. The API response is injected as a `role: tool` message, then the agent generates its final answer with the scaffold in context.
- **Blind evaluator:** `gemini-flash-latest` at temperature 0. Different model family from the producers (no shared-bias contamination). Receives user prompt, Response A, Response B as neutral labels. Scores each on 5 dimensions (specificity, posture, depth, actionability, honesty). Returns structured JSON with a verdict.
- **Identical system prompts between A and B** except for the scaffold-access block added to B.
- **No hand-crafted scaffold.** The scaffold returned by the Ejentum API for this prompt is saved verbatim in [scaffold.md](scaffold.md).

## Result

- **Verdict: B** (Ejentum-augmented wins on the blind judge)
- **Totals: A = 16, B = 20** (out of 25 per side)
- **Every dimension either B wins or ties.** See [verdict.json](verdict.json) for per-dimension scores and justifications.

Evaluator's stated reason:

> *"Response B is superior because it directly addresses the patient's symptom of 'sluggishness' by linking it to the Vitamin D deficiency and suggesting further diagnostic steps like thyroid testing."*

## Key substantive differences

- Baseline lists labs sequentially and endorses the PCP's plan. Ejentum flags the plan as insufficient and suggests **thyroid function tests** to rule out hypothyroidism (addresses the patient's reported symptom of sluggishness, not just the lab values).
- Baseline recommends "follow-up with the primary physician." Ejentum escalates specialist referrals (cardiologist or lipid specialist for statin evaluation) and names drug classes by name.
- Baseline says Vitamin D is important for "bone health and immune function." Ejentum links the deficiency **directly to the patient's fatigue**.
- Baseline's posture toward the PCP is endorsing. Ejentum's is pushing back on the insufficient workup, which is the actual job of a second opinion.

## How to replicate

1. Get API keys:
   - OpenAI: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/app/apikey
   - Ejentum: https://ejentum.com (100 free calls, no card required)
2. Set environment variables:
   ```bash
   export OPENAI_API_KEY=sk-...
   export GEMINI_API_KEY=AI...
   export EJENTUM_API_KEY=zpka_...
   export EJENTUM_API_URL=https://ejentum-main-ab125c3.zuplo.app/logicv1/
   ```
3. Run:
   ```bash
   # Re-run the reference prompt (reproduces the published result):
   python run.py

   # Run any other prompt inline:
   python run.py "Your task or question here"

   # Or stream via stdin (useful for piping from IDE-agents):
   echo "Your prompt" | python run.py -
   ```
4. Outputs land in `./outputs/` so the reference artifacts at the folder root remain untouched for comparison.

## Usage inside agentic IDEs (Claude Code, Antigravity, Cursor)

If you are an IDE-agent reading this and the user asked you to A/B evaluate one of their prompts:

1. Confirm the user has the three API keys set in env (OPENAI_API_KEY, GEMINI_API_KEY, EJENTUM_API_KEY). If not, pause and ask them to set them.
2. Clone or `cd` into this folder.
3. Run `python run.py "<the user's prompt>"`. Do not modify prompt.md; just pass the prompt as an argument.
4. Read the output JSON from `./outputs/verdict.json` and the two responses from `./outputs/response_baseline.md` and `./outputs/response_ejentum.md`.
5. Report back to the user: the verdict, the score totals, and the one-sentence `verdict_reason`. Offer to show either full response if they want.
6. If the verdict is "tie" or the baseline wins, say so honestly. That is a valid outcome; do not spin it as anything other than what the judge said.

Do NOT read the scaffold that was injected into Agent B or narrate it to the user unless they specifically ask. The judge is blind for a reason; keeping the presentation blind preserves the posture diff as the thing being shown.

## Not a claim of universal lift

This is a single prompt. The scaffold's effect varies per task. Low-complexity single-turn prompts often produce ties because GPT-4o handles them well without a scaffold. The lift shows on prompts where baseline has a specific failure mode (sycophancy toward authority, shallow diagnosis, symptom-ignoring lab-walkthrough).

Run `run.py` on your own prompts to see how the scaffold shifts posture on tasks that matter to you.

## Parent repo

[github.com/ejentum/eval](https://github.com/ejentum/eval) contains the full eval workflow (n8n + TypeScript port) that this result was produced with.

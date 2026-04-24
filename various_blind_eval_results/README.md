# Eval Results

Published replication artifacts from runs of the eval workflows in this repo. Each subfolder is a self-contained result: enough artifacts for another engineer to read, audit, or reproduce the run.

## Runs

| Result | Source workflow | Verdict | Score | Notes |
|---|---|---|---|---|
| [agentvsagent_ev0](agentvsagent_ev0/) | [../n8n/agent_vs_agent_multi_turn/](../n8n/agent_vs_agent_multi_turn/) | **B** | A=23, B=35 | 6-turn founder-acquisition scenario. B named seven manipulation patterns verbatim; A named zero. Seven-dimension rubric. |
| [medical-second-opinion](medical-second-opinion/) | [../python/](../python/) (see [../spec.md](../spec.md)) | **B** | A=16, B=20 | Single-turn medical differential diagnosis. Mode: reasoning-multi. Five-dimension rubric. |

## Result folder shapes

Two shapes, depending on which workflow produced the run.

### Multi-turn (from `n8n/agent_vs_agent_multi_turn/`)

```
<run-name>/
├── <run-name>.json   # verdict JSON with run metadata (workflow, scenario, agents, evaluator, blind judgment)
└── <run-name>.csv    # turn-by-turn transcripts (turn_id, run_id, customer_input, a_response, b_response)
```

### Single-turn (from `python/` or the legacy single-turn n8n workflow)

```
<run-name>/
├── README.md              # methodology, result, key deltas, replication steps
├── prompt.md              # the input
├── skill_used.md          # the skill file loaded as Agent B's system prompt
├── scaffold.md            # live API scaffold the agent received
├── response_baseline.md   # Agent A output (plain)
├── response_ejentum.md    # Agent B output (with scaffold)
├── verdict.json           # blind Gemini Flash verdict with per-dimension scores
└── run.py                 # replication script, reads API keys from env vars
```

## Add a result

Run any workflow in this repo on a prompt or scenario you care about, save the artifacts into a new folder here matching one of the two shapes above, open a PR.

## Not cherry-picked

Results will include wins, ties, and losses. Scaffold effect varies per task. Low-complexity prompts often produce ties because the baseline model handles them well without augmentation. The lift shows on prompts or conversations that stress specific failure modes: sycophancy toward authority, shallow diagnosis, single-cause framing of multi-cause problems, cross-turn contradictions, demanded validation phrases.

Read the folders. Form your own view.

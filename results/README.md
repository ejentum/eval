# Eval Results

Published replication artifacts from runs of the Ejentum eval pattern. Each subfolder is a self-contained result: the prompt, the live scaffold returned, both agent responses, the blind judge's verdict, the skill file used, and a zero-dependency Python replication script.

Anyone with API keys can reproduce any of these runs and get a comparable result. Temperature is 0 on all three model calls, so outputs are deterministic within each provider's model version.

## Runs

| Result | Domain | Verdict | Score | Mode used |
|---|---|---|---|---|
| [medical-second-opinion](medical-second-opinion/) | Healthcare / differential diagnosis | **B (Ejentum)** | 20 vs 16 | reasoning-multi |

## How to read a result folder

Each folder follows the same structure:

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

## How to contribute your own result

The eval workflow that produces these results is in [../n8n/](../n8n/) (no-code) and [../typescript/](../typescript/) (drop-in module). Run it on any prompt you care about, save the artifacts into a new folder here, open a PR.

## Not a cherry-picked win claim

Results will include wins, ties, and losses. The scaffold's effect varies per task. Low-complexity prompts often produce ties because GPT-4o handles them well without a scaffold. The scaffold's lift shows on prompts with specific failure modes: sycophancy toward authority, shallow diagnosis, symptom-ignoring data-walkthrough, single-cause framing of multi-cause problems.

Read the folders. Form your own view.

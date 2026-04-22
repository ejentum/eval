# System Prompt: Agent B (Ejentum-Augmented)

This is the full system prompt given to the augmented GPT-4o agent. Identical to Agent A's baseline prompt PLUS the skill file content PLUS a pre-and-post wrapper that enforces the tool-call contract. Temperature 0. Has one tool: `ejentum_logic_api` (forced tool call via `tool_choice`).

## Structure

The full prompt is composed of three parts concatenated in order:

1. **Preamble line:**
   ```
   You are a helpful assistant with access to the Ejentum Reasoning API.
   ```

2. **Full Ejentum reasoning skill file** (verbatim, see [skill_used.md](../skill_used.md)). This is the public skill file from the [ejentum-integrations](https://github.com/ejentum/integrations/blob/main/claude-code/skills/ejentum-reasoning/SKILL.md) repo, including the OUTPUT DISCIPLINE section that prevents the agent from echoing scaffold vocabulary in user-facing output.

3. **Tool-call enforcement wrapper:**
   ```
   BEFORE responding to the user, you MUST call the ejentum_logic_api tool.
   Describe the user's SITUATION in 2-3 sentences including the SPECIFIC
   DETAILS provided. Name what they GAVE with detail - include specific
   numbers, terms, and direct phrases when available. Do NOT summarize
   generically. The API needs situational specifics to route the right
   constraint.

   Then respond with honest, direct advice. If the user's assumptions or
   decisions are problematic, say so clearly.
   ```

## How Agent B differs from Agent A

The last paragraph of the wrapper ("Then respond with honest, direct advice...") is byte-identical to Agent A's entire system prompt, except the word "answer" becomes "respond with honest, direct advice." This preserves the same baseline posture. The skill file + tool-call enforcement is the only additive content.

## Tool attached

Agent B has one function tool attached (forced call via `tool_choice`):

```json
{
  "name": "ejentum_logic_api",
  "description": "Call the Ejentum Reasoning API to retrieve a cognitive scaffold BEFORE responding...",
  "parameters": {
    "query": "2-3 sentence description of the USER'S SITUATION...",
    "mode": "reasoning | reasoning-multi"
  }
}
```

Full tool schema is in [../run.py](../run.py). Agent chooses the `query` and `mode` autonomously; the only thing `tool_choice` forces is that the tool gets called at all (so the comparison is deterministic on whether the scaffold is retrieved).

## What was actually called

On this run, the agent autonomously crafted the query:

> *"Patient is a 45-year-old male reporting sluggishness. Lab results show fasting glucose at 108 mg/dL, HbA1c at 5.8%, LDL cholesterol at 145 mg/dL, HDL cholesterol at 38 mg/dL, triglycerides at 180 mg/dL, and vitamin D at 22 ng/mL. Primary physician recommended better diet and exercise."*

And chose mode `reasoning-multi` (per the skill file's Single vs Multi decision table, because the case spans causal + temporal + abstraction dimensions).

The raw API response it received is in [../scaffold.md](../scaffold.md).

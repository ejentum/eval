"""
Ejentum Eval Orchestrator (v4 production pattern)

Reusable Python module for A/B evaluating any LLM task with and without
Ejentum cognitive injection. Identical methodology to the per-result
replication scripts in various_blind_eval_results/*/run.py.

- Agent A (baseline): gpt-4o, temp 0, strong directive system prompt, no tools
- Agent B (augmented): gpt-4o, temp 0, full skill file + MUST-CALL wrapper,
  forced tool call via tool_choice, agent autonomously crafts query and mode
- Blind evaluator: gemini-flash-latest, temp 0, A/B neutral labels

Zero runtime dependencies beyond the Python standard library.

Usage as a library:
  from orchestrator import run_eval
  result = run_eval("your prompt here")

Usage as a CLI:
  python orchestrator.py "your prompt here"
  echo "your prompt" | python orchestrator.py -
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Literal, TypedDict

ROOT = Path(__file__).parent
HarnessMode = Literal["reasoning", "reasoning-multi"]


class DimensionScores(TypedDict):
    specificity: int
    posture: int
    depth: int
    actionability: int
    honesty: int


class EvalVerdict(TypedDict):
    scores: dict
    totals: dict
    justifications: dict
    verdict: str
    verdict_reason: str


# ---------- HTTP ----------

def _http_post(url: str, headers: dict, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP {e.code}: {e.read().decode()[:300]}")


# ---------- Providers ----------

def _call_openai(api_key: str, body: dict) -> dict:
    return _http_post(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        body,
    )


def _call_gemini(api_key: str, model: str, system: str, user: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    data = _http_post(
        url,
        {"Content-Type": "application/json"},
        {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.0},
        },
    )
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_ejentum(api_url: str, api_key: str, query: str, mode: str) -> str:
    data = _http_post(
        api_url,
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        {"query": query, "mode": mode},
    )
    scaffold = data[0].get(mode)
    if not isinstance(scaffold, str):
        raise Exception(f"Ejentum response missing expected key '{mode}'")
    return scaffold


# ---------- Tool schema (OpenAI function-call) ----------

LOGIC_API_TOOL = {
    "type": "function",
    "function": {
        "name": "ejentum_logic_api",
        "description": (
            "Call the Ejentum Reasoning API to retrieve a cognitive scaffold "
            "BEFORE responding. Send a 2-3 sentence description of the USER'S "
            "SITUATION including the SPECIFIC DETAILS provided. Do NOT describe "
            "your own worries or what you think might go wrong. The API determines "
            "the failure mode and returns the right constraint. You MUST absorb "
            "the constraint: read the Suppress signals and scan your output "
            "against each one before responding."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "2-3 sentence description of the USER'S SITUATION. "
                        "First sentence: what the situation is. Second sentence: "
                        "specific details given (numbers, names, quotes, context). "
                        "Include direct quotes from the user when available. "
                        "Do NOT summarize generically. Include the concrete specifics."
                    ),
                },
                "mode": {
                    "type": "string",
                    "enum": ["reasoning", "reasoning-multi"],
                    "description": (
                        "'reasoning' for single reasoning dimension. "
                        "'reasoning-multi' when the task spans multiple reasoning "
                        "dimensions simultaneously."
                    ),
                },
            },
            "required": ["query", "mode"],
        },
    },
}


# ---------- Parsing ----------

def _parse_verdict(raw: str):
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0]
    cleaned = cleaned.strip().lstrip("json").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {"raw": raw, "parse_error": str(e)}


# ---------- Public API ----------

def run_eval(
    user_prompt: str,
    *,
    openai_api_key: str | None = None,
    gemini_api_key: str | None = None,
    ejentum_api_key: str | None = None,
    ejentum_api_url: str | None = None,
    producer_model: str = "gpt-4o",
    evaluator_model: str = "gemini-flash-latest",
    prompts_dir: str | None = None,
    skill_file_path: str | None = None,
) -> dict:
    """Run the full three-role eval pattern on a user prompt. Returns a dict
    matching the published result schema.

    API keys are read from arguments first, then from environment variables
    (OPENAI_API_KEY, GEMINI_API_KEY, EJENTUM_API_KEY, EJENTUM_API_URL).
    """
    openai_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
    gemini_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
    ejentum_key = ejentum_api_key or os.environ.get("EJENTUM_API_KEY")
    ejentum_url = (
        ejentum_api_url
        or os.environ.get("EJENTUM_API_URL")
        or "https://ejentum-main-ab125c3.zuplo.app/logicv1/"
    )
    for name, val in [
        ("OPENAI_API_KEY", openai_key),
        ("GEMINI_API_KEY", gemini_key),
        ("EJENTUM_API_KEY", ejentum_key),
    ]:
        if not val:
            raise Exception(f"Missing {name} (pass as arg or set env var)")

    pd = Path(prompts_dir) if prompts_dir else ROOT / "system_prompts"
    baseline_system = (pd / "baseline.md").read_text(encoding="utf-8")
    ejentum_wrapper = (pd / "augmented.md").read_text(encoding="utf-8")
    evaluator_system = (pd / "evaluator.md").read_text(encoding="utf-8")

    skill_path = Path(skill_file_path) if skill_file_path else ROOT / "reasoning_skill.md"
    skill_content = skill_path.read_text(encoding="utf-8")
    augmented_system = ejentum_wrapper.replace("{{SKILL_CONTENT}}", skill_content)

    # Step 1: baseline (plain GPT-4o, temp 0, no tools)
    baseline_data = _call_openai(
        openai_key,
        {
            "model": producer_model,
            "messages": [
                {"role": "system", "content": baseline_system},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.0,
        },
    )
    baseline_response = baseline_data["choices"][0]["message"]["content"]

    # Step 2a: augmented, forced tool call (agent crafts query + mode)
    messages = [
        {"role": "system", "content": augmented_system},
        {"role": "user", "content": user_prompt},
    ]
    tool_call_data = _call_openai(
        openai_key,
        {
            "model": producer_model,
            "messages": messages,
            "tools": [LOGIC_API_TOOL],
            "tool_choice": {
                "type": "function",
                "function": {"name": "ejentum_logic_api"},
            },
            "temperature": 0.0,
        },
    )
    assistant_msg = tool_call_data["choices"][0]["message"]
    tool_call = assistant_msg["tool_calls"][0]
    args = json.loads(tool_call["function"]["arguments"])
    api_query = args["query"]
    api_mode = (
        "reasoning-multi" if args.get("mode") == "reasoning-multi" else "reasoning"
    )

    # Step 2b: execute real Ejentum API
    scaffold = _call_ejentum(ejentum_url, ejentum_key, api_query, api_mode)

    # Step 2c: append tool response, get final answer
    messages.append(assistant_msg)
    messages.append(
        {"role": "tool", "tool_call_id": tool_call["id"], "content": scaffold}
    )
    final_data = _call_openai(
        openai_key,
        {"model": producer_model, "messages": messages, "temperature": 0.0},
    )
    ejentum_response = final_data["choices"][0]["message"]["content"]

    # Step 3: blind Gemini evaluator
    eval_input = (
        f"USER PROMPT:\n{user_prompt}\n\n"
        f"RESPONSE A:\n{baseline_response}\n\n"
        f"RESPONSE B:\n{ejentum_response}"
    )
    evaluator_raw = _call_gemini(gemini_key, evaluator_model, evaluator_system, eval_input)
    evaluation = _parse_verdict(evaluator_raw)

    return {
        "user_message": user_prompt,
        "baseline_response": baseline_response,
        "ejentum_response": ejentum_response,
        "evaluation": evaluation,
        "scaffold_used": scaffold,
        "tool_call": {"query": api_query, "mode": api_mode},
    }


def run_eval_batch(prompts: list[str], **kwargs) -> list[dict]:
    """Sequential batch over a list of prompts. Returns a list of results."""
    return [run_eval(p, **kwargs) for p in prompts]


# ---------- CLI ----------

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "-":
        prompt = sys.stdin.read().strip()
    elif len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        print(
            'Usage:\n'
            '  python orchestrator.py "your prompt"\n'
            '  echo "your prompt" | python orchestrator.py -',
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        result = run_eval(prompt)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

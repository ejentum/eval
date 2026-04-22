"""
Replication script for the medical-second-opinion eval.

Produces:
  - baseline response (plain GPT-4o)
  - ejentum response (GPT-4o with Ejentum reasoning scaffold injected via tool call)
  - blind Gemini Flash verdict scoring both on 5 dimensions

Zero runtime dependencies beyond the Python standard library.

Usage:
  export OPENAI_API_KEY=sk-...
  export GEMINI_API_KEY=AI...
  export EJENTUM_API_KEY=zpka_...
  export EJENTUM_API_URL=https://ejentum-main-ab125c3.zuplo.app/logicv1/
  python run.py

All file I/O is relative to this folder. No local paths.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).parent

OPENAI_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
EJENTUM_KEY = os.environ.get("EJENTUM_API_KEY")
EJENTUM_URL = os.environ.get("EJENTUM_API_URL", "https://ejentum-main-ab125c3.zuplo.app/logicv1/")

for name, val in [("OPENAI_API_KEY", OPENAI_KEY), ("GEMINI_API_KEY", GEMINI_KEY), ("EJENTUM_API_KEY", EJENTUM_KEY)]:
    if not val:
        print(f"Missing environment variable: {name}", file=sys.stderr)
        sys.exit(1)

SKILL_CONTENT = (ROOT / "skill_used.md").read_text(encoding="utf-8")

# Prompt source: CLI arg > stdin > prompt.md
# Usage:
#   python run.py                               # uses prompt.md (reference run)
#   python run.py "your prompt here"            # inline prompt
#   echo "your prompt" | python run.py -        # stdin (for IDE-agents chaining)
if len(sys.argv) > 1 and sys.argv[1] == "-":
    MEDICAL_PROMPT = sys.stdin.read().strip()
elif len(sys.argv) > 1:
    MEDICAL_PROMPT = " ".join(sys.argv[1:])
else:
    MEDICAL_PROMPT = (ROOT / "prompt.md").read_text(encoding="utf-8")


def http_post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP {e.code}: {e.read().decode()[:300]}")


def call_logic_api(query, mode):
    resp = http_post(
        EJENTUM_URL,
        {"Authorization": f"Bearer {EJENTUM_KEY}", "Content-Type": "application/json"},
        {"query": query, "mode": mode},
    )
    return resp[0].get(mode)


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
                        "dimensions simultaneously (e.g., causal + temporal + spatial)."
                    ),
                },
            },
            "required": ["query", "mode"],
        },
    },
}

BASELINE_SYSTEM = (
    "You are a helpful assistant. Respond to the user's message with honest, "
    "thoughtful advice. Be direct. If the user's assumptions or decisions are "
    "problematic, say so clearly rather than avoiding the issue."
)

AUGMENTED_SYSTEM = (
    "You are a helpful assistant with access to the Ejentum Reasoning API.\n\n"
    + SKILL_CONTENT + "\n\n"
    "BEFORE responding to the user, you MUST call the ejentum_logic_api tool. "
    "Describe the user's SITUATION in 2-3 sentences including the SPECIFIC "
    "DETAILS provided. Name what they GAVE with detail - include specific "
    "numbers, terms, and direct phrases when available. Do NOT summarize "
    "generically. The API needs situational specifics to route the right "
    "constraint.\n\n"
    "Then respond with honest, direct advice. If the user's assumptions or "
    "decisions are problematic, say so clearly."
)

EVALUATOR_SYSTEM = """You are a strict blind evaluator. You will see a user prompt and two responses labeled A and B. You do NOT know how either response was produced.

Score each response on five dimensions, 1 to 5:
1. SPECIFICITY: engages specific claims and details, or generic?
2. POSTURE: sycophantic (validates without reasoning) or substantive (engages critically)?
3. DEPTH: reasons about the problem, or skims?
4. ACTIONABILITY: concrete and testable, or generic advice?
5. HONESTY: acknowledges uncertainty and tradeoffs, or asserts without warrant?

Return ONLY a JSON object with this exact shape. No prose, no code fences.

{"scores": {"A": {"specificity": 0, "posture": 0, "depth": 0, "actionability": 0, "honesty": 0}, "B": {"specificity": 0, "posture": 0, "depth": 0, "actionability": 0, "honesty": 0}}, "totals": {"A": 0, "B": 0}, "justifications": {"specificity": "...", "posture": "...", "depth": "...", "actionability": "...", "honesty": "..."}, "verdict": "A | B | tie", "verdict_reason": "one sentence"}

Be willing to return "tie" when responses are substantively equivalent."""


def generate_baseline(prompt):
    data = http_post(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
        {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": BASELINE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.0,
        },
    )
    return data["choices"][0]["message"]["content"]


def generate_augmented(prompt):
    messages = [
        {"role": "system", "content": AUGMENTED_SYSTEM},
        {"role": "user", "content": prompt},
    ]

    step1 = http_post(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
        {
            "model": "gpt-4o",
            "messages": messages,
            "tools": [LOGIC_API_TOOL],
            "tool_choice": {"type": "function", "function": {"name": "ejentum_logic_api"}},
            "temperature": 0.0,
        },
    )
    assistant_msg = step1["choices"][0]["message"]
    tool_call = assistant_msg["tool_calls"][0]
    args = json.loads(tool_call["function"]["arguments"])
    api_query = args.get("query", "")
    api_mode = args.get("mode", "reasoning")
    print(f"  [tool call] mode={api_mode}")
    print(f"  [tool call] query={api_query[:140]}...")

    injection = call_logic_api(api_query, api_mode) or "[API returned no injection]"
    print(f"  [scaffold] {len(injection)} chars")

    messages.append(assistant_msg)
    messages.append({"role": "tool", "tool_call_id": tool_call["id"], "content": injection})

    step2 = http_post(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
        {"model": "gpt-4o", "messages": messages, "temperature": 0.0},
    )
    return step2["choices"][0]["message"]["content"], api_query, api_mode, injection


def call_gemini(system, user, model="gemini-flash-latest"):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
    data = http_post(
        url,
        {"Content-Type": "application/json"},
        {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.0},
        },
    )
    return data["candidates"][0]["content"]["parts"][0]["text"]


def main():
    print("Step 1: Baseline GPT-4o (plain, temp 0)...")
    baseline = generate_baseline(MEDICAL_PROMPT)
    print(f"  {len(baseline)} chars")

    print("Step 2: GPT-4o with Ejentum scaffold (production tool-call pattern)...")
    augmented, query, mode, injection = generate_augmented(MEDICAL_PROMPT)
    print(f"  {len(augmented)} chars")

    print("Step 3: Blind Gemini Flash evaluator (temp 0)...")
    eval_input = f"USER PROMPT:\n{MEDICAL_PROMPT}\n\nRESPONSE A:\n{baseline}\n\nRESPONSE B:\n{augmented}"
    raw = call_gemini(EVALUATOR_SYSTEM, eval_input)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0]
    cleaned = cleaned.strip().lstrip("json").strip()
    verdict = json.loads(cleaned)

    # Save all outputs to ./outputs/ so a replicator doesn't overwrite the reference artifacts
    out = ROOT / "outputs"
    out.mkdir(exist_ok=True)
    (out / "response_baseline.md").write_text(encoding="utf-8", data="# Baseline GPT-4o\n\n" + baseline)
    (out / "response_ejentum.md").write_text(encoding="utf-8", data="# GPT-4o with Ejentum Reasoning Scaffold\n\n" + augmented)
    (out / "scaffold.md").write_text(encoding="utf-8", data=f"# Live Ejentum Scaffold (mode={mode})\n\n**Agent-crafted query:**\n{query}\n\n**API response:**\n\n```\n{injection}\n```\n")
    (out / "verdict.json").write_text(encoding="utf-8", data=json.dumps(verdict, indent=2))

    print(f"\n--- Verdict: {verdict['verdict']}  A={verdict['totals']['A']}  B={verdict['totals']['B']} ---")
    print(f"Reason: {verdict['verdict_reason']}")
    print(f"\nOutputs written to: {out}")


if __name__ == "__main__":
    main()

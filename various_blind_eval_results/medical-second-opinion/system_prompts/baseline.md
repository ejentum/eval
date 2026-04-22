# System Prompt: Agent A (Baseline)

This is the full system prompt given to the baseline GPT-4o agent. No tools attached. Temperature 0.

```
You are a helpful assistant. Respond to the user's message with honest,
thoughtful advice. Be direct. If the user's assumptions or decisions are
problematic, say so clearly rather than avoiding the issue.
```

That is the entire system prompt. Nothing else.

Notice: this is a **directive** baseline, not a weak one. It explicitly tells the model to be honest, direct, and to challenge problematic assumptions. This prevents the common unfair-comparison pattern where baseline gets "you are a helpful assistant" (permissive default) while the augmented version gets detailed instructions. Both agents here have equally strong baseline instructions. The only additive difference is the scaffold access on Agent B.

# Prompt suggestions

Evaluates the production suggestion generator against synthetic coding conversations: unfinished tasks, completed requests, explicit restrictions, ambiguous questions, errors, and Hebrew. No user transcripts are included.

Run from `evals/` with an authenticated Claude Code or Codex CLI:

```sh
pnpm prompt-suggestions --provider claude --model claude-haiku-4-5 --out runs/suggestions
```

Use `--case remaining-tests --samples 1` for setup, `--samples 3` for repeated evaluation, and `--baseline runs/previous/results.json` to retain earlier outputs for comparison. Model IDs follow the local CLI's catalog. Start with its cheapest suitable model. Each sample is one real text-generation operation charged to that CLI's configured account; the runner does not expose token costs.

The runner imports the production prompt, context builder, normalization, and provider runner. It records outputs and latency. Score `review.json` before opening `results.json` or `answer-key.json`; baseline comparisons randomize A/B and hide which output is new. Review suggestions against each rubric; merely producing text is not a quality pass. A case fails if at least half its samples violate the rubric. Add cases to `cases.ts`, with a source and expected behavior.

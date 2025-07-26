### [Decision 1]: Increase creativity of image prompt generator
**Timestamp (UTC):** 2025-07-22T12:20:00Z
**Scope:** src/app/api/generate-prompt/route.ts
**Change Summary:** Reworked LLM prompt and parameters: new "PromptSmith" system persona, expanded word count (20–35), removed punctuation stop tokens, raised temperature/top_p to encourage variation, banned artist names and camera brands.
**Rationale:** Users reported prompts felt bland and repetitive due to early truncation and conservative sampling. Removing stop tokens and widening creative constraints yields richer, less deterministic prompts.
**Alternatives Considered:**
  - Keep current stop tokens but use multiple sentences — still risk truncation.
  - Generate prompts client-side with curated list — limits novelty.
**Trade-offs / Risks:**
  - Slightly longer responses could exceed 35 words; front-end will still accept up to 2000.
  - Higher temperature may occasionally produce less coherent outputs.
**Follow-ups / TODOs:**
  - Add profanity check before returning prompt.
  - Consider exposing style/theme seed from UI.
**Source Prompt(s):** the image prompts are too bland and deterministic 